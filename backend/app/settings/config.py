"""
Application configuration — single entry point (Pydantic Settings).

Environment variables are read from the process environment and ``backend/.env``.

**Production-critical** (must be overridden for real deployments; insecure defaults
below exist only for local development and automated tests — they are rejected when
``ENVIRONMENT=production``):

- ``DATABASE_URL``
- ``TELEGRAM_BOT_TOKEN``
- ``TELEGRAM_WEBAPP_URL``
- ``SECRET_KEY``

**Optional** — all other fields have safe defaults suitable for dev/test.
"""
from __future__ import annotations

from pathlib import Path
from typing import Annotated, Final, List, Self

from pydantic import Field, ValidationInfo, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Backend root (directory containing `.env`)
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent

# -----------------------------------------------------------------------------
# Local development / test defaults — never rely on these in production
# (validated in ``reject_insecure_defaults_in_production``).
# -----------------------------------------------------------------------------
_DEV_DATABASE_URL: Final[str] = "sqlite+aiosqlite:///./dev.db"
_DEV_SECRET_KEY: Final[str] = "dev-only-secret-key-minimum-32-characters-long"
_DEV_TELEGRAM_BOT_TOKEN: Final[str] = (
    "000000000:AAHdev_local_only_replace_for_production_bot_token"
)
_DEV_TELEGRAM_WEBAPP_URL: Final[str] = "http://localhost:5173"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(BACKEND_DIR / ".env"),
        case_sensitive=True,
        env_ignore_empty=True,
    )

    # --- Optional: application metadata & runtime mode ---
    APP_NAME: Annotated[str, Field(description="Human-readable API name.")] = "FitTracker Pro"
    APP_VERSION: Annotated[str, Field(description="Semantic version exposed in /version.")] = (
        "1.0.0"
    )
    GIT_COMMIT_SHA: Annotated[
        str | None,
        Field(description="Git SHA for release diagnostics (optional)."),
    ] = None
    BUILD_TIMESTAMP: Annotated[
        str | None,
        Field(description="ISO 8601 build time for release diagnostics (optional)."),
    ] = None
    ENVIRONMENT: Annotated[
        str,
        Field(description='Logical environment: "development", "test", "production", etc.'),
    ] = "development"
    DEBUG: Annotated[
        bool,
        Field(description="Enable FastAPI docs and verbose behaviour; must be false in production."),
    ] = False

    # --- Production-critical (dev/test defaults; override in prod) ---
    DATABASE_URL: Annotated[
        str,
        Field(
            description=(
                "SQLAlchemy async URL. Defaults to local SQLite file for development; "
                "use PostgreSQL in production."
            ),
        ),
    ] = _DEV_DATABASE_URL
    DATABASE_URL_SYNC: Annotated[
        str | None,
        Field(description="Optional sync driver URL (e.g. Alembic); derived if unset."),
    ] = None

    # --- Optional: Redis & analytics caching ---
    REDIS_URL: Annotated[str, Field(description="Redis for rate limiting and optional cache.")] = (
        "redis://localhost:6379/0"
    )
    ANALYTICS_CACHE_ENABLED: bool = True
    ANALYTICS_CACHE_TTL_SECONDS: int = 120
    ANALYTICS_MEMORY_CACHE_ENABLED: bool = True
    ANALYTICS_MEMORY_CACHE_TTL_SECONDS: int = 20
    ANALYTICS_DEFAULT_MAX_EXERCISES: int = 30
    ANALYTICS_MAX_EXERCISES_HARD_LIMIT: int = 100
    ANALYTICS_DEFAULT_MAX_DATA_POINTS: int = 120
    ANALYTICS_MAX_DATA_POINTS_HARD_LIMIT: int = 365

    # --- Production-critical (dev/test defaults; override in prod) ---
    TELEGRAM_BOT_TOKEN: Annotated[
        str,
        Field(description="Telegram Bot API token from @BotFather."),
    ] = _DEV_TELEGRAM_BOT_TOKEN
    TELEGRAM_WEBAPP_URL: Annotated[
        str,
        Field(description="Public base URL of the Telegram Mini App (WebApp)."),
    ] = _DEV_TELEGRAM_WEBAPP_URL

    SECRET_KEY: Annotated[
        str,
        Field(description="JWT signing secret; use a long random value in production."),
    ] = _DEV_SECRET_KEY
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # --- Optional: CORS & observability ---
    ALLOWED_ORIGINS: str | List[str] = "*"
    SENTRY_DSN: str | None = None
    ENABLE_PROMETHEUS_METRICS: bool = True

    # --- Optional: email ---
    SMTP_HOST: str | None = None
    SMTP_PORT: int = 587
    SMTP_USER: str | None = None
    SMTP_PASSWORD: str | None = None
    SMTP_TLS: bool = True

    # --- Optional: uploads & rate limiting ---
    UPLOAD_DIR: str = "./uploads"
    MAX_UPLOAD_SIZE: int = 10 * 1024 * 1024
    RATE_LIMIT_PER_MINUTE: int = 60

    # --- Optional: logging ---
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "text"

    @field_validator(
        "DATABASE_URL",
        "TELEGRAM_BOT_TOKEN",
        "TELEGRAM_WEBAPP_URL",
        "SECRET_KEY",
        mode="before",
    )
    @classmethod
    def validate_required_not_empty(cls, value, info: ValidationInfo):
        if value is None:
            raise ValueError(f"{info.field_name} is required")
        if isinstance(value, str) and not value.strip():
            raise ValueError(f"{info.field_name} cannot be empty")
        return value

    @field_validator("TELEGRAM_BOT_TOKEN")
    @classmethod
    def validate_telegram_bot_token(cls, value: str) -> str:
        normalized = value.strip()
        if normalized.lower() in {"your_telegram_bot_token_here", "changeme", "your_token_here"}:
            raise ValueError("TELEGRAM_BOT_TOKEN contains a placeholder value")
        return normalized

    @field_validator("TELEGRAM_WEBAPP_URL")
    @classmethod
    def validate_telegram_webapp_url(cls, value: str) -> str:
        normalized = value.strip()
        if "your-domain.com" in normalized.lower():
            raise ValueError("TELEGRAM_WEBAPP_URL contains a placeholder value")
        return normalized

    @field_validator("GIT_COMMIT_SHA", "BUILD_TIMESTAMP", mode="before")
    @classmethod
    def empty_optional_release_metadata(cls, value):
        if value is None:
            return None
        if isinstance(value, str) and not value.strip():
            return None
        return value.strip() if isinstance(value, str) else value

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def parse_allowed_origins(cls, v):
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",")]
        return v

    @field_validator("SECRET_KEY")
    @classmethod
    def validate_secret_key(cls, value: str, info: ValidationInfo) -> str:
        environment = info.data.get("ENVIRONMENT", "production")
        if environment == "production" and len(value) < 32:
            raise ValueError("SECRET_KEY must be at least 32 characters in production")
        return value

    @field_validator("ALLOWED_ORIGINS")
    @classmethod
    def validate_allowed_origins(cls, value, info: ValidationInfo):
        environment = info.data.get("ENVIRONMENT", "production")
        if environment == "production" and value == ["*"]:
            raise ValueError("ALLOWED_ORIGINS cannot be wildcard in production")
        return value

    @field_validator("DEBUG")
    @classmethod
    def validate_debug_in_production(cls, value: bool, info: ValidationInfo) -> bool:
        environment = info.data.get("ENVIRONMENT", "production")
        if environment == "production" and value:
            raise ValueError("DEBUG must be false in production")
        return value

    @model_validator(mode="after")
    def reject_insecure_defaults_in_production(self) -> Self:
        """Block development defaults when ``ENVIRONMENT`` is production."""
        if self.ENVIRONMENT.strip().lower() != "production":
            return self

        errors: list[str] = []
        db = self.DATABASE_URL.strip()
        if db in (_DEV_DATABASE_URL, "sqlite+aiosqlite:///:memory:"):
            errors.append(
                "DATABASE_URL must not use the SQLite dev default or in-memory DB in production"
            )
        elif db.lower().startswith("sqlite"):
            errors.append("DATABASE_URL must use a production-grade database (not SQLite)")

        if self.SECRET_KEY == _DEV_SECRET_KEY:
            errors.append("SECRET_KEY must be set to a unique secret in production")

        if self.TELEGRAM_BOT_TOKEN == _DEV_TELEGRAM_BOT_TOKEN:
            errors.append("TELEGRAM_BOT_TOKEN must be set to a real bot token in production")

        if self.TELEGRAM_WEBAPP_URL.strip() == _DEV_TELEGRAM_WEBAPP_URL:
            errors.append("TELEGRAM_WEBAPP_URL must be set to your public Mini App URL in production")

        if errors:
            raise ValueError("; ".join(errors))
        return self


settings = Settings()
