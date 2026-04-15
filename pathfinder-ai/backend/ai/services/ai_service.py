import re
import logging
from typing import List, Tuple, Optional
from langchain_groq import ChatGroq
from langchain_community.utilities import SerpAPIWrapper
from langchain_community.tools import Tool
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser, PydanticOutputParser
from langchain.agents import AgentExecutor, create_react_agent
from langchain import hub
from serpapi import GoogleSearch

from backend.ai.models.output_models import (
    CareerInsightsFullData,
    MarketAnalysisFullData,
    ChartData,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MAX_RESUME_CHARS = 15_000
_UNSAFE_RE = re.compile(r'[\x00-\x1f\x7f<>{}\[\]\\^`|~]')


def _sanitize_input(value: str, max_len: int = 200) -> str:
    """Validate and sanitize user-controlled text before LLM prompt interpolation."""
    if not isinstance(value, str):
        value = str(value)
    value = value.strip()[:max_len]
    value = _UNSAFE_RE.sub('', value)
    return value


def _scrub_pii(text: str) -> str:
    """Remove obvious PII (emails, phone numbers, pincodes) from resume text."""
    text = re.sub(r'[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}', '[EMAIL]', text)
    text = re.sub(r'(\+91[-\s]?)?[6-9]\d{9}', '[PHONE]', text)
    text = re.sub(r'\b\d{6}\b', '[PINCODE]', text)
    return text


def initialize_llm_and_tools(
    groq_api_key: str, serpapi_key: str
) -> Tuple[Optional[ChatGroq], Optional[List[Tool]]]:
    try:
        if not groq_api_key:
            raise ValueError("Groq API key is required.")
        if not serpapi_key:
            raise ValueError("SerpAPI key is required.")

        llm = ChatGroq(
            model="openai/gpt-oss-120b",
            groq_api_key=groq_api_key,
            temperature=0.1,
        )

        search = SerpAPIWrapper(
            serpapi_api_key=serpapi_key,
            params={"engine": "google", "google_domain": "google.com", "gl": "in", "hl": "en"},
        )

        search_tool = Tool(
            name="web_search",
            description="Use to search the web for job market trends, salaries, companies, Indian colleges, and live data.",
            func=search.run,
        )

        return llm, [search_tool]
    except Exception as e:
        logger.error(f"Error initializing LLM/tools: {e}")
        return None, None


def create_agent_with_tools(llm, tools: List[Tool]):
    try:
        # Uses LCEL-native create_react_agent (text-based ReAct, no tool calling needed).
        # Works with Groq which does not support OpenAI-style function/tool calling.
        react_prompt = hub.pull("hwchase17/react")
        agent = create_react_agent(llm, tools, react_prompt)
        return AgentExecutor(
            agent=agent,
            tools=tools,
            verbose=True,
            handle_parsing_errors=True,
            max_iterations=6,
        )
    except Exception as e:
        logger.error(f"Error creating agent: {e}")
        return None


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
Top 5 skills with why each matters for this role (one line per skill).

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

_CAREER_DATA_PARSER = PydanticOutputParser(pydantic_object=CareerInsightsFullData)

_CAREER_DATA_PROMPT = ChatPromptTemplate.from_template("""
You are a career data assistant for the Indian job market.
For the role "{subcareer}" in India, return accurate structured data for bento grid cards and chart visualization.

{format_instructions}

Field guidance:
- insights.skills: top 5 must-have skills, score 0-100 (importance/demand weight)
- insights.roadmap: exactly 3 stages; icon must be one of "school", "trending_up", "star"
- insights.careerLadder: 3-4 rungs with realistic INR LPA ranges; badge must be Entry/Mid/Senior/Lead
- insights.outlook: 1-2 sentences on India-specific growth trajectory
- insights.resources: 3 specific course/cert/book names with platform
- chart.type: "radar"
- chart.labels: ["Technical Skills", "Soft Skills", "Domain Knowledge", "Tools", "Leadership", "Communication"]
- chart.data: 6 integers 0-100 representing skill importance weights for {subcareer}
- chart.label: "Skill Importance Profile (0-100)"
""")


def generate_career_insights(
    category: str, subcareer: str, llm: ChatGroq
) -> Tuple[str, Optional[dict], Optional[dict]]:
    try:
        if llm is None:
            raise RuntimeError("LLM not initialized")

        safe_category = _sanitize_input(category)
        safe_subcareer = _sanitize_input(subcareer)

        content_chain = _CAREER_CONTENT_PROMPT | llm | StrOutputParser()
        data_chain = _CAREER_DATA_PROMPT | llm | _CAREER_DATA_PARSER

        logger.info(f"Generating career insights for {safe_subcareer}...")
        markdown = content_chain.invoke({"subcareer": safe_subcareer, "category": safe_category})

        try:
            data: CareerInsightsFullData = data_chain.invoke({
                "subcareer": safe_subcareer,
                "format_instructions": _CAREER_DATA_PARSER.get_format_instructions(),
            })
            return markdown, data.insights.model_dump(), data.chart.model_dump()
        except Exception as data_err:
            logger.error(f"Career insights data chain failed: {data_err}")
            return markdown, None, None

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

### **Salary Benchmarks** (INR LPA — India)
| Level | Range |
|---|---|
| Entry | x-y |
| Mid | x-y |
| Senior | x-y |
| Lead/Architect | x-y |
- How this role's salary compares to 1-2 adjacent careers
- Salary growth trajectory over the past 2 years

---

### **What Employers Are Hiring For Right Now**
- Top 6 skills appearing most in active job postings
- Critical skills gap: what most candidates lack that employers want
- Tools / platforms with the highest hiring signal in 2024-2025

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

_MARKET_DATA_PARSER = PydanticOutputParser(pydantic_object=MarketAnalysisFullData)

_MARKET_DATA_PROMPT = ChatPromptTemplate.from_template("""
You are a market data assistant for the Indian job market.
Using the live data below, return accurate structured data for "{subcareer}" in India.

RAW LIVE DATA:
{live_data}

{format_instructions}

Field guidance:
- insights.salary: actual INR LPA ranges for entry/median/senior/top levels
- insights.growth: projected 12-month demand growth (e.g. "+18%")
- insights.confidence: your confidence in this data 0-100
- insights.skills: top 6 skills most requested in active job postings RIGHT NOW
- insights.locations: top 3 Indian cities with % share of job postings (must sum to ≤100)
- insights.remotePercent: % of roles that are remote-friendly (integer)
- insights.trajectory: 7 integers 0-100 showing demand trend from 6 months ago to today
- chart.type: "bar"
- chart.labels: ["Entry Level", "Mid Level", "Senior Level", "Lead/Architect"]
- chart.data: 4 realistic integers representing average LPA for each level for {subcareer}
- chart.unit: "LPA (INR)"
- chart.label: "Avg Salary Range (LPA)"
""")


def generate_market_analysis(
    subcareer: str,
    llm: ChatGroq,
    search_func=None,
) -> Tuple[str, Optional[dict], Optional[dict]]:
    try:
        if llm is None:
            raise RuntimeError("LLM not initialized")

        safe_subcareer = _sanitize_input(subcareer)
        logger.info(f"Fetching live market data for {safe_subcareer}...")

        live_data = "Use your latest training knowledge for the Indian job market."
        if search_func is not None:
            search_query = (
                f"Current job market for {safe_subcareer} in India 2024-2025: "
                f"demand trend, salary ranges (entry/mid/senior/lead in LPA), "
                f"top hiring companies, hot cities, in-demand skills, "
                f"skills gap, automation risk, future outlook, freelance opportunities."
            )
            try:
                live_data = search_func(search_query)
            except Exception as search_err:
                logger.warning(f"Search failed, falling back to LLM knowledge: {search_err}")

        content_chain = _MARKET_CONTENT_PROMPT | llm | StrOutputParser()
        data_chain = _MARKET_DATA_PROMPT | llm | _MARKET_DATA_PARSER

        markdown = content_chain.invoke({"subcareer": safe_subcareer, "live_data": live_data})

        try:
            data: MarketAnalysisFullData = data_chain.invoke({
                "subcareer": safe_subcareer,
                "live_data": live_data,
                "format_instructions": _MARKET_DATA_PARSER.get_format_instructions(),
            })
            return markdown, data.insights.model_dump(), data.chart.model_dump()
        except Exception as data_err:
            logger.error(f"Market analysis data chain failed: {data_err}")
            return markdown, None, None

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

_COLLEGE_CHART_PARSER = PydanticOutputParser(pydantic_object=ChartData)

_COLLEGE_CHART_PROMPT = ChatPromptTemplate.from_template("""
You are a placement data assistant for Indian colleges.
For the career path "{subcareer}", provide realistic average placement package data by college tier.

{format_instructions}

Field guidance:
- type: "bar"
- labels: ["Premier/IIT/NIT", "Top Private", "State Govt", "Mid Private", "Diploma/Cert"]
- data: 5 realistic LPA integers for {subcareer} graduates from each tier
- unit: "LPA"
- label: "Avg Placement Package (LPA)"
""")


def generate_college_recommendations(
    subcareer: str,
    llm: ChatGroq,
    location: str = None,
    district: str = None,
) -> Tuple[str, Optional[dict]]:
    try:
        if llm is None:
            raise RuntimeError("LLM not initialized")

        safe_subcareer = _sanitize_input(subcareer)
        safe_location = _sanitize_input(location) if location else None
        safe_district = _sanitize_input(district) if district else None

        if safe_district and safe_location:
            scope_line = f'Only list colleges in or near the district of {safe_district}, {safe_location}. Do not list colleges from other districts or regions.'
            location_context = f'in {safe_district}, {safe_location}'
        elif safe_district:
            scope_line = f'Only list colleges in or near the district of {safe_district}. Do not list colleges from other districts.'
            location_context = f'in {safe_district} district'
        elif safe_location:
            scope_line = f'Only list colleges in or near {safe_location}. Do not list colleges from other regions.'
            location_context = f'in {safe_location}'
        else:
            scope_line = 'Include IITs, NITs, and top state/private colleges across India.'
            location_context = 'in India'

        content_chain = _COLLEGE_CONTENT_PROMPT | llm | StrOutputParser()
        chart_chain = _COLLEGE_CHART_PROMPT | llm | _COLLEGE_CHART_PARSER

        logger.info(
            f"Generating college recommendations for {safe_subcareer}"
            + (f" in {safe_district}," if safe_district else "")
            + (f" {safe_location}" if safe_location else " (all India)")
        )
        markdown = content_chain.invoke({
            "subcareer": safe_subcareer,
            "location_context": location_context,
            "scope_line": scope_line,
        })

        try:
            chart: ChartData = chart_chain.invoke({
                "subcareer": safe_subcareer,
                "format_instructions": _COLLEGE_CHART_PARSER.get_format_instructions(),
            })
            return markdown, chart.model_dump()
        except Exception as chart_err:
            logger.error(f"College chart data chain failed: {chart_err}")
            return markdown, None

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
    scrub_pii: bool = False,
) -> str:
    try:
        if llm is None:
            raise RuntimeError("LLM not initialized")

        logger.warning(
            "PII notice: resume content will be sent to an external LLM service (Groq). "
            "Ensure compliance with your data-handling policies."
        )

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

        logger.info(f"Analyzing resume for {safe_role}...")
        return chain.invoke({
            "target_role": safe_role,
            "resume_text": resume_text,
            "truncation_notice": truncation_notice,
        })

    except Exception as e:
        logger.error(f"Error generating resume feedback: {e}")
        return f"❌ Unable to analyze resume. Error: {e}"


