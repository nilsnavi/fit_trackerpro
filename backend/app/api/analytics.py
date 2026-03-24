"""
Analytics API Router
Endpoints for workout analytics, progress tracking, and data export
"""
from typing import Optional, List, Dict, Any
from datetime import datetime, date, timedelta
import calendar

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, cast, Integer, literal, true, or_, text

from app.middleware.auth import get_current_user
from app.models import get_async_db, User, WorkoutLog, DailyWellness
from app.utils.config import settings
from app.utils.cache import get_cache_json, set_cache_json
from app.schemas.analytics import (
    ExerciseProgressResponse,
    ExerciseProgressData,
    WorkoutCalendarResponse,
    CalendarDayEntry,
    DataExportRequest,
    DataExportResponse,
)

router = APIRouter()


def _build_analytics_cache_key(endpoint: str, user_id: int, **kwargs: Any) -> str:
    parts = [f"analytics:{endpoint}:u:{user_id}"]
    for k in sorted(kwargs.keys()):
        parts.append(f"{k}:{kwargs[k]}")
    return "|".join(parts)


@router.get("/progress", response_model=List[ExerciseProgressResponse])
async def get_exercise_progress(
    exercise_id: Optional[int] = Query(None),
    period: str = Query("30d", pattern="^(7d|30d|90d|1y|all)$"),
    max_exercises: int = Query(
        settings.ANALYTICS_DEFAULT_MAX_EXERCISES,
        ge=1,
        le=settings.ANALYTICS_MAX_EXERCISES_HARD_LIMIT
    ),
    max_data_points: int = Query(
        settings.ANALYTICS_DEFAULT_MAX_DATA_POINTS,
        ge=1,
        le=settings.ANALYTICS_MAX_DATA_POINTS_HARD_LIMIT
    ),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Get exercise progress analytics

    **Headers:**
    ```
    Authorization: Bearer <access_token>
    ```

    **Query Parameters:**
    - `exercise_id`: Specific exercise ID (optional, returns all if not specified)
    - `period`: Time period (7d, 30d, 90d, 1y, all)

    **Response:**
    ```json
    [
        {
            "exercise_id": 1,
            "exercise_name": "Bench Press",
            "period": "30d",
            "data_points": [
                {"date": "2024-01-01", "max_weight": 60, "total_volume": 1800},
                {"date": "2024-01-15", "max_weight": 65, "total_volume": 1950}
            ],
            "summary": {
                "exercise_id": 1,
                "exercise_name": "Bench Press",
                "total_sets": 24,
                "total_reps": 240,
                "max_weight": 65.0,
                "avg_weight": 62.5,
                "first_date": "2024-01-01",
                "last_date": "2024-01-20",
                "progress_percentage": 8.3
            },
            "best_performance": {
                "date": "2024-01-15",
                "weight": 65.0,
                "reps": 10
            }
        }
    ]
    ```
    """
    # Calculate date range
    days_map = {"7d": 7, "30d": 30, "90d": 90, "1y": 365, "all": 3650}
    days = days_map.get(period, 30)
    date_from = date.today() - timedelta(days=days)

    cache_key = _build_analytics_cache_key(
        "progress",
        current_user.id,
        exercise_id=exercise_id or "all",
        period=period,
        max_exercises=max_exercises,
        max_data_points=max_data_points,
    )
    cached_response = await get_cache_json(cache_key)
    if cached_response is not None:
        return cached_response

    parsed_sets_cte = """
        WITH parsed_sets AS (
            SELECT
                wl.date AS workout_date,
                (exercise_item.item->>'exercise_id')::int AS exercise_id,
                COALESCE(NULLIF(exercise_item.item->>'name', ''), 'Unknown') AS exercise_name,
                NULLIF(set_item.item->>'weight', '')::double precision AS weight,
                NULLIF(set_item.item->>'reps', '')::int AS reps
            FROM workout_logs wl
            CROSS JOIN LATERAL jsonb_array_elements(wl.exercises) AS exercise_item(item)
            CROSS JOIN LATERAL jsonb_array_elements(
                COALESCE(exercise_item.item->'sets_completed', '[]'::jsonb)
            ) AS set_item(item)
            WHERE wl.user_id = :user_id
              AND wl.date >= :date_from
              AND exercise_item.item ? 'exercise_id'
              AND (:exercise_id IS NULL OR (exercise_item.item->>'exercise_id')::int = :exercise_id)
        ),
        limited_exercises AS (
            SELECT exercise_id
            FROM parsed_sets
            GROUP BY exercise_id
            ORDER BY MAX(workout_date) DESC, exercise_id
            LIMIT :max_exercises
        ),
        filtered_sets AS (
            SELECT ps.*
            FROM parsed_sets ps
            JOIN limited_exercises le ON le.exercise_id = ps.exercise_id
        )
    """

    params = {
        "user_id": current_user.id,
        "date_from": date_from,
        "exercise_id": exercise_id,
        "max_exercises": max_exercises,
        "max_data_points": max_data_points,
    }

    summary_result = await db.execute(
        text(
            parsed_sets_cte + """
            SELECT
                exercise_id,
                MAX(exercise_name) AS exercise_name,
                COUNT(*) AS total_sets,
                COALESCE(SUM(reps), 0) AS total_reps,
                MAX(weight) AS max_weight,
                AVG(weight) AS avg_weight,
                MIN(workout_date) AS first_date,
                MAX(workout_date) AS last_date
            FROM filtered_sets
            GROUP BY exercise_id
            ORDER BY MAX(workout_date) DESC, exercise_id
            """
        ),
        params
    )
    summary_rows = summary_result.mappings().all()

    if not summary_rows:
        return []

    data_points_result = await db.execute(
        text(
            parsed_sets_cte + """
            , ranked_sets AS (
                SELECT
                    exercise_id,
                    workout_date,
                    weight,
                    reps,
                    ROW_NUMBER() OVER (
                        PARTITION BY exercise_id, workout_date
                        ORDER BY weight DESC NULLS LAST, reps DESC NULLS LAST
                    ) AS rn
                FROM filtered_sets
            ),
            ranked_by_exercise AS (
                SELECT
                    exercise_id,
                    workout_date,
                    weight,
                    reps,
                    ROW_NUMBER() OVER (
                        PARTITION BY exercise_id
                        ORDER BY workout_date DESC
                    ) AS ex_rn
                FROM ranked_sets
                WHERE rn = 1
            )
            SELECT exercise_id, workout_date, weight AS max_weight, reps
            FROM ranked_by_exercise
            WHERE ex_rn <= :max_data_points
            ORDER BY exercise_id, workout_date
            """
        ),
        params
    )
    data_points_rows = data_points_result.mappings().all()

    best_perf_result = await db.execute(
        text(
            parsed_sets_cte + """
            , ranked_best AS (
                SELECT
                    exercise_id,
                    workout_date,
                    weight,
                    reps,
                    ROW_NUMBER() OVER (
                        PARTITION BY exercise_id
                        ORDER BY weight DESC NULLS LAST, workout_date ASC
                    ) AS rn
                FROM filtered_sets
                WHERE weight IS NOT NULL
            )
            SELECT exercise_id, workout_date, weight, reps
            FROM ranked_best
            WHERE rn = 1
            """
        ),
        params
    )
    best_perf_rows = best_perf_result.mappings().all()

    data_points_by_ex: Dict[int, List[Dict[str, Any]]] = {}
    for row in data_points_rows:
        ex_id = int(row["exercise_id"])
        point = {
            "date": row["workout_date"].isoformat(),
            "max_weight": float(row["max_weight"]) if row["max_weight"] is not None else None,
            "reps": int(row["reps"]) if row["reps"] is not None else None,
        }
        data_points_by_ex.setdefault(ex_id, []).append(point)

    best_perf_by_ex: Dict[int, Dict[str, Any]] = {}
    for row in best_perf_rows:
        best_perf_by_ex[int(row["exercise_id"])] = {
            "date": row["workout_date"].isoformat(),
            "weight": float(row["weight"]) if row["weight"] is not None else None,
            "reps": int(row["reps"]) if row["reps"] is not None else None,
        }

    responses: List[ExerciseProgressResponse] = []
    for row in summary_rows:
        ex_id = int(row["exercise_id"])
        data_points = data_points_by_ex.get(ex_id, [])

        # Preserve old behavior: progress based on first/last non-null weight in timeline.
        weights = [p["max_weight"] for p in data_points if p["max_weight"] is not None]
        progress_pct = None
        if len(weights) >= 2 and weights[0] > 0:
            progress_pct = round(((weights[-1] - weights[0]) / weights[0]) * 100, 1)

        avg_weight_val = float(row["avg_weight"]) if row["avg_weight"] is not None else None
        summary = ExerciseProgressData(
            exercise_id=ex_id,
            exercise_name=row["exercise_name"],
            total_sets=int(row["total_sets"]),
            total_reps=int(row["total_reps"] or 0),
            max_weight=float(row["max_weight"]) if row["max_weight"] is not None else None,
            avg_weight=round(avg_weight_val, 1) if avg_weight_val else None,
            first_date=row["first_date"],
            last_date=row["last_date"],
            progress_percentage=progress_pct
        )

        responses.append(
            ExerciseProgressResponse(
                exercise_id=ex_id,
                exercise_name=row["exercise_name"],
                period=period,
                data_points=data_points,
                summary=summary,
                best_performance=best_perf_by_ex.get(ex_id)
            )
        )

    response_payload = [item.model_dump(mode="json") for item in responses]
    await set_cache_json(
        cache_key,
        response_payload,
        ttl_seconds=settings.ANALYTICS_CACHE_TTL_SECONDS
    )
    return response_payload


@router.get("/calendar", response_model=WorkoutCalendarResponse)
async def get_workout_calendar(
    year: int = Query(datetime.now().year, ge=2020, le=2030),
    month: int = Query(datetime.now().month, ge=1, le=12),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Get workout calendar for a specific month

    **Headers:**
    ```
    Authorization: Bearer <access_token>
    ```

    **Query Parameters:**
    - `year`: Year (default: current year)
    - `month`: Month 1-12 (default: current month)

    **Response:**
    ```json
    {
        "year": 2024,
        "month": 1,
        "days": [
            {
                "date": "2024-01-01",
                "has_workout": true,
                "workout_count": 1,
                "total_duration": 45,
                "workout_types": ["strength"],
                "glucose_logged": true,
                "wellness_logged": true
            }
        ],
        "summary": {
            "total_workouts": 16,
            "total_duration": 720,
            "active_days": 12,
            "rest_days": 19
        }
    }
    ```
    """
    # Calculate date range for the month
    first_day = date(year, month, 1)
    last_day = date(year, month, calendar.monthrange(year, month)[1])

    cache_key = _build_analytics_cache_key(
        "calendar",
        current_user.id,
        year=year,
        month=month,
    )
    cached_response = await get_cache_json(cache_key)
    if cached_response is not None:
        return cached_response

    # Aggregate workouts per day in SQL
    base_filters = and_(
        WorkoutLog.user_id == current_user.id,
        WorkoutLog.date >= first_day,
        WorkoutLog.date <= last_day
    )

    day_stats_result = await db.execute(
        select(
            WorkoutLog.date.label("workout_date"),
            func.count(WorkoutLog.id).label("workout_count"),
            func.coalesce(func.sum(WorkoutLog.duration), 0).label("total_duration"),
            func.bool_or(
                or_(
                    WorkoutLog.glucose_before.isnot(None),
                    WorkoutLog.glucose_after.isnot(None)
                )
            ).label("glucose_logged")
        ).where(base_filters).group_by(WorkoutLog.date)
    )

    tag_elements = func.jsonb_array_elements_text(
        WorkoutLog.tags
    ).table_valued("tag").alias("tag_elements")

    day_tags_result = await db.execute(
        select(
            WorkoutLog.date.label("workout_date"),
            func.array_remove(
                func.array_agg(func.distinct(tag_elements.c.tag)),
                None
            ).label("workout_types")
        ).select_from(WorkoutLog).join(
            tag_elements,
            true(),
            isouter=True
        ).where(base_filters).group_by(WorkoutLog.date)
    )

    wellness_result = await db.execute(
        select(DailyWellness.date).where(
            and_(
                DailyWellness.user_id == current_user.id,
                DailyWellness.date >= first_day,
                DailyWellness.date <= last_day
            )
        )
    )

    day_stats_map = {
        row.workout_date: row for row in day_stats_result.all()
    }
    day_tags_map = {
        row.workout_date: (row.workout_types or []) for row in day_tags_result.all()
    }
    wellness_dates = {row[0] for row in wellness_result.all()}

    # Build calendar days
    days = []
    current = first_day
    while current <= last_day:
        day_stats = day_stats_map.get(current)
        workout_count = int(day_stats.workout_count) if day_stats else 0
        total_duration = int(day_stats.total_duration) if day_stats else 0
        glucose_logged = bool(day_stats.glucose_logged) if day_stats else False

        days.append(CalendarDayEntry(
            date=current,
            has_workout=workout_count > 0,
            workout_count=workout_count,
            total_duration=total_duration,
            workout_types=day_tags_map.get(current, []),
            glucose_logged=glucose_logged,
            wellness_logged=current in wellness_dates
        ))

        current += timedelta(days=1)

    # Calculate summary
    total_workouts = sum(d.workout_count for d in days)
    total_duration = sum(d.total_duration for d in days)
    active_days = sum(1 for d in days if d.has_workout)

    response_payload = WorkoutCalendarResponse(
        year=year,
        month=month,
        days=days,
        summary={
            "total_workouts": total_workouts,
            "total_duration": total_duration,
            "active_days": active_days,
            "rest_days": len(days) - active_days
        }
    )
    response_json = response_payload.model_dump(mode="json")
    await set_cache_json(
        cache_key,
        response_json,
        ttl_seconds=settings.ANALYTICS_CACHE_TTL_SECONDS
    )
    return response_json


@router.post("/export", response_model=DataExportResponse)
async def export_data(
    export_request: DataExportRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Request data export

    **Headers:**
    ```
    Authorization: Bearer <access_token>
    ```

    **Request:**
    ```json
    {
        "format": "json",
        "date_from": "2024-01-01",
        "date_to": "2024-01-31",
        "include_workouts": true,
        "include_glucose": true,
        "include_wellness": true,
        "include_achievements": true
    }
    ```

    **Response:**
    ```json
    {
        "export_id": "exp_123456",
        "status": "pending",
        "format": "json",
        "download_url": null,
        "expires_at": "2024-01-21T10:00:00",
        "requested_at": "2024-01-20T10:00:00",
        "file_size": null
    }
    ```
    """
    import uuid

    export_id = f"exp_{uuid.uuid4().hex[:12]}"

    # TODO: Trigger async export (background job / queue when introduced)
    # For now, return pending status

    return DataExportResponse(
        export_id=export_id,
        status="pending",
        format=export_request.format,
        download_url=None,
        expires_at=datetime.utcnow() + timedelta(days=1),
        requested_at=datetime.utcnow(),
        file_size=None
    )


@router.get("/export/{export_id}", response_model=DataExportResponse)
async def get_export_status(
    export_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Check data export status
    """
    # TODO: Check export status from Redis/DB
    # For now, return not found
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Export not found or expired"
    )


@router.get("/summary")
async def get_analytics_summary(
    period: str = Query("30d", pattern="^(7d|30d|90d|1y|all)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Get analytics summary

    **Headers:**
    ```
    Authorization: Bearer <access_token>
    ```

    **Query Parameters:**
    - `period`: Time period (7d, 30d, 90d, 1y, all)

    **Response:**
    ```json
    {
        "total_workouts": 16,
        "total_duration": 720,
        "total_exercises": 45,
        "current_streak": 5,
        "longest_streak": 12,
        "personal_records": [...],
        "favorite_exercises": [...],
        "weekly_average": 3.7,
        "monthly_average": 16.0
    }
    ```
    """
    # Calculate date range
    days_map = {"7d": 7, "30d": 30, "90d": 90, "1y": 365, "all": 36500}
    days = days_map.get(period, 30)
    date_from = date.today() - timedelta(days=days)

    cache_key = _build_analytics_cache_key(
        "summary",
        current_user.id,
        period=period,
    )
    cached_response = await get_cache_json(cache_key)
    if cached_response is not None:
        return cached_response

    base_filters = and_(
        WorkoutLog.user_id == current_user.id,
        WorkoutLog.date >= date_from
    )

    summary_result = await db.execute(
        select(
            func.count(WorkoutLog.id).label("total_workouts"),
            func.coalesce(func.sum(WorkoutLog.duration), 0).label("total_duration")
        ).where(base_filters)
    )
    summary_row = summary_result.one()
    total_workouts = int(summary_row.total_workouts or 0)

    if total_workouts == 0:
        empty_payload = {
            "total_workouts": 0,
            "total_duration": 0,
            "total_exercises": 0,
            "current_streak": 0,
            "longest_streak": 0,
            "personal_records": [],
            "favorite_exercises": [],
            "weekly_average": 0.0,
            "monthly_average": 0.0
        }
        await set_cache_json(
            cache_key,
            empty_payload,
            ttl_seconds=settings.ANALYTICS_CACHE_TTL_SECONDS
        )
        return empty_payload

    total_duration = int(summary_row.total_duration or 0)

    exercise_elements = func.jsonb_array_elements(
        WorkoutLog.exercises
    ).table_valued("item").alias("exercise_elements")
    exercise_id_expr = cast(
        exercise_elements.c.item.op("->>")("exercise_id"),
        Integer
    )
    exercise_name_expr = func.coalesce(
        func.nullif(exercise_elements.c.item.op("->>")("name"), ""),
        literal("Unknown")
    )

    unique_exercises_result = await db.execute(
        select(
            func.count(func.distinct(exercise_id_expr)).label("total_exercises")
        ).select_from(WorkoutLog).join(
            exercise_elements,
            true()
        ).where(base_filters).where(
            exercise_elements.c.item.op("?")("exercise_id")
        )
    )
    total_exercises = int(unique_exercises_result.scalar() or 0)

    # Calculate streaks
    workout_dates_result = await db.execute(
        select(WorkoutLog.date).where(base_filters).group_by(WorkoutLog.date).order_by(WorkoutLog.date)
    )
    workout_dates = [row[0] for row in workout_dates_result.all()]
    current_streak = 0
    longest_streak = 0
    temp_streak = 0

    today = date.today()
    yesterday = today - timedelta(days=1)

    # Check if streak is active (workout today or yesterday)
    if workout_dates and workout_dates[-1] in [today, yesterday]:
        # Calculate current streak
        for i in range(len(workout_dates) - 1, -1, -1):
            if i == len(workout_dates) - 1:
                current_streak = 1
            elif (workout_dates[i + 1] - workout_dates[i]).days == 1:
                current_streak += 1
            else:
                break

    # Calculate longest streak
    temp_streak = 1
    for i in range(1, len(workout_dates)):
        if (workout_dates[i] - workout_dates[i - 1]).days == 1:
            temp_streak += 1
        else:
            longest_streak = max(longest_streak, temp_streak)
            temp_streak = 1
    longest_streak = max(longest_streak, temp_streak)

    favorite_exercises_result = await db.execute(
        select(
            exercise_id_expr.label("exercise_id"),
            exercise_name_expr.label("name"),
            func.count().label("count")
        ).select_from(WorkoutLog).join(
            exercise_elements,
            true()
        ).where(base_filters).where(
            exercise_elements.c.item.op("?")("exercise_id")
        ).group_by(
            exercise_id_expr,
            exercise_name_expr
        ).order_by(
            func.count().desc()
        ).limit(5)
    )
    favorite_exercises = [
        {
            "exercise_id": int(row.exercise_id),
            "name": row.name,
            "count": int(row.count)
        }
        for row in favorite_exercises_result.all()
    ]

    # Calculate averages
    weeks = max(1, days / 7)
    months = max(1, days / 30)

    response_payload = {
        "total_workouts": total_workouts,
        "total_duration": total_duration,
        "total_exercises": total_exercises,
        "current_streak": current_streak,
        "longest_streak": longest_streak,
        "personal_records": [],  # TODO: Implement PR tracking
        "favorite_exercises": favorite_exercises,
        "weekly_average": round(total_workouts / weeks, 1),
        "monthly_average": round(total_workouts / months, 1)
    }
    await set_cache_json(
        cache_key,
        response_payload,
        ttl_seconds=settings.ANALYTICS_CACHE_TTL_SECONDS
    )
    return response_payload
