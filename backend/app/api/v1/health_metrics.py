"""
Health metrics API router.
HTTP-only endpoints delegating business logic to services.
"""
from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.auth import get_current_user
from app.application.health_service import HealthService
from app.core.audit import HEALTH_DATA_READ, audit_log, get_client_ip
from app.domain.user import User
from app.infrastructure.database import get_async_db
from app.schemas.health import (
    BodyMeasurementCreate,
    BodyMeasurementHistoryResponse,
    BodyMeasurementResponse,
    BodyMeasurementType,
    BodyMeasurementUpdate,
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


def _audit_health_read(request: Request, user: User, resource: str) -> None:
    """Record post-factum access to sensitive health data (never the values)."""
    audit_log(
        action=HEALTH_DATA_READ,
        user_db_id=user.id,
        telegram_id=user.telegram_id,
        client_ip=get_client_ip(request),
        meta={"resource": resource, "operation": "read"},
    )


@router.post(
    "/body-measurements",
    response_model=BodyMeasurementResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_body_measurement(
    measurement_data: BodyMeasurementCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = HealthService(db)
    return await service.create_body_measurement(user_id=current_user.id, data=measurement_data)


@router.get("/body-measurements", response_model=BodyMeasurementHistoryResponse)
async def get_body_measurements(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    measurement_type: Optional[BodyMeasurementType] = Query(None),
    latest: bool = Query(False),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = HealthService(db)
    response = await service.get_body_measurements(
        user_id=current_user.id,
        page=page,
        page_size=page_size,
        date_from=date_from,
        date_to=date_to,
        measurement_type=measurement_type,
        latest=latest,
    )
    _audit_health_read(request, current_user, "body_measurement")
    return response


@router.patch("/body-measurements/{measurement_id}", response_model=BodyMeasurementResponse)
async def update_body_measurement(
    measurement_id: int,
    measurement_data: BodyMeasurementUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = HealthService(db)
    return await service.update_body_measurement(
        user_id=current_user.id,
        measurement_id=measurement_id,
        data=measurement_data,
    )


@router.delete("/body-measurements/{measurement_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_body_measurement(
    measurement_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = HealthService(db)
    await service.delete_body_measurement(user_id=current_user.id, measurement_id=measurement_id)
    return None


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
    request: Request,
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
    response = await service.get_glucose_history(
        user_id=current_user.id,
        page=page,
        page_size=page_size,
        date_from=date_from,
        date_to=date_to,
        measurement_type=measurement_type,
    )
    _audit_health_read(request, current_user, "glucose")
    return response


@router.get("/glucose/{log_id}", response_model=GlucoseLogResponse)
async def get_glucose_log(
    log_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = HealthService(db)
    response = await service.get_glucose_log(user_id=current_user.id, log_id=log_id)
    _audit_health_read(request, current_user, "glucose")
    return response


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
    request: Request,
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    limit: int = Query(30, ge=1, le=365),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = HealthService(db)
    response = await service.get_wellness_history(
        user_id=current_user.id,
        date_from=date_from,
        date_to=date_to,
        limit=limit,
    )
    _audit_health_read(request, current_user, "wellness")
    return response


@router.get("/wellness/{entry_id}", response_model=DailyWellnessResponse)
async def get_wellness_entry(
    entry_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = HealthService(db)
    response = await service.get_wellness_entry(user_id=current_user.id, entry_id=entry_id)
    _audit_health_read(request, current_user, "wellness")
    return response


@router.get("/stats", response_model=HealthStatsResponse)
async def get_health_stats(
    request: Request,
    period: str = Query("30d", pattern="^(7d|30d|90d|1y)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = HealthService(db)
    response = await service.get_health_stats(user_id=current_user.id, period=period)
    _audit_health_read(request, current_user, "health_stats")
    return response


@router.get("/glucose/stats", response_model=HealthStatsResponse)
async def get_glucose_stats(
    request: Request,
    period: str = Query("30d", pattern="^(7d|30d|90d|1y)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = HealthService(db)
    response = await service.get_health_stats(user_id=current_user.id, period=period)
    _audit_health_read(request, current_user, "glucose_stats")
    return response


@router.get("/wellness/stats", response_model=HealthStatsResponse)
async def get_wellness_stats(
    request: Request,
    period: str = Query("30d", pattern="^(7d|30d|90d|1y)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = HealthService(db)
    response = await service.get_health_stats(user_id=current_user.id, period=period)
    _audit_health_read(request, current_user, "wellness_stats")
    return response


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
