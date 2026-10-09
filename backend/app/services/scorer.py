from app.config import settings
from app.models.schemas import Classification, Level


def compute_score(probability: int, impact: int) -> int:
    return probability * impact


def level_for(score: int) -> Level:
    if score >= 16:
        return Level.critical
    if score >= 10:
        return Level.high
    if score >= 5:
        return Level.medium
    return Level.low


def effective_probability(classification: Classification, probability: int) -> int:
    # An issue has already happened (P = 100%), which is the top of the 1–5 scale.
    return 5 if classification == Classification.issue else probability


def needs_review(confidence: float, has_verified_evidence: bool) -> bool:
    return confidence < settings.confidence_review_threshold or not has_verified_evidence
