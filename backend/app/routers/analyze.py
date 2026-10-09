from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai.client import ModelUnavailableError
from app.config import settings
from app.db import get_db
from app.deps import can_act
from app.errors import AppError
from app.models.schemas import AnalysisCreate, AnalysisOut, Role
from app.models.tables import Analysis
from app.services.analysis import run_analysis
from app.services.extractor import ExtractionError
from app.services.risks import to_out

router = APIRouter(prefix="/analyses", tags=["analyses"])


def _out(a: Analysis) -> AnalysisOut:
    return AnalysisOut(
        analysis_id=a.analysis_id, text=a.text, language_hint=a.language_hint, source=a.source,
        model=a.model, stats=a.stats, created_at=a.created_at, risks=[to_out(r) for r in a.risks],
    )


@router.post("", response_model=AnalysisOut, status_code=201)
def create_analysis(body: AnalysisCreate, db: Session = Depends(get_db), role: Role = Depends(can_act)):
    if not body.text.strip():
        raise AppError(422, "empty_input", "Text is empty.")
    if len(body.text) > settings.max_input_chars:
        raise AppError(
            413, "input_too_long", f"Text is {len(body.text)} characters; the limit is {settings.max_input_chars}."
        )
    try:
        analysis = run_analysis(db, body, role)
    except ModelUnavailableError as exc:
        raise AppError(503, "model_unavailable", f"The local AI model could not be reached: {exc}")
    except ExtractionError:
        raise AppError(502, "invalid_model_output", "The AI returned invalid output twice. Try again.")
    return _out(analysis)


@router.get("/{analysis_id}", response_model=AnalysisOut)
def get_analysis(analysis_id: str, db: Session = Depends(get_db)):
    a = db.scalar(select(Analysis).where(Analysis.analysis_id == analysis_id))
    if not a:
        raise AppError(404, "not_found", f"Analysis {analysis_id} not found.")
    return _out(a)
