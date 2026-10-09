from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # SQLite file locally; on hosts without a persistent disk (Vercel) use Postgres, e.g. Neon:
    # postgres://user:pass@host/db  (the "postgres://" form from hosting dashboards is accepted)
    database_url: str = "sqlite:///./rm_ai.db"

    @field_validator("database_url")
    @classmethod
    def _normalize_db_url(cls, v: str) -> str:
        for prefix in ("postgres://", "postgresql://"):
            if v.startswith(prefix):
                return "postgresql+psycopg://" + v[len(prefix):]
        return v

    # AI Provider: "ollama" (local air-gap), "fake" (dev/tests), or "vertex" (Google Cloud Vertex AI)
    ai_provider: str = "ollama"

    # Ollama settings
    ollama_url: str = "http://localhost:11434"
    ollama_model: str = ""  # required when AI_PROVIDER=ollama; set in .env
    ollama_api_key: str | None = None  # sent as "Authorization: Bearer <key>" when set
    ai_timeout_seconds: float = 300.0

    # Google Cloud Vertex AI settings (Project: rma-app-511110)
    gcp_project_id: str = "rma-app-511110"
    gcp_location: str = "us-central1"
    gcp_api_key: str = ""
    vertex_model: str = "gemini-2.5-flash"
    vertex_endpoint_id: str | None = None
    vertex_staging_bucket: str = "gs://rma-app-511110-ml-data"
    # Gemini 2.5 "thinking" tokens before answering. Unset = model default (slow on long documents);
    # 0 = off (fastest, Flash only); e.g. 1024 = a little.
    vertex_thinking_budget: int | None = None

    max_input_chars: int = 20000
    confidence_review_threshold: float = 0.7

    # Trusted dev origins. In prod behind Nginx this list is tightened.


settings = Settings()
