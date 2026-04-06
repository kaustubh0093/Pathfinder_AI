from typing import List, Optional
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Career Insights
# ---------------------------------------------------------------------------

class SkillScore(BaseModel):
    name: str
    score: int = Field(ge=0, le=100)


class RoadmapStage(BaseModel):
    stage: str
    desc: str
    icon: str  # expected: "school" | "trending_up" | "star"


class CareerLadderRung(BaseModel):
    role: str
    salary: str
    badge: str  # expected: "Entry" | "Mid" | "Senior" | "Lead"


class CareerInsightsData(BaseModel):
    skills: List[SkillScore]
    roadmap: List[RoadmapStage]
    careerLadder: List[CareerLadderRung]
    outlook: str
    resources: List[str]


# ---------------------------------------------------------------------------
# Market Analysis
# ---------------------------------------------------------------------------

class SalaryBand(BaseModel):
    entry: str
    median: str
    senior: str
    top: str


class CityShare(BaseModel):
    city: str
    pct: int


class MarketAnalysisData(BaseModel):
    salary: SalaryBand
    growth: str
    confidence: int = Field(ge=0, le=100)
    skills: List[str]
    locations: List[CityShare]
    remotePercent: int
    trajectory: List[int]


# ---------------------------------------------------------------------------
# Chart (shared by career insights, market analysis, and college recommendations)
# ---------------------------------------------------------------------------

class ChartData(BaseModel):
    type: str  # "radar" | "bar"
    labels: List[str]
    data: List[float]
    unit: Optional[str] = None
    label: str


# ---------------------------------------------------------------------------
# Combined output models — used by PydanticOutputParser (one data chain call
# returns both the insights and chart data together)
# ---------------------------------------------------------------------------

class CareerInsightsFullData(BaseModel):
    insights: CareerInsightsData
    chart: ChartData


class MarketAnalysisFullData(BaseModel):
    insights: MarketAnalysisData
    chart: ChartData
