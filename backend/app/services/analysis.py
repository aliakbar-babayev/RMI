from sqlalchemy.orm import Session

from app.ai.client import model_name
from app.models.schemas import AIRisk, AnalysisCreate, Evidence
from app.models.tables import Analysis, Risk
from app.services import scorer
from app.services.audit_log import record_event, utc_now
from app.services.extractor import extract_risks
from app.services.verifier import locate_quote


def _verified_evidence(text: str, item: AIRisk) -> tuple[list[Evidence], int]:
    """Keep only quotes that really appear in the text. Returns (kept, dropped_count)."""
    kept: list[Evidence] = []
    for ev in item.evidence:
        span = locate_quote(text, ev.quote)
        if span:
            start, end = span
            # Store the exact original-language text from the document, not the model's copy.
            kept.append(Evidence(text=text[start:end], verified=True, start=start, end=end))
    return kept, len(item.evidence) - len(kept)


def run_analysis(db: Session, body: AnalysisCreate, actor_role: str) -> Analysis:
    extraction, attempts = extract_risks(body.text, body.language_hint)

    now = utc_now()
    analysis = Analysis(
        text=body.text,
        language_hint=body.language_hint,
        source=body.source,
        model=model_name(),
        created_at=now,
        stats={},
    )
    db.add(analysis)
    db.flush()
    analysis.analysis_id = f"AN-{analysis.id:03d}"
    record_event(
        db,
        entity_type="analysis",
        entity_id=analysis.analysis_id,
        event_type="analysis.requested",
        actor_type="human",
        actor_role=actor_role,
        data={"chars": len(body.text), "language_hint": body.language_hint, "source": body.source},
    )

    dropped_quotes = 0
    flagged = 0
    for item in extraction.risks:
        evidence, dropped = _verified_evidence(body.text, item)
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
            source=item.source or body.source,
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
            data={"analysis_id": analysis.analysis_id, "score": score, "needs_review": review},
        )

    analysis.stats = {
        "risks_returned": len(extraction.risks),
        "needs_review": flagged,
        "dropped_quotes": dropped_quotes,
        "model_attempts": attempts,
    }
    record_event(
        db,
        entity_type="analysis",
        entity_id=analysis.analysis_id,
        event_type="analysis.completed",
        actor_type="system",
        data={"model": analysis.model, **analysis.stats},
    )
    db.commit()
    db.refresh(analysis)
    return analysis
