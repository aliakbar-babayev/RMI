from pydantic import ValidationError

from app.ai.client import call_model
from app.ai.prompts import SYSTEM_PROMPT, build_retry_message, build_user_message
from app.models.schemas import AIExtraction


class ExtractionError(Exception):
    pass


def _strip_fences(raw: str) -> str:
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1] if "\n" in raw else ""
        raw = raw.rsplit("```", 1)[0]
    return raw.strip()


def extract_risks(text: str, language_hint: str | None) -> tuple[AIExtraction, int]:
    """Ask the model for risks and validate the reply. Returns (result, attempts used).

    Retries once with the validation error; raw model text never leaves this function.
    """
    user_msg = build_user_message(text, language_hint)
    prompt = user_msg
    last_error = ""
    for attempt in (1, 2):
        raw = call_model(SYSTEM_PROMPT, prompt)
        try:
            return AIExtraction.model_validate_json(_strip_fences(raw)), attempt
        except ValidationError as exc:
            last_error = str(exc)
            prompt = build_retry_message(user_msg, last_error)
    raise ExtractionError(last_error)
