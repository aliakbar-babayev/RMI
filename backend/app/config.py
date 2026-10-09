from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./rm_ai.db"

    # "ollama" = local model via Ollama; "fake" = deterministic stand-in for dev/tests
    ai_provider: str = "ollama"
    ollama_url: str = "http://localhost:11434"
    ollama_model: str = "qwen2.5:7b"
    ollama_api_key: str | None = None  # sent as "Authorization: Bearer <key>" when set
    ai_timeout_seconds: float = 300.0

    max_input_chars: int = 20000
    confidence_review_threshold: float = 0.7

    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]


settings = Settings()
