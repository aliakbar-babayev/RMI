from sqlalchemy.orm import Session

from app.ai.client import model_name
from app.ai.prompts import READINESS_PROMPT, build_user_message
from app.models.schemas import READINESS_DIMENSIONS, AIReadiness, AIRisk, AnalysisCreate, Evidence
from app.models.tables import Analysis, Risk
from app.services import scorer
from app.services.audit_log import record_event, utc_now
from app.services.extractor import ask_model, extract_risks
from app.services.verifier import locate_quote

_DIMENSION_POINTS = {"passed": 10, "warning": 5, "failed": 0}
_CRITICAL_PENALTY = 5  # readiness points per open critical risk found in the same document
_MAX_PENALTY = 20


def _verified_evidence(text: str, quotes: list[str]) -> tuple[list[Evidence], int]:
    """Keep only quotes that really appear in the text. Returns (kept, dropped_count)."""
    kept: list[Evidence] = []
    for quote in quotes:
        span = locate_quote(text, quote)
        if span:
            start, end = span
            # Store the exact original-language text from the document, not the model's copy.
            kept.append(Evidence(text=text[start:end], verified=True, start=start, end=end))
    return kept, len(quotes) - len(kept)


def new_analysis(db: Session, *, text: str, language_hint: str | None, source: str | None,
                 actor_role: str | None, incident_id: str | None = None) -> Analysis:
    analysis = Analysis(
        text=text, language_hint=language_hint, source=source, model=model_name(),
        created_at=utc_now(), stats={}, incident_id=incident_id,
    )
    db.add(analysis)
    db.flush()
    analysis.analysis_id = f"AN-{analysis.id:03d}"
    record_event(
        db,
        entity_type="analysis",
        entity_id=analysis.analysis_id,
        event_type="analysis.requested",
        actor_type="human" if actor_role else "system",
        actor_role=actor_role,
        data={"chars": len(text), "language_hint": language_hint, "source": source, "incident_id": incident_id},
    )
    return analysis


def save_risks(db: Session, analysis: Analysis, items: list[AIRisk], fallback_source: str | None) -> dict:
    """Score, verify and store AI-proposed risks for an analysis. Returns counts for stats."""
    now = utc_now()
    dropped_quotes = 0
    flagged = 0
    for item in items:
        evidence, dropped = _verified_evidence(analysis.text, [e.quote for e in item.evidence])
        dropped_quotes += dropped
        probability = scorer.effective_probability(item.classification, item.probability)
        score = scorer.compute_score(probability, item.impact)
        review = scorer.needs_review(item.confidence, bool(evidence))
        flagged += review
        risk = Risk(
            analysis_pk=analysis.id,
            classification=item.classification,
            statement=item.statement,
            category=item.category,
            source=item.source or fallback_source,
            probability=probability,
            impact=item.impact,
            score=score,
            level=scorer.level_for(score),
            rationale=item.rationale,
            evidence=[e.model_dump() for e in evidence],
            confidence=item.confidence,
            needs_review=review,
            strategy=item.strategy,
            actions=item.actions,
            trigger=item.trigger,
            owner_role=item.owner_role,
            status="pending",
            created_at=now,
            updated_at=now,
        )
        db.add(risk)
        db.flush()
        risk.risk_id = f"R-{risk.id:03d}"
        record_event(
            db,
            entity_type="risk",
            entity_id=risk.risk_id,
            event_type="risk.proposed",
            actor_type="ai",
            data={"analysis_id": analysis.analysis_id, "score": score, "needs_review": review,
                  "incident_id": analysis.incident_id},
        )
    return {"risks_returned": len(items), "needs_review": flagged, "dropped_quotes": dropped_quotes}


def readiness_review(text: str, language_hint: str | None, critical_risks: int) -> dict:
    """12-dimension plan review. The model rates each dimension; the backend computes the score."""
    review, attempts = ask_model(READINESS_PROMPT, build_user_message(text, language_hint), AIReadiness)
    by_key = {d.key: d for d in review.dimensions if d.key in READINESS_DIMENSIONS}
    dimensions = []
    for key in READINESS_DIMENSIONS:
        d = by_key.get(key)
        if d is None:
            dimensions.append({"key": key, "status": "warning", "finding": "", "recommendation": "",
                               "evidence": None, "assessed": False})
            continue
        evidence = None
        if d.quote:
            kept, _ = _verified_evidence(text, [d.quote])
            evidence = kept[0].model_dump() if kept else None
        dimensions.append({"key": key, "status": d.status.value, "finding": d.finding,
                           "recommendation": d.recommendation, "evidence": evidence, "assessed": True})

    base = round(sum(_DIMENSION_POINTS[d["status"]] for d in dimensions) / len(dimensions) * 10)
    penalty = min(_MAX_PENALTY, critical_risks * _CRITICAL_PENALTY)
    score = max(0, base - penalty)
    decision = "go" if score >= 75 else "conditional_go" if score >= 50 else "not_ready"
    return {
        "score": score,
        "base_score": base,
        "critical_penalty": penalty,
        "decision": decision,
        "summary": review.summary,
        "dimensions": dimensions,
        "counts": {s: sum(1 for d in dimensions if d["status"] == s) for s in ("passed", "warning", "failed")},
        "model_attempts": attempts,
    }


def run_analysis(db: Session, body: AnalysisCreate, actor_role: str) -> Analysis:
    # Model calls happen before any database write, so a slow model never holds the audit lock.
    extraction, attempts = extract_risks(body.text, body.language_hint)
    critical = sum(
        1 for r in extraction.risks
        if scorer.compute_score(scorer.effective_probability(r.classification, r.probability), r.impact) >= 16
    )
    readiness = readiness_review(body.text, body.language_hint, critical) if body.readiness else None

    analysis = new_analysis(db, text=body.text, language_hint=body.language_hint, source=body.source,
                            actor_role=actor_role)
    stats = save_risks(db, analysis, extraction.risks, body.source)
    analysis.stats = {**stats, "model_attempts": attempts}
    analysis.readiness = readiness
    record_event(
        db,
        entity_type="analysis",
        entity_id=analysis.analysis_id,
        event_type="analysis.completed",
        actor_type="system",
        data={"model": analysis.model, **analysis.stats,
              **({"readiness_score": readiness["score"], "decision": readiness["decision"]} if readiness else {})},
    )
    db.commit()
    db.refresh(analysis)
    return analysis
