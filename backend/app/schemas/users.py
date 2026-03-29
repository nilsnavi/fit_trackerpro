"""User management API schemas (non-auth)."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class UserCreate(BaseModel):
    telegram_id: int = Field(
        ...,
        gt=0,
        le=10**12,
        description="Telegram user ID (positive integer).",
    )
    username: Optional[str] = Field(
        None,
        max_length=64,
        description="Telegram @username without the leading @.",
    )
    first_name: Optional[str] = Field(
        None,
        max_length=255,
        description="Given name.",
    )
    last_name: Optional[str] = Field(
        None,
        max_length=255,
        description="Family name.",
    )


class UserResponse(BaseModel):
    id: int
    telegram_id: int
    username: Optional[str]
    first_name: Optional[str]
    last_name: Optional[str]
    created_at: datetime
    updated_at: datetime
