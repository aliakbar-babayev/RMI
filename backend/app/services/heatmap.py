"""Dashboard numbers. Every count here comes from the database, never from the model."""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.schemas import OPEN_STATUSES, Status
from app.models.tables import Analysis, Escalation, Incident, Risk

UNASSIGNED = "unassigned"


def kpis(db: Session) -> dict:
    by_status = dict(db.execute(select(Risk.status, func.count()).group_by(Risk.status)).all())
    open_filter = Risk.status.in_(OPEN_STATUSES)
    return {
        "open": sum(by_status.get(s, 0) for s in OPEN_STATUSES),
        "critical": db.scalar(select(func.count()).where(open_filter, Risk.score >= 16)),
        "pending_review": by_status.get(Status.pending, 0),
        "needs_review": db.scalar(select(func.count()).where(open_filter, Risk.needs_review)),
        "escalated": by_status.get(Status.escalated, 0),
        "resolved": by_status.get(Status.resolved, 0),
        "rejected": by_status.get(Status.rejected, 0),
        "total": sum(by_status.values()),
        "materialized": db.scalar(select(func.count()).where(Risk.materialized_by.is_not(None))),
        **_operations(db),
    }


def _operations(db: Session) -> dict:
    """Incident and escalation counts, plus how many AI quotes survived verification."""
    open_incidents = db.scalar(select(func.count()).where(Incident.status != "closed"))
    open_sev12 = db.scalar(select(func.count()).where(Incident.status != "closed", Incident.severity.in_(("SEV1", "SEV2"))))
    pending_esc = db.scalar(select(func.count()).where(Escalation.status == "pending"))
    active_grants = db.scalar(select(func.count()).where(Escalation.status == "approved"))
    verified = dropped = 0
    for stats in db.scalars(select(Analysis.stats)):
        dropped += (stats or {}).get("dropped_quotes", 0)
    for evidence in db.scalars(select(Risk.evidence)):
        verified += len(evidence or [])
    total_quotes = verified + dropped
    return {
        "open_incidents": open_incidents,
        "open_sev1_sev2": open_sev12,
        "pending_escalations": pending_esc,
        "active_grants": active_grants,
        "quotes_verified": verified,
        "quotes_dropped": dropped,
        "quote_verification_rate": round(verified / total_quotes, 4) if total_quotes else None,
    }


def heatmap(db: Session, source: str | None, mode: str) -> dict:
    """mode="all": every non-rejected risk; mode="open": open risks only."""
    query = select(Risk).where(Risk.status != Status.rejected)
    if source:
        query = query.where(Risk.source.is_(None) if source == UNASSIGNED else Risk.source == source)
    if mode == "open":
        query = query.where(Risk.status.in_(OPEN_STATUSES))
    risks = db.scalars(query.order_by(Risk.score.desc(), Risk.id)).all()

    cells = {(p, i): {"p": p, "i": i, "open": 0, "total": 0, "risk_ids": []}
             for p in range(1, 6) for i in range(1, 6)}
    sources: dict[str, dict] = {}
    for r in risks:
        is_open = r.status in OPEN_STATUSES
        cell = cells[(r.probability, r.impact)]
        cell["total"] += 1
        cell["open"] += is_open
        cell["risk_ids"].append(r.risk_id)

        name = r.source or UNASSIGNED
        row = sources.setdefault(
            name, {"source": name, "total": 0, "open": 0, "solved": 0, "open_exposure": 0}
        )
        row["total"] += 1
        if is_open:
            row["open"] += 1
            row["open_exposure"] += r.score
        elif r.status == Status.resolved:
            row["solved"] += 1

    return {
        "cells": list(cells.values()),
        "sources": sorted(sources.values(), key=lambda s: (-s["open_exposure"], s["source"])),
    }


def top(db: Session, limit: int) -> list[Risk]:
    return db.scalars(
        select(Risk).where(Risk.status.in_(OPEN_STATUSES)).order_by(Risk.score.desc(), Risk.id).limit(limit)
    ).all()
