"""
Workouts API Router
Endpoints for workout templates, history, and session management
"""
from typing import Optional, List
from datetime import datetime, date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func, and_

from app.middleware.auth import get_current_user
from app.models import (
    get_async_db,
    User,
    WorkoutTemplate,
    WorkoutLog,
    TrainingLoadDaily,
    Exercise,
    MuscleLoad,
    RecoveryState,
    DailyWellness,
)
from app.utils.cache import invalidate_user_analytics_cache
from app.schemas.workouts import (
    WorkoutTemplateCreate,
    WorkoutTemplateResponse,
    WorkoutTemplateList,
    WorkoutStartRequest,
    WorkoutStartResponse,
    WorkoutCompleteRequest,
    WorkoutCompleteResponse,
    WorkoutHistoryResponse,
    WorkoutHistoryItem,
)

router = APIRouter()


def _safe_float(value: object) -> Optional[float]:
    try:
        if value is None:
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _extract_workout_volume_and_rpe(
    exercises: Optional[list[dict]],
) -> tuple[float, list[float]]:
    if not exercises:
        return 0.0, []

    total_volume = 0.0
    rpe_values: list[float] = []

    for exercise in exercises:
        if not isinstance(exercise, dict):
            continue

        sets = exercise.get("sets_completed")
        if not isinstance(sets, list):
            continue

        for set_item in sets:
            if not isinstance(set_item, dict):
                continue

            reps = _safe_float(set_item.get("reps"))
            weight = _safe_float(set_item.get("weight"))
            if reps is not None and weight is not None and reps >= 0 and weight >= 0:
                total_volume += reps * weight

            rpe = _safe_float(set_item.get("rpe"))
            if rpe is not None and 0 <= rpe <= 10:
                rpe_values.append(rpe)

    return total_volume, rpe_values


async def _upsert_training_load_daily(
    db: AsyncSession,
    user_id: int,
    target_date: date,
) -> None:
    day_workouts_result = await db.execute(
        select(WorkoutLog).where(
            and_(
                WorkoutLog.user_id == user_id,
                WorkoutLog.date == target_date,
            )
        )
    )
    day_workouts = day_workouts_result.scalars().all()

    total_duration = 0
    total_volume = 0.0
    day_rpe_values: list[float] = []

    for workout in day_workouts:
        if workout.duration:
            total_duration += int(workout.duration)

        workout_volume, workout_rpe_values = _extract_workout_volume_and_rpe(
            workout.exercises
        )
        total_volume += workout_volume
        day_rpe_values.extend(workout_rpe_values)

    avg_rpe = (
        round(sum(day_rpe_values) / len(day_rpe_values), 1)
        if day_rpe_values
        else None
    )
    fatigue_score = round(total_duration * avg_rpe, 2) if avg_rpe is not None else 0.0

    existing_result = await db.execute(
        select(TrainingLoadDaily).where(
            and_(
                TrainingLoadDaily.user_id == user_id,
                TrainingLoadDaily.date == target_date,
            )
        )
    )
    training_load = existing_result.scalar_one_or_none()

    if training_load:
        training_load.volume = Decimal(str(round(total_volume, 2)))
        training_load.avg_rpe = Decimal(str(avg_rpe)) if avg_rpe is not None else None
        training_load.fatigue_score = Decimal(str(fatigue_score))
    else:
        db.add(
            TrainingLoadDaily(
                user_id=user_id,
                date=target_date,
                volume=Decimal(str(round(total_volume, 2))),
                avg_rpe=Decimal(str(avg_rpe)) if avg_rpe is not None else None,
                fatigue_score=Decimal(str(fatigue_score)),
            )
        )


def _extract_workout_muscle_load(
    exercises: Optional[list[dict]],
    exercise_groups_map: dict[int, list[str]],
) -> dict[str, float]:
    if not exercises:
        return {}

    muscle_load: dict[str, float] = {}

    for exercise in exercises:
        if not isinstance(exercise, dict):
            continue

        exercise_id_raw = exercise.get("exercise_id")
        if exercise_id_raw is None:
            continue

        try:
            exercise_id = int(exercise_id_raw)
        except (TypeError, ValueError):
            continue

        muscle_groups = [
            group for group in exercise_groups_map.get(exercise_id, [])
            if isinstance(group, str) and group
        ]
        if not muscle_groups:
            continue

        sets = exercise.get("sets_completed")
        if not isinstance(sets, list):
            continue

        for set_item in sets:
            if not isinstance(set_item, dict):
                continue

            reps = _safe_float(set_item.get("reps"))
            if reps is None or reps < 0:
                continue

            weight = _safe_float(set_item.get("weight"))
            set_load_score = reps * (weight if weight is not None and weight >= 0 else 1.0)
            if set_load_score <= 0:
                continue

            share = set_load_score / len(muscle_groups)
            for muscle_group in muscle_groups:
                muscle_load[muscle_group] = muscle_load.get(muscle_group, 0.0) + share

    return muscle_load


