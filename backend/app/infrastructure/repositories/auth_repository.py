from __future__ import annotations

from sqlalchemy import select

from app.domain.user import User
from app.infrastructure.repositories.base import SQLAlchemyRepository


class AuthRepository(SQLAlchemyRepository):
    async def get_user_by_telegram_id(self, telegram_id: int):
        result = await self.db.execute(select(User).where(User.telegram_id == telegram_id))
        return result.scalar_one_or_none()

    async def delete_user(self, user: User) -> None:
        await self.delete(user)
        await self.commit()

    async def insert_user(self, user: User) -> User:
        self.add(user)
        await self.commit()
        await self.refresh(user)
        return user

    async def commit_user_fields(self) -> None:
        await self.commit()

    async def save_profile(self, user: User) -> User:
        await self.commit()
        await self.refresh(user)
        return user
