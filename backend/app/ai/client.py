"""The only place that knows which model is used. Everything else calls call_model()."""

import httpx
from pydantic import BaseModel

from app.ai import fake_model
from app.config import settings
from app.models.schemas import AIExtraction


class ModelUnavailableError(Exception):
    pass


def _vertex_model() -> str:
    # Accept "google/<model>" as well as "<model>".
    return settings.vertex_model.removeprefix("google/")


def model_name() -> str:
    if settings.ai_provider == "fake":
        return "fake"
    if settings.ai_provider == "vertex":
        return f"vertex:{_vertex_model()}"
    return f"ollama:{settings.ollama_model}"


def call_model(system_prompt: str, user_text: str, schema: type[BaseModel] = AIExtraction) -> str:
    """Send one prompt to the model and return its raw text reply.

    `schema` is the shape the reply must follow (risk extraction by default).
    """
    if settings.ai_provider == "fake":
        return fake_model.reply(user_text, schema.__name__)
    if settings.ai_provider == "vertex":
        return _call_vertex(system_prompt, user_text)
    return _call_ollama(system_prompt, user_text, schema)


def _call_ollama(system_prompt: str, user_text: str, schema: type[BaseModel]) -> str:
    if not settings.ollama_model:
        raise ModelUnavailableError("OLLAMA_MODEL is not set in .env")
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


def _call_vertex(system_prompt: str, user_text: str) -> str:
    if not (settings.gcp_api_key and settings.gcp_project_id):
        raise ModelUnavailableError("GCP_API_KEY and GCP_PROJECT_ID must be set in .env")
    loc = settings.gcp_location
    url = (
        f"https://{loc}-aiplatform.googleapis.com/v1/projects/{settings.gcp_project_id}"
        f"/locations/{loc}/publishers/google/models/{_vertex_model()}:generateContent"
    )
    try:
        resp = httpx.post(
            url,
            # Key in a header, not the URL, so it does not end up in proxy or access logs.
            headers={"x-goog-api-key": settings.gcp_api_key},
            json={
                "systemInstruction": {"parts": [{"text": system_prompt}]},
                "contents": [{"role": "user", "parts": [{"text": user_text}]}],
                # JSON mode; the reply is still validated against the Pydantic schema.
                "generationConfig": {
                    "temperature": 0,
                    "responseMimeType": "application/json",
                    **(
                        {"thinkingConfig": {"thinkingBudget": settings.vertex_thinking_budget}}
                        if settings.vertex_thinking_budget is not None
                        else {}
                    ),
                },
            },
            timeout=settings.ai_timeout_seconds,
        )
    except httpx.HTTPError as exc:
        raise ModelUnavailableError(f"Vertex AI could not be reached: {exc}") from exc

    if resp.status_code in (401, 403):
        raise ModelUnavailableError("Vertex AI rejected the API key")
    if resp.status_code == 404:
        raise ModelUnavailableError(f"Vertex model '{_vertex_model()}' is not available to this project")
    if resp.status_code == 429:
        raise ModelUnavailableError("Vertex AI rate limit or quota reached; try again shortly")
    if resp.status_code >= 400:
        raise ModelUnavailableError(f"Vertex AI error {resp.status_code}")
    try:
        candidate = resp.json()["candidates"][0]
        parts = candidate.get("content", {}).get("parts", [])
        text = "".join(p.get("text", "") for p in parts if not p.get("thought"))
    except (KeyError, IndexError, ValueError) as exc:
        raise ModelUnavailableError("Vertex AI returned an unexpected response") from exc
    if not text:
        raise ModelUnavailableError(f"Vertex AI returned no text (finish reason: {candidate.get('finishReason')})")
    return text
