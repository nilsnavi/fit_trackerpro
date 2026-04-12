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

from pydantic import AliasChoices, Field, ValidationInfo, field_validator, model_validator
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
    ALEMBIC_INI_PATH: Annotated[
        str | None,
        Field(
            default=None,
            description=(
                "Path to alembic.ini for readiness migration checks. "
                "When unset, uses embedded migrations in the image (if present) or "
                "``<repo>/database/migrations/alembic.ini`` in a monorepo checkout."
            ),
        ),
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

    # Idempotency-Key replay window for sensitive mutations (seconds).
    IDEMPOTENCY_DEFAULT_TTL_SECONDS: Annotated[
        int,
        Field(description="TTL for Idempotency-Key response replay (workouts, achievements, export).", ge=60),
    ] = 86400
    IDEMPOTENCY_EMERGENCY_TTL_SECONDS: Annotated[
        int,
        Field(description="TTL for emergency notify idempotency keys.", ge=60),
    ] = 3600

    # --- Production-critical (dev/test defaults; override in prod) ---
    TELEGRAM_BOT_TOKEN: Annotated[
        str,
        Field(description="Telegram Bot API token from @BotFather."),
    ] = _DEV_TELEGRAM_BOT_TOKEN
    TELEGRAM_WEBAPP_URL: Annotated[
        str,
        Field(description="Public base URL of the Telegram Mini App (WebApp)."),
    ] = _DEV_TELEGRAM_WEBAPP_URL

    TELEGRAM_BOT_ENABLED: Annotated[
        bool,
        Field(
            description=(
                "Start Telegram bot runtime inside the API process (polling in dev, webhook in prod). "
                "Disable this if another bot instance already runs polling elsewhere; WebApp auth still works."
            )
        ),
    ] = False

    SECRET_KEY: Annotated[
        str,
        Field(description="JWT signing secret; use a long random value in production."),
    ] = _DEV_SECRET_KEY
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # --- Optional: CORS & observability ---
    ALLOWED_ORIGINS: str | List[str] = "*"
    ADMIN_USER_IDS: list[int] = []
    SENTRY_DSN: str | None = None
    SENTRY_RELEASE: Annotated[
        str | None,
        Field(
            description=(
                "Optional explicit Sentry release. If unset, derived from GIT_COMMIT_SHA or APP_VERSION."
            )
        ),
    ] = None
    SENTRY_ERROR_SAMPLE_RATE: Annotated[
        float,
        Field(description="Sampling for error events (0..1).", ge=0.0, le=1.0),
    ] = 1.0
    SENTRY_TRACES_SAMPLE_RATE: Annotated[
        float | None,
        Field(description="Sampling for transactions (0..1). If unset, defaults by ENVIRONMENT.", ge=0.0, le=1.0),
    ] = None
    SENTRY_PROFILES_SAMPLE_RATE: Annotated[
        float | None,
        Field(description="Sampling for profiles (0..1). If unset, uses traces sample rate.", ge=0.0, le=1.0),
    ] = None
    ENABLE_PROMETHEUS_METRICS: bool = True

    # --- Dev UX: create DB schema automatically (no Alembic in repo) ---
    AUTO_CREATE_DB_SCHEMA: Annotated[
        bool,
        Field(
            description=(
                "Create database tables on startup (Base.metadata.create_all). "
                "Intended for local development only; must not be enabled in production."
            )
        ),
    ] = False

    # --- Optional: email ---
    SMTP_HOST: str | None = None
    SMTP_PORT: int = 587
    SMTP_USER: str | None = None
    SMTP_PASSWORD: str | None = None
    SMTP_TLS: bool = True

    # --- Optional: uploads & rate limiting ---
    UPLOAD_DIR: str = "./uploads"
    MAX_UPLOAD_SIZE: int = 10 * 1024 * 1024

    # Tiered HTTP rate limits (see ``RateLimitMiddleware``). ``RATE_LIMIT_PER_MINUTE`` remains a
    # supported env alias for the default (read) tier requests per window.
    RATE_LIMIT_DEFAULT_WINDOW_SECONDS: Annotated[
        int,
        Field(description="Sliding window length for the default (read) tier.", ge=1),
    ] = 60
    RATE_LIMIT_DEFAULT_REQUESTS: int = Field(
        default=60,
        ge=1,
        validation_alias=AliasChoices("RATE_LIMIT_DEFAULT_REQUESTS", "RATE_LIMIT_PER_MINUTE"),
        description="Max requests per window for general read traffic (GET, HEAD, OPTIONS).",
    )

    RATE_LIMIT_AUTH_WINDOW_SECONDS: Annotated[
        int, Field(description="Window for auth routes (login, refresh, logout, /me).", ge=1)
    ] = 60
    RATE_LIMIT_AUTH_REQUESTS: Annotated[
        int, Field(description="Max requests per window for auth routes.", ge=1)
    ] = 10

    RATE_LIMIT_AUTH_STRICT_WINDOW_SECONDS: Annotated[
        int, Field(description="Window for Telegram login (strictest auth tier).", ge=1)
    ] = 60
    RATE_LIMIT_AUTH_STRICT_REQUESTS: Annotated[
        int, Field(description="Max requests per window for POST /telegram.", ge=1)
    ] = 5

    RATE_LIMIT_SYSTEM_WINDOW_SECONDS: Annotated[
        int, Field(description="Window for /api/v1/system/* (excluding skipped probes).", ge=1)
    ] = 60
    RATE_LIMIT_SYSTEM_REQUESTS: Annotated[
        int, Field(description="Max requests per window for system routes.", ge=1)
    ] = 30

    RATE_LIMIT_WRITE_WINDOW_SECONDS: Annotated[
        int,
        Field(
            description="Window for mutating methods (POST/PUT/PATCH/DELETE) outside auth/system.",
            ge=1,
        ),
    ] = 60
    RATE_LIMIT_WRITE_REQUESTS: Annotated[
        int,
        Field(
            description="Max requests per window for write traffic (non-auth, non-system API).",
            ge=1,
        ),
    ] = 40

    RATE_LIMIT_EXPORT_WINDOW_SECONDS: Annotated[
        int, Field(description="Window for analytics export endpoint.", ge=1)
    ] = 3600
    RATE_LIMIT_EXPORT_REQUESTS: Annotated[
        int, Field(description="Max export requests per window.", ge=1)
    ] = 5

    RATE_LIMIT_EMERGENCY_NOTIFY_WINDOW_SECONDS: Annotated[
        int, Field(description="Window for emergency notify endpoints.", ge=1)
    ] = 60
    RATE_LIMIT_EMERGENCY_NOTIFY_REQUESTS: Annotated[
        int, Field(description="Max emergency notify requests per window.", ge=1)
    ] = 20

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

    @field_validator("ADMIN_USER_IDS", mode="before")
    @classmethod
    def parse_admin_user_ids(cls, value):
        if value is None or value == "":
            return []

        if isinstance(value, str):
            raw_parts = [part.strip() for part in value.split(",")]
            parts = [part for part in raw_parts if part]
            if not parts:
                return []
            try:
                return [int(part) for part in parts]
            except ValueError as exc:
                raise ValueError(
                    "ADMIN_USER_IDS must be a comma-separated list of integers, "
                    "for example: 123456789,987654321"
                ) from exc

        if isinstance(value, list):
            parsed: list[int] = []
            for item in value:
                if isinstance(item, bool):
                    raise ValueError(
                        "ADMIN_USER_IDS must contain only integers"
                    )
                if isinstance(item, int):
                    parsed.append(item)
                    continue
                if isinstance(item, str) and item.strip():
                    try:
                        parsed.append(int(item.strip()))
                        continue
                    except ValueError as exc:
                        raise ValueError(
                            "ADMIN_USER_IDS must contain only integers"
                        ) from exc
                raise ValueError("ADMIN_USER_IDS must contain only integers")
            return parsed

        raise ValueError(
            "ADMIN_USER_IDS must be either a comma-separated string or a list of integers"
        )

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
        if environment == "production":
            non_empty = [o for o in value if isinstance(o, str) and o.strip()]
            if not non_empty:
                raise ValueError(
                    "ALLOWED_ORIGINS must list at least one origin in production "
                    "(comma-separated HTTPS origins for the Mini App)"
                )
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

        if self.AUTO_CREATE_DB_SCHEMA:
            errors.append(
                "AUTO_CREATE_DB_SCHEMA must not be enabled in production; "
                "run Alembic migrations instead"
            )

        if errors:
            raise ValueError("; ".join(errors))
        return self


settings = Settings()
