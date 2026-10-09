from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.schemas import RiskOut
from app.services import heatmap as svc
from app.services import insights
from app.services.risks import to_out

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/kpis")
def get_kpis(db: Session = Depends(get_db)):
    return svc.kpis(db)


@router.get("/heatmap")
def get_heatmap(
    source: str | None = None, mode: Literal["all", "open"] = "all", db: Session = Depends(get_db)
):
    return svc.heatmap(db, source, mode)


@router.get("/insights")
def get_insights(db: Session = Depends(get_db)):
    return insights.get_insights(db)


@router.get("/top", response_model=list[RiskOut])
def get_top(limit: int = Query(default=10, ge=1, le=100), db: Session = Depends(get_db)):
    return [to_out(r) for r in svc.top(db, limit)]