# ── Job Search ────────────────────────────────────────────────────────────────

def search_jobs(role: str, location: str = "India", api_key: str = None) -> List[dict]:
    try:
        if not api_key:
            logger.error("SerpAPI key is missing in search_jobs")
            return []

        all_jobs = []
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

            logger.info(f"Attempting job search with query: {query_text}")
            try:
                search = GoogleSearch(params)
                results = search.get_dict()

                if "error" in results:
                    logger.error(f"SerpAPI Error for query '{query_text}': {results['error']}")
                    continue

                if "jobs_results" in results:
                    page_results = results["jobs_results"]
                    logger.info(f"Found {len(page_results)} results for query '{query_text}'")

                    for job in page_results:
                        job_id = f"{job.get('title')}-{job.get('company_name')}"
                        if any(f"{j['title']}-{j['company_name_raw']}" == job_id for j in all_jobs):
                            continue

                        apply_link = "#"
                        if "apply_options" in job and len(job["apply_options"]) > 0:
                            apply_link = job["apply_options"][0].get("link", "#")

                        desc = job.get("description", "")
                        truncated_desc = desc[:250] + "..." if len(desc) > 250 else desc

                        all_jobs.append({
                            "title": job.get("title", "Unknown Role"),
                            "company": job.get("company_name", "Unknown Company"),
                            "company_name_raw": job.get("company_name", ""),
                            "location": job.get("location", "India"),
                            "description": truncated_desc,
                            "link": apply_link,
                            "thumbnail": job.get("thumbnail", None),
                        })
                else:
                    logger.warning(f"No results found for query: {query_text}")
            except Exception as e:
                logger.error(f"Structured search failed for query '{query_text}': {e}")

        return all_jobs[:15]

    except Exception as e:
        logger.error(f"Root error in search_jobs: {e}")
        return []
