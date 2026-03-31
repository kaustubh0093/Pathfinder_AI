import re
import json
import logging
import asyncio
import threading
from typing import List, Optional

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel

from backend.ai.services.ai_service import (
    initialize_llm_and_tools,
    create_agent_with_tools,
    generate_career_insights,
    generate_market_analysis,
    generate_college_recommendations,
    generate_resume_feedback,
    search_jobs,
)
from backend.ai.data.career_data import CAREER_CATEGORIES
from backend.ai.utils.text_utils import as_markdown
from backend.ai.utils.file_utils import extract_text_from_bytes
from backend.config import Config

router = APIRouter()
logger = logging.getLogger(__name__)

# Global LLM/Agent cache — initialized on first request
_llm = None
_agent = None
_search_func = None
_ai_init_lock = threading.Lock()


def get_ai_components():
    global _llm, _agent, _search_func
    if _llm is None:
        with _ai_init_lock:
            if _llm is None:
                if not Config.GROQ_API_KEY:
                    logger.error("GROQ_API_KEY is missing")
                    return None, None, None
                if not Config.SERPAPI_KEY:
                    logger.error("SERPAPI_KEY is missing")
                    return None, None, None
                tmp_llm, tools = initialize_llm_and_tools(Config.GROQ_API_KEY, Config.SERPAPI_KEY)
                if not tmp_llm or not tools:
                    logger.error("LLM initialization returned no LLM or empty tools list")
                    return None, None, None
                _search_func = tools[0].func
                _agent = create_agent_with_tools(tmp_llm, tools)
                _llm = tmp_llm
    return _llm, _agent, _search_func


# ── Helpers ──────────────────────────────────────────────────────────────────

_INSIGHTS_RE = re.compile(r'<!--\s*INSIGHTS_DATA\s*([\s\S]*?)\s*-->', re.MULTILINE)
_CHART_RE = re.compile(r'<!--\s*CHART_DATA\s*([\s\S]*?)\s*-->', re.MULTILINE)

# Fallback: LLM writes data as labelled markdown code blocks instead of HTML comments
_INSIGHTS_BLOCK_RE = re.compile(
    r'\*{0,2}INSIGHTS_DATA\*{0,2}[^\n]*\n```(?:json)?\n([\s\S]*?)\n```',
    re.MULTILINE,
)
_CHART_BLOCK_RE = re.compile(
    r'\*{0,2}(?:Updated\s+)?(?:\w+\s+)?Chart\s+Data\*{0,2}[^\n]*\n```(?:json)?\n([\s\S]*?)\n```',
    re.MULTILINE | re.IGNORECASE,
)


def _json_span(text: str, start: int) -> int | None:
    """Return the index one past the closing '}' for the JSON object opening at `start`."""
    depth = 0
    in_str = False
    esc = False
    for i in range(start, len(text)):
        c = text[i]
        if esc:
            esc = False
            continue
        if c == '\\' and in_str:
            esc = True
            continue
        if c == '"':
            in_str = not in_str
            continue
        if in_str:
            continue
        if c == '{':
            depth += 1
        elif c == '}':
            depth -= 1
            if depth == 0:
                return i + 1
    return None


def _extract_bare_json(markdown: str, required_key: str) -> dict | None:
    """Find and parse the first JSON object that contains required_key as a top-level key."""
    for m in re.finditer(r'\{', markdown):
        end = _json_span(markdown, m.start())
        if end is None:
            continue
        try:
            obj = json.loads(markdown[m.start():end])
            if required_key in obj:
                return obj
        except Exception:
            continue
    return None


def _remove_bare_json(markdown: str, required_key: str, extra_check=None) -> str:
    """Remove all JSON objects that contain required_key as a top-level key."""
    while True:
        removed = False
        for m in re.finditer(r'\{', markdown):
            end = _json_span(markdown, m.start())
            if end is None:
                continue
            try:
                obj = json.loads(markdown[m.start():end])
                if required_key in obj and (extra_check is None or extra_check(obj)):
                    markdown = markdown[:m.start()] + markdown[end:]
                    removed = True
                    break
            except Exception:
                continue
        if not removed:
            break
    return markdown


def _extract_insights(markdown: str) -> dict | None:
    for pattern in (_INSIGHTS_RE, _INSIGHTS_BLOCK_RE):
        match = pattern.search(markdown)
        if match:
            try:
                return json.loads(match.group(1).strip())
            except Exception:
                continue
    # Fallback: LLM output bare JSON without comment/code-block wrappers
    return _extract_bare_json(markdown, 'skills')


def _extract_chart(markdown: str) -> dict | None:
    for pattern in (_CHART_RE, _CHART_BLOCK_RE):
        match = pattern.search(markdown)
        if match:
            try:
                return json.loads(match.group(1).strip())
            except Exception:
                continue
    # Fallback: bare JSON with type=radar/bar
    obj = _extract_bare_json(markdown, 'type')
    if obj and obj.get('type') in ('radar', 'bar'):
        return obj
    return None


