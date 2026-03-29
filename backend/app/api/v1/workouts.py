"""
Workouts API Router
HTTP-only endpoints delegating business logic to services
"""
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.middleware.auth import get_current_user
from app.domain.user import User
from app.domain.exceptions import WorkoutNotFoundError
from app.infrastructure.database import get_async_db
from app.schemas.workouts import (
    WorkoutCompleteRequest,
    WorkoutCompleteResponse,
    WorkoutHistoryItem,
    WorkoutHistoryResponse,
    WorkoutStartRequest,
    WorkoutStartResponse,
    WorkoutTemplateCreate,
    WorkoutTemplateList,
    WorkoutTemplateResponse,
)
from app.application.workouts_service import WorkoutsService

router = APIRouter()


def _map_service_error(exc: Exception) -> HTTPException:
    if isinstance(exc, WorkoutNotFoundError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    return HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Unexpected workouts error")


@router.get("/templates", response_model=WorkoutTemplateList)
async def get_workout_templates(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    template_type: Optional[str] = Query(None, pattern="^(cardio|strength|flexibility|mixed)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = WorkoutsService(db)
    try:
        return await service.get_templates(
            user_id=current_user.id,
            page=page,
            page_size=page_size,
            template_type=template_type,
        )
    except Exception as exc:
        raise _map_service_error(exc) from exc


@router.post("/templates", response_model=WorkoutTemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_workout_template(
    template_data: WorkoutTemplateCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = WorkoutsService(db)
    try:
        return await service.create_template(user_id=current_user.id, data=template_data)
    except Exception as exc:
        raise _map_service_error(exc) from exc


@router.get("/templates/{template_id}", response_model=WorkoutTemplateResponse)
async def get_workout_template(
    template_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = WorkoutsService(db)
    try:
        return await service.get_template(user_id=current_user.id, template_id=template_id)
    except Exception as exc:
        raise _map_service_error(exc) from exc


@router.put("/templates/{template_id}", response_model=WorkoutTemplateResponse)
async def update_workout_template(
    template_id: int,
    template_data: WorkoutTemplateCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = WorkoutsService(db)
    try:
        return await service.update_template(
            user_id=current_user.id,
            template_id=template_id,
            data=template_data,
        )
    except Exception as exc:
        raise _map_service_error(exc) from exc


@router.delete("/templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workout_template(
    template_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = WorkoutsService(db)
    try:
        await service.delete_template(user_id=current_user.id, template_id=template_id)
        return None
    except Exception as exc:
        raise _map_service_error(exc) from exc


@router.get("/history", response_model=WorkoutHistoryResponse)
async def get_workout_history(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = WorkoutsService(db)
    try:
        return await service.get_history(
            user_id=current_user.id,
            page=page,
            page_size=page_size,
            date_from=date_from,
            date_to=date_to,
        )
    except Exception as exc:
        raise _map_service_error(exc) from exc


@router.post("/start", response_model=WorkoutStartResponse)
async def start_workout(
    start_data: WorkoutStartRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = WorkoutsService(db)
    try:
        return await service.start_workout(user_id=current_user.id, data=start_data)
    except Exception as exc:
        raise _map_service_error(exc) from exc


@router.post("/complete", response_model=WorkoutCompleteResponse)
async def complete_workout(
    workout_id: int,
    complete_data: WorkoutCompleteRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = WorkoutsService(db)
    try:
        return await service.complete_workout(
            user_id=current_user.id,
            workout_id=workout_id,
            data=complete_data,
        )
    except Exception as exc:
        raise _map_service_error(exc) from exc


@router.get("/history/{workout_id}", response_model=WorkoutHistoryItem)
async def get_workout_detail(
    workout_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = WorkoutsService(db)
    try:
        return await service.get_workout_detail(user_id=current_user.id, workout_id=workout_id)
    except Exception as exc:
        raise _map_service_error(exc) from exc
