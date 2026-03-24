"""
Health API Router
Endpoints for glucose tracking and wellness metrics
"""
from typing import Optional, List
from datetime import datetime, date, timedelta

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func, and_, between

from app.middleware.auth import get_current_user
from app.models import get_async_db, User, GlucoseLog, DailyWellness, WorkoutLog
from app.utils.cache import invalidate_user_analytics_cache
from app.schemas.health import (
    GlucoseLogCreate,
    GlucoseLogResponse,
    GlucoseHistoryResponse,
    DailyWellnessCreate,
    DailyWellnessResponse,
    HealthStatsResponse,
    GlucoseStats,
    WorkoutStats,
    WellnessStats,
)

router = APIRouter()


@router.post("/glucose", response_model=GlucoseLogResponse, status_code=status.HTTP_201_CREATED)
async def create_glucose_log(
    log_data: GlucoseLogCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Record a new glucose measurement

    **Headers:**
    ```
    Authorization: Bearer <access_token>
    ```

    **Request:**
    ```json
    {
        "value": 5.8,
        "measurement_type": "pre_workout",
        "timestamp": "2024-01-20T08:00:00",
        "notes": "Felt good before workout",
        "workout_id": 123
    }
    ```

    **Response:** Created glucose log
    """
    # Validate workout_id if provided
    if log_data.workout_id:
        result = await db.execute(
            select(WorkoutLog).where(
                and_(
                    WorkoutLog.id == log_data.workout_id,
                    WorkoutLog.user_id == current_user.id
                )
            )
        )
        workout = result.scalar_one_or_none()

        if not workout:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workout not found"
            )

    # Use current time if timestamp not provided
    timestamp = log_data.timestamp or datetime.utcnow()

    glucose_log = GlucoseLog(
        user_id=current_user.id,
        workout_id=log_data.workout_id,
        value=log_data.value,
        measurement_type=log_data.measurement_type,
        timestamp=timestamp,
        notes=log_data.notes
    )

    db.add(glucose_log)
    await db.commit()
    await db.refresh(glucose_log)

    return glucose_log


@router.get("/glucose", response_model=GlucoseHistoryResponse)
async def get_glucose_history(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    measurement_type: Optional[str] = Query(
        None,
        pattern="^(fasting|pre_workout|post_workout|random|bedtime)$"
    ),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Get glucose measurement history

    **Headers:**
    ```
    Authorization: Bearer <access_token>
    ```

    **Query Parameters:**
    - `page`: Page number (default: 1)
    - `page_size`: Items per page (default: 50, max: 100)
    - `date_from`: Filter from date (YYYY-MM-DD)
    - `date_to`: Filter to date (YYYY-MM-DD)
    - `measurement_type`: Filter by type (fasting, pre_workout, post_workout, random, bedtime)

    **Response:**
    ```json
    {
        "items": [
            {
                "id": 1,
                "user_id": 1,
                "workout_id": 123,
                "value": 5.8,
                "measurement_type": "pre_workout",
                "timestamp": "2024-01-20T08:00:00",
                "notes": "Felt good",
                "created_at": "2024-01-20T08:00:00"
            }
        ],
        "total": 150,
        "page": 1,
        "page_size": 50,
        "date_from": "2024-01-01",
        "date_to": "2024-01-31",
        "average": 6.2,
        "min_value": 4.5,
        "max_value": 8.1
    }
    ```
    """
    # Build query
    query = select(GlucoseLog).where(GlucoseLog.user_id == current_user.id)

    if date_from:
        query = query.where(func.date(GlucoseLog.timestamp) >= date_from)
    if date_to:
        query = query.where(func.date(GlucoseLog.timestamp) <= date_to)
    if measurement_type:
        query = query.where(GlucoseLog.measurement_type == measurement_type)

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()

    # Get statistics
    stats_query = select(
        func.avg(GlucoseLog.value),
        func.min(GlucoseLog.value),
        func.max(GlucoseLog.value)
    ).where(GlucoseLog.user_id == current_user.id)

    if date_from:
        stats_query = stats_query.where(
            func.date(GlucoseLog.timestamp) >= date_from)
    if date_to:
        stats_query = stats_query.where(
            func.date(GlucoseLog.timestamp) <= date_to)
    if measurement_type:
        stats_query = stats_query.where(
            GlucoseLog.measurement_type == measurement_type)

    stats_result = await db.execute(stats_query)
    avg_val, min_val, max_val = stats_result.first()

    # Apply pagination
    query = query.order_by(desc(GlucoseLog.timestamp))
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    logs = result.scalars().all()

    return GlucoseHistoryResponse(
        items=logs,
        total=total,
        page=page,
        page_size=page_size,
        date_from=date_from,
        date_to=date_to,
        average=round(avg_val, 2) if avg_val else None,
        min_value=round(min_val, 2) if min_val else None,
        max_value=round(max_val, 2) if max_val else None
    )


@router.get("/glucose/{log_id}", response_model=GlucoseLogResponse)
async def get_glucose_log(
    log_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Get specific glucose log by ID
    """
    result = await db.execute(
        select(GlucoseLog).where(
            and_(
                GlucoseLog.id == log_id,
                GlucoseLog.user_id == current_user.id
            )
        )
    )
    log = result.scalar_one_or_none()

    if not log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Glucose log not found"
        )

    return log


@router.delete("/glucose/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_glucose_log(
    log_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Delete glucose log
    """
    result = await db.execute(
        select(GlucoseLog).where(
            and_(
                GlucoseLog.id == log_id,
                GlucoseLog.user_id == current_user.id
            )
        )
    )
    log = result.scalar_one_or_none()

    if not log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Glucose log not found"
        )

    await db.delete(log)
    await db.commit()


@router.post("/wellness", response_model=DailyWellnessResponse, status_code=status.HTTP_201_CREATED)
async def create_wellness_entry(
    wellness_data: DailyWellnessCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Create or update daily wellness entry

    **Headers:**
    ```
    Authorization: Bearer <access_token>
    ```

    **Request:**
    ```json
    {
        "date": "2024-01-20",
        "sleep_score": 85,
        "sleep_hours": 7.5,
        "energy_score": 75,
        "pain_zones": {
            "head": 0,
            "neck": 1,
            "shoulders": 0,
            "back": 2,
            "knees": 0
        },
        "stress_level": 3,
        "mood_score": 80,
        "notes": "Good day overall, slight back tension"
    }
    ```

    **Response:** Created/updated wellness entry
    """
    # Check if entry exists for this date
    result = await db.execute(
        select(DailyWellness).where(
            and_(
                DailyWellness.user_id == current_user.id,
                DailyWellness.date == wellness_data.date
            )
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
        # Update existing entry
        existing.sleep_score = wellness_data.sleep_score
        existing.sleep_hours = wellness_data.sleep_hours
        existing.energy_score = wellness_data.energy_score
        existing.pain_zones = wellness_data.pain_zones.model_dump()
        existing.stress_level = wellness_data.stress_level
        existing.mood_score = wellness_data.mood_score
        existing.notes = wellness_data.notes

        await db.commit()
        await db.refresh(existing)
        await invalidate_user_analytics_cache(current_user.id)
        return existing
    else:
        # Create new entry
        wellness = DailyWellness(
            user_id=current_user.id,
            date=wellness_data.date,
            sleep_score=wellness_data.sleep_score,
            sleep_hours=wellness_data.sleep_hours,
            energy_score=wellness_data.energy_score,
            pain_zones=wellness_data.pain_zones.model_dump(),
            stress_level=wellness_data.stress_level,
            mood_score=wellness_data.mood_score,
            notes=wellness_data.notes
        )

        db.add(wellness)
        await db.commit()
        await db.refresh(wellness)
        await invalidate_user_analytics_cache(current_user.id)
        return wellness


@router.get("/wellness", response_model=List[DailyWellnessResponse])
async def get_wellness_history(
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    limit: int = Query(30, ge=1, le=365),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Get wellness history

    **Headers:**
    ```
    Authorization: Bearer <access_token>
    ```

    **Query Parameters:**
    - `date_from`: Filter from date (YYYY-MM-DD)
    - `date_to`: Filter to date (YYYY-MM-DD)
    - `limit`: Maximum entries to return (default: 30, max: 365)

    **Response:** List of wellness entries
    """
    # Build query
    query = select(DailyWellness).where(
        DailyWellness.user_id == current_user.id
    )

    if date_from:
        query = query.where(DailyWellness.date >= date_from)
    if date_to:
        query = query.where(DailyWellness.date <= date_to)

    query = query.order_by(desc(DailyWellness.date))
    query = query.limit(limit)

    result = await db.execute(query)
    entries = result.scalars().all()

    return entries


@router.get("/wellness/{entry_id}", response_model=DailyWellnessResponse)
async def get_wellness_entry(
    entry_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Get specific wellness entry by ID
    """
    result = await db.execute(
        select(DailyWellness).where(
            and_(
                DailyWellness.id == entry_id,
                DailyWellness.user_id == current_user.id
            )
        )
    )
    entry = result.scalar_one_or_none()

    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Wellness entry not found"
        )

    return entry


@router.get("/stats", response_model=HealthStatsResponse)
async def get_health_stats(
    period: str = Query("30d", pattern="^(7d|30d|90d|1y)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Get health statistics summary

    **Headers:**
    ```
    Authorization: Bearer <access_token>
    ```

    **Query Parameters:**
    - `period`: Time period (7d, 30d, 90d, 1y)

    **Response:**
    ```json
    {
        "period": "30d",
        "glucose": {
            "average_7d": 6.1,
            "average_30d": 6.3,
            "readings_count_7d": 14,
            "readings_count_30d": 45,
            "in_range_percentage": 85.5
        },
        "workouts": {
            "total_workouts_7d": 4,
            "total_workouts_30d": 16,
            "total_duration_7d": 180,
            "total_duration_30d": 720,
            "avg_duration": 45.0,
            "favorite_type": "strength"
        },
        "wellness": {
            "avg_sleep_score_7d": 82.5,
            "avg_sleep_score_30d": 79.2,
            "avg_energy_score_7d": 78.0,
            "avg_energy_score_30d": 75.5,
            "avg_sleep_hours_7d": 7.2,
            "avg_sleep_hours_30d": 6.9
        },
        "generated_at": "2024-01-20T10:00:00"
    }
    ```
    """
    # Calculate date ranges
    days_map = {"7d": 7, "30d": 30, "90d": 90, "1y": 365}
    days = days_map.get(period, 30)

    date_7d = date.today() - timedelta(days=7)
    date_30d = date.today() - timedelta(days=30)
    date_period = date.today() - timedelta(days=days)

    # Glucose stats
    glucose_stats_7d = await db.execute(
        select(
            func.avg(GlucoseLog.value),
            func.count(GlucoseLog.id)
        ).where(
            and_(
                GlucoseLog.user_id == current_user.id,
                func.date(GlucoseLog.timestamp) >= date_7d
            )
        )
    )
    avg_7d, count_7d = glucose_stats_7d.first()

    glucose_stats_30d = await db.execute(
        select(
            func.avg(GlucoseLog.value),
            func.count(GlucoseLog.id)
        ).where(
            and_(
                GlucoseLog.user_id == current_user.id,
                func.date(GlucoseLog.timestamp) >= date_30d
            )
        )
    )
    avg_30d, count_30d = glucose_stats_30d.first()

    # Count in-range readings (4-7 mmol/L is typical target)
    in_range_result = await db.execute(
        select(func.count(GlucoseLog.id)).where(
            and_(
                GlucoseLog.user_id == current_user.id,
                func.date(GlucoseLog.timestamp) >= date_30d,
                GlucoseLog.value >= 4.0,
                GlucoseLog.value <= 7.0
            )
        )
    )
    in_range_count = in_range_result.scalar()

    in_range_pct = (in_range_count / count_30d *
                    100) if count_30d and count_30d > 0 else None

    glucose = GlucoseStats(
        average_7d=round(avg_7d, 2) if avg_7d else None,
        average_30d=round(avg_30d, 2) if avg_30d else None,
        readings_count_7d=count_7d or 0,
        readings_count_30d=count_30d or 0,
        in_range_percentage=round(in_range_pct, 1) if in_range_pct else None
    )

    # Workout stats
    workout_stats_7d = await db.execute(
        select(
            func.count(WorkoutLog.id),
            func.coalesce(func.sum(WorkoutLog.duration), 0)
        ).where(
            and_(
                WorkoutLog.user_id == current_user.id,
                WorkoutLog.date >= date_7d
            )
        )
    )
    workouts_7d, duration_7d = workout_stats_7d.first()

    workout_stats_30d = await db.execute(
        select(
            func.count(WorkoutLog.id),
            func.coalesce(func.sum(WorkoutLog.duration), 0),
            func.avg(WorkoutLog.duration)
        ).where(
            and_(
                WorkoutLog.user_id == current_user.id,
                WorkoutLog.date >= date_30d
            )
        )
    )
    workouts_30d, duration_30d, avg_duration = workout_stats_30d.first()

    # Get favorite workout type
    fav_type_result = await db.execute(
        select(WorkoutLog.tags).where(
            and_(
                WorkoutLog.user_id == current_user.id,
                WorkoutLog.date >= date_30d
            )
        )
    )
    tags_list = fav_type_result.scalars().all()

    # Flatten tags and count
    from collections import Counter
    all_tags = [tag for tags in tags_list for tag in tags] if tags_list else []
    favorite_type = Counter(all_tags).most_common(1)[
        0][0] if all_tags else None

    workouts = WorkoutStats(
        total_workouts_7d=workouts_7d or 0,
        total_workouts_30d=workouts_30d or 0,
        total_duration_7d=duration_7d or 0,
        total_duration_30d=duration_30d or 0,
        avg_duration=round(avg_duration, 1) if avg_duration else None,
        favorite_type=favorite_type
    )

    # Wellness stats
    wellness_stats_7d = await db.execute(
        select(
            func.avg(DailyWellness.sleep_score),
            func.avg(DailyWellness.energy_score),
            func.avg(DailyWellness.sleep_hours)
        ).where(
            and_(
                DailyWellness.user_id == current_user.id,
                DailyWellness.date >= date_7d
            )
        )
    )
    sleep_7d, energy_7d, hours_7d = wellness_stats_7d.first()

    wellness_stats_30d = await db.execute(
        select(
            func.avg(DailyWellness.sleep_score),
            func.avg(DailyWellness.energy_score),
            func.avg(DailyWellness.sleep_hours)
        ).where(
            and_(
                DailyWellness.user_id == current_user.id,
                DailyWellness.date >= date_30d
            )
        )
    )
    sleep_30d, energy_30d, hours_30d = wellness_stats_30d.first()

    wellness = WellnessStats(
        avg_sleep_score_7d=round(sleep_7d, 1) if sleep_7d else None,
        avg_sleep_score_30d=round(sleep_30d, 1) if sleep_30d else None,
        avg_energy_score_7d=round(energy_7d, 1) if energy_7d else None,
        avg_energy_score_30d=round(energy_30d, 1) if energy_30d else None,
        avg_sleep_hours_7d=round(hours_7d, 1) if hours_7d else None,
        avg_sleep_hours_30d=round(hours_30d, 1) if hours_30d else None
    )

    return HealthStatsResponse(
        period=period,
        glucose=glucose,
        workouts=workouts,
        wellness=wellness,
        generated_at=datetime.utcnow()
    )
