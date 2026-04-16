"""
Health metrics API router.
HTTP-only endpoints delegating business logic to services.
"""
from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.auth import get_current_user
from app.application.health_service import HealthService
from app.domain.user import User
from app.infrastructure.database import get_async_db
from app.schemas.health import (
    DailyWellnessCreate,
    DailyWellnessResponse,
    GlucoseHistoryResponse,
    GlucoseLogCreate,
    GlucoseLogResponse,
    HealthStatsResponse,
    WaterDailyStats,
    WaterEntryCreate,
    WaterEntryResponse,
    WaterGoalCreate,
    WaterGoalResponse,
    WaterHistoryResponse,
    WaterReminderCreate,
    WaterReminderResponse,
    WaterWeeklyStats,
)

router = APIRouter()


@router.post("/glucose", response_model=GlucoseLogResponse, status_code=status.HTTP_201_CREATED)
async def create_glucose_log(
    log_data: GlucoseLogCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = HealthService(db)
    return await service.create_glucose_log(user_id=current_user.id, data=log_data)


@router.get("/glucose", response_model=GlucoseHistoryResponse)
async def get_glucose_history(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    measurement_type: Optional[str] = Query(
        None, pattern="^(fasting|pre_workout|post_workout|random|bedtime)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = HealthService(db)
    return await service.get_glucose_history(
        user_id=current_user.id,
        page=page,
        page_size=page_size,
        date_from=date_from,
        date_to=date_to,
        measurement_type=measurement_type,
    )


@router.get("/glucose/{log_id}", response_model=GlucoseLogResponse)
async def get_glucose_log(
    log_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = HealthService(db)
    return await service.get_glucose_log(user_id=current_user.id, log_id=log_id)


@router.delete("/glucose/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_glucose_log(
    log_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = HealthService(db)
    await service.delete_glucose_log(user_id=current_user.id, log_id=log_id)
    return None


@router.post("/wellness", response_model=DailyWellnessResponse, status_code=status.HTTP_201_CREATED)
async def create_wellness_entry(
    wellness_data: DailyWellnessCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = HealthService(db)
    return await service.create_or_update_wellness(user_id=current_user.id, data=wellness_data)


@router.get("/wellness", response_model=List[DailyWellnessResponse])
async def get_wellness_history(
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    limit: int = Query(30, ge=1, le=365),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = HealthService(db)
    return await service.get_wellness_history(
        user_id=current_user.id,
        date_from=date_from,
        date_to=date_to,
        limit=limit,
    )


@router.get("/wellness/{entry_id}", response_model=DailyWellnessResponse)
async def get_wellness_entry(
    entry_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = HealthService(db)
    return await service.get_wellness_entry(user_id=current_user.id, entry_id=entry_id)


@router.get("/stats", response_model=HealthStatsResponse)
async def get_health_stats(
    period: str = Query("30d", pattern="^(7d|30d|90d|1y)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = HealthService(db)
    return await service.get_health_stats(user_id=current_user.id, period=period)


@router.get("/glucose/stats", response_model=HealthStatsResponse)
async def get_glucose_stats(
    period: str = Query("30d", pattern="^(7d|30d|90d|1y)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = HealthService(db)
    return await service.get_health_stats(user_id=current_user.id, period=period)


@router.get("/wellness/stats", response_model=HealthStatsResponse)
async def get_wellness_stats(
    period: str = Query("30d", pattern="^(7d|30d|90d|1y)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = HealthService(db)
    return await service.get_health_stats(user_id=current_user.id, period=period)


# ==================== Water Endpoints ====================


@router.post("/water", response_model=WaterEntryResponse, status_code=status.HTTP_201_CREATED)
async def create_water_entry(
    entry_data: WaterEntryCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = HealthService(db)
    return await service.create_water_entry(user_id=current_user.id, data=entry_data)


@router.get("/water", response_model=WaterHistoryResponse)
async def get_water_history(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = HealthService(db)
    return await service.get_water_history(
        user_id=current_user.id,
        page=page,
        page_size=page_size,
        date_from=date_from,
        date_to=date_to,
    )


# Specific routes BEFORE parameterized routes (important for FastAPI routing)
@router.get("/water/weekly", response_model=WaterWeeklyStats)
async def get_water_weekly_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = HealthService(db)
    return await service.get_water_weekly_stats(user_id=current_user.id)


@router.get("/water/goal", response_model=WaterGoalResponse)
async def get_water_goal(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = HealthService(db)
    return await service.get_water_goal(user_id=current_user.id)


@router.post("/water/goal", response_model=WaterGoalResponse, status_code=status.HTTP_201_CREATED)
async def set_water_goal(
    goal_data: WaterGoalCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = HealthService(db)
    return await service.set_water_goal(user_id=current_user.id, data=goal_data)


@router.get("/water/reminder", response_model=WaterReminderResponse)
async def get_water_reminder(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = HealthService(db)
    return await service.get_water_reminder(user_id=current_user.id)


@router.post("/water/reminder", response_model=WaterReminderResponse, status_code=status.HTTP_201_CREATED)
async def set_water_reminder(
    reminder_data: WaterReminderCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = HealthService(db)
    return await service.set_water_reminder(user_id=current_user.id, data=reminder_data)


@router.get("/water/daily/{target_date}", response_model=WaterDailyStats)
async def get_water_daily_stats(
    target_date: date,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = HealthService(db)
    return await service.get_water_daily_stats(user_id=current_user.id, target_date=target_date)


# Parameterized routes MUST come last
@router.get("/water/{entry_id}", response_model=WaterEntryResponse)
async def get_water_entry(
    entry_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = HealthService(db)
    return await service.get_water_entry(user_id=current_user.id, entry_id=entry_id)


@router.delete("/water/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_water_entry(
    entry_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = HealthService(db)
    await service.delete_water_entry(user_id=current_user.id, entry_id=entry_id)
    return None
