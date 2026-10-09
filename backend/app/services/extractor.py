from pydantic import BaseModel, ValidationError

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
    raise ExtractionError(last_error)


def extract_risks(text: str, language_hint: str | None) -> tuple[AIExtraction, int]:
    return ask_model(SYSTEM_PROMPT, build_user_message(text, language_hint), AIExtraction)
