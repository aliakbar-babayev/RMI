from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./rm_ai.db"

    # "ollama" = local model via Ollama; "vertex" = Google Cloud Vertex AI;
    # "fake" = deterministic stand-in for dev/tests
    ai_provider: str = "ollama"
    ollama_url: str = "http://localhost:11434"
    ollama_model: str = ""  # required when AI_PROVIDER=ollama; set in .env
    ollama_api_key: str | None = None  # sent as "Authorization: Bearer <key>" when set

    # Vertex AI (API key / express mode). Secrets only in .env, never in code.
    gcp_project_id: str = ""
    gcp_location: str = "us-central1"
    gcp_api_key: str = ""
    vertex_model: str = "gemini-2.5-flash"
    # Gemini 2.5 "thinking" tokens before answering. Unset = model default (slow on long documents);
    # 0 = off (fastest, Flash only); e.g. 1024 = a little.
    vertex_thinking_budget: int | None = None

    ai_timeout_seconds: float = 300.0

    max_input_chars: int = 20000
    confidence_review_threshold: float = 0.7

    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]


settings = Settings()
