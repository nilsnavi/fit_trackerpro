"""
Exercises API Router
HTTP-only endpoints delegating business logic to services
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.middleware.auth import get_current_user, require_admin
from app.models import User, get_async_db
from app.schemas.exercises import ExerciseCreate, ExerciseListResponse, ExerciseResponse, ExerciseUpdate
from app.services.exercises_service import ExerciseNotFoundError, ExercisesService

router = APIRouter()


def _map_service_error(exc: Exception) -> HTTPException:
    if isinstance(exc, ExerciseNotFoundError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    return HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Unexpected exercises error")


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
    try:
        return await service.get_exercises(
            category=category,
            muscle_group=muscle_group,
            equipment=equipment,
            search=search,
            status=status,
            page=page,
            page_size=page_size,
        )
    except Exception as exc:
        raise _map_service_error(exc) from exc


@router.get("/{exercise_id}", response_model=ExerciseResponse)
async def get_exercise(
    exercise_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = ExercisesService(db)
    try:
        return await service.get_exercise(exercise_id=exercise_id)
    except Exception as exc:
        raise _map_service_error(exc) from exc


@router.post("/", response_model=ExerciseResponse, status_code=status.HTTP_201_CREATED)
async def create_exercise(
    exercise_data: ExerciseCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = ExercisesService(db)
    try:
        return await service.create_exercise(user_id=current_user.id, data=exercise_data)
    except Exception as exc:
        raise _map_service_error(exc) from exc


@router.put("/{exercise_id}", response_model=ExerciseResponse)
async def update_exercise(
    exercise_id: int,
    exercise_data: ExerciseUpdate,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_async_db),
):
    service = ExercisesService(db)
    try:
        return await service.update_exercise(exercise_id=exercise_id, data=exercise_data)
    except Exception as exc:
        raise _map_service_error(exc) from exc


@router.delete("/{exercise_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_exercise(
    exercise_id: int,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_async_db),
):
    service = ExercisesService(db)
    try:
        await service.delete_exercise(exercise_id=exercise_id)
        return None
    except Exception as exc:
        raise _map_service_error(exc) from exc


@router.post("/{exercise_id}/approve", response_model=ExerciseResponse)
async def approve_exercise(
    exercise_id: int,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_async_db),
):
    service = ExercisesService(db)
    try:
        return await service.approve_exercise(exercise_id=exercise_id)
    except Exception as exc:
        raise _map_service_error(exc) from exc


@router.get("/categories/list")
async def get_exercise_categories(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = ExercisesService(db)
    return service.get_categories()


@router.get("/equipment/list")
async def get_equipment_list(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = ExercisesService(db)
    return service.get_equipment()


@router.get("/muscle-groups/list")
async def get_muscle_groups(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = ExercisesService(db)
    return service.get_muscle_groups()