def _strip_data_comments(markdown: str) -> str:
    # Strip HTML comment format
    markdown = _INSIGHTS_RE.sub('', markdown)
    markdown = _CHART_RE.sub('', markdown)
    # Strip labelled code-block format (LLM fallback)
    markdown = _INSIGHTS_BLOCK_RE.sub('', markdown)
    markdown = _CHART_BLOCK_RE.sub('', markdown)
    # Strip any stray JSON code blocks whose first key is a known data field
    markdown = re.sub(
        r'```(?:json)?\s*\n?\s*\{\s*"(?:skills|salary|roadmap|careerLadder|type)[\s\S]*?\n?```',
        '', markdown,
    )
    # Strip bare JSON objects the LLM emitted without any wrapper
    markdown = _remove_bare_json(markdown, 'skills')
    markdown = _remove_bare_json(markdown, 'type', lambda obj: obj.get('type') in ('radar', 'bar'))
    return markdown.strip()


# ── Pydantic request models ───────────────────────────────────────────────────

class CareerInsightRequest(BaseModel):
    category: str
    subcareer: str


class MarketRequest(BaseModel):
    subcareer: str


class CollegeRequest(BaseModel):
    subcareer: str
    location: Optional[str] = None
    district: Optional[str] = None


class ChatRequest(BaseModel):
    message: str
    history: List[dict] = []


class JobRequest(BaseModel):
    role: str
    location: str = "India"


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/careers", summary="Get all career categories and roles")
async def get_careers():
    return CAREER_CATEGORIES


@router.post("/career-insights", summary="Generate career roadmap & analysis")
async def career_insights(req: CareerInsightRequest):
    llm, _, _sf = get_ai_components()
    if not llm:
        raise HTTPException(status_code=500, detail="LLM not initialized. Check API keys.")
    result = await asyncio.to_thread(generate_career_insights, req.category, req.subcareer, llm)
    raw = as_markdown(result)
    insights = _extract_insights(raw)
    chart_data = _extract_chart(raw)
    clean = _strip_data_comments(raw)
    return {"result": clean, "chartData": chart_data, "insights": insights}


@router.post("/market-analysis", summary="Live job market analysis — returns insights for bento grid")
async def market_analysis(req: MarketRequest):
    llm, _, search_func = get_ai_components()
    if not llm:
        raise HTTPException(status_code=500, detail="LLM not initialized. Check API keys.")
    if not search_func:
        raise HTTPException(status_code=500, detail="Search function not initialized.")
    result = await asyncio.to_thread(generate_market_analysis, req.subcareer, llm, search_func)
    raw = as_markdown(result)
    insights = _extract_insights(raw)
    chart_data = _extract_chart(raw)
    clean = _strip_data_comments(raw)
    return {"result": clean, "chartData": chart_data, "insights": insights}


@router.post("/college-recommendations", summary="Top Indian college recommendations")
async def college_recommendations(req: CollegeRequest):
    llm, _, _sf = get_ai_components()
    if not llm:
        raise HTTPException(status_code=500, detail="LLM not initialized. Check API keys.")
    result = await asyncio.to_thread(generate_college_recommendations, req.subcareer, llm, req.location, req.district)
    raw = as_markdown(result)
    chart_data = _extract_chart(raw)
    clean = _strip_data_comments(raw)
    return {"result": clean, "chartData": chart_data}


@router.post("/resume-analysis", summary="AI resume coach & ATS feedback")
async def resume_analysis(
    resume_text: str = Form(default=""),
    target_role: str = Form(default=""),
    file: Optional[UploadFile] = File(default=None),
):
    if file and file.filename:
        content = await file.read()
        resume_text = extract_text_from_bytes(content, file.filename)

    if not resume_text.strip():
        raise HTTPException(status_code=400, detail="No resume content provided.")

    llm, _, _sf = get_ai_components()
    if not llm:
        raise HTTPException(status_code=500, detail="LLM not initialized. Check API keys.")

    result = await asyncio.to_thread(generate_resume_feedback, resume_text, target_role, llm)
    return {"result": as_markdown(result)}


@router.post("/chat", summary="Interactive AI career advisor chat")
async def chat(req: ChatRequest):
    llm, _, _ = get_ai_components()
    if not llm:
        raise HTTPException(status_code=500, detail="AI components not initialized. Check API keys.")
    try:
        system_prompt = (
            "You are an expert AI career advisor specializing in the Indian job market. "
            "You help users with career guidance, skill planning, interview preparation, "
            "resume advice, salary negotiation, and career transitions. "
            "Be concise, actionable, and realistic. Use bullet points where helpful. "
            "Always tailor advice to the Indian job market context."
        )

        if req.history:
            history_lines = "\n".join(
                f"{'User' if m.get('role') == 'human' else 'Assistant'}: {m.get('content', '')}"
                for m in req.history[-6:]
            )
            full_input = f"{system_prompt}\n\nConversation history:\n{history_lines}\n\nUser: {req.message}"
        else:
            full_input = f"{system_prompt}\n\nUser: {req.message}"

        response = await asyncio.to_thread(llm.invoke, full_input)
        answer = response.content if hasattr(response, "content") else str(response)
        return {"answer": as_markdown(answer)}
    except Exception as e:
        logger.error(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/jobs", summary="Find live job & internship listings")
async def find_jobs(req: JobRequest):
    if not req.role:
        raise HTTPException(status_code=400, detail="Role is required.")
    try:
        jobs = await asyncio.to_thread(search_jobs, req.role, req.location, Config.SERPAPI_KEY)
        logger.info(f"Found {len(jobs)} jobs for '{req.role}'")
        return jobs
    except Exception as e:
        logger.error(f"Job search error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
