"""Module 2: incident reporting, assessment, location, blast radius and lifecycle."""

import re
import time
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai.prompts import INCIDENT_PROMPT, build_incident_message
from app.errors import AppError
from app.models.schemas import OPEN_STATUSES, AIIncident, IncidentCreate, IncidentStatus, Severity
from app.models.tables import Analysis, AuditEvent, Escalation, Incident, Risk, System
from app.services.analysis import new_analysis, save_risks
from app.services.audit_log import record_event, utc_now
from app.services.extractor import ask_model

# Minutes allowed from report to each stage, by severity (None = no target).
SLA_MINUTES: dict[str, dict[str, int | None]] = {
    "SEV1": {"acknowledge": 15, "contain": 60, "recover": 240},
    "SEV2": {"acknowledge": 60, "contain": 240, "recover": 1440},
    "SEV3": {"acknowledge": 1440, "contain": 4320, "recover": 10080},
    "SEV4": {"acknowledge": 10080, "contain": None, "recover": 43200},
}

# Who is told, by severity. Phase 1 has no real channels: this is the routing the team agreed.
ROUTING: dict[str, list[str]] = {
    "SEV1": ["Risk team", "System owner", "On-call", "Executive"],
    "SEV2": ["Risk team", "System owner"],
    "SEV3": ["System owner"],
    "SEV4": [],
}

# Commands an AI suggestion must never present as safe to run.
_DESTRUCTIVE = re.compile(
    r"\brm\s+-|\bdrop\s+(table|database)\b|\btruncate\b|--force\b|\bmkfs\b|\bchmod\s+-R\b|\bdd\s+if=|\bdel\s+/f\b",
    re.I,
)

# Allowed lifecycle moves: action -> (statuses it may start from, new status, timestamp field)
_LIFECYCLE = {
    "acknowledge": ({"reported"}, IncidentStatus.acknowledged, "acknowledged_at"),
    "contain": ({"reported", "acknowledged"}, IncidentStatus.contained, "contained_at"),
    "recover": ({"acknowledged", "contained"}, IncidentStatus.recovered, "recovered_at"),
    "close": ({"recovered"}, IncidentStatus.closed, "closed_at"),
}


def _ts(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=UTC)


def _seconds(start: str | None, end: str | None) -> float | None:
    a, b = _ts(start), _ts(end)
    return round((b - a).total_seconds(), 1) if a and b else None


# ---------- registry ----------


def systems_by_id(db: Session) -> dict[str, System]:
    return {s.system_id: s for s in db.scalars(select(System))}


def locate(report: str, selected: list[str], ai_systems: list[str], registry: dict[str, System]) -> tuple[list[str], list[str]]:
    """Affected systems: picked by the reporter, named in the text, or named by the AI (if they exist).

    Returns (known system ids, names that are not in the registry). Nothing is guessed silently.
    """
    lowered = report.lower()
    found: list[str] = []
    unmapped: list[str] = []
    for sid in selected:
        (found if sid in registry else unmapped).append(sid)
    for sid in registry:
        if re.search(rf"(?<![\w-]){re.escape(sid.lower())}(?![\w-])", lowered):
            found.append(sid)
    for sid in ai_systems:
        (found if sid in registry else unmapped).append(sid)
    dedupe = lambda xs: list(dict.fromkeys(xs))  # noqa: E731
    found = dedupe(found)
    return found, [u for u in dedupe(unmapped) if u not in found]


def blast_radius(roots: list[str], registry: dict[str, System], max_hops: int = 3) -> list[dict]:
    """Systems that depend on the roots, directly or through others, with their distance."""
    dependents: dict[str, list[str]] = {}
    for s in registry.values():
        for dep in s.depends_on:
            dependents.setdefault(dep, []).append(s.system_id)
    seen = {r: 0 for r in roots}
    via: dict[str, str] = {}
    frontier = list(roots)
    for hop in range(1, max_hops + 1):
        nxt = []
        for node in frontier:
            for d in dependents.get(node, []):
                if d not in seen:
                    seen[d] = hop
                    via[d] = node
                    nxt.append(d)
        frontier = nxt
    out = []
    for sid, hop in seen.items():
        s = registry.get(sid)
        if not s:
            continue
        out.append({"system_id": sid, "name": s.name, "kind": s.kind, "environment": s.environment,
                    "criticality": s.criticality, "owner_team": s.owner_team, "hop": hop, "via": via.get(sid)})
    return sorted(out, key=lambda n: (n["hop"], n["system_id"]))


