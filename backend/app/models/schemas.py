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
    admin = "admin"  # risk team: sees everything, makes every decision
    worker = "worker"  # employee: reports incidents, requests access, follows their reports


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
    # Also run the 12-dimension pre-project readiness review (a second model call).
    readiness: bool = False


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
    materialized_by: str | None = None
    incident_id: str | None = None
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
    readiness: dict | None = None
    incident_id: str | None = None
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
    duration_ms: float | None = None


# ---------- Module 1: pre-project readiness review ----------

READINESS_DIMENSIONS = [
    "scope", "success_criteria", "schedule", "budget", "resourcing", "vendors",
    "dependencies", "testing", "rollback", "security_access", "compliance", "stakeholders",
]


class DimensionStatus(StrEnum):
    passed = "passed"
    warning = "warning"
    failed = "failed"


class AIDimension(BaseModel):
    model_config = ConfigDict(extra="ignore")
    key: str
    status: DimensionStatus
    finding: str = ""
    recommendation: str = ""
    quote: str | None = None

    _norm = field_validator("key", "status", mode="before")(_lower)


class AIReadiness(BaseModel):
    model_config = ConfigDict(extra="ignore")
    summary: str = ""
    dimensions: list[AIDimension]


# ---------- Module 2: incident assessment ----------


class Severity(StrEnum):
    sev1 = "SEV1"
    sev2 = "SEV2"
    sev3 = "SEV3"
    sev4 = "SEV4"


class TimeToImpact(StrEnum):
    immediate = "immediate"
    hours = "hours"
    days = "days"
    none = "none"
    unknown = "unknown"


class AIAction(BaseModel):
    model_config = ConfigDict(extra="ignore")
    action: str = Field(min_length=1)
    owner_role: str = ""


class AIResponsePlan(BaseModel):
    model_config = ConfigDict(extra="ignore")
    immediate: list[AIAction] = Field(default_factory=list)
    recovery: list[AIAction] = Field(default_factory=list)
    prevention: list[AIAction] = Field(default_factory=list)


class AIEscalation(BaseModel):
    model_config = ConfigDict(extra="ignore")
    resource: str
    access_level: str
    duration_minutes: int = Field(ge=5, le=1440)
    reason: str = ""


class AIIncident(BaseModel):
    model_config = ConfigDict(extra="ignore")
    title: str = Field(min_length=1)
    summary: str = ""
    severity: Severity
    severity_reason: str = ""
    environment: str | None = None
    systems: list[str] = Field(default_factory=list)
    time_to_impact: TimeToImpact = TimeToImpact.unknown
    consequential_risks: list[AIRisk] = Field(default_factory=list)
    response: AIResponsePlan = Field(default_factory=AIResponsePlan)
    escalation: AIEscalation | None = None

    @field_validator("severity", mode="before")
    @classmethod
    def _sev(cls, v: Any) -> Any:
        return v.strip().upper() if isinstance(v, str) else v

    _norm = field_validator("time_to_impact", mode="before")(_lower)


class IncidentStatus(StrEnum):
    reported = "reported"
    acknowledged = "acknowledged"
    contained = "contained"
    recovered = "recovered"
    closed = "closed"


class IncidentCreate(BaseModel):
    report: str
    reporter_name: str | None = Field(default=None, max_length=100)
    environment: str | None = Field(default=None, max_length=20)
    systems: list[str] = Field(default_factory=list, max_length=20)
    occurred_at: str | None = None
    anonymous: bool = False
    language_hint: str | None = Field(default=None, max_length=10)


class SeverityChange(BaseModel):
    severity: Severity
    reason: str = Field(min_length=1)

    @field_validator("severity", mode="before")
    @classmethod
    def _sev(cls, v: Any) -> Any:
        return v.strip().upper() if isinstance(v, str) else v


class EscalationType(StrEnum):
    privilege = "privilege"
    decision = "decision"
    budget = "budget"
    risk_acceptance = "risk_acceptance"
    cross_team = "cross_team"
    vendor = "vendor"


class EscalationCreate(BaseModel):
    type: EscalationType = EscalationType.privilege
    incident_id: str | None = None
    risk_id: str | None = None
    action_needed: str = Field(min_length=1)
    resource: str = Field(min_length=1, max_length=200)
    access_level: str = Field(min_length=1, max_length=100)
    duration_minutes: int = Field(ge=5, le=1440)
    justification: str = Field(min_length=1)


class BreakGlassCreate(BaseModel):
    incident_id: str
    resource: str = Field(min_length=1, max_length=200)
    access_level: str = Field(min_length=1, max_length=100)
    justification: str = Field(min_length=1)


class EscalationDecision(BaseModel):
    result: str = Field(pattern="^(approve|reject)$")
    comment: str | None = None
    # Approve with a narrower scope than requested.
    access_level: str | None = Field(default=None, max_length=100)
    duration_minutes: int | None = Field(default=None, ge=5, le=1440)
