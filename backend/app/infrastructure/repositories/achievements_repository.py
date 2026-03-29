from __future__ import annotations

from sqlalchemy import and_, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.achievement import Achievement
from app.domain.user import User
from app.domain.user_achievement import UserAchievement


class AchievementsRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list_achievements(self, category: str | None):
        query = select(Achievement)
        if category:
            query = query.where(Achievement.category == category)
        query = query.order_by(Achievement.display_order, Achievement.category)
        result = await self.db.execute(query)
        return result.scalars().all()

    async def list_categories(self):
        result = await self.db.execute(select(Achievement.category).distinct())
        return [row[0] for row in result.all()]

    async def list_user_achievements_with_meta(self, user_id: int):
        result = await self.db.execute(
            select(UserAchievement, Achievement)
            .join(Achievement, UserAchievement.achievement_id == Achievement.id)
            .where(UserAchievement.user_id == user_id)
            .order_by(desc(UserAchievement.earned_at))
        )
        return result.all()

    async def get_user_achievement_with_meta(self, user_id: int, achievement_id: int):
        result = await self.db.execute(
            select(UserAchievement, Achievement)
            .join(Achievement, UserAchievement.achievement_id == Achievement.id)
            .where(
                and_(
                    UserAchievement.user_id == user_id,
                    UserAchievement.achievement_id == achievement_id,
                )
            )
        )
        return result.first()

    async def get_achievement(self, achievement_id: int):
        result = await self.db.execute(select(Achievement).where(Achievement.id == achievement_id))
        return result.scalar_one_or_none()

    async def get_user_achievement(self, user_id: int, achievement_id: int):
        result = await self.db.execute(
            select(UserAchievement).where(
                and_(
                    UserAchievement.user_id == user_id,
                    UserAchievement.achievement_id == achievement_id,
                )
            )
        )
        return result.scalar_one_or_none()

    async def get_user_total_points(self, user_id: int) -> int:
        result = await self.db.execute(
            select(func.sum(Achievement.points))
            .join(UserAchievement, UserAchievement.achievement_id == Achievement.id)
            .where(
                and_(
                    UserAchievement.user_id == user_id,
                    UserAchievement.progress >= 100,
                )
            )
        )
        return int(result.scalar() or 0)

    async def list_top_users(self, limit: int):
        result = await self.db.execute(
            select(
                UserAchievement.user_id,
                func.sum(Achievement.points).label("total_points"),
                func.count(UserAchievement.id).label("achievements_count"),
            )
            .join(Achievement, UserAchievement.achievement_id == Achievement.id)
            .where(UserAchievement.progress >= 100)
            .group_by(UserAchievement.user_id)
            .order_by(desc("total_points"))
            .limit(limit)
        )
        return result.all()

    async def get_user(self, user_id: int):
        result = await self.db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def count_higher_ranked_users(self, user_points: int) -> int:
        result = await self.db.execute(
            select(func.count()).select_from(
                select(UserAchievement.user_id)
                .join(Achievement, UserAchievement.achievement_id == Achievement.id)
                .where(UserAchievement.progress >= 100)
                .group_by(UserAchievement.user_id)
                .having(func.sum(Achievement.points) > user_points)
                .subquery()
            )
        )
        return int(result.scalar() or 0)

    async def count_users_in_leaderboard(self) -> int:
        result = await self.db.execute(
            select(func.count()).select_from(
                select(UserAchievement.user_id).distinct().subquery()
            )
        )
        return int(result.scalar() or 0)
