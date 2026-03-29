"""
Analytics API Router
HTTP-only endpoints delegating business logic to services
"""
from datetime import date, datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.middleware.auth import get_current_user
from app.domain import User, get_async_db
from app.schemas.analytics import (
    AnalyticsSummaryResponse,
    DataExportRequest,
    DataExportResponse,
    ExerciseProgressResponse,
    MuscleImbalanceSignalsResponse,
    MuscleLoadEntry,
    MuscleLoadTableResponse,
    RecoveryStateRecalculateResponse,
    RecoveryStateResponse,
    TrainingLoadDailyEntry,
    TrainingLoadDailyTableResponse,
    WorkoutCalendarResponse,
)
from app.services.analytics_service import (
    AnalyticsNotFoundError,
    AnalyticsService,
    AnalyticsUnavailableError,
    AnalyticsValidationError,
)
from app.settings import settings

router = APIRouter()


def _map_service_error(exc: Exception) -> HTTPException:
    if isinstance(exc, AnalyticsValidationError):
        return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    if isinstance(exc, AnalyticsNotFoundError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    if isinstance(exc, AnalyticsUnavailableError):
        return HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))
    return HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Unexpected analytics error")


@router.get("/training-load/daily", response_model=List[TrainingLoadDailyEntry])
async def get_daily_training_load(
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = AnalyticsService(db)
    try:
        return await service.get_daily_training_load(
            user_id=current_user.id,
            date_from=date_from,
            date_to=date_to,
        )
    except Exception as exc:
        raise _map_service_error(exc) from exc


@router.get("/training-load/daily/table", response_model=TrainingLoadDailyTableResponse)
async def get_daily_training_load_table(
    page: int = Query(1, ge=1),
    page_size: int = Query(30, ge=1, le=365),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = AnalyticsService(db)
    try:
        return await service.get_daily_training_load_table(
            user_id=current_user.id,
            page=page,
            page_size=page_size,
            date_from=date_from,
            date_to=date_to,
        )
    except Exception as exc:
        raise _map_service_error(exc) from exc


@router.get("/muscle-load", response_model=List[MuscleLoadEntry])
async def get_muscle_load(
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = AnalyticsService(db)
    try:
        return await service.get_muscle_load(
            user_id=current_user.id,
            date_from=date_from,
            date_to=date_to,
        )
    except Exception as exc:
        raise _map_service_error(exc) from exc


@router.get("/muscle-load/table", response_model=MuscleLoadTableResponse)
async def get_muscle_load_table(
    page: int = Query(1, ge=1),
    page_size: int = Query(30, ge=1, le=365),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    muscle_group: Optional[str] = Query(None, max_length=50),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = AnalyticsService(db)
    try:
        return await service.get_muscle_load_table(
            user_id=current_user.id,
            page=page,
            page_size=page_size,
            date_from=date_from,
            date_to=date_to,
            muscle_group=muscle_group,
        )
    except Exception as exc:
        raise _map_service_error(exc) from exc


@router.get("/recovery-state", response_model=RecoveryStateResponse)
async def get_recovery_state(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = AnalyticsService(db)
    try:
        return await service.get_recovery_state(user_id=current_user.id)
    except Exception as exc:
        raise _map_service_error(exc) from exc


@router.post("/recovery-state/recalculate", response_model=RecoveryStateRecalculateResponse)
async def recalculate_recovery_state(
    target_date: Optional[date] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = AnalyticsService(db)
    try:
        return await service.recalculate_recovery_state(
            user_id=current_user.id,
            target_date=target_date,
            date_from=date_from,
            date_to=date_to,
        )
    except Exception as exc:
        raise _map_service_error(exc) from exc


@router.get("/progress", response_model=List[ExerciseProgressResponse])
async def get_exercise_progress(
    exercise_id: Optional[int] = Query(None),
    period: str = Query("30d", pattern="^(7d|30d|90d|1y|all)$"),
    max_exercises: int = Query(
        settings.ANALYTICS_DEFAULT_MAX_EXERCISES,
        ge=1,
        le=settings.ANALYTICS_MAX_EXERCISES_HARD_LIMIT,
    ),
    max_data_points: int = Query(
        settings.ANALYTICS_DEFAULT_MAX_DATA_POINTS,
        ge=1,
        le=settings.ANALYTICS_MAX_DATA_POINTS_HARD_LIMIT,
    ),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = AnalyticsService(db)
    try:
        return await service.get_exercise_progress(
            user_id=current_user.id,
            exercise_id=exercise_id,
            period=period,
            max_exercises=max_exercises,
            max_data_points=max_data_points,
        )
    except Exception as exc:
        raise _map_service_error(exc) from exc


@router.get("/calendar", response_model=WorkoutCalendarResponse)
async def get_workout_calendar(
    year: int = Query(datetime.now().year, ge=2020, le=2030),
    month: int = Query(datetime.now().month, ge=1, le=12),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = AnalyticsService(db)
    try:
        return await service.get_workout_calendar(
            user_id=current_user.id,
            year=year,
            month=month,
        )
    except Exception as exc:
        raise _map_service_error(exc) from exc


@router.post("/export", response_model=DataExportResponse)
async def export_data(
    export_request: DataExportRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = AnalyticsService(db)
    try:
        return await service.export_data(export_request=export_request)
    except Exception as exc:
        raise _map_service_error(exc) from exc


@router.get("/export/{export_id}", response_model=DataExportResponse)
async def get_export_status(
    export_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = AnalyticsService(db)
    try:
        return await service.get_export_status(export_id=export_id)
    except Exception as exc:
        raise _map_service_error(exc) from exc


@router.get("/summary", response_model=AnalyticsSummaryResponse)
async def get_analytics_summary(
    period: str = Query("30d", pattern="^(7d|30d|90d|1y|all)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = AnalyticsService(db)
    try:
        return await service.get_analytics_summary(user_id=current_user.id, period=period)
    except Exception as exc:
        raise _map_service_error(exc) from exc


@router.get("/muscle-signals", response_model=MuscleImbalanceSignalsResponse)
async def get_muscle_imbalance_signals(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = AnalyticsService(db)
    try:
        return await service.get_muscle_imbalance_signals(user_id=current_user.id)
    except Exception as exc:
        raise _map_service_error(exc) from exc
