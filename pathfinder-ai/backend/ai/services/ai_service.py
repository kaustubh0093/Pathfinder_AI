import re
import logging
from typing import List, Tuple, Optional
from langchain_groq import ChatGroq
from langchain_community.utilities import SerpAPIWrapper
from langchain_community.tools import Tool
from langchain_classic.agents import initialize_agent, AgentType
from serpapi import GoogleSearch

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
        agent_executor = initialize_agent(
            tools,
            llm,
            agent=AgentType.ZERO_SHOT_REACT_DESCRIPTION,
            verbose=True,
            handle_parsing_errors=True,
            max_iterations=6,
            early_stopping_method="generate",
        )
        return agent_executor
    except Exception as e:
        logger.error(f"Error creating agent: {e}")
        return None


def generate_career_insights(category: str, subcareer: str, llm: ChatGroq) -> str:
    try:
        if llm is None:
            raise RuntimeError("LLM not initialized")

        safe_category = _sanitize_input(category)
        safe_subcareer = _sanitize_input(subcareer)

        career_prompt = f"""
You are an expert career development coach. Create a **personal growth blueprint** for someone building a career as a **{safe_subcareer}** in India.

This is a CAREER DEVELOPMENT guide — focus on the individual's learning journey, skill-building path, and role progression.
Do NOT include generic market demand metrics, hiring company lists, or remote-work percentages (those belong in a market analysis).

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

No fluff. Be specific to the Indian context.

<!-- CHART_DATA
{{
    "type": "radar",
    "labels": ["Technical Skills", "Soft Skills", "Domain Knowledge", "Tools", "Leadership", "Communication"],
    "data": [85, 70, 90, 80, 60, 75],
    "label": "Skill Importance Profile (0-100)"
}}
-->
Replace data values (0-100) with accurate weights for "{safe_subcareer}".

<!-- INSIGHTS_DATA
{{
    "skills": [
        {{"name": "Skill 1", "score": 90}},
        {{"name": "Skill 2", "score": 85}},
        {{"name": "Skill 3", "score": 78}},
        {{"name": "Skill 4", "score": 70}},
        {{"name": "Skill 5", "score": 65}}
    ],
    "roadmap": [
        {{"stage": "Beginner", "desc": "One line: what to learn or do at the entry stage.", "icon": "school"}},
        {{"stage": "Intermediate", "desc": "One line: projects, tools, and skills to grow.", "icon": "trending_up"}},
        {{"stage": "Advanced", "desc": "One line: leadership, architecture, and mastery.", "icon": "star"}}
    ],
    "careerLadder": [
        {{"role": "Junior Role", "salary": "X-Y LPA", "badge": "Entry"}},
        {{"role": "Mid Role", "salary": "X-Y LPA", "badge": "Mid"}},
        {{"role": "Senior Role", "salary": "X-Y LPA", "badge": "Senior"}},
        {{"role": "Lead Role", "salary": "X-Y LPA", "badge": "Lead"}}
    ],
    "outlook": "Concise 1-2 sentence growth outlook for this role in India.",
    "resources": [
        "Resource 1 — platform or type",
        "Resource 2 — platform or type",
        "Resource 3 — platform or type"
    ]
}}
-->
Fill INSIGHTS_DATA with accurate data for "{safe_subcareer}" in India:
- skills: top 5 must-have skills with realistic mastery-importance scores (0-100)
- roadmap: 3 stages with concise actionable one-line descriptions (keep icon values as "school", "trending_up", "star")
- careerLadder: 3-4 role rungs with realistic INR LPA ranges and badge labels (Entry/Mid/Senior/Lead)
- outlook: concise 1-2 sentence career growth outlook for India
- resources: 3 specific course/certification/book names with platform
"""
        logger.info(f"Generating career insights for {safe_subcareer}...")
        output = llm.invoke(career_prompt)
        return output.content if hasattr(output, "content") else str(output)

    except Exception as e:
        logger.error(f"Error generating career insights: {e}")
        return f"❌ Unable to generate career insights. Error: {e}"