async def _upsert_muscle_load_daily(
    db: AsyncSession,
    user_id: int,
    target_date: date,
) -> None:
    day_workouts_result = await db.execute(
        select(WorkoutLog).where(
            and_(
                WorkoutLog.user_id == user_id,
                WorkoutLog.date == target_date,
            )
        )
    )
    day_workouts = day_workouts_result.scalars().all()

    exercise_ids: set[int] = set()
    for workout in day_workouts:
        exercises = workout.exercises or []
        for exercise in exercises:
            if not isinstance(exercise, dict):
                continue
            exercise_id_raw = exercise.get("exercise_id")
            try:
                if exercise_id_raw is not None:
                    exercise_ids.add(int(exercise_id_raw))
            except (TypeError, ValueError):
                continue

    exercise_groups_map: dict[int, list[str]] = {}
    if exercise_ids:
        exercise_result = await db.execute(
            select(Exercise).where(Exercise.id.in_(exercise_ids))
        )
        for ex in exercise_result.scalars().all():
            exercise_groups_map[int(ex.id)] = list(ex.muscle_groups or [])

    day_muscle_load: dict[str, float] = {}
    for workout in day_workouts:
        workout_load = _extract_workout_muscle_load(
            workout.exercises,
            exercise_groups_map,
        )
        for muscle_group, value in workout_load.items():
            day_muscle_load[muscle_group] = day_muscle_load.get(muscle_group, 0.0) + value

    existing_result = await db.execute(
        select(MuscleLoad).where(
            and_(
                MuscleLoad.user_id == user_id,
                MuscleLoad.date == target_date,
            )
        )
    )
    existing_rows = existing_result.scalars().all()
    existing_by_group = {row.muscle_group: row for row in existing_rows}
    new_groups = set(day_muscle_load.keys())

    for group, load_score in day_muscle_load.items():
        row = existing_by_group.get(group)
        value = Decimal(str(round(load_score, 2)))
        if row:
            row.load_score = value
        else:
            db.add(
                MuscleLoad(
                    user_id=user_id,
                    muscle_group=group,
                    date=target_date,
                    load_score=value,
                )
            )

    for group, row in existing_by_group.items():
        if group not in new_groups:
            await db.delete(row)


def _clamp(value: float, lower: float = 0.0, upper: float = 100.0) -> float:
    return max(lower, min(upper, value))


async def _upsert_recovery_state(
    db: AsyncSession,
    user_id: int,
    target_date: date,
) -> None:
    training_result = await db.execute(
        select(TrainingLoadDaily).where(
            and_(
                TrainingLoadDaily.user_id == user_id,
                TrainingLoadDaily.date == target_date,
            )
        )
    )
    training = training_result.scalar_one_or_none()

    fatigue_score = float(training.fatigue_score) if training and training.fatigue_score is not None else 0.0
    fatigue_level = int(round(_clamp(fatigue_score / 5.0)))

    wellness_result = await db.execute(
        select(DailyWellness).where(
            and_(
                DailyWellness.user_id == user_id,
                DailyWellness.date <= target_date,
            )
        ).order_by(DailyWellness.date.desc()).limit(1)
    )
    latest_wellness = wellness_result.scalar_one_or_none()

    readiness_raw = 100.0 - (fatigue_level * 0.6)
    if latest_wellness:
        sleep_score = float(latest_wellness.sleep_score or 0)
        energy_score = float(latest_wellness.energy_score or 0)
        stress_level = float(latest_wellness.stress_level or 0)
        readiness_raw += ((sleep_score - 50) * 0.2)
        readiness_raw += ((energy_score - 50) * 0.3)
        readiness_raw -= (stress_level * 2.0)

    readiness_score = round(_clamp(readiness_raw), 2)

    existing_result = await db.execute(
        select(RecoveryState).where(RecoveryState.user_id == user_id)
    )
    state = existing_result.scalar_one_or_none()

    if state:
        state.fatigue_level = fatigue_level
        state.readiness_score = Decimal(str(readiness_score))
    else:
        db.add(
            RecoveryState(
                user_id=user_id,
                fatigue_level=fatigue_level,
                readiness_score=Decimal(str(readiness_score)),
            )
        )