# ---------- create ----------


def _plan(response) -> dict:
    out = {}
    for horizon in ("immediate", "recovery", "prevention"):
        out[horizon] = [
            {"action": a.action, "owner_role": a.owner_role, "flagged": bool(_DESTRUCTIVE.search(a.action))}
            for a in getattr(response, horizon)
        ]
    return out


def create_incident(db: Session, body: IncidentCreate, role: str) -> Incident:
    registry = systems_by_id(db)
    known = [(s.system_id, s.name, s.environment, s.criticality) for s in registry.values()]
    t0 = time.perf_counter()
    assessment, attempts = ask_model(INCIDENT_PROMPT, build_incident_message(body.report, known, body.language_hint), AIIncident)
    ai_seconds = round(time.perf_counter() - t0, 2)

    systems, unmapped = locate(body.report, body.systems, assessment.systems, registry)
    environment = body.environment or assessment.environment or (
        registry[systems[0]].environment if systems else None
    )
    escalation = None
    if assessment.escalation:
        e = assessment.escalation
        escalation = {"resource": e.resource, "access_level": e.access_level,
                      "duration_minutes": e.duration_minutes, "reason": e.reason,
                      "known_system": e.resource in registry}

    now = utc_now()
    incident = Incident(
        title=assessment.title[:300],
        report=body.report,
        reporter_role=None if body.anonymous else role,
        reporter_name=None if body.anonymous else ((body.reporter_name or "").strip() or None),
        anonymous=body.anonymous,
        environment=environment,
        systems=systems,
        unmapped_systems=unmapped,
        severity=assessment.severity.value,
        severity_reason=assessment.severity_reason,
        summary=assessment.summary,
        time_to_impact=assessment.time_to_impact.value,
        response_plan=_plan(assessment.response),
        escalation_suggestion=escalation,
        status=IncidentStatus.reported,
        occurred_at=body.occurred_at,
        reported_at=now,
        ai_seconds=ai_seconds,
    )
    db.add(incident)
    db.flush()
    incident.incident_id = f"INC-{incident.id:03d}"
    record_event(
        db, entity_type="incident", entity_id=incident.incident_id, event_type="incident.reported",
        actor_type="human", actor_role=None if body.anonymous else role,
        data={"anonymous": body.anonymous, "occurred_at": body.occurred_at, "systems_selected": body.systems},
    )

    analysis = new_analysis(db, text=body.report, language_hint=body.language_hint,
                            source=systems[0] if systems else None, actor_role=None, incident_id=incident.incident_id)
    stats = save_risks(db, analysis, assessment.consequential_risks, systems[0] if systems else None)
    analysis.stats = {**stats, "model_attempts": attempts}
    incident.analysis_id = analysis.analysis_id
    record_event(
        db, entity_type="incident", entity_id=incident.incident_id, event_type="incident.assessed",
        actor_type="ai",
        data={"severity": incident.severity, "systems": systems, "unmapped": unmapped,
              "consequential_risks": stats["risks_returned"], "ai_seconds": ai_seconds,
              "notify": ROUTING[incident.severity]},
    )
    db.commit()
    db.refresh(incident)
    return incident


# ---------- read ----------


def get_incident(db: Session, incident_id: str) -> Incident:
    inc = db.scalar(select(Incident).where(Incident.incident_id == incident_id))
    if not inc:
        raise AppError(404, "not_found", f"Incident {incident_id} not found.")
    return inc


def metrics(inc: Incident, now: str | None = None) -> dict:
    now = now or utc_now()
    sla = SLA_MINUTES[inc.severity]
    stages = {"acknowledge": inc.acknowledged_at, "contain": inc.contained_at, "recover": inc.recovered_at}
    sla_status = {}
    for stage, done_at in stages.items():
        target = sla[stage]
        elapsed = _seconds(inc.reported_at, done_at or now)
        if target is None:
            state = "none"
        elif done_at:
            state = "met" if elapsed is not None and elapsed <= target * 60 else "breached"
        else:
            state = "running" if elapsed is not None and elapsed <= target * 60 else "breached"
        sla_status[stage] = {"target_minutes": target, "elapsed_seconds": elapsed, "state": state, "done": bool(done_at)}
    return {
        "detection_lag_seconds": _seconds(inc.occurred_at, inc.reported_at),
        "time_to_acknowledge_seconds": _seconds(inc.reported_at, inc.acknowledged_at),
        "time_to_contain_seconds": _seconds(inc.reported_at, inc.contained_at),
        "time_to_recover_seconds": _seconds(inc.reported_at, inc.recovered_at),
        "ai_assessment_seconds": inc.ai_seconds,
        "sla": sla_status,
    }


