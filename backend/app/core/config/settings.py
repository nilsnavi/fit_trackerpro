"""
Application configuration — single entry point (Pydantic Settings).
"""
from pathlib import Path
from typing import List

from pydantic import ValidationInfo, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Backend root (directory containing `.env`)
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(BACKEND_DIR / ".env"),
        case_sensitive=True,
    )

    # Application
    APP_NAME: str = "FitTracker Pro"
    ENVIRONMENT: str = "development"
    DEBUG: bool = False

    # Database
    DATABASE_URL: str
    DATABASE_URL_SYNC: str | None = None

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    ANALYTICS_CACHE_ENABLED: bool = True
    ANALYTICS_CACHE_TTL_SECONDS: int = 120
    ANALYTICS_MEMORY_CACHE_ENABLED: bool = True
    ANALYTICS_MEMORY_CACHE_TTL_SECONDS: int = 20
    ANALYTICS_DEFAULT_MAX_EXERCISES: int = 30
    ANALYTICS_MAX_EXERCISES_HARD_LIMIT: int = 100
    ANALYTICS_DEFAULT_MAX_DATA_POINTS: int = 120
    ANALYTICS_MAX_DATA_POINTS_HARD_LIMIT: int = 365

    # Telegram
    TELEGRAM_BOT_TOKEN: str
    TELEGRAM_WEBAPP_URL: str

    # Security
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # CORS
    ALLOWED_ORIGINS: str | List[str] = "*"

    # Sentry
    SENTRY_DSN: str | None = None

    # Email
    SMTP_HOST: str | None = None
    SMTP_PORT: int = 587
    SMTP_USER: str | None = None
    SMTP_PASSWORD: str | None = None
    SMTP_TLS: bool = True

    # Uploads
    UPLOAD_DIR: str = "./uploads"
    MAX_UPLOAD_SIZE: int = 10 * 1024 * 1024

    # Rate limiting
    RATE_LIMIT_PER_MINUTE: int = 60

    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "text"  # set to "json" for structured stderr logs

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


settings = Settings()