def generate_market_analysis(
    subcareer: str,
    llm: ChatGroq,
    search_func=None,
) -> str:
    try:
        if llm is None:
            raise RuntimeError("LLM not initialized")

        safe_subcareer = _sanitize_input(subcareer)
        logger.info(f"Fetching live market data for {safe_subcareer}...")

        raw_data = ""
        if search_func is not None:
            search_query = (
                f"Current job market for {safe_subcareer} in India 2024-2025: "
                f"demand trend, salary ranges (entry/mid/senior/lead in LPA), "
                f"top hiring companies, hot cities, in-demand skills, "
                f"skills gap, automation risk, future outlook, freelance opportunities."
            )
            try:
                raw_data = search_func(search_query)
            except Exception as search_err:
                logger.warning(f"Search failed, falling back to LLM knowledge: {search_err}")

        format_prompt = f"""
You are an expert Market Intelligence Analyst for the Indian job market.
Using the live data below, produce a **data-driven hiring market report** for "{safe_subcareer}" in India.

RAW LIVE DATA:
{raw_data if raw_data else "Use your latest training knowledge for the Indian job market."}

This is a MARKET INTELLIGENCE report — focus on what employers are doing, what the market signals are, and whether this is a good time to be in this field.
Do NOT include personal learning roadmaps, course recommendations, or beginner/intermediate/advanced progression guides (those belong in a career insights report).

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

<!-- CHART_DATA
{{
    "type": "bar",
    "labels": ["Entry Level", "Mid Level", "Senior Level", "Lead/Architect"],
    "data": [low_val, mid_val, high_val, ultra_val],
    "unit": "LPA (INR)",
    "label": "Avg Salary Range (LPA)"
}}
-->
Replace values with realistic integers for "{safe_subcareer}".

<!-- INSIGHTS_DATA
{{
    "salary": {{
        "entry": "X-Y LPA",
        "median": "X-Y LPA",
        "senior": "X-Y LPA",
        "top": "X-Y LPA"
    }},
    "growth": "+XX%",
    "confidence": 95,
    "skills": ["Skill1", "Skill2", "Skill3", "Skill4", "Skill5", "Skill6"],
    "locations": [
        {{"city": "City1", "pct": 40}},
        {{"city": "City2", "pct": 28}},
        {{"city": "City3", "pct": 18}}
    ],
    "remotePercent": 45,
    "trajectory": [32, 41, 48, 55, 67, 79, 90]
}}
-->
Fill INSIGHTS_DATA with real market data for "{safe_subcareer}" in India:
- salary: actual INR LPA ranges for each level
- growth: projected 12-month demand growth (e.g. "+18%")
- confidence: your confidence in this data 0-100
- skills: top 6 skills most requested in active job postings RIGHT NOW
- locations: top 3 Indian cities with % share of job postings (must sum to ≤100)
- remotePercent: % of roles that are remote-friendly (integer)
- trajectory: 7 integers (0-100) showing demand trend from 6 months ago to today (ascending if growing)
"""
        output = llm.invoke(format_prompt)
        return output.content if hasattr(output, "content") else str(output)

    except Exception as e:
        logger.error(f"Error generating market analysis: {e}")
        return f"❌ Unable to fetch market analysis. Error: {e}"


def generate_college_recommendations(
    subcareer: str,
    llm: ChatGroq,
    location: str = None,
    district: str = None,
) -> str:
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

        college_prompt = f"""
You are an expert education and placement analyst for India.

Generate a **highly accurate college recommendation list** for:
Career Path: **{safe_subcareer}**
Location Context: **{location_context}**

{scope_line}

Strictly follow the output format below.

---

### **Output Format (MANDATORY)**

1. **Markdown Table ONLY** with EXACT columns:
| College | City | Tier | Admission | Fees (₹/yr) | Avg Package (LPA) |

#### Constraints:
- 8-10 colleges MAX
- Prioritize relevance to "{safe_subcareer}" (placements + specialization)
- Tier must be one of: Premier / State Govt / Private
- Fees: Use compact format (e.g., 50K, 1.5L, 2-3L)
- Avg Package: realistic Indian data (e.g., 6, 8-12)
- Admission: exam or mode only (e.g., JEE Main, MHT-CET, Direct)
- Keep college names SHORT
- Ensure diversity: mix of Tier-1, Tier-2, Tier-3

---

2. **Exactly 3 Bullet Points (One Line Each)**:
- Top entrance exam to focus on
- Best certification to add alongside degree
- #1 practical tip to maximize placements

---

<!-- CHART_DATA
{{
    "type": "bar",
    "labels": ["Premier/IIT/NIT", "Top Private", "State Govt", "Mid Private", "Diploma/Cert"],
    "data": [25, 14, 7, 5, 3],
    "unit": "LPA",
    "label": "Avg Placement Package (LPA)"
}}
-->
Replace the data values with realistic LPA figures specific to "{safe_subcareer}".
"""
        logger.info(
            f"Generating college recommendations for {safe_subcareer}"
            + (f" in {safe_district}," if safe_district else "")
            + (f" {safe_location}" if safe_location else " (all India)")
        )
        output = llm.invoke(college_prompt)
        return output.content if hasattr(output, "content") else str(output)

    except Exception as e:
        logger.error(f"Error generating college recommendations: {e}")
        return f"❌ Unable to generate college recommendations. Error: {e}"


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

        resume_prompt = f"""
As an expert resume coach, analyze the following resume for the target role: "{safe_role}"

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
        logger.info(f"Analyzing resume for {safe_role}...")
        output = llm.invoke(resume_prompt)
        return output.content if hasattr(output, "content") else str(output)

    except Exception as e:
        logger.error(f"Error generating resume feedback: {e}")
        return f"❌ Unable to analyze resume. Error: {e}"


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
                        if any(f"{j['title']}-{j['company']}" == job_id for j in all_jobs):
                            continue

                        apply_link = "#"
                        if "apply_options" in job and len(job["apply_options"]) > 0:
                            apply_link = job["apply_options"][0].get("link", "#")

                        desc = job.get("description", "")
                        truncated_desc = desc[:250] + "..." if len(desc) > 250 else desc

                        all_jobs.append({
                            "title": job.get("title", "Unknown Role"),
                            "company": job.get("company_name", "Unknown Company"),
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
