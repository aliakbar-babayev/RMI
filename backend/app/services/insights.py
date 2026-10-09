"""Dashboard insights (row C): numbers from queries, words from AI.

The backend computes facts from the database. The model may only rephrase and combine
them. Any number in its text that is not in the facts rejects the whole reply, and the
fixed Azerbaijani template sentences are shown instead.
"""

import hashlib
import json
import re
import threading
import time

from pydantic import BaseModel, Field, ValidationError
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.ai.client import ModelUnavailableError, call_model
from app.ai.prompts import INSIGHTS_PROMPT, build_facts_message
from app.models.schemas import OPEN_STATUSES
from app.models.tables import Risk
from app.services.heatmap import heatmap, kpis

CATEGORY_AZ = {
    "financial": "maliyyə",
    "operational": "əməliyyat",
    "it": "İT",
    "infosec": "informasiya təhlükəsizliyi",
    "reputational": "reputasiya",
}

_NUMBER = re.compile(r"\d+(?:[.,]\d+)?")


class _AIInsight(BaseModel):
    text: str = Field(min_length=1)
    fact_ids: list[str] = Field(default_factory=list)


class AIInsights(BaseModel):
    insights: list[_AIInsight] = Field(max_length=4)


# The model is slow and the frontend polls, so the reply is reused until the facts change.
# A template fallback is reused only briefly, so the AI is retried once it is reachable.
_cache: dict[str, tuple[float, dict]] = {}
_FALLBACK_TTL_SECONDS = 60
# Only one model call at a time; polls arriving meanwhile get the template answer.
_generating = threading.Lock()


def build_facts(db: Session) -> list[dict]:
    k = kpis(db)
    facts: list[dict] = []
    if k["total"] == 0:
        return facts

    facts.append({
        "id": "open",
        "values": {"open": k["open"], "critical": k["critical"]},
        "text": f"Hazırda {k['open']} açıq risk var, onlardan {k['critical']} kritikdir.",
    })

    sources = [s for s in heatmap(db, None, "all")["sources"] if s["open"]]
    if sources:
        s = sources[0]
        facts.append({
            "id": "top_source",
            "values": {"source": s["source"], "open": s["open"], "solved": s["solved"]},
            "text": f"Ən yüksək açıq risk {s['source']} mənbəsindədir: {s['open']} açıq, {s['solved']} həll olunmuş risk.",
        })

    if k["needs_review"]:
        facts.append({
            "id": "needs_review",
            "values": {"needs_review": k["needs_review"]},
            "text": f"{k['needs_review']} risk insan yoxlaması tələb edir (aşağı etibar və ya təsdiqlənməmiş sübut).",
        })

    if k["escalated"]:
        facts.append({
            "id": "escalated",
            "values": {"escalated": k["escalated"]},
            "text": f"{k['escalated']} risk eskalasiya olunub və qərar gözləyir.",
        })

    row = db.execute(
        select(Risk.category, func.count()).where(Risk.status.in_(OPEN_STATUSES))
        .group_by(Risk.category).order_by(func.count().desc(), Risk.category).limit(1)
    ).first()
    if row:
        facts.append({
            "id": "top_category",
            "values": {"category": row[0], "count": row[1]},
            "text": f"Açıq risklərin ən çoxu {CATEGORY_AZ[row[0]]} kateqoriyasındadır ({row[1]}).",
        })
    return facts


def _allowed_numbers(facts: list[dict]) -> set[str]:
    return set(_NUMBER.findall(json.dumps([f["values"] for f in facts], ensure_ascii=False)))


def _validate(ai: AIInsights, facts: list[dict]) -> bool:
    ids = {f["id"] for f in facts}
    allowed = _allowed_numbers(facts)
    for item in ai.insights:
        if not item.fact_ids or not set(item.fact_ids) <= ids:
            return False
        if not set(_NUMBER.findall(item.text)) <= allowed:
            return False
    return bool(ai.insights)


def _template(facts: list[dict]) -> list[dict]:
    return [{"text": f["text"], "fact_ids": [f["id"]]} for f in facts]


def get_insights(db: Session) -> dict:
    facts = build_facts(db)
    if not facts:
        return {"insights": [], "facts": [], "generated_by": "none"}

    key = hashlib.sha256(json.dumps(facts, sort_keys=True).encode()).hexdigest()
    fallback = {"insights": _template(facts), "facts": facts, "generated_by": "template"}
    if key in _cache:
        created, cached = _cache[key]
        if cached["generated_by"] == "ai" or time.monotonic() - created < _FALLBACK_TTL_SECONDS:
            return cached

    if not _generating.acquire(blocking=False):
        return fallback
    try:
        result = fallback
        try:
            raw = call_model(INSIGHTS_PROMPT, build_facts_message(json.dumps(facts, ensure_ascii=False)), AIInsights)
            ai = AIInsights.model_validate_json(raw)
            if _validate(ai, facts):
                result = {"insights": [i.model_dump() for i in ai.insights], "facts": facts, "generated_by": "ai"}
        except (ModelUnavailableError, ValidationError):
            pass
        _cache.clear()
        _cache[key] = (time.monotonic(), result)
        return result
    finally:
        _generating.release()
