"""
Application configuration using Pydantic Settings
"""
import os
from pathlib import Path
from typing import List
from pydantic_settings import BaseSettings
from pydantic import validator


# Get the backend directory path
BACKEND_DIR = Path(__file__).parent.parent.parent


class Settings(BaseSettings):
    # Application
    APP_NAME: str = "FitTracker Pro"
    DEBUG: bool = False
    ENVIRONMENT: str = "production"

    # Database
    DATABASE_URL: str
    DATABASE_URL_SYNC: str | None = None

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

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

    @validator("ALLOWED_ORIGINS", pre=True)
    def parse_allowed_origins(cls, v):
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",")]
        return v

    class Config:
        env_file = str(BACKEND_DIR / ".env")
        case_sensitive = True


settings = Settings()
