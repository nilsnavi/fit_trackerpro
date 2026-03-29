from __future__ import annotations

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain import Challenge, User


class ChallengesRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def count_challenges(
        self,
        status: str | None,
        challenge_type: str | None,
        is_public: bool | None,
    ) -> int:
        query = select(func.count(Challenge.id))
        if status:
            query = query.where(Challenge.status == status)
        if challenge_type:
            query = query.where(Challenge.type == challenge_type)
        if is_public is not None:
            query = query.where(Challenge.is_public == is_public)
        result = await self.db.execute(query)
        return int(result.scalar() or 0)

    async def list_challenges(
        self,
        status: str | None,
        challenge_type: str | None,
        is_public: bool | None,
        page: int,
        page_size: int,
    ):
        query = select(Challenge)
        if status:
            query = query.where(Challenge.status == status)
        if challenge_type:
            query = query.where(Challenge.type == challenge_type)
        if is_public is not None:
            query = query.where(Challenge.is_public == is_public)
        query = query.order_by(desc(Challenge.start_date)).offset((page - 1) * page_size).limit(page_size)
        result = await self.db.execute(query)
        return result.scalars().all()

    async def get_challenge(self, challenge_id: int):
        result = await self.db.execute(select(Challenge).where(Challenge.id == challenge_id))
        return result.scalar_one_or_none()

    async def get_user(self, user_id: int):
        result = await self.db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()
