"""Data models for the AI Workforce system."""

from dataclasses import dataclass, field, asdict
from typing import Optional


@dataclass
class AgentWorker:
    id: str
    name: str
    provider: str  # claude | openai | gemini | ollama
    model_name: str
    status: str = "idle"  # idle | working | paused | offline | budget_exceeded
    current_task_id: Optional[str] = None
    created_at: str = ""
    config: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class AgentTask:
    id: str
    title: str
    description: str
    project_path: str = ""
    category: str = "general"  # security | expansion | improvement | revenue | general
    assigned_agent: Optional[str] = None
    status: str = "pending"  # pending | running | completed | failed
    priority: int = 5
    source: str = "manual"  # manual | scan | recommendation
    result: Optional[str] = None
    tokens_used: int = 0
    cost_usd: float = 0.0
    created_at: str = ""
    started_at: Optional[str] = None
    completed_at: Optional[str] = None

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class BudgetStatus:
    provider: str
    daily_tokens_used: int = 0
    daily_tokens_limit: int = 0
    monthly_cost_used: float = 0.0
    monthly_cost_limit: float = 0.0
    is_free_tier: bool = True
    can_spend: bool = True

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class Recommendation:
    id: str
    project: str
    title: str
    description: str
    category: str = "general"
    priority: int = 5
    suggested_agent: Optional[str] = None
    status: str = "pending"  # pending | assigned | dismissed
    created_at: str = ""

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class Insight:
    id: str
    task_id: str
    agent_id: str
    category: str  # security | expansion | improvement | revenue
    title: str
    content: str
    confidence: float = 0.8
    obsidian_path: Optional[str] = None
    created_at: str = ""

    def to_dict(self) -> dict:
        return asdict(self)
