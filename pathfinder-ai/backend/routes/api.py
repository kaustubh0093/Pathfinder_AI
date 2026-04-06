import logging
import asyncio
import threading
from typing import List, Optional

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

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


# ── Chat chain (module-level so it's built once) ─────────────────────────────

_CHAT_SYSTEM_PROMPT = (
    "You are an expert AI career advisor specializing in the Indian job market. "
    "You help users with career guidance, skill planning, interview preparation, "
    "resume advice, salary negotiation, and career transitions. "
    "Be concise, actionable, and realistic. Use bullet points where helpful. "
    "Always tailor advice to the Indian job market context."
)

_chat_prompt = ChatPromptTemplate.from_messages([
    ("system", "{system}"),
    ("human", "{input}"),
])
_chat_chain = _chat_prompt | StrOutputParser()  # llm bound at call time via pipe


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/careers", summary="Get all career categories and roles")
async def get_careers():
    return CAREER_CATEGORIES


@router.post("/career-insights", summary="Generate career roadmap & analysis")
async def career_insights(req: CareerInsightRequest):
    llm, _, _ = get_ai_components()
    if not llm:
        raise HTTPException(status_code=500, detail="LLM not initialized. Check API keys.")

    markdown, insights, chart_data = await asyncio.to_thread(
        generate_career_insights, req.category, req.subcareer, llm
    )
    return {
        "result": as_markdown(markdown),
        "chartData": chart_data,
        "insights": insights,
    }


@router.post("/market-analysis", summary="Live job market analysis — returns insights for bento grid")
async def market_analysis(req: MarketRequest):
    llm, _, search_func = get_ai_components()
    if not llm:
        raise HTTPException(status_code=500, detail="LLM not initialized. Check API keys.")
    if not search_func:
        raise HTTPException(status_code=500, detail="Search function not initialized.")

    markdown, insights, chart_data = await asyncio.to_thread(
        generate_market_analysis, req.subcareer, llm, search_func
    )
    return {
        "result": as_markdown(markdown),
        "chartData": chart_data,
        "insights": insights,
    }


@router.post("/college-recommendations", summary="Top Indian college recommendations")
async def college_recommendations(req: CollegeRequest):
    llm, _, _ = get_ai_components()
    if not llm:
        raise HTTPException(status_code=500, detail="LLM not initialized. Check API keys.")

    markdown, chart_data = await asyncio.to_thread(
        generate_college_recommendations, req.subcareer, llm, req.location, req.district
    )
    return {
        "result": as_markdown(markdown),
        "chartData": chart_data,
    }


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

    llm, _, _ = get_ai_components()
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
        if req.history:
            history_lines = "\n".join(
                f"{'User' if m.get('role') == 'human' else 'Assistant'}: {m.get('content', '')}"
                for m in req.history[-6:]
            )
            user_input = f"Conversation history:\n{history_lines}\n\nUser: {req.message}"
        else:
            user_input = req.message

        chain = _chat_prompt | llm | StrOutputParser()
        answer = await asyncio.to_thread(
            chain.invoke,
            {"system": _CHAT_SYSTEM_PROMPT, "input": user_input},
        )
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
