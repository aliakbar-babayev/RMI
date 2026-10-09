from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.services.incidents import blast_radius, systems_by_id

router = APIRouter(prefix="/systems", tags=["systems"])


def _out(s) -> dict:
    return {"system_id": s.system_id, "name": s.name, "kind": s.kind, "environment": s.environment,
            "criticality": s.criticality, "owner_team": s.owner_team, "description": s.description,
            "depends_on": s.depends_on}


@router.get("")
def list_systems(db: Session = Depends(get_db)):
    return [_out(s) for s in sorted(systems_by_id(db).values(), key=lambda s: s.system_id)]


@router.get("/{system_id}/blast-radius")
def system_blast_radius(system_id: str, db: Session = Depends(get_db)):
    """What would be affected if this system failed (for planning, before any incident)."""
    registry = systems_by_id(db)
    if system_id not in registry:
        from app.errors import AppError

        raise AppError(404, "not_found", f"System {system_id} is not in the registry.")
    return blast_radius([system_id], registry)
