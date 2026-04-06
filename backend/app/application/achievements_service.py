from __future__ import annotations

from datetime import datetime

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import ACHIEVEMENT_CLAIM, audit_log
from app.domain.exceptions import AchievementNotFoundError
from app.infrastructure.idempotency import run_idempotent
from app.infrastructure.repositories.achievements_repository import AchievementsRepository
from app.schemas.achievements import (
    AchievementLeaderboardEntry,
    AchievementLeaderboardResponse,
    AchievementListResponse,
    AchievementProgressData,
    AchievementResponse,
    AchievementUnlockResponse,
    UserAchievementListResponse,
    UserAchievementResponse,
)
from app.settings import settings


class AchievementsService:
    def __init__(self, db: AsyncSession) -> None:
        self.repository = AchievementsRepository(db)

    async def get_achievements(self, category: str | None) -> AchievementListResponse:
        achievements = await self.repository.list_achievements(category=category)
        categories = await self.repository.list_categories()
        return AchievementListResponse(
            items=[AchievementResponse.model_validate(a, from_attributes=True) for a in achievements],
            total=len(achievements),
            categories=categories,
        )

    async def get_user_achievements(self, user_id: int) -> UserAchievementListResponse:
        rows = await self.repository.list_user_achievements_with_meta(user_id=user_id)

        items = []
        total_points = 0
        completed_count = 0
        in_progress_count = 0
        for ua, achievement in rows:
            is_completed = ua.progress >= 100
            if is_completed:
                completed_count += 1
                total_points += achievement.points
            else:
                in_progress_count += 1
            items.append(
                UserAchievementResponse(
                    id=ua.id,
                    user_id=ua.user_id,
                    achievement_id=ua.achievement_id,
                    achievement=AchievementResponse.model_validate(achievement, from_attributes=True),
                    earned_at=ua.earned_at,
                    progress=ua.progress,
                    progress_data=AchievementProgressData.model_validate(ua.progress_data or {}),
                    is_completed=is_completed,
                )
            )

        recent = [item for item in items if item.is_completed][:5]
        return UserAchievementListResponse(
            items=items,
            total=len(items),
            total_points=total_points,
            completed_count=completed_count,
            in_progress_count=in_progress_count,
            recent_achievements=recent,
        )

    async def get_user_achievement_detail(self, user_id: int, achievement_id: int) -> UserAchievementResponse:
        row = await self.repository.get_user_achievement_with_meta(
            user_id=user_id,
            achievement_id=achievement_id,
        )
        if not row:
            raise AchievementNotFoundError("Achievement not found")
        ua, achievement = row
        return UserAchievementResponse(
            id=ua.id,
            user_id=ua.user_id,
            achievement_id=ua.achievement_id,
            achievement=AchievementResponse.model_validate(achievement, from_attributes=True),
            earned_at=ua.earned_at,
            progress=ua.progress,
            progress_data=AchievementProgressData.model_validate(ua.progress_data or {}),
            is_completed=ua.progress >= 100,
        )

    async def _claim_achievement_once(
        self,
        user_id: int,
        achievement_id: int,
        client_ip: str | None = None,
    ) -> AchievementUnlockResponse:
        achievement = await self.repository.get_achievement(achievement_id=achievement_id)
        if not achievement:
            raise AchievementNotFoundError("Achievement not found")

        existing = await self.repository.get_user_achievement(
            user_id=user_id,
            achievement_id=achievement_id,
        )
        if existing and existing.progress >= 100:
            total_points = await self.repository.get_user_total_points(user_id=user_id)
            return AchievementUnlockResponse(
                unlocked=False,
                achievement=AchievementResponse.model_validate(achievement, from_attributes=True),
                points_earned=0,
                new_total_points=total_points,
                message="Achievement already unlocked",
            )

        try:
            await self.repository.complete_user_achievement(
                user_id=user_id,
                achievement_id=achievement_id,
                existing=existing,
                earned_at=datetime.utcnow(),
            )
        except IntegrityError:
            await self.repository.db.rollback()
            existing_after = await self.repository.get_user_achievement(
                user_id=user_id,
                achievement_id=achievement_id,
            )
            total_points = await self.repository.get_user_total_points(user_id=user_id)
            if existing_after and existing_after.progress >= 100:
                return AchievementUnlockResponse(
                    unlocked=False,
                    achievement=AchievementResponse.model_validate(achievement, from_attributes=True),
                    points_earned=0,
                    new_total_points=total_points,
                    message="Achievement already unlocked",
                )
            raise

        total_points = await self.repository.get_user_total_points(user_id=user_id)
        audit_log(
            action=ACHIEVEMENT_CLAIM,
            user_db_id=user_id,
            resource_type="achievement",
            resource_id=achievement_id,
            client_ip=client_ip,
            meta={"points_earned": achievement.points, "new_total_points": total_points},
        )
        return AchievementUnlockResponse(
            unlocked=True,
            achievement=AchievementResponse.model_validate(achievement, from_attributes=True),
            points_earned=achievement.points,
            new_total_points=total_points,
            message=f"Achievement unlocked! {achievement.description}",
        )

    async def claim_achievement(
        self,
        user_id: int,
        achievement_id: int,
        client_ip: str | None = None,
        idempotency_key: str | None = None,
    ) -> AchievementUnlockResponse:
        async def _run() -> AchievementUnlockResponse:
            return await self._claim_achievement_once(
                user_id=user_id,
                achievement_id=achievement_id,
                client_ip=client_ip,
            )

        if idempotency_key:
            return await run_idempotent(
                user_id=user_id,
                scope=f"achievement_claim:{achievement_id}",
                raw_key=idempotency_key,
                ttl_seconds=settings.IDEMPOTENCY_DEFAULT_TTL_SECONDS,
                execute=_run,
                serialize_result=lambda r: r.model_dump(mode="json"),
                deserialize_result=lambda d: AchievementUnlockResponse.model_validate(d),
            )
        return await _run()

    async def get_leaderboard(self, user_id: int, limit: int) -> AchievementLeaderboardResponse:
        top_users = await self.repository.list_top_users(limit=limit)
        leaderboard: list[AchievementLeaderboardEntry] = []
        for rank, row in enumerate(top_users, 1):
            user = await self.repository.get_user(user_id=row.user_id)
            leaderboard.append(
                AchievementLeaderboardEntry(
                    rank=rank,
                    user_id=row.user_id,
                    username=user.username if user else None,
                    first_name=user.first_name if user else None,
                    total_points=row.total_points,
                    achievements_count=row.achievements_count,
                )
            )

        user_points = await self.repository.get_user_total_points(user_id=user_id)
        higher_ranked = await self.repository.count_higher_ranked_users(user_points=user_points)
        total_users = await self.repository.count_users_in_leaderboard()
        return AchievementLeaderboardResponse(
            leaderboard=leaderboard,
            user_rank=higher_ranked + 1,
            user_points=user_points,
            total_users=total_users,
        )
