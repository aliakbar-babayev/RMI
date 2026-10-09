"""Module 6: escalation to someone with more privilege or authority.

Rules: the AI only suggests; an executive approves (never the requester's own role);
access is always time-boxed and expires on its own; break-glass grants at once but
is logged loudly and must be reviewed afterwards. No access is granted in a real
system here: grants are records an IAM/PAM integration would act on.
"""

import re
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.errors import AppError
from app.models.schemas import BreakGlassCreate, EscalationCreate, EscalationDecision, Role
from app.models.tables import Escalation
from app.services.audit_log import record_event, utc_now
from app.services.incidents import get_incident

APPROVER_ROLE = Role.executive
BREAK_GLASS_MINUTES = 60
# Minutes an approver has to decide, by incident severity (no incident: 240).
DECISION_MINUTES = {"SEV1": 15, "SEV2": 30, "SEV3": 240, "SEV4": 1440}

_BROAD_ACCESS = re.compile(r"\b(root|admin|administrator|superuser|full|all|\*)\b", re.I)
_PRESSURE = re.compile(
    r"already approved|pre-?approved|skip (the )?review|no time to|ceo (said|approved|wants)|don'?t tell|bypass",
    re.I,
)


def _iso(dt: datetime) -> str:
    return dt.isoformat(timespec="milliseconds").replace("+00:00", "Z")


def _now() -> datetime:
    return datetime.now(UTC)


def _parse(ts: str) -> datetime:
    return datetime.fromisoformat(ts.replace("Z", "+00:00"))


def flags(esc: Escalation) -> list[dict]:
    """Warnings shown to the approver. Checked by fixed rules, not by the model."""
    out = []
    s = esc.suggestion
    if s and esc.duration_minutes > s["duration_minutes"]:
        out.append({"type": "longer_than_suggested",
                    "message": f"Requested {esc.duration_minutes} min; the AI suggested {s['duration_minutes']} min."})
    if _BROAD_ACCESS.search(esc.access_level) and not (s and _BROAD_ACCESS.search(s["access_level"])):
        out.append({"type": "broad_access", "message": f"'{esc.access_level}' is broad; consider "
                    f"'{s['access_level']}'." if s else f"'{esc.access_level}' is broad access."})
    if s and s["resource"] != esc.resource:
        out.append({"type": "different_resource",
                    "message": f"Request is for {esc.resource}, but the incident points to {s['resource']}."})
    if _PRESSURE.search(esc.justification) or _PRESSURE.search(esc.action_needed):
        out.append({"type": "pressure_language",
                    "message": "The request claims prior approval or asks to skip review. Verify it independently."})
    return out


def expire_due(db: Session) -> None:
    """Mark grants whose time is up as expired (done on read; no background worker in Phase 1)."""
    now = _now()
    changed = False
    for esc in db.scalars(select(Escalation).where(Escalation.status == "approved", Escalation.expires_at.is_not(None))):
        if _parse(esc.expires_at) <= now:
            esc.status = "expired"
            record_event(db, entity_type="escalation", entity_id=esc.escalation_id, event_type="access.expired",
                         actor_type="system", data={"resource": esc.resource, "expired_at": esc.expires_at})
            changed = True
    if changed:
        db.commit()


def get(db: Session, escalation_id: str) -> Escalation:
    esc = db.scalar(select(Escalation).where(Escalation.escalation_id == escalation_id))
    if not esc:
        raise AppError(404, "not_found", f"Escalation {escalation_id} not found.")
    return esc


def to_out(esc: Escalation) -> dict:
    overdue = (
        esc.status == "pending" and esc.decision_deadline is not None and _parse(esc.decision_deadline) < _now()
    )
    return {
        "escalation_id": esc.escalation_id, "type": esc.type, "incident_id": esc.incident_id, "risk_id": esc.risk_id,
        "requested_by_role": esc.requested_by_role, "action_needed": esc.action_needed, "resource": esc.resource,
        "access_level": esc.access_level, "duration_minutes": esc.duration_minutes,
        "justification": esc.justification, "suggestion": esc.suggestion, "break_glass": esc.break_glass,
        "status": esc.status, "decision": esc.decision, "decision_deadline": esc.decision_deadline,
        "overdue": overdue, "granted_at": esc.granted_at, "expires_at": esc.expires_at, "revoked_at": esc.revoked_at,
        "review_required": esc.review_required, "reviewed_at": esc.reviewed_at, "created_at": esc.created_at,
        "approver_role": APPROVER_ROLE.value, "flags": flags(esc),
    }


def _new(db: Session, **fields) -> Escalation:
    esc = Escalation(created_at=utc_now(), **fields)
    db.add(esc)
    db.flush()
    esc.escalation_id = f"ESC-{esc.id:03d}"
    return esc


def create(db: Session, body: EscalationCreate, role: str) -> Escalation:
    suggestion = None
    deadline_min = DECISION_MINUTES.get("SEV3")
    if body.incident_id:
        inc = get_incident(db, body.incident_id)
        suggestion = inc.escalation_suggestion
        deadline_min = DECISION_MINUTES[inc.severity]
    esc = _new(
        db, type=body.type.value, incident_id=body.incident_id, risk_id=body.risk_id, requested_by_role=role,
        action_needed=body.action_needed, resource=body.resource, access_level=body.access_level,
        duration_minutes=body.duration_minutes, justification=body.justification, suggestion=suggestion,
        status="pending", decision_deadline=_iso(_now() + timedelta(minutes=deadline_min)),
    )
    record_event(db, entity_type="escalation", entity_id=esc.escalation_id, event_type="escalation.requested",
                 actor_type="human", actor_role=role,
                 data={"type": esc.type, "incident_id": esc.incident_id, "resource": esc.resource,
                       "access_level": esc.access_level, "duration_minutes": esc.duration_minutes,
                       "flags": [f["type"] for f in flags(esc)]})
    db.commit()
    return esc


