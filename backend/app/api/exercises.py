"""
Exercises API Router
Endpoints for exercise catalog and management
"""
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func, and_, or_

from app.middleware.auth import get_current_user, require_admin
from app.models import get_async_db, User, Exercise
from app.schemas.exercises import (
    ExerciseCreate,
    ExerciseUpdate,
    ExerciseResponse,
    ExerciseListResponse,
    ExerciseFilterParams,
)

router = APIRouter()


@router.get("/", response_model=ExerciseListResponse)
async def get_exercises(
    category: Optional[str] = Query(
        None, pattern="^(strength|cardio|flexibility|balance|sport)$"),
    muscle_group: Optional[str] = Query(None),
    equipment: Optional[str] = Query(None),
    search: Optional[str] = Query(None, max_length=100),
    status: str = Query("active", pattern="^(active|pending|archived|all)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Get exercise catalog with filters

    **Headers:**
    ```
    Authorization: Bearer <access_token>
    ```

    **Query Parameters:**
    - `category`: Filter by category (strength, cardio, flexibility, balance, sport)
    - `muscle_group`: Filter by target muscle group
    - `equipment`: Filter by required equipment
    - `search`: Search in name and description
    - `status`: Filter by status (active, pending, archived, all)
    - `page`: Page number (default: 1)
    - `page_size`: Items per page (default: 20, max: 100)

    **Response:**
    ```json
    {
        "items": [
            {
                "id": 1,
                "name": "Bench Press",
                "description": "Classic chest exercise...",
                "category": "strength",
                "equipment": ["barbell", "bench"],
                "muscle_groups": ["chest", "triceps", "shoulders"],
                "risk_flags": {
                    "high_blood_pressure": false,
                    "diabetes": false,
                    "joint_problems": false,
                    "back_problems": false,
                    "heart_conditions": false
                },
                "media_url": "https://...",
                "status": "active",
                "author_user_id": null,
                "created_at": "2024-01-01T00:00:00",
                "updated_at": "2024-01-01T00:00:00"
            }
        ],
        "total": 150,
        "page": 1,
        "page_size": 20,
        "filters": {
            "category": "strength",
            "status": "active"
        }
    }
    ```
    """
    # Build query
    query = select(Exercise)

    # Apply filters
    if category:
        query = query.where(Exercise.category == category)

    if status != "all":
        query = query.where(Exercise.status == status)

    if muscle_group:
        query = query.where(
            Exercise.muscle_groups.contains([muscle_group])
        )

    if equipment:
        query = query.where(
            Exercise.equipment.contains([equipment])
        )

    if search:
        search_filter = or_(
            Exercise.name.ilike(f"%{search}%"),
            Exercise.description.ilike(f"%{search}%")
        )
        query = query.where(search_filter)

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()

    # Apply pagination
    query = query.order_by(Exercise.name)
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    exercises = result.scalars().all()

    return ExerciseListResponse(
        items=exercises,
        total=total,
        page=page,
        page_size=page_size,
        filters={
            "category": category,
            "muscle_group": muscle_group,
            "equipment": equipment,
            "search": search,
            "status": status
        }
    )


@router.get("/{exercise_id}", response_model=ExerciseResponse)
async def get_exercise(
    exercise_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Get exercise details by ID

    **Response:** Exercise object with full details
    """
    result = await db.execute(
        select(Exercise).where(Exercise.id == exercise_id)
    )
    exercise = result.scalar_one_or_none()

    if not exercise:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Exercise not found"
        )

    return exercise


@router.post("/", response_model=ExerciseResponse, status_code=status.HTTP_201_CREATED)
async def create_exercise(
    exercise_data: ExerciseCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Create new exercise (submitted for moderation)

    **Headers:**
    ```
    Authorization: Bearer <access_token>
    ```

    **Request:**
    ```json
    {
        "name": "Custom Exercise",
        "description": "Description of the exercise...",
        "category": "strength",
        "equipment": ["dumbbells"],
        "muscle_groups": ["biceps", "forearms"],
        "risk_flags": {
            "high_blood_pressure": false,
            "diabetes": false,
            "joint_problems": false,
            "back_problems": false,
            "heart_conditions": false
        },
        "media_url": "https://example.com/video.mp4"
    }
    ```

    **Response:** Created exercise with status "pending"
    """
    exercise = Exercise(
        name=exercise_data.name,
        description=exercise_data.description,
        category=exercise_data.category,
        equipment=exercise_data.equipment,
        muscle_groups=exercise_data.muscle_groups,
        risk_flags=exercise_data.risk_flags.model_dump(),
        media_url=exercise_data.media_url,
        status="pending",  # New exercises start as pending
        author_user_id=current_user.id
    )

    db.add(exercise)
    await db.commit()
    await db.refresh(exercise)

    return exercise


@router.put("/{exercise_id}", response_model=ExerciseResponse)
async def update_exercise(
    exercise_id: int,
    exercise_data: ExerciseUpdate,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Update exercise (Admin only)

    **Headers:**
    ```
    Authorization: Bearer <access_token>
    ```

    **Request:**
    ```json
    {
        "name": "Updated Name",
        "description": "Updated description...",
        "status": "active"
    }
    ```

    **Response:** Updated exercise object
    """
    result = await db.execute(
        select(Exercise).where(Exercise.id == exercise_id)
    )
    exercise = result.scalar_one_or_none()

    if not exercise:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Exercise not found"
        )

    # Update fields
    update_data = exercise_data.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        if field == "risk_flags" and value is not None:
            exercise.risk_flags = value.model_dump()
        else:
            setattr(exercise, field, value)

    await db.commit()
    await db.refresh(exercise)

    return exercise


@router.delete("/{exercise_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_exercise(
    exercise_id: int,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Delete exercise (Admin only)
    """
    result = await db.execute(
        select(Exercise).where(Exercise.id == exercise_id)
    )
    exercise = result.scalar_one_or_none()

    if not exercise:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Exercise not found"
        )

    await db.delete(exercise)
    await db.commit()


@router.post("/{exercise_id}/approve", response_model=ExerciseResponse)
async def approve_exercise(
    exercise_id: int,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Approve pending exercise (Admin only)

    Changes status from "pending" to "active"
    """
    result = await db.execute(
        select(Exercise).where(
            and_(
                Exercise.id == exercise_id,
                Exercise.status == "pending"
            )
        )
    )
    exercise = result.scalar_one_or_none()

    if not exercise:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pending exercise not found"
        )

    exercise.status = "active"
    await db.commit()
    await db.refresh(exercise)

    return exercise


@router.get("/categories/list")
async def get_exercise_categories(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Get list of available exercise categories

    **Response:**
    ```json
    {
        "categories": [
            {"value": "strength", "label": "Strength"},
            {"value": "cardio", "label": "Cardio"},
            {"value": "flexibility", "label": "Flexibility"},
            {"value": "balance", "label": "Balance"},
            {"value": "sport", "label": "Sport"}
        ]
    }
    ```
    """
    categories = [
        {"value": "strength", "label": "Strength", "icon": "dumbbell"},
        {"value": "cardio", "label": "Cardio", "icon": "heart-pulse"},
        {"value": "flexibility", "label": "Flexibility", "icon": "person-stretching"},
        {"value": "balance", "label": "Balance", "icon": "scale-balanced"},
        {"value": "sport", "label": "Sport", "icon": "basketball"}
    ]

    return {"categories": categories}


@router.get("/equipment/list")
async def get_equipment_list(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Get list of common equipment options

    **Response:**
    ```json
    {
        "equipment": [
            {"value": "none", "label": "No Equipment"},
            {"value": "dumbbells", "label": "Dumbbells"},
            {"value": "barbell", "label": "Barbell"},
            {"value": "kettlebell", "label": "Kettlebell"},
            {"value": "resistance_bands", "label": "Resistance Bands"},
            {"value": "pull_up_bar", "label": "Pull-up Bar"},
            {"value": "bench", "label": "Bench"},
            {"value": "cable_machine", "label": "Cable Machine"},
            {"value": "smith_machine", "label": "Smith Machine"}
        ]
    }
    ```
    """
    equipment = [
        {"value": "none", "label": "No Equipment"},
        {"value": "dumbbells", "label": "Dumbbells"},
        {"value": "barbell", "label": "Barbell"},
        {"value": "kettlebell", "label": "Kettlebell"},
        {"value": "resistance_bands", "label": "Resistance Bands"},
        {"value": "pull_up_bar", "label": "Pull-up Bar"},
        {"value": "bench", "label": "Bench"},
        {"value": "cable_machine", "label": "Cable Machine"},
        {"value": "smith_machine", "label": "Smith Machine"},
        {"value": "leg_press", "label": "Leg Press Machine"},
        {"value": "treadmill", "label": "Treadmill"},
        {"value": "exercise_bike", "label": "Exercise Bike"},
        {"value": "rowing_machine", "label": "Rowing Machine"},
        {"value": "elliptical", "label": "Elliptical"},
        {"value": "medicine_ball", "label": "Medicine Ball"},
        {"value": "foam_roller", "label": "Foam Roller"},
        {"value": "yoga_mat", "label": "Yoga Mat"}
    ]

    return {"equipment": equipment}


@router.get("/muscle-groups/list")
async def get_muscle_groups(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Get list of muscle groups

    **Response:**
    ```json
    {
        "muscle_groups": [
            {"value": "chest", "label": "Chest"},
            {"value": "back", "label": "Back"},
            {"value": "shoulders", "label": "Shoulders"},
            {"value": "biceps", "label": "Biceps"},
            {"value": "triceps", "label": "Triceps"},
            {"value": "forearms", "label": "Forearms"},
            {"value": "abs", "label": "Abs"},
            {"value": "quadriceps", "label": "Quadriceps"},
            {"value": "hamstrings", "label": "Hamstrings"},
            {"value": "glutes", "label": "Glutes"},
            {"value": "calves", "label": "Calves"},
            {"value": "full_body", "label": "Full Body"}
        ]
    }
    ```
    """
    muscle_groups = [
        {"value": "chest", "label": "Chest"},
        {"value": "back", "label": "Back"},
        {"value": "shoulders", "label": "Shoulders"},
        {"value": "biceps", "label": "Biceps"},
        {"value": "triceps", "label": "Triceps"},
        {"value": "forearms", "label": "Forearms"},
        {"value": "abs", "label": "Abs"},
        {"value": "obliques", "label": "Obliques"},
        {"value": "lower_back", "label": "Lower Back"},
        {"value": "lats", "label": "Lats"},
        {"value": "traps", "label": "Traps"},
        {"value": "quadriceps", "label": "Quadriceps"},
        {"value": "hamstrings", "label": "Hamstrings"},
        {"value": "glutes", "label": "Glutes"},
        {"value": "calves", "label": "Calves"},
        {"value": "hip_flexors", "label": "Hip Flexors"},
        {"value": "adductors", "label": "Adductors"},
        {"value": "abductors", "label": "Abductors"},
        {"value": "full_body", "label": "Full Body"}
    ]

    return {"muscle_groups": muscle_groups}
