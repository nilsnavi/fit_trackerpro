"""
Analytics API Router
HTTP-only endpoints delegating business logic to services
"""
from datetime import date, datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.auth import get_current_user
from app.api.deps.idempotency import optional_idempotency_key
from app.application.analytics_service import AnalyticsService
from app.domain.user import User
from app.infrastructure.database import get_async_db
from app.schemas.analytics import (
    AnalyticsPerformanceOverviewResponse,
    AnalyticsSummaryResponse,
    DataExportRequest,
    DataExportResponse,
    ExerciseProgressResponse,
    MuscleImbalanceSignalsResponse,
    MuscleLoadEntry,
    MuscleLoadTableResponse,
    ProgressInsightsResponse,
    RecoveryStateRecalculateResponse,
    RecoveryStateResponse,
    TrainingLoadDailyEntry,
    TrainingLoadDailyTableResponse,
    WorkoutCalendarResponse,
    WorkoutPostSummaryResponse,
)
from app.settings import settings

router = APIRouter()


@router.get("/training-load/daily", response_model=List[TrainingLoadDailyEntry])
async def get_daily_training_load(
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = AnalyticsService(db)
    return await service.get_daily_training_load(
        user_id=current_user.id,
        date_from=date_from,
        date_to=date_to,
    )


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
    return await service.get_daily_training_load_table(
        user_id=current_user.id,
        page=page,
        page_size=page_size,
        date_from=date_from,
        date_to=date_to,
    )


@router.get("/muscle-load", response_model=List[MuscleLoadEntry])
async def get_muscle_load(
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = AnalyticsService(db)
    return await service.get_muscle_load(
        user_id=current_user.id,
        date_from=date_from,
        date_to=date_to,
    )


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
    return await service.get_muscle_load_table(
        user_id=current_user.id,
        page=page,
        page_size=page_size,
        date_from=date_from,
        date_to=date_to,
        muscle_group=muscle_group,
    )


@router.get("/recovery-state", response_model=RecoveryStateResponse)
async def get_recovery_state(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = AnalyticsService(db)
    return await service.get_recovery_state(user_id=current_user.id)


@router.post("/recovery-state/recalculate", response_model=RecoveryStateRecalculateResponse)
async def recalculate_recovery_state(
    target_date: Optional[date] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = AnalyticsService(db)
    return await service.recalculate_recovery_state(
        user_id=current_user.id,
        target_date=target_date,
        date_from=date_from,
        date_to=date_to,
    )


@router.get("/progress", response_model=List[ExerciseProgressResponse])
async def get_exercise_progress(
    exercise_id: Optional[int] = Query(None),
    period: str = Query("30d", pattern="^(7d|30d|90d|1y|all)$"),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
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
    return await service.get_exercise_progress(
        user_id=current_user.id,
        exercise_id=exercise_id,
        period=period,
        date_from=date_from,
        date_to=date_to,
        max_exercises=max_exercises,
        max_data_points=max_data_points,
    )


@router.get("/progress-insights", response_model=ProgressInsightsResponse)
async def get_progress_insights(
    period: str = Query("30d", pattern="^(7d|30d|90d|1y|all)$"),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    limit_best_sets: int = Query(5, ge=1, le=20),
    limit_pr_events: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = AnalyticsService(db)
    return await service.get_progress_insights(
        user_id=current_user.id,
        period=period,
        date_from=date_from,
        date_to=date_to,
        limit_best_sets=limit_best_sets,
        limit_pr_events=limit_pr_events,
    )


@router.get("/workout-summary", response_model=WorkoutPostSummaryResponse)
async def get_workout_post_summary(
    workout_id: int = Query(..., ge=1),
    limit_best_sets: int = Query(5, ge=1, le=20),
    limit_pr_events: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = AnalyticsService(db)
    return await service.get_workout_post_summary(
        user_id=current_user.id,
        workout_id=workout_id,
        limit_best_sets=limit_best_sets,
        limit_pr_events=limit_pr_events,
    )


@router.get("/calendar", response_model=WorkoutCalendarResponse)
async def get_workout_calendar(
    year: int = Query(datetime.now().year, ge=2020, le=2030),
    month: int = Query(datetime.now().month, ge=1, le=12),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = AnalyticsService(db)
    return await service.get_workout_calendar(
        user_id=current_user.id,
        year=year,
        month=month,
    )


@router.post("/export", response_model=DataExportResponse)
async def export_data(
    export_request: DataExportRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
    idempotency_key: str | None = Depends(optional_idempotency_key),
):
    service = AnalyticsService(db)
    return await service.export_data(
        user_id=current_user.id,
        export_request=export_request,
        idempotency_key=idempotency_key,
    )


@router.get("/export/{export_id}", response_model=DataExportResponse)
async def get_export_status(
    export_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = AnalyticsService(db)
    return await service.get_export_status(
        user_id=current_user.id,
        export_id=export_id,
    )


@router.get("/summary", response_model=AnalyticsSummaryResponse)
async def get_analytics_summary(
    period: str = Query("30d", pattern="^(7d|30d|90d|1y|all)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = AnalyticsService(db)
    return await service.get_analytics_summary(user_id=current_user.id, period=period)


@router.get("/performance-overview", response_model=AnalyticsPerformanceOverviewResponse)
async def get_analytics_performance_overview(
    period: str = Query("30d", pattern="^(7d|30d|90d|1y|all)$"),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = AnalyticsService(db)
    return await service.get_performance_overview(
        user_id=current_user.id,
        period=period,
        date_from=date_from,
        date_to=date_to,
    )


@router.get("/muscle-signals", response_model=MuscleImbalanceSignalsResponse)
async def get_muscle_imbalance_signals(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = AnalyticsService(db)
    return await service.get_muscle_imbalance_signals(user_id=current_user.id)