@router.get("/templates", response_model=WorkoutTemplateList)
async def get_workout_templates(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    template_type: Optional[str] = Query(
        None, pattern="^(cardio|strength|flexibility|mixed)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Get list of user's workout templates

    **Headers:**
    ```
    Authorization: Bearer <access_token>
    ```

    **Query Parameters:**
    - `page`: Page number (default: 1)
    - `page_size`: Items per page (default: 20, max: 100)
    - `template_type`: Filter by type (cardio, strength, flexibility, mixed)

    **Response:**
    ```json
    {
        "items": [
            {
                "id": 1,
                "user_id": 1,
                "name": "Upper Body Strength",
                "type": "strength",
                "exercises": [
                    {
                        "exercise_id": 1,
                        "name": "Bench Press",
                        "sets": 4,
                        "reps": 10,
                        "rest_seconds": 90
                    }
                ],
                "is_public": false,
                "created_at": "2024-01-15T10:30:00",
                "updated_at": "2024-01-15T10:30:00"
            }
        ],
        "total": 5,
        "page": 1,
        "page_size": 20
    }
    ```
    """
    # Build query
    query = select(WorkoutTemplate).where(
        WorkoutTemplate.user_id == current_user.id
    )

    if template_type:
        query = query.where(WorkoutTemplate.type == template_type)

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()

    # Apply pagination
    query = query.order_by(desc(WorkoutTemplate.created_at))
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    templates = result.scalars().all()

    return WorkoutTemplateList(
        items=templates,
        total=total,
        page=page,
        page_size=page_size
    )


@router.post("/templates", response_model=WorkoutTemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_workout_template(
    template_data: WorkoutTemplateCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Create new workout template

    **Headers:**
    ```
    Authorization: Bearer <access_token>
    ```

    **Request:**
    ```json
    {
        "name": "Upper Body Strength",
        "type": "strength",
        "exercises": [
            {
                "exercise_id": 1,
                "name": "Bench Press",
                "sets": 4,
                "reps": 10,
                "rest_seconds": 90,
                "weight": 60.0
            },
            {
                "exercise_id": 2,
                "name": "Shoulder Press",
                "sets": 3,
                "reps": 12,
                "rest_seconds": 60
            }
        ],
        "is_public": false
    }
    ```

    **Response:** Created template object
    """
    template = WorkoutTemplate(
        user_id=current_user.id,
        name=template_data.name,
        type=template_data.type,
        exercises=[ex.model_dump() for ex in template_data.exercises],
        is_public=template_data.is_public
    )

    db.add(template)
    await db.commit()
    await db.refresh(template)

    return template


@router.get("/templates/{template_id}", response_model=WorkoutTemplateResponse)
async def get_workout_template(
    template_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Get specific workout template by ID
    """
    result = await db.execute(
        select(WorkoutTemplate).where(
            and_(
                WorkoutTemplate.id == template_id,
                WorkoutTemplate.user_id == current_user.id
            )
        )
    )
    template = result.scalar_one_or_none()

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found"
        )

    return template


@router.put("/templates/{template_id}", response_model=WorkoutTemplateResponse)
async def update_workout_template(
    template_id: int,
    template_data: WorkoutTemplateCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Update workout template
    """
    result = await db.execute(
        select(WorkoutTemplate).where(
            and_(
                WorkoutTemplate.id == template_id,
                WorkoutTemplate.user_id == current_user.id
            )
        )
    )
    template = result.scalar_one_or_none()

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found"
        )

    # Update fields
    template.name = template_data.name
    template.type = template_data.type
    template.exercises = [ex.model_dump() for ex in template_data.exercises]
    template.is_public = template_data.is_public

    await db.commit()
    await db.refresh(template)

    return template


@router.delete("/templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workout_template(
    template_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Delete workout template
    """
    result = await db.execute(
        select(WorkoutTemplate).where(
            and_(
                WorkoutTemplate.id == template_id,
                WorkoutTemplate.user_id == current_user.id
            )
        )
    )
    template = result.scalar_one_or_none()

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found"
        )

    await db.delete(template)
    await db.commit()


@router.get("/history", response_model=WorkoutHistoryResponse)
async def get_workout_history(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Get workout history

    **Headers:**
    ```
    Authorization: Bearer <access_token>
    ```

    **Query Parameters:**
    - `page`: Page number (default: 1)
    - `page_size`: Items per page (default: 20, max: 100)
    - `date_from`: Filter from date (YYYY-MM-DD)
    - `date_to`: Filter to date (YYYY-MM-DD)

    **Response:**
    ```json
    {
        "items": [
            {
                "id": 1,
                "date": "2024-01-20",
                "duration": 45,
                "exercises": [...],
                "comments": "Great workout!",
                "tags": ["strength", "morning"],
                "glucose_before": 5.5,
                "glucose_after": 6.2,
                "created_at": "2024-01-20T08:30:00"
            }
        ],
        "total": 50,
        "page": 1,
        "page_size": 20,
        "date_from": "2024-01-01",
        "date_to": "2024-01-31"
    }
    ```
    """
    # Build query
    query = select(WorkoutLog).where(WorkoutLog.user_id == current_user.id)

    if date_from:
        query = query.where(WorkoutLog.date >= date_from)
    if date_to:
        query = query.where(WorkoutLog.date <= date_to)

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()

    # Apply pagination
    query = query.order_by(desc(WorkoutLog.date))
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    workouts = result.scalars().all()

    return WorkoutHistoryResponse(
        items=workouts,
        total=total,
        page=page,
        page_size=page_size,
        date_from=date_from,
        date_to=date_to
    )


@router.post("/start", response_model=WorkoutStartResponse)
async def start_workout(
    start_data: WorkoutStartRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Start a new workout session

    **Headers:**
    ```
    Authorization: Bearer <access_token>
    ```

    **Request:**
    ```json
    {
        "template_id": 1,
        "name": "Morning Workout",
        "type": "strength"
    }
    ```

    **Response:**
    ```json
    {
        "id": 123,
        "user_id": 1,
        "template_id": 1,
        "date": "2024-01-20",
        "start_time": "2024-01-20T08:00:00",
        "status": "in_progress",
        "message": "Workout started successfully"
    }
    ```
    """
    # Validate template if provided
    if start_data.template_id:
        result = await db.execute(
            select(WorkoutTemplate).where(
                and_(
                    WorkoutTemplate.id == start_data.template_id,
                    WorkoutTemplate.user_id == current_user.id
                )
            )
        )
        template = result.scalar_one_or_none()

        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Template not found"
            )

    # Create workout log (in_progress status)
    workout = WorkoutLog(
        user_id=current_user.id,
        template_id=start_data.template_id,
        date=date.today(),
        exercises=[],  # Will be populated on completion
        comments=start_data.name
    )

    db.add(workout)
    await db.commit()
    await db.refresh(workout)
    await invalidate_user_analytics_cache(current_user.id)

    return WorkoutStartResponse(
        id=workout.id,
        user_id=workout.user_id,
        template_id=workout.template_id,
        date=workout.date,
        start_time=workout.created_at,
        status="in_progress",
        message="Workout started successfully"
    )


@router.post("/complete", response_model=WorkoutCompleteResponse)
async def complete_workout(
    workout_id: int,
    complete_data: WorkoutCompleteRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Complete a workout session

    **Headers:**
    ```
    Authorization: Bearer <access_token>
    ```

    **Request:**
    ```json
    {
        "duration": 45,
        "exercises": [
            {
                "exercise_id": 1,
                "name": "Bench Press",
                "sets_completed": [
                    {"set_number": 1, "reps": 10, "weight": 60.0, "completed": true},
                    {"set_number": 2, "reps": 10, "weight": 60.0, "completed": true}
                ]
            }
        ],
        "comments": "Felt strong today!",
        "tags": ["strength", "personal_best"],
        "glucose_before": 5.5,
        "glucose_after": 6.2
    }
    ```

    **Response:** Completed workout object
    """
    result = await db.execute(
        select(WorkoutLog).where(
            and_(
                WorkoutLog.id == workout_id,
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

    # Update workout with completion data
    workout.duration = complete_data.duration
    workout.exercises = [ex.model_dump() for ex in complete_data.exercises]
    workout.comments = complete_data.comments
    workout.tags = complete_data.tags
    workout.glucose_before = complete_data.glucose_before
    workout.glucose_after = complete_data.glucose_after

    await _upsert_training_load_daily(
        db=db,
        user_id=current_user.id,
        target_date=workout.date,
    )
    await _upsert_muscle_load_daily(
        db=db,
        user_id=current_user.id,
        target_date=workout.date,
    )
    await _upsert_recovery_state(
        db=db,
        user_id=current_user.id,
        target_date=workout.date,
    )

    await db.commit()
    await db.refresh(workout)
    await invalidate_user_analytics_cache(current_user.id)

    return WorkoutCompleteResponse(
        id=workout.id,
        user_id=workout.user_id,
        template_id=workout.template_id,
        date=workout.date,
        duration=workout.duration,
        exercises=complete_data.exercises,
        comments=workout.comments,
        tags=workout.tags,
        glucose_before=workout.glucose_before,
        glucose_after=workout.glucose_after,
        completed_at=workout.updated_at,
        message="Workout completed successfully"
    )


@router.get("/history/{workout_id}", response_model=WorkoutHistoryItem)
async def get_workout_detail(
    workout_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Get specific workout details
    """
    result = await db.execute(
        select(WorkoutLog).where(
            and_(
                WorkoutLog.id == workout_id,
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

    return workout
