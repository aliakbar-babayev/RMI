from fastapi import Header

from app.errors import AppError
from app.models.schemas import Role

# Older clients (the Phase 1 frontend) still send the first role names.
_LEGACY = {"executive": Role.admin, "analyst": Role.admin, "auditor": Role.worker}


def current_role(x_role: str = Header(default=Role.worker.value)) -> Role:
    """No login yet: the frontend's role switcher sends X-Role. Missing = worker (least privilege)."""
    value = x_role.strip().lower()
    if value in _LEGACY:
        return _LEGACY[value]
    try:
        return Role(value)
    except ValueError:
        raise AppError(400, "invalid_role", "X-Role must be admin or worker.")


def require_admin(x_role: str = Header(default=Role.worker.value)) -> Role:
    """Decisions (approve risks, run analyses, move incidents, decide escalations) are admin-only."""
    role = current_role(x_role)
    if role != Role.admin:
        raise AppError(403, "forbidden", "Only an admin can do this.")
    return role


# Any known role may report incidents and request escalations.
can_act = current_role
