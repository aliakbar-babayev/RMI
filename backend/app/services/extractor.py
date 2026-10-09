from pydantic import BaseModel, ValidationError

from app.ai.client import call_model
from app.ai.prompts import SYSTEM_PROMPT, build_retry_message, build_user_message
from app.models.schemas import AIExtraction


class ExtractionError(Exception):
    pass


def _strip_fences(raw: str) -> str:
    raw = raw.strip()
    # 1. Extract from markdown code fences if present anywhere in the text
    if "```" in raw:
        parts = raw.split("```")
        for i in range(1, len(parts), 2):
            block = parts[i].strip()
            if block.startswith("json\n") or block.startswith("json\r\n"):
                block = block.split("\n", 1)[1].strip()
            elif block.startswith("json"):
                block = block[4:].strip()
            if block.startswith("{"):
                return block
    # 2. Extract JSON object substring between the first { and last }
    if "{" in raw and "}" in raw:
        start = raw.find("{")
        end = raw.rfind("}") + 1
        candidate = raw[start:end].strip()
        if candidate:
            return candidate
    return raw.strip()


def ask_model[T: BaseModel](system_prompt: str, user_msg: str, schema: type[T]) -> tuple[T, int]:
    """Ask the model and validate the reply against `schema`. Returns (result, attempts used).

    Retries once with the validation error; raw model text never leaves this function.
    """
    prompt = user_msg
    last_error = ""
    for attempt in (1, 2):
        raw = call_model(system_prompt, prompt, schema)
        try:
            return schema.model_validate_json(_strip_fences(raw)), attempt
        except ValidationError as exc:
            last_error = str(exc)
            prompt = build_retry_message(user_msg, last_error)

    # Resilient fallback: if custom endpoint failed schema validation twice, fallback to Gemini Flash
    from app.config import settings
    if settings.gcp_api_key and settings.vertex_endpoint_id:
        try:
            from app.ai.client import _call_vertex_rest
            raw = _call_vertex_rest(system_prompt, user_msg, schema)
            return schema.model_validate_json(_strip_fences(raw)), 3
        except Exception:
            pass

    raise ExtractionError(last_error)


def extract_risks(text: str, language_hint: str | None) -> tuple[AIExtraction, int]:
    return ask_model(SYSTEM_PROMPT, build_user_message(text, language_hint), AIExtraction)