def materialize_candidates(db: Session, inc: Incident) -> list[Risk]:
    """Open risks predicted earlier on the same systems: maybe this incident is that risk happening."""
    if not inc.systems:
        return []
    return list(db.scalars(
        select(Risk).join(Analysis)
        .where(Risk.source.in_(inc.systems), Risk.status.in_(OPEN_STATUSES), Risk.materialized_by.is_(None),
               (Analysis.incident_id.is_(None)) | (Analysis.incident_id != inc.incident_id))
        .order_by(Risk.score.desc())
    ))


def consequential_risks(db: Session, inc: Incident) -> list[Risk]:
    return list(db.scalars(select(Risk).join(Analysis).where(Analysis.incident_id == inc.incident_id).order_by(Risk.id)))


def timeline(db: Session, inc: Incident) -> list[AuditEvent]:
    ids = {inc.incident_id}
    if inc.analysis_id:
        ids.add(inc.analysis_id)
    ids |= {r.risk_id for r in consequential_risks(db, inc)}
    ids |= set(db.scalars(select(Risk.risk_id).where(Risk.materialized_by == inc.incident_id)))
    ids |= {e.escalation_id for e in db.scalars(select(Escalation).where(Escalation.incident_id == inc.incident_id))}
    return list(db.scalars(select(AuditEvent).where(AuditEvent.entity_id.in_(ids)).order_by(AuditEvent.event_id)))


# ---------- change ----------


def advance(db: Session, inc: Incident, action: str, role: str, note: str | None) -> Incident:
    allowed, new_status, field = _LIFECYCLE[action]
    if inc.status not in allowed:
        raise AppError(409, "invalid_transition", f"Cannot {action} an incident with status '{inc.status}'.")
    note = (note or "").strip() or None
    if action == "recover" and not note:
        raise AppError(422, "resolution_required", "Describe how the problem was solved.")
    if action in ("recover", "close") and note and not (action == "close" and inc.resolution):
        inc.resolution = note
    now = utc_now()
    setattr(inc, field, now)
    if action in ("contain", "recover") and not inc.acknowledged_at:
        inc.acknowledged_at = now  # acting on it implies it was seen
    inc.status = new_status
    record_event(db, entity_type="incident", entity_id=inc.incident_id, event_type=f"incident.{new_status.value}",
                 actor_type="human", actor_role=role, data={"note": note})
    db.commit()
    return inc


def change_severity(db: Session, inc: Incident, severity: Severity, reason: str, role: str) -> Incident:
    if inc.status == IncidentStatus.closed:
        raise AppError(409, "invalid_transition", "A closed incident cannot change severity.")
    if inc.severity == severity.value:
        raise AppError(422, "nothing_to_change", f"Severity is already {severity.value}.")
    old = inc.severity
    inc.severity = severity.value
    record_event(db, entity_type="incident", entity_id=inc.incident_id, event_type="incident.severity_changed",
                 actor_type="human", actor_role=role, data={"from": old, "to": severity.value, "reason": reason})
    db.commit()
    return inc


def confirm_materialized(db: Session, inc: Incident, risk_id: str, role: str) -> Risk:
    risk = next((r for r in materialize_candidates(db, inc) if r.risk_id == risk_id), None)
    if not risk:
        raise AppError(409, "not_a_candidate", f"{risk_id} is not an open risk predicted for this incident's systems.")
    risk.materialized_by = inc.incident_id
    risk.updated_at = utc_now()
    record_event(db, entity_type="risk", entity_id=risk.risk_id, event_type="risk.materialized",
                 actor_type="human", actor_role=role,
                 data={"incident_id": inc.incident_id, "predicted_at": risk.created_at})
    record_event(db, entity_type="incident", entity_id=inc.incident_id, event_type="incident.linked_risk",
                 actor_type="human", actor_role=role, data={"risk_id": risk.risk_id})
    db.commit()
    return risk
