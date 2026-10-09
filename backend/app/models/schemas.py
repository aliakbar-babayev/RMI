from enum import StrEnum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator


class Classification(StrEnum):
    risk = "risk"
    issue = "issue"
    assumption = "assumption"


class Category(StrEnum):
    financial = "financial"
    operational = "operational"
    it = "it"
    infosec = "infosec"
    reputational = "reputational"


class Strategy(StrEnum):
    avoid = "avoid"
    mitigate = "mitigate"
    transfer = "transfer"
    accept = "accept"


class Status(StrEnum):
    pending = "pending"
    approved = "approved"
    edited = "edited"
    rejected = "rejected"
    escalated = "escalated"
    resolved = "resolved"


class Level(StrEnum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class Role(StrEnum):
    executive = "executive"
    analyst = "analyst"
    auditor = "auditor"


class EscalationTarget(StrEnum):
    ciso = "ciso"
    pmo = "pmo"


OPEN_STATUSES = (Status.pending, Status.approved, Status.edited, Status.escalated)


def _lower(v: Any) -> Any:
    return v.strip().lower() if isinstance(v, str) else v


# ---------- What the model must return (validated before anything is stored) ----------


class AIEvidence(BaseModel):
    model_config = ConfigDict(extra="ignore")
    quote: str = Field(min_length=1)


class AIRisk(BaseModel):
    # Extra keys (e.g. a model-supplied "score") are ignored: the backend computes the score.
    model_config = ConfigDict(extra="ignore")

    classification: Classification
    statement: str = Field(min_length=1)
    category: Category
    source: str | None = None
    probability: int = Field(ge=1, le=5)
    impact: int = Field(ge=1, le=5)
    confidence: float = Field(ge=0, le=1)
    rationale: str = Field(min_length=1)
    evidence: list[AIEvidence] = Field(default_factory=list)
    strategy: Strategy
    actions: list[str] = Field(default_factory=list)
    trigger: str = ""
    owner_role: str = ""

    _norm = field_validator("classification", "category", "strategy", mode="before")(_lower)

    @field_validator("source", mode="before")
    @classmethod
    def _empty_source(cls, v: Any) -> Any:
        return v.strip() or None if isinstance(v, str) else v


class AIExtraction(BaseModel):
    model_config = ConfigDict(extra="ignore")
    risks: list[AIRisk]


# ---------- API ----------


class AnalysisCreate(BaseModel):
    text: str
    language_hint: str | None = Field(default=None, max_length=10)
    source: str | None = Field(default=None, max_length=200)


class Evidence(BaseModel):
    type: str = "quote"
    text: str
    verified: bool
    start: int | None = None  # character offsets in the analysis text, for highlighting
    end: int | None = None


class RiskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    risk_id: str
    analysis_id: str
    classification: Classification
    statement: str
    category: Category
    source: str | None
    probability: int
    impact: int
    score: int
    level: Level
    rationale: str
    evidence: list[Evidence]
    confidence: float
    needs_review: bool
    strategy: Strategy
    actions: list[str]
    trigger: str
    owner_role: str
    status: Status
    escalated_to: str | None
    created_at: str
    updated_at: str


class AnalysisOut(BaseModel):
    analysis_id: str
    text: str
    language_hint: str | None
    source: str | None
    model: str
    stats: dict
    created_at: str
    risks: list[RiskOut]


class RiskPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    probability: int | None = Field(default=None, ge=1, le=5)
    impact: int | None = Field(default=None, ge=1, le=5)
    statement: str | None = Field(default=None, min_length=1)
    owner_role: str | None = None
    category: Category | None = None
    strategy: Strategy | None = None
    trigger: str | None = None
    actions: list[str] | None = None
    source: str | None = None
    comment: str | None = None


class CommentBody(BaseModel):
    comment: str | None = None


class RejectBody(BaseModel):
    reason: str = Field(min_length=1)


class EscalateBody(BaseModel):
    to: EscalationTarget
    reason: str = Field(min_length=1)


class AuditActor(BaseModel):
    type: str
    role: str | None


class AuditEntryOut(BaseModel):
    event_id: int
    entity_type: str
    entity_id: str
    event_type: str
    actor: AuditActor
    data: dict
    recorded_at: str
    prev_hash: str
    hash: str


class VerifyOut(BaseModel):
    ok: bool
    checked: int
    broken_at: int | None = None
