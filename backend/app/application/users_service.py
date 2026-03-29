"""User management use cases (not Telegram auth)."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.exceptions import NotImplementedFeatureError
from app.schemas.users import UserCreate, UserResponse


class UsersService:
    def __init__(self, _db: AsyncSession) -> None:
        pass

    async def create_user(self, data: UserCreate) -> UserResponse:
        # TODO: Implement user creation logic
        now = datetime.utcnow()
        return UserResponse(
            id=1,
            telegram_id=data.telegram_id,
            username=data.username,
            first_name=data.first_name,
            last_name=data.last_name,
            created_at=now,
            updated_at=now,
        )

    async def get_user_by_id(self, user_id: int) -> UserResponse:
        raise NotImplementedFeatureError("Not implemented yet")
