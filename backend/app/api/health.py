"""
Health API Router
HTTP-only endpoints delegating business logic to services
"""
from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.middleware.auth import get_current_user
from app.models import User, get_async_db
from app.schemas.health import (
    DailyWellnessCreate,
    DailyWellnessResponse,
    GlucoseHistoryResponse,
    GlucoseLogCreate,
    GlucoseLogResponse,
    HealthStatsResponse,
)
from app.services.health_service import HealthNotFoundError, HealthService

router = APIRouter()


def _map_service_error(exc: Exception) -> HTTPException:
    if isinstance(exc, HealthNotFoundError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    return HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Unexpected health error")


@router.post("/glucose", response_model=GlucoseLogResponse, status_code=status.HTTP_201_CREATED)
async def create_glucose_log(
    log_data: GlucoseLogCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = HealthService(db)
    try:
        return await service.create_glucose_log(user_id=current_user.id, data=log_data)
    except Exception as exc:
        raise _map_service_error(exc) from exc


@router.get("/glucose", response_model=GlucoseHistoryResponse)
async def get_glucose_history(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    measurement_type: Optional[str] = Query(None, pattern="^(fasting|pre_workout|post_workout|random|bedtime)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = HealthService(db)
    try:
        return await service.get_glucose_history(
            user_id=current_user.id,
            page=page,
            page_size=page_size,
            date_from=date_from,
            date_to=date_to,
            measurement_type=measurement_type,
        )
    except Exception as exc:
        raise _map_service_error(exc) from exc


@router.get("/glucose/{log_id}", response_model=GlucoseLogResponse)
async def get_glucose_log(
    log_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = HealthService(db)
    try:
        return await service.get_glucose_log(user_id=current_user.id, log_id=log_id)
    except Exception as exc:
        raise _map_service_error(exc) from exc


@router.delete("/glucose/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_glucose_log(
    log_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = HealthService(db)
    try:
        await service.delete_glucose_log(user_id=current_user.id, log_id=log_id)
        return None
    except Exception as exc:
        raise _map_service_error(exc) from exc


@router.post("/wellness", response_model=DailyWellnessResponse, status_code=status.HTTP_201_CREATED)
async def create_wellness_entry(
    wellness_data: DailyWellnessCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = HealthService(db)
    try:
        return await service.create_or_update_wellness(user_id=current_user.id, data=wellness_data)
    except Exception as exc:
        raise _map_service_error(exc) from exc


@router.get("/wellness", response_model=List[DailyWellnessResponse])
async def get_wellness_history(
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    limit: int = Query(30, ge=1, le=365),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = HealthService(db)
    try:
        return await service.get_wellness_history(
            user_id=current_user.id,
            date_from=date_from,
            date_to=date_to,
            limit=limit,
        )
    except Exception as exc:
        raise _map_service_error(exc) from exc


@router.get("/wellness/{entry_id}", response_model=DailyWellnessResponse)
async def get_wellness_entry(
    entry_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = HealthService(db)
    try:
        return await service.get_wellness_entry(user_id=current_user.id, entry_id=entry_id)
    except Exception as exc:
        raise _map_service_error(exc) from exc


@router.get("/stats", response_model=HealthStatsResponse)
async def get_health_stats(
    period: str = Query("30d", pattern="^(7d|30d|90d|1y)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = HealthService(db)
    try:
        return await service.get_health_stats(user_id=current_user.id, period=period)
    except Exception as exc:
        raise _map_service_error(exc) from exc


@router.get("/glucose/stats", response_model=HealthStatsResponse)
async def get_glucose_stats(
    period: str = Query("30d", pattern="^(7d|30d|90d|1y)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = HealthService(db)
    try:
        return await service.get_health_stats(user_id=current_user.id, period=period)
    except Exception as exc:
        raise _map_service_error(exc) from exc


@router.get("/wellness/stats", response_model=HealthStatsResponse)
async def get_wellness_stats(
    period: str = Query("30d", pattern="^(7d|30d|90d|1y)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = HealthService(db)
    try:
        return await service.get_health_stats(user_id=current_user.id, period=period)
    except Exception as exc:
        raise _map_service_error(exc) from exc
