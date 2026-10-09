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
