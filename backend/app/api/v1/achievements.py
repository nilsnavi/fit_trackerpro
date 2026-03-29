"""
Achievements API Router
HTTP-only endpoints delegating business logic to services
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.middleware.auth import get_current_user
from app.domain.user import User
from app.domain.exceptions import AchievementNotFoundError
from app.infrastructure.database import get_async_db
from app.schemas.achievements import (
    AchievementLeaderboardResponse,
    AchievementListResponse,
    AchievementUnlockResponse,
    UserAchievementListResponse,
    UserAchievementResponse,
)
from app.application.achievements_service import AchievementsService

router = APIRouter()


def _map_service_error(exc: Exception) -> HTTPException:
    if isinstance(exc, AchievementNotFoundError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    return HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Unexpected achievements error")


@router.get("/", response_model=AchievementListResponse)
async def get_achievements(
    category: Optional[str] = Query(None, pattern="^(workouts|health|streaks|social|general)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = AchievementsService(db)
    try:
        return await service.get_achievements(category=category)
    except Exception as exc:
        raise _map_service_error(exc) from exc


@router.get("/user", response_model=UserAchievementListResponse)
async def get_user_achievements(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = AchievementsService(db)
    try:
        return await service.get_user_achievements(user_id=current_user.id)
    except Exception as exc:
        raise _map_service_error(exc) from exc


@router.get("/user/{achievement_id}", response_model=UserAchievementResponse)
async def get_user_achievement_detail(
    achievement_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = AchievementsService(db)
    try:
        return await service.get_user_achievement_detail(
            user_id=current_user.id,
            achievement_id=achievement_id,
        )
    except Exception as exc:
        raise _map_service_error(exc) from exc


@router.post("/{achievement_id}/claim", response_model=AchievementUnlockResponse)
async def claim_achievement(
    achievement_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = AchievementsService(db)
    try:
        return await service.claim_achievement(
            user_id=current_user.id,
            achievement_id=achievement_id,
        )
    except Exception as exc:
        raise _map_service_error(exc) from exc


@router.get("/leaderboard", response_model=AchievementLeaderboardResponse)
async def get_achievements_leaderboard(
    limit: int = Query(10, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = AchievementsService(db)
    try:
        return await service.get_leaderboard(user_id=current_user.id, limit=limit)
    except Exception as exc:
        raise _map_service_error(exc) from exc
