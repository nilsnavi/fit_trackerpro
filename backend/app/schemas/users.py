"""User management API schemas (non-auth)."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class UserCreate(BaseModel):
    telegram_id: int
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None


class UserResponse(BaseModel):
    id: int
    telegram_id: int
    username: Optional[str]
    first_name: Optional[str]
    last_name: Optional[str]
    created_at: datetime
    updated_at: datetime
