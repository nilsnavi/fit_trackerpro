"""
User management: public registration/lookup vs authenticated ``/me`` subtree.

Public: ``POST /`` (create), ``GET /{user_id}`` (read by id).
Protected: ``/me`` (profile read, patch, delete) — Bearer access token.
"""
from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import Response as FastApiResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.auth import get_current_user
from app.application.analytics_service import AnalyticsService
from app.application.auth_service import AuthService
from app.application.users_service import UsersService
from app.core.audit import get_client_ip
from app.domain.user import User
from app.infrastructure.database import get_async_db
from app.schemas.auth import UserProfileResponse, UserProfileUpdate
from app.schemas.users import UserCreate, UserResponse

public_users_router = APIRouter()

protected_users_router = APIRouter()


@public_users_router.post("/", response_model=UserResponse)
async def create_user(user: UserCreate, db: AsyncSession = Depends(get_async_db)):
    """Create or update user from Telegram data"""
    service = UsersService(db)
    return await service.create_user(user)


@public_users_router.get("/{user_id}", response_model=UserResponse)
async def get_user(user_id: int, db: AsyncSession = Depends(get_async_db)):
    """Get user by ID"""
    service = UsersService(db)
    return await service.get_user_by_id(user_id)


@protected_users_router.get("/me", response_model=UserProfileResponse)
async def get_current_user_profile(current_user: User = Depends(get_current_user)):
    """Current user profile (same contract as ``/users/auth/me``)."""
    return AuthService.get_profile(current_user)


@protected_users_router.patch("/me", response_model=UserProfileResponse)
async def patch_current_user_profile(
    profile_update: UserProfileUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    """Partial profile update."""
    service = AuthService(db)
    return await service.update_profile(
        current_user=current_user,
        profile_update=profile_update,
        client_ip=get_client_ip(request),
    )


@protected_users_router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_current_user(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    """Delete the authenticated user account."""
    service = AuthService(db)
    await service.delete_account(current_user, client_ip=get_client_ip(request))
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- Compatibility endpoints for the current frontend profile screen ---


@protected_users_router.get("/stats")
@protected_users_router.get("/me/stats")
async def get_user_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    """
    Lightweight user stats for `ProfilePage` (окно — 30 дней).

    Значения считаются по реальной истории: `active_days` — уникальные дни
    с тренировками, остальное — из сводки аналитики. Калории не считаются,
    поэтому поля `total_calories` в ответе нет.
    """
    analytics = AnalyticsService(db)
    summary = await analytics.get_analytics_summary(user_id=current_user.id, period="30d")
    active_days = await analytics.get_active_days(user_id=current_user.id, period="30d")
    return {
        "active_days": active_days,
        "total_workouts": int(summary.total_workouts or 0),
        "current_streak": int(summary.current_streak or 0),
        "longest_streak": int(summary.longest_streak or 0),
        "total_duration": int(summary.total_duration or 0),
    }


@protected_users_router.get("/coach-access")
@protected_users_router.post("/coach-access/generate")
@protected_users_router.delete("/coach-access/{access_id}", status_code=status.HTTP_204_NO_CONTENT)
async def coach_access_unavailable(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    """
    Доступ тренера не реализован (WS2-5).

    Раньше здесь выдавался код, который ничего не открывал, а UI обещал рабочий
    доступ. Пока нет механизма просмотра данных тренером и аудита доступа
    (WS3-8), эндпоинты честно отвечают 501 вместо выдачи бесполезного кода.
    """
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Coach access is not implemented yet",
    )


@protected_users_router.get("/export")
async def export_user_data(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    """
    Simple JSON export for the current UI contract (`usersApi.exportData()` expects a Blob).
    """
    service = UsersService(db)
    payload = await service.build_export_payload(current_user)
    content = json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
    filename = f"fittracker-export-{current_user.id}.json"
    return FastApiResponse(
        content=content,
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
