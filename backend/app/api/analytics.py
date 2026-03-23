"""
Analytics API Router
Endpoints for workout analytics, progress tracking, and data export
"""
from typing import Optional, List, Dict, Any
from datetime import datetime, date, timedelta
import calendar

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, desc, extract

from app.middleware.auth import get_current_user
from app.models import get_async_db, User, WorkoutLog, Exercise
from app.schemas.analytics import (
    ExerciseProgressResponse,
    ExerciseProgressData,
    WorkoutCalendarResponse,
    CalendarDayEntry,
    DataExportRequest,
    DataExportResponse,
)

router = APIRouter()


@router.get("/progress", response_model=List[ExerciseProgressResponse])
async def get_exercise_progress(
    exercise_id: Optional[int] = Query(None),
    period: str = Query("30d", pattern="^(7d|30d|90d|1y|all)$"),
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

    # Get workout logs in period
    query = select(WorkoutLog).where(
        and_(
            WorkoutLog.user_id == current_user.id,
            WorkoutLog.date >= date_from
        )
    ).order_by(WorkoutLog.date)

    result = await db.execute(query)
    workouts = result.scalars().all()

    # Process exercise data
    exercise_data: Dict[int, Dict[str, Any]] = {}

    for workout in workouts:
        for ex in workout.exercises:
            ex_id = ex.get("exercise_id")
            if not ex_id:
                continue

            # Filter by exercise_id if specified
            if exercise_id and ex_id != exercise_id:
                continue

            if ex_id not in exercise_data:
                exercise_data[ex_id] = {
                    "name": ex.get("name", "Unknown"),
                    "sets": [],
                    "dates": []
                }

            # Process sets
            for set_data in ex.get("sets_completed", []):
                exercise_data[ex_id]["sets"].append({
                    "date": workout.date,
                    "weight": set_data.get("weight"),
                    "reps": set_data.get("reps"),
                    "completed": set_data.get("completed", True)
                })

            exercise_data[ex_id]["dates"].append(workout.date)

    # Build response
    responses = []
    for ex_id, data in exercise_data.items():
        if not data["sets"]:
            continue

        sets = data["sets"]
        dates = sorted(set(data["dates"]))

        # Calculate statistics
        weights = [s["weight"] for s in sets if s["weight"]]
        reps = [s["reps"] for s in sets if s["reps"]]

        max_weight = max(weights) if weights else None
        avg_weight = sum(weights) / len(weights) if weights else None
        total_reps = sum(reps) if reps else 0

        # Calculate progress percentage
        progress_pct = None
        if len(weights) >= 2:
            first_weight = weights[0]
            last_weight = weights[-1]
            if first_weight > 0:
                progress_pct = round(
                    ((last_weight - first_weight) / first_weight) * 100, 1)

        # Build data points for chart
        data_points = []
        date_weights = {}
        for s in sets:
            d = s["date"]
            if d not in date_weights or (s["weight"] and s["weight"] > date_weights[d].get("weight", 0)):
                date_weights[d] = s

        for d, s in sorted(date_weights.items()):
            data_points.append({
                "date": d.isoformat(),
                "max_weight": s.get("weight"),
                "reps": s.get("reps")
            })

        summary = ExerciseProgressData(
            exercise_id=ex_id,
            exercise_name=data["name"],
            total_sets=len(sets),
            total_reps=total_reps,
            max_weight=max_weight,
            avg_weight=round(avg_weight, 1) if avg_weight else None,
            first_date=dates[0],
            last_date=dates[-1],
            progress_percentage=progress_pct
        )

        best_perf = None
        if weights:
            max_w = max(weights)
            best_set = next((s for s in sets if s["weight"] == max_w), None)
            if best_set:
                best_perf = {
                    "date": best_set["date"].isoformat(),
                    "weight": best_set["weight"],
                    "reps": best_set["reps"]
                }

        responses.append(ExerciseProgressResponse(
            exercise_id=ex_id,
            exercise_name=data["name"],
            period=period,
            data_points=data_points,
            summary=summary,
            best_performance=best_perf
        ))

    return responses


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

    # Get all workouts for the month
    result = await db.execute(
        select(WorkoutLog).where(
            and_(
                WorkoutLog.user_id == current_user.id,
                WorkoutLog.date >= first_day,
                WorkoutLog.date <= last_day
            )
        )
    )
    workouts = result.scalars().all()

    # Group workouts by date
    workouts_by_date: Dict[date, List[WorkoutLog]] = {}
    for w in workouts:
        if w.date not in workouts_by_date:
            workouts_by_date[w.date] = []
        workouts_by_date[w.date].append(w)

    # Build calendar days
    days = []
    current = first_day
    while current <= last_day:
        day_workouts = workouts_by_date.get(current, [])

        workout_types = []
        for w in day_workouts:
            if w.tags:
                workout_types.extend(w.tags)
        workout_types = list(set(workout_types))

        days.append(CalendarDayEntry(
            date=current,
            has_workout=len(day_workouts) > 0,
            workout_count=len(day_workouts),
            total_duration=sum(w.duration or 0 for w in day_workouts),
            workout_types=workout_types,
            glucose_logged=any(
                w.glucose_before or w.glucose_after for w in day_workouts),
            wellness_logged=False  # TODO: Check wellness entries
        ))

        current += timedelta(days=1)

    # Calculate summary
    total_workouts = sum(d.workout_count for d in days)
    total_duration = sum(d.total_duration for d in days)
    active_days = sum(1 for d in days if d.has_workout)

    return WorkoutCalendarResponse(
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

    # Get workouts
    result = await db.execute(
        select(WorkoutLog).where(
            and_(
                WorkoutLog.user_id == current_user.id,
                WorkoutLog.date >= date_from
            )
        ).order_by(WorkoutLog.date)
    )
    workouts = result.scalars().all()

    if not workouts:
        return {
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

    # Calculate statistics
    total_duration = sum(w.duration or 0 for w in workouts)

    # Count unique exercises
    exercise_ids = set()
    for w in workouts:
        for ex in w.exercises:
            if ex.get("exercise_id"):
                exercise_ids.add(ex["exercise_id"])

    # Calculate streaks
    workout_dates = sorted(set(w.date for w in workouts))
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

    # Get favorite exercises
    exercise_counts = {}
    for w in workouts:
        for ex in w.exercises:
            ex_id = ex.get("exercise_id")
            ex_name = ex.get("name", "Unknown")
            if ex_id:
                if ex_id not in exercise_counts:
                    exercise_counts[ex_id] = {"name": ex_name, "count": 0}
                exercise_counts[ex_id]["count"] += 1

    favorite_exercises = sorted(
        [{"exercise_id": k, **v} for k, v in exercise_counts.items()],
        key=lambda x: x["count"],
        reverse=True
    )[:5]

    # Calculate averages
    weeks = max(1, days / 7)
    months = max(1, days / 30)

    return {
        "total_workouts": len(workouts),
        "total_duration": total_duration,
        "total_exercises": len(exercise_ids),
        "current_streak": current_streak,
        "longest_streak": longest_streak,
        "personal_records": [],  # TODO: Implement PR tracking
        "favorite_exercises": favorite_exercises,
        "weekly_average": round(len(workouts) / weeks, 1),
        "monthly_average": round(len(workouts) / months, 1)
    }
