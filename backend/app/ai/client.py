"""The only place that knows which model is used. Everything else calls call_model()."""

import httpx
from pydantic import BaseModel

from app.ai import fake_model
from app.config import settings
from app.models.schemas import AIExtraction


class ModelUnavailableError(Exception):
    pass


def model_name() -> str:
    return "fake" if settings.ai_provider == "fake" else f"ollama:{settings.ollama_model}"


def call_model(system_prompt: str, user_text: str, schema: type[BaseModel] = AIExtraction) -> str:
    """Send one prompt to the model and return its raw text reply.

    `schema` is the shape the reply must follow (risk extraction by default).
    """
    if settings.ai_provider == "fake":
        return fake_model.reply(user_text)

    headers = {"Authorization": f"Bearer {settings.ollama_api_key}"} if settings.ollama_api_key else {}
    try:
        resp = httpx.post(
            f"{settings.ollama_url.rstrip('/')}/api/chat",
            headers=headers,
            json={
                "model": settings.ollama_model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_text},
                ],
                "stream": False,
                # Ollama constrains decoding to this JSON schema; the result is still validated.
                "format": schema.model_json_schema(),
                "options": {"temperature": 0},
            },
            timeout=settings.ai_timeout_seconds,
        )
        if resp.status_code in (401, 403):
            raise ModelUnavailableError("the model server rejected the API key")
        resp.raise_for_status()
        return resp.json()["message"]["content"]
    except (httpx.HTTPError, KeyError, ValueError) as exc:
        raise ModelUnavailableError(str(exc)) from exc
