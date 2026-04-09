"""
Exercises API Router
HTTP-only endpoints delegating business logic to services
"""
import json
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.auth import get_current_user, require_admin
from app.application.exercises_service import ExercisesService
from app.domain.user import User
from app.infrastructure.database import get_async_db
from app.schemas.exercises import (
    ExerciseCategoriesResponse,
    ExerciseCreate,
    ExerciseEquipmentListResponse,
    ExerciseListResponse,
    ExerciseMuscleGroupsResponse,
    ExerciseResponse,
    ExerciseUpdate,
    RiskFlags,
)
from app.settings import settings

router = APIRouter()


@router.get("/", response_model=ExerciseListResponse)
async def get_exercises(
    category: Optional[str] = Query(None, pattern="^(strength|cardio|flexibility|balance|sport)$"),
    muscle_group: Optional[str] = Query(None),
    equipment: Optional[str] = Query(None),
    search: Optional[str] = Query(None, max_length=100),
    status: str = Query("active", pattern="^(active|pending|archived|all)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = ExercisesService(db)
    return await service.get_exercises(
        category=category,
        muscle_group=muscle_group,
        equipment=equipment,
        search=search,
        status=status,
        page=page,
        page_size=page_size,
    )


@router.get("/by-slugs")
async def get_exercises_by_slugs(
    slugs: list[str] = Query(..., max_length=50),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
) -> dict[str, int]:
    """Resolve exercise slugs to IDs. Used by goal-based program presets."""
    service = ExercisesService(db)
    return await service.get_ids_by_slugs(slugs)


@router.get("/{exercise_id}", response_model=ExerciseResponse)
async def get_exercise(
    exercise_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = ExercisesService(db)
    return await service.get_exercise(exercise_id=exercise_id)


@router.post("/", response_model=ExerciseResponse, status_code=status.HTTP_201_CREATED)
async def create_exercise(
    exercise_data: ExerciseCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = ExercisesService(db)
    is_admin = current_user.telegram_id in settings.ADMIN_USER_IDS
    return await service.create_exercise(user_id=current_user.id, data=exercise_data, is_admin=is_admin)


@router.post("/custom", response_model=ExerciseResponse, status_code=status.HTTP_201_CREATED)
async def create_custom_exercise_multipart(
    name: str = Form(...),
    category: str = Form(...),
    description: str = Form(""),
    equipment: str = Form("[]"),
    target_muscles: str = Form("[]"),
    risks: str = Form("[]"),
    difficulty: str = Form("beginner"),
    media: UploadFile | None = File(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    """
    Compatibility endpoint for the frontend `AddExercise` form.

    The UI submits a multipart/form-data payload with JSON-encoded arrays in some fields.
    For MVP we accept the payload and create a pending exercise. Media storage is not
    implemented yet; file is accepted but ignored.
    """

    def _parse_json_list(raw: str) -> list[str]:
        try:
            parsed = json.loads(raw) if raw else []
            if isinstance(parsed, list):
                return [str(x) for x in parsed if isinstance(x, (str, int, float)) and str(x).strip()]
        except json.JSONDecodeError:
            pass
        return []

    equipment_list = _parse_json_list(equipment)
    muscle_groups = _parse_json_list(target_muscles)
    risks_list = _parse_json_list(risks)

    # Best-effort mapping from UI "risks" (joint areas) to backend health flags.
    risk_flags = RiskFlags()
    if "back" in risks_list:
        risk_flags.back_problems = True
    if "heart" in risks_list or "cardio" in risks_list:
        risk_flags.heart_conditions = True

    # Ignore `difficulty` and `media` for now; they are UI-only fields.
    _ = (difficulty, media)

    service = ExercisesService(db)
    is_admin = current_user.telegram_id in settings.ADMIN_USER_IDS
    return await service.create_exercise(
        user_id=current_user.id,
        data=ExerciseCreate(
            name=name,
            category=category,  # pydantic validates against ExerciseCategory
            description=description or None,
            equipment=equipment_list,
            muscle_groups=muscle_groups,
            risk_flags=risk_flags,
            media_url=None,
        ),
        is_admin=is_admin,
    )


@router.put("/{exercise_id}", response_model=ExerciseResponse)
async def update_exercise(
    exercise_id: int,
    exercise_data: ExerciseUpdate,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_async_db),
):
    service = ExercisesService(db)
    return await service.update_exercise(exercise_id=exercise_id, data=exercise_data)


@router.delete("/{exercise_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_exercise(
    exercise_id: int,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_async_db),
):
    service = ExercisesService(db)
    await service.delete_exercise(exercise_id=exercise_id)
    return None


@router.post("/{exercise_id}/approve", response_model=ExerciseResponse)
async def approve_exercise(
    exercise_id: int,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_async_db),
):
    service = ExercisesService(db)
    return await service.approve_exercise(exercise_id=exercise_id)


@router.get("/categories/list", response_model=ExerciseCategoriesResponse)
async def get_exercise_categories(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = ExercisesService(db)
    return await service.get_categories()


@router.get("/equipment/list", response_model=ExerciseEquipmentListResponse)
async def get_equipment_list(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = ExercisesService(db)
    return await service.get_equipment()


@router.get("/muscle-groups/list", response_model=ExerciseMuscleGroupsResponse)
async def get_muscle_groups(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = ExercisesService(db)
    return await service.get_muscle_groups()
