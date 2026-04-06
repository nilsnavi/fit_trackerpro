"""
Achievements API Router
HTTP-only endpoints delegating business logic to services
"""
from typing import Optional

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.auth import get_current_user
from app.api.deps.idempotency import optional_idempotency_key
from app.application.achievements_service import AchievementsService
from app.core.audit import get_client_ip
from app.domain.user import User
from app.infrastructure.database import get_async_db
from app.schemas.achievements import (
    AchievementLeaderboardResponse,
    AchievementListResponse,
    AchievementUnlockResponse,
    UserAchievementListResponse,
    UserAchievementResponse,
)

router = APIRouter()


@router.get("/", response_model=AchievementListResponse)
async def get_achievements(
    category: Optional[str] = Query(None, pattern="^(workouts|health|streaks|social|general)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = AchievementsService(db)
    return await service.get_achievements(category=category)


@router.get("/user", response_model=UserAchievementListResponse)
async def get_user_achievements(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = AchievementsService(db)
    return await service.get_user_achievements(user_id=current_user.id)


@router.get("/user/{achievement_id}", response_model=UserAchievementResponse)
async def get_user_achievement_detail(
    achievement_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = AchievementsService(db)
    return await service.get_user_achievement_detail(
        user_id=current_user.id,
        achievement_id=achievement_id,
    )


@router.post("/{achievement_id}/claim", response_model=AchievementUnlockResponse)
async def claim_achievement(
    achievement_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
    idempotency_key: str | None = Depends(optional_idempotency_key),
):
    service = AchievementsService(db)
    return await service.claim_achievement(
        user_id=current_user.id,
        achievement_id=achievement_id,
        client_ip=get_client_ip(request),
        idempotency_key=idempotency_key,
    )


@router.get("/leaderboard", response_model=AchievementLeaderboardResponse)
async def get_achievements_leaderboard(
    limit: int = Query(10, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = AchievementsService(db)
    return await service.get_leaderboard(user_id=current_user.id, limit=limit)