def decide(db: Session, esc: Escalation, body: EscalationDecision, role: str) -> Escalation:
    if role != APPROVER_ROLE:
        raise AppError(403, "forbidden", "Only an executive can approve or reject escalations.")
    if esc.requested_by_role == role:
        raise AppError(403, "separation_of_duties", "A request cannot be decided by the same role that made it.")
    if esc.status != "pending":
        raise AppError(409, "invalid_transition", f"Escalation is already {esc.status}.")

    if body.result == "reject":
        if not (body.comment or "").strip():
            raise AppError(422, "reason_required", "Give a reason when rejecting.")
        esc.status = "rejected"
        esc.decision = {"result": "rejected", "by_role": role, "at": utc_now(), "comment": body.comment}
        record_event(db, entity_type="escalation", entity_id=esc.escalation_id, event_type="escalation.rejected",
                     actor_type="human", actor_role=role, data={"comment": body.comment})
        db.commit()
        return esc

    duration = body.duration_minutes or esc.duration_minutes
    if duration > esc.duration_minutes:
        raise AppError(422, "wider_than_requested", "An approval can narrow the request, never widen it.")
    level = body.access_level or esc.access_level
    modified = duration != esc.duration_minutes or level != esc.access_level
    now = _now()
    esc.access_level = level
    esc.duration_minutes = duration
    esc.status = "approved"
    esc.granted_at = _iso(now)
    esc.expires_at = _iso(now + timedelta(minutes=duration))
    esc.decision = {"result": "approved_modified" if modified else "approved", "by_role": role,
                    "at": esc.granted_at, "comment": body.comment}
    record_event(db, entity_type="escalation", entity_id=esc.escalation_id, event_type="escalation.approved",
                 actor_type="human", actor_role=role,
                 data={"modified": modified, "access_level": level, "duration_minutes": duration, "comment": body.comment})
    record_event(db, entity_type="escalation", entity_id=esc.escalation_id, event_type="access.granted",
                 actor_type="system", data={"resource": esc.resource, "access_level": level, "expires_at": esc.expires_at})
    db.commit()
    return esc


def break_glass(db: Session, body: BreakGlassCreate, role: str) -> Escalation:
    inc = get_incident(db, body.incident_id)
    if inc.severity not in ("SEV1", "SEV2"):
        raise AppError(409, "not_allowed", "Break-glass is only for SEV1 or SEV2 incidents. Request a normal escalation.")
    if inc.status in ("recovered", "closed"):
        raise AppError(409, "not_allowed", "The incident is already recovered.")
    now = _now()
    esc = _new(
        db, type="privilege", incident_id=inc.incident_id, risk_id=None, requested_by_role=role,
        action_needed="Emergency access (break-glass)", resource=body.resource, access_level=body.access_level,
        duration_minutes=BREAK_GLASS_MINUTES, justification=body.justification, suggestion=inc.escalation_suggestion,
        break_glass=True, status="approved", granted_at=_iso(now),
        expires_at=_iso(now + timedelta(minutes=BREAK_GLASS_MINUTES)), review_required=True,
        decision={"result": "break_glass", "by_role": role, "at": _iso(now), "comment": None},
    )
    record_event(db, entity_type="escalation", entity_id=esc.escalation_id, event_type="breakglass.used",
                 actor_type="human", actor_role=role,
                 data={"incident_id": inc.incident_id, "resource": esc.resource, "access_level": esc.access_level,
                       "expires_at": esc.expires_at, "justification": esc.justification})
    db.commit()
    return esc


def revoke(db: Session, esc: Escalation, role: str) -> Escalation:
    if esc.status != "approved":
        raise AppError(409, "invalid_transition", f"Only active access can be revoked (status: {esc.status}).")
    if role not in (APPROVER_ROLE, esc.requested_by_role):
        raise AppError(403, "forbidden", "Only the requester or an executive can revoke.")
    esc.status = "revoked"
    esc.revoked_at = utc_now()
    record_event(db, entity_type="escalation", entity_id=esc.escalation_id, event_type="access.revoked",
                 actor_type="human", actor_role=role, data={"resource": esc.resource})
    db.commit()
    return esc


def review(db: Session, esc: Escalation, role: str, justified: bool, comment: str | None) -> Escalation:
    if role != APPROVER_ROLE:
        raise AppError(403, "forbidden", "Only an executive can review break-glass use.")
    if not esc.break_glass or esc.reviewed_at:
        raise AppError(409, "invalid_transition", "Nothing to review.")
    esc.reviewed_at = utc_now()
    esc.decision = {**(esc.decision or {}), "review": {"justified": justified, "by_role": role, "comment": comment}}
    record_event(db, entity_type="escalation", entity_id=esc.escalation_id, event_type="breakglass.reviewed",
                 actor_type="human", actor_role=role, data={"justified": justified, "comment": comment})
    db.commit()
    return esc
