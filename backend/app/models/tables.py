from sqlalchemy import JSON, Boolean, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class Analysis(Base):
    __tablename__ = "analyses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    analysis_id: Mapped[str | None] = mapped_column(String(20), unique=True, index=True)
    text: Mapped[str] = mapped_column(Text)
    language_hint: Mapped[str | None] = mapped_column(String(10))
    source: Mapped[str | None] = mapped_column(String(200))
    model: Mapped[str] = mapped_column(String(100))
    stats: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[str] = mapped_column(String(32))
    # Pre-project readiness review (Module 1); null when not requested.
    readiness: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    # Set when this analysis is the AI assessment of an incident report (Module 2).
    incident_id: Mapped[str | None] = mapped_column(String(20), nullable=True, index=True)

    risks: Mapped[list["Risk"]] = relationship(back_populates="analysis", order_by="Risk.id")


class Risk(Base):
    __tablename__ = "risks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    risk_id: Mapped[str | None] = mapped_column(String(20), unique=True, index=True)
    analysis_pk: Mapped[int] = mapped_column(ForeignKey("analyses.id"))
    classification: Mapped[str] = mapped_column(String(20))
    statement: Mapped[str] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(20), index=True)
    source: Mapped[str | None] = mapped_column(String(200), index=True)
    probability: Mapped[int] = mapped_column(Integer)
    impact: Mapped[int] = mapped_column(Integer)
    score: Mapped[int] = mapped_column(Integer, index=True)
    level: Mapped[str] = mapped_column(String(10), index=True)
    rationale: Mapped[str] = mapped_column(Text)
    evidence: Mapped[list] = mapped_column(JSON, default=list)
    confidence: Mapped[float] = mapped_column(Float)
    needs_review: Mapped[bool] = mapped_column(Boolean, default=False)
    strategy: Mapped[str] = mapped_column(String(20))
    actions: Mapped[list] = mapped_column(JSON, default=list)
    trigger: Mapped[str] = mapped_column(Text, default="")
    owner_role: Mapped[str] = mapped_column(String(100), default="")
    status: Mapped[str] = mapped_column(String(20), default="pending", index=True)
    escalated_to: Mapped[str | None] = mapped_column(String(20))
    # Incident that showed this predicted risk actually happened (confirmed by a person).
    materialized_by: Mapped[str | None] = mapped_column(String(20), nullable=True)
    created_at: Mapped[str] = mapped_column(String(32))
    updated_at: Mapped[str] = mapped_column(String(32))

    analysis: Mapped[Analysis] = relationship(back_populates="risks")


class AuditEvent(Base):
    __tablename__ = "audit_events"

    event_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    entity_type: Mapped[str] = mapped_column(String(20))
    entity_id: Mapped[str] = mapped_column(String(20), index=True)
    event_type: Mapped[str] = mapped_column(String(50))
    actor_type: Mapped[str] = mapped_column(String(10))
    actor_role: Mapped[str | None] = mapped_column(String(20))
    data: Mapped[dict] = mapped_column(JSON, default=dict)
    recorded_at: Mapped[str] = mapped_column(String(32))
    prev_hash: Mapped[str] = mapped_column(String(64))
    hash: Mapped[str] = mapped_column(String(64))

    # Unique: two entries pointing at the same predecessor would mean a forked chain.
    __table_args__ = (Index("ix_audit_events_prev_hash", "prev_hash", unique=True),)


class System(Base):
    """System registry (a small CMDB): what exists, who owns it, what depends on what."""

    __tablename__ = "systems"

    system_id: Mapped[str] = mapped_column(String(100), primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    kind: Mapped[str] = mapped_column(String(30))  # server | service | database | network | application | vendor
    environment: Mapped[str] = mapped_column(String(20))  # production | staging | development
    criticality: Mapped[str] = mapped_column(String(10))  # low | medium | high | critical
    owner_team: Mapped[str] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(Text, default="")
    # Systems this one needs. Blast radius walks these edges backwards.
    depends_on: Mapped[list] = mapped_column(JSON, default=list)


class Incident(Base):
    __tablename__ = "incidents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    incident_id: Mapped[str | None] = mapped_column(String(20), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(300))
    report: Mapped[str] = mapped_column(Text)
    reporter_role: Mapped[str | None] = mapped_column(String(20))
    reporter_name: Mapped[str | None] = mapped_column(String(100))
    anonymous: Mapped[bool] = mapped_column(Boolean, default=False)
    # How it was solved; written by the person who marks it recovered or closed.
    resolution: Mapped[str | None] = mapped_column(Text)
    environment: Mapped[str | None] = mapped_column(String(20))
    systems: Mapped[list] = mapped_column(JSON, default=list)
    unmapped_systems: Mapped[list] = mapped_column(JSON, default=list)
    severity: Mapped[str] = mapped_column(String(5), index=True)
    severity_reason: Mapped[str] = mapped_column(Text, default="")
    summary: Mapped[str] = mapped_column(Text, default="")
    time_to_impact: Mapped[str] = mapped_column(String(20), default="unknown")
    response_plan: Mapped[dict] = mapped_column(JSON, default=dict)
    escalation_suggestion: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    analysis_id: Mapped[str | None] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(String(20), default="reported", index=True)
    occurred_at: Mapped[str | None] = mapped_column(String(32))
    reported_at: Mapped[str] = mapped_column(String(32))
    acknowledged_at: Mapped[str | None] = mapped_column(String(32))
    contained_at: Mapped[str | None] = mapped_column(String(32))
    recovered_at: Mapped[str | None] = mapped_column(String(32))
    closed_at: Mapped[str | None] = mapped_column(String(32))
    ai_seconds: Mapped[float | None] = mapped_column(Float)


class Escalation(Base):
    __tablename__ = "escalations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    escalation_id: Mapped[str | None] = mapped_column(String(20), unique=True, index=True)
    type: Mapped[str] = mapped_column(String(20))
    incident_id: Mapped[str | None] = mapped_column(String(20), index=True)
    risk_id: Mapped[str | None] = mapped_column(String(20))
    requested_by_role: Mapped[str] = mapped_column(String(20))
    action_needed: Mapped[str] = mapped_column(Text)
    resource: Mapped[str] = mapped_column(String(200))
    access_level: Mapped[str] = mapped_column(String(100))
    duration_minutes: Mapped[int] = mapped_column(Integer)
    justification: Mapped[str] = mapped_column(Text)
    suggestion: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    break_glass: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String(20), default="pending", index=True)
    decision: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    decision_deadline: Mapped[str | None] = mapped_column(String(32))
    granted_at: Mapped[str | None] = mapped_column(String(32))
    expires_at: Mapped[str | None] = mapped_column(String(32))
    revoked_at: Mapped[str | None] = mapped_column(String(32))
    review_required: Mapped[bool] = mapped_column(Boolean, default=False)
    reviewed_at: Mapped[str | None] = mapped_column(String(32))
    created_at: Mapped[str] = mapped_column(String(32))
