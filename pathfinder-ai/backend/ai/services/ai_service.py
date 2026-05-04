import json
import re
import logging
from concurrent.futures import ThreadPoolExecutor
from typing import List, Tuple, Optional, Any, Type

from pydantic import BaseModel
from langchain_groq import ChatGroq
from langchain_community.utilities import SerpAPIWrapper
from langchain_community.tools import Tool
from langchain_core.prompts import ChatPromptTemplate, PromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain.agents import AgentExecutor, create_react_agent
from serpapi import GoogleSearch

from backend.ai.models.output_models import (
    CareerInsightsFullData,
    MarketAnalysisFullData,
    ChartData,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MAX_RESUME_CHARS = 15_000
MAX_LIVE_DATA_CHARS = 4_000  # cap ResearchAgent output before injecting into prompts
_UNSAFE_RE = re.compile(r'[\x00-\x1f\x7f<>{}\[\]\\^`|~]')

_DEFAULT_LIVE_DATA = (
    "(no live search performed — fall back to the model's training "
    "knowledge of the Indian job market)"
)

# When the AgentExecutor force-stops on iteration limit, LangChain returns this
# literal string as the agent's `output`. We detect it so we don't pipe a useless
# stub into the downstream Content/Data prompts as if it were live findings.
_AGENT_STOPPED_PREFIXES = (
    "Agent stopped due to iteration limit",
    "Agent stopped due to time limit",
)

# Inlined ReAct prompt. Avoids the network call to LangChain Hub at startup
# and keeps the agent's contract visible in this file for the demo.
_REACT_PROMPT_TEMPLATE = """Answer the following question as best you can. You have access to the following tools:

{tools}

Use this format EXACTLY:

Question: the input question you must answer
Thought: think about what to do next
Action: the action to take, must be one of [{tool_names}]
Action Input: the input to the action
Observation: the result of the action
... (Thought / Action / Action Input / Observation may repeat at most 3 times)
Thought: I now know the final answer
Final Answer: a concise factual summary answering the question

Begin!

Question: {input}
Thought:{agent_scratchpad}"""


# ── Sanitizers ────────────────────────────────────────────────────────────────

def _sanitize_input(value: str, max_len: int = 200) -> str:
    """Strip control chars and length-cap user-controlled text before prompt interpolation."""
    if not isinstance(value, str):
        value = str(value)
    return _UNSAFE_RE.sub('', value.strip()[:max_len])


def _scrub_pii(text: str) -> str:
    """Redact obvious PII (emails, phone numbers, pincodes) before sending to the LLM."""
    text = re.sub(r'[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}', '[EMAIL]', text)
    text = re.sub(r'(\+91[-\s]?)?[6-9]\d{9}', '[PHONE]', text)
    text = re.sub(r'\b\d{6}\b', '[PINCODE]', text)
    return text


# ── LLM + ResearchAgent setup ─────────────────────────────────────────────────

def initialize_llm_and_tools(
    groq_api_key: str, serpapi_key: str
) -> Tuple[Optional[ChatGroq], Optional[List[Tool]]]:
    """Build the shared Groq LLM and the `web_search` tool used by the ResearchAgent."""
    try:
        if not groq_api_key:
            raise ValueError("Groq API key is required.")
        if not serpapi_key:
            raise ValueError("SerpAPI key is required.")


        # when ReAct asks for plain-text "Action:" lines. Groq then rejects
        # the request with "Tool choice is none, but model called a tool".
        # Llama 3.3 follows ReAct's text contract cleanly.
        llm = ChatGroq(
            model="llama-3.3-70b-versatile",
            groq_api_key=groq_api_key,
            temperature=0.1,
        )

        search = SerpAPIWrapper(
            serpapi_api_key=serpapi_key,
            params={"engine": "google", "google_domain": "google.com", "gl": "in", "hl": "en"},
        )

        # Wrap search.run so every SerpAPI hit announces itself in the log.
        # Without this the only signal a search happened is a tool-call line buried
        # inside the ReAct trace; this makes "did we just spend a SerpAPI credit?"
        # readable at a glance.
        def logged_search(query: str) -> str:
            logger.info(f"[SERPAPI] querying: {query!r}")
            return search.run(query)

        search_tool = Tool(
            name="web_search",
            description=(
                "Search the live web. Use for current Indian job market data: "
                "salary ranges, hiring companies, demand trends, in-demand skills. "
                "Input should be a focused search query string."
            ),
            func=logged_search,
        )

        return llm, [search_tool]
    except Exception as e:
        logger.error(f"Error initializing LLM/tools: {e}")
        return None, None


def create_agent_with_tools(llm: ChatGroq, tools: List[Tool]) -> Optional[AgentExecutor]:
    """Build the ResearchAgent — a ReAct executor that decides when to call `web_search`.

    `handle_parsing_errors=True` lets the agent recover from a malformed Thought/Action
    block instead of failing the whole report. `max_iterations=3` gives the agent room
    to do one search → observe → emit Final Answer. With `early_stopping_method="generate"`,
    if iterations are exhausted the executor forces one final summarization call instead
    of returning a useless "Agent stopped..." stub — so SerpAPI credits are never wasted.
    """
    try:
        prompt = PromptTemplate.from_template(_REACT_PROMPT_TEMPLATE)
        agent = create_react_agent(llm, tools, prompt)
        return AgentExecutor(
            agent=agent,
            tools=tools,
            verbose=False,
            handle_parsing_errors=True,
            max_iterations=3,
            early_stopping_method="generate",
        )
    except Exception as e:
        logger.error(f"Error creating ResearchAgent: {e}")
        return None


_RESEARCH_BRIEF = """Research the current Indian job market for the role: "{subcareer}".

Use the web_search tool EXACTLY ONCE with a single broad query that covers as many of these as possible:
- demand trend & hiring velocity
- salary ranges in INR LPA
- top hiring companies & cities
- in-demand skills

After the single search, immediately emit "Final Answer:" with a concise factual plain-text
summary (no headings, no markdown). Do NOT issue a second web_search."""


def _run_research_agent(agent_executor: Optional[AgentExecutor], subcareer: str) -> str:
    """Invoke the ResearchAgent and return text findings, or a safe fallback string."""
    if agent_executor is None:
        return _DEFAULT_LIVE_DATA
    try:
        logger.info(f"[GROQ:ReAct] ResearchAgent gathering live data for '{subcareer}' (≤{agent_executor.max_iterations} reasoning turns)")
        result = agent_executor.invoke({"input": _RESEARCH_BRIEF.format(subcareer=subcareer)})
        findings = (result.get("output") or "").strip()
        # Treat a force-stop stub as no findings — feeding "Agent stopped..." into the
        # downstream prompts as if it were live market data corrupts the report and
        # silently wastes the SerpAPI credits we just spent.
        if not findings or findings.startswith(_AGENT_STOPPED_PREFIXES):
            logger.warning(f"[GROQ:ReAct] no usable findings for '{subcareer}' (force-stop or empty) — using fallback")
            return _DEFAULT_LIVE_DATA
        logger.info(f"[GROQ:ReAct] ResearchAgent done for '{subcareer}' ({len(findings)} chars of findings)")
        return findings[:MAX_LIVE_DATA_CHARS]
    except Exception as e:
        logger.warning(f"ResearchAgent failed, falling back to model knowledge: {e}")
        return _DEFAULT_LIVE_DATA


# ── Shared Content + Data chain helper ────────────────────────────────────────

def _run_dual_chain(
    llm: ChatGroq,
    content_prompt: ChatPromptTemplate,
    data_prompt: ChatPromptTemplate,
    data_model: Type[BaseModel],
    variables: dict,
) -> Tuple[str, Optional[Any]]:
    """ContentAgent + DataAgent fired in parallel.

    1. ContentAgent  → human-readable markdown via plain string output.
    2. DataAgent     → strict Pydantic model for charts / bento grid, generated
       via Groq's native JSON mode (response_format={"type": "json_object"}).
       This replaces PydanticOutputParser + OutputFixingParser:
         • Dropped the auto-generated JSON-schema dump from the prompt
           (~1000 tokens saved per Data call) — the prompt now carries only a
           hand-written compact schema sketch.
         • Dropped the silent repair retry — Groq JSON mode forces valid JSON
           server-side, so the failure surface that needed repairing collapses.
       We still validate the parsed dict with the Pydantic model at the
       boundary so downstream code keeps its type guarantees.

    The two chains have no data dependency on each other — they read the same
    `variables` dict — so we run them on a thread pool. End-to-end latency
    becomes max(content, data) instead of content + data, saving 3-5s per request.

    Returns (markdown, parsed_pydantic_model). The data slot is None only
    if the JSON parse or Pydantic validation failed.
    """
    json_llm = llm.bind(response_format={"type": "json_object"})
    content_chain = content_prompt | llm | StrOutputParser()
    data_chain = data_prompt | json_llm | StrOutputParser()

    def _run_content():
        logger.info("[GROQ:Content] generating markdown report")
        return content_chain.invoke(variables)

    def _run_data():
        logger.info("[GROQ:Data] generating structured data (Groq JSON mode)")
        raw = data_chain.invoke(variables)
        try:
            return data_model.model_validate(json.loads(raw))
        except Exception as e:
            logger.error(f"[GROQ:Data] JSON validation failed: {e}; raw head={raw[:160]!r}")
            return None

    with ThreadPoolExecutor(max_workers=2) as pool:
        content_future = pool.submit(_run_content)
        data_future = pool.submit(_run_data)

        try:
            markdown = content_future.result()
        except Exception as e:
            logger.error(f"[GROQ:Content] ContentAgent failed: {e}")
            markdown = f"❌ Content generation failed: {e}"

        try:
            data = data_future.result()
        except Exception as e:
            logger.error(f"[GROQ:Data] DataAgent failed: {e}")
            data = None

    return markdown, data


# ── Career Insights ───────────────────────────────────────────────────────────

_CAREER_CONTENT_PROMPT = ChatPromptTemplate.from_template("""
You are an expert career development coach. Create a **personal growth blueprint** for someone building a career as a **{subcareer}** in India.

This is a CAREER DEVELOPMENT guide — focus on the individual's learning journey, skill-building path, and role progression.
Do NOT include generic market demand metrics, hiring company lists, or remote-work percentages.

Reply in this exact structure. Keep each section concise and actionable:

---

### **What This Role Is About**
- 2-3 bullet points: day-to-day responsibilities and what makes this role unique.

---

### **Core Skills to Master**
Top 5 skills, each phrased as: **Master [skill]** — [what mastering it unlocks for your career growth].
One line per skill. Frame as personal capability gains, not job-posting frequency.

---

### **Your Learning Roadmap**
3 stages — what to DO at each stage, not just titles:
- **Stage 1 – Build Foundations**: Specific courses, tools, and mini-projects to start.
- **Stage 2 – Gain Real Experience**: Freelance work, open-source, internships, certifications to earn.
- **Stage 3 – Lead & Specialize**: Niche to own, leadership responsibilities, advanced certifications.

---

### **Career Progression Path**
3–4 role levels with typical responsibilities at each level (brief salary range as reference only):

---

### **Growth Outlook**
2 lines: how this role is evolving in India and what specializations are emerging.

---

### **Top 3 Learning Resources**
Specific course / certification / book name with platform — one line each.

---

No fluff. Be specific to the Indian context. Output ONLY the markdown above — no JSON, no code blocks.
""")

_CAREER_DATA_PROMPT = ChatPromptTemplate.from_template("""
You are a career data assistant for the Indian job market.
For the role "{subcareer}" in India, return ONLY a JSON object with this exact shape:

{{
  "insights": {{
    "skills":       [{{"name": "<skill>", "score": <0-100 int>}}, ... 5 items],
    "roadmap":      [{{"stage": "<title>", "desc": "<1 line>", "icon": "<school|trending_up|star>"}}, ... 3 items],
    "careerLadder": [{{"role": "<title>", "salary": "<INR LPA range>", "badge": "<Entry|Mid|Senior|Lead>"}}, ... 3-4 items],
    "outlook":      "<1-2 sentences on India-specific growth>",
    "resources":    ["<course/cert/book + platform>", ... 3 items]
  }},
  "chart": {{
    "type":   "radar",
    "labels": ["Technical Skills", "Soft Skills", "Domain Knowledge", "Tools", "Leadership", "Communication"],
    "data":   [<6 integers 0-100, importance weights for {subcareer}>],
    "label":  "Skill Importance Profile (0-100)"
  }}
}}

Constraints:
- skills.score: 0-100 importance/demand weight
- roadmap.icon: must be one of "school", "trending_up", "star"
- careerLadder.badge: must be Entry/Mid/Senior/Lead, with realistic INR LPA salary ranges
- Output ONLY the JSON object — no markdown fences, no commentary.
""")


def generate_career_insights(
    category: str, subcareer: str, llm: ChatGroq
) -> Tuple[str, Optional[dict], Optional[dict]]:
    """ContentAgent + DataAgent. No live research needed — this is a learning roadmap."""
    try:
        if llm is None:
            raise RuntimeError("LLM not initialized")

        safe_category = _sanitize_input(category)
        safe_subcareer = _sanitize_input(subcareer)
        logger.info(f"[CAREER-INSIGHTS] start for {safe_subcareer!r} (no SerpAPI; pure model knowledge)")

        markdown, data = _run_dual_chain(
            llm,
            _CAREER_CONTENT_PROMPT,
            _CAREER_DATA_PROMPT,
            CareerInsightsFullData,
            {"subcareer": safe_subcareer, "category": safe_category},
        )
        if data is None:
            return markdown, None, None
        return markdown, data.insights.model_dump(), data.chart.model_dump()

    except Exception as e:
        logger.error(f"Error generating career insights: {e}")
        return f"❌ Unable to generate career insights. Error: {e}", None, None


# ── Market Analysis ───────────────────────────────────────────────────────────

_MARKET_CONTENT_PROMPT = ChatPromptTemplate.from_template("""
You are an expert Market Intelligence Analyst for the Indian job market.
Using the live data below, produce a **data-driven hiring market report** for "{subcareer}" in India.

RAW LIVE DATA:
{live_data}

This is a MARKET INTELLIGENCE report — focus on what employers are doing, what the market signals are, and whether this is a good time to be in this field.
Do NOT include personal learning roadmaps or course recommendations.

Reply in this EXACT structure. Keep each section to 3-5 bullet points max. Be data-driven and realistic for India.

---

### **Market Demand Signal**
- Current demand level: High / Medium / Low — and why
- Which industries are driving the most hiring right now
- Hiring velocity: growing / stable / declining (with evidence)
- Volume of active job postings (estimated)

---

### **Salary Context**
The bento card above already shows the actual INR LPA ranges. In this section, focus on:
- How this role's salary compares to 1-2 adjacent careers (e.g. vs Data Analyst, vs Backend Engineer)
- Salary growth trajectory over the past 2 years (% increase, what drove it)
- Which sectors / company sizes pay above the median band
Do NOT repeat the entry/mid/senior/lead numbers as a table.

---

### **What Employers Are Hiring For Right Now**
- Top 6 skills, each as: **[Skill]** — appears in ~X% of postings (estimated frequency in active listings)
- Critical skills gap: what most candidates lack that employers want
- Tools / platforms with the highest hiring signal in 2024-2025
Frame everything as employer demand signals, not learning recommendations.

---

### **Top Hiring Companies**
- 5-6 companies actively hiring for this role + what makes their offers competitive

---

### **Geographic Hiring Hubs & Remote**
- Top 4-5 cities with highest job concentration
- % of roles that are remote or hybrid
- Emerging secondary markets

---

### **Competitive Landscape**
- Competition level (High / Medium / Low) and candidate supply vs demand
- Profile of candidates who are winning offers right now
- Key differentiators that get shortlisted

---

### **Market Risk Factors**
- Automation / AI displacement risk for this role
- Industry concentration risk (too dependent on one sector?)
- Saturation signals in the talent pool

---

### **Opportunity Signals**
- Under-served niches where demand exceeds supply
- Freelance / contract / startup opportunities
- New sectors beginning to hire for this role

---

### **Investment vs Return**
- Estimated time to reach Mid-level from zero
- Earning potential in 5 years vs other career switches
- Overall market verdict: **Strong Entry / Selective / Avoid**

---

Output ONLY the markdown above — no JSON, no code blocks.
""")

_MARKET_DATA_PROMPT = ChatPromptTemplate.from_template("""
You are a market data assistant for the Indian job market.
Using the live data below, return ONLY a JSON object with this exact shape for "{subcareer}" in India.

RAW LIVE DATA:
{live_data}

JSON shape:
{{
  "insights": {{
    "salary": {{
      "entry":  "<INR LPA range>",
      "median": "<INR LPA range>",
      "senior": "<INR LPA range>",
      "top":    "<INR LPA range>"
    }},
    "growth":        "<e.g. +18%>",
    "confidence":    <0-100 int>,
    "skills":        ["<skill>", ... 6 items],
    "locations":     [{{"city": "<city>", "pct": <int>}}, ... 3 items, pct sums to ≤100],
    "remotePercent": <int 0-100>,
    "trajectory":    [<7 integers 0-100, demand trend from 6 months ago to now>]
  }},
  "chart": {{
    "type":   "bar",
    "labels": ["Entry Level", "Mid Level", "Senior Level", "Lead/Architect"],
    "data":   [<4 realistic average LPA integers for each level>],
    "unit":   "LPA (INR)",
    "label":  "Avg Salary Range (LPA)"
  }}
}}

Constraints:
- insights.growth: projected 12-month demand growth signed string (e.g. "+18%")
- insights.skills: top 6 skills most requested in active job postings RIGHT NOW
- insights.locations: top 3 Indian cities with % share of job postings
- Output ONLY the JSON object — no markdown fences, no commentary.
""")


def generate_market_analysis(
    subcareer: str,
    llm: ChatGroq,
    research_agent: Optional[AgentExecutor] = None,
) -> Tuple[str, Optional[dict], Optional[dict]]:
    """Full multi-agent pipeline:  ResearchAgent → ContentAgent + DataAgent.

    The ResearchAgent decides whether to issue web searches and how many;
    its findings are injected as `live_data` into both downstream chains.
    If the ResearchAgent is unavailable or fails, the report falls back
    to the model's training knowledge.
    """
    try:
        if llm is None:
            raise RuntimeError("LLM not initialized")

        safe_subcareer = _sanitize_input(subcareer)
        logger.info(f"[MARKET-ANALYSIS] start for {safe_subcareer!r} (ResearchAgent → Content → Data)")

        live_data = _run_research_agent(research_agent, safe_subcareer)

        markdown, data = _run_dual_chain(
            llm,
            _MARKET_CONTENT_PROMPT,
            _MARKET_DATA_PROMPT,
            MarketAnalysisFullData,
            {"subcareer": safe_subcareer, "live_data": live_data},
        )
        if data is None:
            return markdown, None, None
        return markdown, data.insights.model_dump(), data.chart.model_dump()

    except Exception as e:
        logger.error(f"Error generating market analysis: {e}")
        return f"❌ Unable to fetch market analysis. Error: {e}", None, None


# ── College Recommendations ───────────────────────────────────────────────────

_COLLEGE_CONTENT_PROMPT = ChatPromptTemplate.from_template("""
You are an expert education and placement analyst for India.

Generate a **highly accurate college recommendation report** for:
Career Path: **{subcareer}**
Location Context: **{location_context}**

{scope_line}

Strictly follow the output format below. Be specific, data-driven, and realistic.

---

### **Output Format (MANDATORY)**

## Top College Recommendations

Markdown Table with EXACT columns:
| College | City | Tier | Course | Duration | Fees (₹/yr) | Avg Package (LPA) | Top Recruiters | Admission |

#### Constraints:
- 10-12 colleges
- Prioritize relevance to "{subcareer}" (placements + specialization)
- Tier: Premier / State Govt / Private
- Course: specific degree name (e.g., B.Tech CSE, MBA, BCA)
- Duration: e.g., 4 yrs, 2 yrs
- Fees: compact format (e.g., 50K, 1.5L, 2-3L)
- Avg Package: realistic Indian data (e.g., 6, 8-12)
- Top Recruiters: 2-3 real companies that hire from that college for this role
- Admission: exam or mode (e.g., JEE Main, CAT, MHT-CET, Direct)
- Mix Premier / State Govt / Private tiers

---

## Entrance Exams to Target

List 4-5 relevant entrance exams with a one-line description of what each tests or leads to.

---

## Key Certifications to Pursue Alongside Degree

List 3-4 certifications that significantly improve placement chances for "{subcareer}". Include the issuing body.

---

## Placement Maximization Tips

5 specific, actionable tips to maximize placement chances for "{subcareer}" — internships, projects, competitive platforms, networking, etc.

---

## Salary Outlook After Graduation

One short paragraph on realistic starting salary range, growth trajectory, and which cities/companies pay the most for "{subcareer}" freshers.

---

Output ONLY the markdown above — no JSON, no code blocks, no extra commentary.
""")

_COLLEGE_CHART_PROMPT = ChatPromptTemplate.from_template("""
You are a placement data assistant for Indian colleges.
For the career path "{subcareer}", return ONLY a JSON object with this exact shape:

{{
  "type":   "bar",
  "labels": ["Premier/IIT/NIT", "Top Private", "State Govt", "Mid Private", "Diploma/Cert"],
  "data":   [<5 realistic LPA integers for {subcareer} graduates, one per tier in order above>],
  "unit":   "LPA",
  "label":  "Avg Placement Package (LPA)"
}}

Output ONLY the JSON object — no markdown fences, no commentary.
""")


def generate_college_recommendations(
    subcareer: str,
    llm: ChatGroq,
    location: Optional[str] = None,
    district: Optional[str] = None,
) -> Tuple[str, Optional[dict]]:
    """ContentAgent + DataAgent. The DataAgent only emits a single ChartData payload."""
    try:
        if llm is None:
            raise RuntimeError("LLM not initialized")

        safe_subcareer = _sanitize_input(subcareer)
        safe_location = _sanitize_input(location) if location else None
        safe_district = _sanitize_input(district) if district else None

        if safe_district and safe_location:
            scope_line = (
                f'Only list colleges in or near the district of {safe_district}, '
                f'{safe_location}. Do not list colleges from other districts or regions.'
            )
            location_context = f'in {safe_district}, {safe_location}'
        elif safe_district:
            scope_line = (
                f'Only list colleges in or near the district of {safe_district}. '
                f'Do not list colleges from other districts.'
            )
            location_context = f'in {safe_district} district'
        elif safe_location:
            scope_line = (
                f'Only list colleges in or near {safe_location}. '
                f'Do not list colleges from other regions.'
            )
            location_context = f'in {safe_location}'
        else:
            scope_line = 'Include IITs, NITs, and top state/private colleges across India.'
            location_context = 'in India'

        logger.info(f"[COLLEGE-RECS] start for {safe_subcareer!r} {location_context} (no SerpAPI; pure model knowledge)")

        markdown, chart = _run_dual_chain(
            llm,
            _COLLEGE_CONTENT_PROMPT,
            _COLLEGE_CHART_PROMPT,
            ChartData,
            {
                "subcareer": safe_subcareer,
                "location_context": location_context,
                "scope_line": scope_line,
            },
        )
        return markdown, (chart.model_dump() if chart is not None else None)

    except Exception as e:
        logger.error(f"Error generating college recommendations: {e}")
        return f"❌ Unable to generate college recommendations. Error: {e}", None


# ── Resume Feedback ───────────────────────────────────────────────────────────

_RESUME_PROMPT = ChatPromptTemplate.from_template(
    """As an expert resume coach, analyze the following resume for the target role: "{target_role}"

**Resume Content**:
{resume_text}{truncation_notice}

Provide comprehensive feedback in the following structure:

1) **Overall Assessment** (Score: X/10):
   - Brief summary of strengths and weaknesses
   - First impression rating

2) **Content Analysis**:
   - Relevance to target role
   - Key achievements and quantifiable results
   - Skills alignment with job requirements
   - Missing critical information

3) **Format & Structure**:
   - Layout and readability assessment
   - Section organization
   - Length appropriateness

4) **Specific Improvements Needed**:
   - What to add (skills, experiences, keywords)
   - What to remove or reduce
   - How to rephrase key sections
   - ATS optimization tips

5) **Section-by-Section Feedback**:
   - Summary/Objective
   - Work Experience
   - Education
   - Skills
   - Projects/Certifications

6) **Action Items** (Priority-ordered):
   - Top 5-7 changes to make immediately
   - Keywords to include for ATS
   - Formatting improvements

7) **Example Improvements**:
   - Before/After examples for 2-3 bullet points
   - Better ways to phrase achievements

8) **Industry-Specific Tips**:
   - Tailored advice for the Indian job market
   - Cultural considerations for Indian recruiters

Be constructive, specific, and actionable. Use markdown formatting with clear sections.
"""
)


def generate_resume_feedback(
    resume_text: str,
    target_role: str,
    llm: ChatGroq,
    scrub_pii: bool = True,
) -> str:
    """Single-agent ContentAgent. PII (emails, phones, pincodes) is scrubbed by default
    before the resume is sent to the external LLM.
    """
    try:
        if llm is None:
            raise RuntimeError("LLM not initialized")

        truncation_notice = ""
        if len(resume_text) > MAX_RESUME_CHARS:
            resume_text = resume_text[:MAX_RESUME_CHARS]
            truncation_notice = (
                f"\n\n[Note: Resume was truncated to {MAX_RESUME_CHARS} characters for processing.]"
            )

        if scrub_pii:
            resume_text = _scrub_pii(resume_text)

        safe_role = _sanitize_input(target_role)
        chain = _RESUME_PROMPT | llm | StrOutputParser()

        logger.info(f"[GROQ:Resume] analyzing resume for {safe_role!r} (PII scrubbing={'on' if scrub_pii else 'off'})")
        return chain.invoke({
            "target_role": safe_role,
            "resume_text": resume_text,
            "truncation_notice": truncation_notice,
        })

    except Exception as e:
        logger.error(f"Error generating resume feedback: {e}")
        return f"❌ Unable to analyze resume. Error: {e}"


# ── Job Search ────────────────────────────────────────────────────────────────

def search_jobs(role: str, location: str = "India", api_key: Optional[str] = None) -> List[dict]:
    """Live job listings via SerpAPI's google_jobs engine. Not part of the agent
    pipeline — called directly by the /jobs endpoint."""
    try:
        if not api_key:
            logger.error("SerpAPI key is missing in search_jobs")
            return []

        all_jobs: List[dict] = []
        seen_keys: set = set()
        search_terms = [
            f"{role} jobs in {location}",
            f"{role} openings {location}",
            f"{role} internships {location}",
        ]

        for query_text in search_terms:
            if len(all_jobs) >= 10:
                break

            params = {
                "engine": "google_jobs",
                "q": query_text,
                "hl": "en",
                "gl": "in",
                "api_key": api_key,
            }

            logger.info(f"[SERPAPI:google_jobs] querying: {query_text!r}")
            try:
                results = GoogleSearch(params).get_dict()

                if "error" in results:
                    logger.error(f"[SERPAPI:google_jobs] error for {query_text!r}: {results['error']}")
                    continue

                page_results = results.get("jobs_results") or []
                if not page_results:
                    logger.warning(f"[SERPAPI:google_jobs] empty results for: {query_text!r}")
                    continue

                logger.info(f"[SERPAPI:google_jobs] got {len(page_results)} results for {query_text!r}")
                for job in page_results:
                    title = (job.get("title") or "Unknown Role").strip()
                    company = (job.get("company_name") or "").strip()
                    # Single canonical dedup key — both sides built the same way.
                    key = f"{title.lower()}::{company.lower()}"
                    if key in seen_keys:
                        continue
                    seen_keys.add(key)

                    apply_options = job.get("apply_options") or []
                    apply_link = apply_options[0].get("link", "#") if apply_options else "#"

                    desc = job.get("description") or ""
                    truncated_desc = desc[:250] + "..." if len(desc) > 250 else desc

                    all_jobs.append({
                        "title": title,
                        "company": company or "Unknown Company",
                        "company_name_raw": company,
                        "location": job.get("location") or location,
                        "description": truncated_desc,
                        "link": apply_link,
                        "thumbnail": job.get("thumbnail"),
                    })
            except Exception as e:
                logger.error(f"Search failed for '{query_text}': {e}")

        return all_jobs[:15]

    except Exception as e:
        logger.error(f"Root error in search_jobs: {e}")
        return []
