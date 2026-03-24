"""
Workouts API Router
Endpoints for workout templates, history, and session management
"""
from typing import Optional, List
from datetime import datetime, date

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func, and_

from app.middleware.auth import get_current_user
from app.models import get_async_db, User, WorkoutTemplate, WorkoutLog
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
