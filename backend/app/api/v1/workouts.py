"""
Workouts API Router
HTTP-only endpoints delegating business logic to services
"""
import calendar
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.auth import get_current_user
from app.api.deps.idempotency import optional_idempotency_key
from app.application.workouts_service import WorkoutsService
from app.core.audit import get_client_ip
from app.domain.user import User
from app.infrastructure.database import get_async_db
from app.infrastructure.repositories.workouts_repository import WorkoutsRepository
from app.schemas.workouts import (
    WorkoutCompleteRequest,
    WorkoutCompleteResponse,
    WorkoutHistoryItem,
    WorkoutHistoryResponse,
    WorkoutSessionUpdateRequest,
    WorkoutStartRequest,
    WorkoutStartFromTemplateRequest,
    WorkoutStartResponse,
    WorkoutTemplateCloneRequest,
    WorkoutTemplateCreate,
    WorkoutTemplateFromWorkoutCreate,
    WorkoutTemplateList,
    WorkoutTemplatePatchRequest,
    WorkoutTemplateResponse,
)

router = APIRouter()


@router.get("/templates", response_model=WorkoutTemplateList)
async def get_workout_templates(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    template_type: Optional[str] = Query(None, pattern="^(cardio|strength|flexibility|mixed)$"),
    include_archived: bool = Query(False),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = WorkoutsService(db)
    return await service.get_templates(
        user_id=current_user.id,
        page=page,
        page_size=page_size,
        template_type=template_type,
        include_archived=include_archived,
    )


@router.post("/templates", response_model=WorkoutTemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_workout_template(
    template_data: WorkoutTemplateCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = WorkoutsService(db)
    return await service.create_template(
        user_id=current_user.id,
        data=template_data,
        client_ip=get_client_ip(request),
    )


@router.post("/templates/from-workout", response_model=WorkoutTemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_workout_template_from_workout(
    payload: WorkoutTemplateFromWorkoutCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = WorkoutsService(db)
    return await service.create_template_from_workout(
        user_id=current_user.id,
        data=payload,
        client_ip=get_client_ip(request),
    )


@router.get("/templates/{template_id}", response_model=WorkoutTemplateResponse)
async def get_workout_template(
    template_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = WorkoutsService(db)
    return await service.get_template(user_id=current_user.id, template_id=template_id)


@router.put("/templates/{template_id}", response_model=WorkoutTemplateResponse)
async def update_workout_template(
    template_id: int,
    template_data: WorkoutTemplateCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = WorkoutsService(db)
    return await service.update_template(
        user_id=current_user.id,
        template_id=template_id,
        data=template_data,
        client_ip=get_client_ip(request),
    )


@router.patch("/templates/{template_id}", response_model=WorkoutTemplateResponse)
async def patch_workout_template(
    template_id: int,
    patch_data: WorkoutTemplatePatchRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = WorkoutsService(db)
    return await service.patch_template(
        user_id=current_user.id,
        template_id=template_id,
        data=patch_data,
        client_ip=get_client_ip(request),
    )


@router.post("/templates/{template_id}/clone", response_model=WorkoutTemplateResponse, status_code=status.HTTP_201_CREATED)
async def clone_workout_template(
    template_id: int,
    clone_data: WorkoutTemplateCloneRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = WorkoutsService(db)
    return await service.clone_template(
        user_id=current_user.id,
        template_id=template_id,
        data=clone_data,
        client_ip=get_client_ip(request),
    )


@router.delete("/templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workout_template(
    template_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = WorkoutsService(db)
    await service.delete_template(
        user_id=current_user.id,
        template_id=template_id,
        client_ip=get_client_ip(request),
    )
    return None


@router.post("/templates/{template_id}/archive", response_model=WorkoutTemplateResponse)
async def archive_workout_template(
    template_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = WorkoutsService(db)
    return await service.archive_template(
        user_id=current_user.id,
        template_id=template_id,
        client_ip=get_client_ip(request),
    )


@router.post("/templates/{template_id}/unarchive", response_model=WorkoutTemplateResponse)
async def unarchive_workout_template(
    template_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = WorkoutsService(db)
    return await service.unarchive_template(
        user_id=current_user.id,
        template_id=template_id,
        client_ip=get_client_ip(request),
    )


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
    return await service.get_history(
        user_id=current_user.id,
        page=page,
        page_size=page_size,
        date_from=date_from,
        date_to=date_to,
    )


@router.post("/start", response_model=WorkoutStartResponse)
async def start_workout(
    start_data: WorkoutStartRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = WorkoutsService(db)
    return await service.start_workout(
        user_id=current_user.id,
        data=start_data,
        client_ip=get_client_ip(request),
    )


@router.post("/start/from-template/{template_id}", response_model=WorkoutStartResponse)
async def start_workout_from_template_with_overrides(
    template_id: int,
    start_data: WorkoutStartFromTemplateRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = WorkoutsService(db)
    return await service.start_workout_from_template_with_overrides(
        user_id=current_user.id,
        template_id=template_id,
        data=start_data,
        client_ip=get_client_ip(request),
    )


@router.post("/complete", response_model=WorkoutCompleteResponse)
async def complete_workout(
    workout_id: int,
    complete_data: WorkoutCompleteRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
    idempotency_key: str | None = Depends(optional_idempotency_key),
):
    service = WorkoutsService(db)
    return await service.complete_workout(
        user_id=current_user.id,
        workout_id=workout_id,
        data=complete_data,
        client_ip=get_client_ip(request),
        idempotency_key=idempotency_key,
    )


@router.patch("/history/{workout_id}", response_model=WorkoutHistoryItem)
async def update_active_workout(
    workout_id: int,
    session_data: WorkoutSessionUpdateRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = WorkoutsService(db)
    return await service.update_workout_session(
        user_id=current_user.id,
        workout_id=workout_id,
        data=session_data,
        client_ip=get_client_ip(request),
    )


@router.get("/history/{workout_id}", response_model=WorkoutHistoryItem)
async def get_workout_detail(
    workout_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = WorkoutsService(db)
    return await service.get_workout_detail(user_id=current_user.id, workout_id=workout_id)


@router.get("/calendar")
async def get_workouts_calendar_month(
    year: int = Query(date.today().year, ge=2020, le=2030),
    month: int = Query(date.today().month, ge=1, le=12),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    """
    Compatibility endpoint for the current frontend calendar page.

    Returns a flat list of workouts in the selected month (frontend groups by day).
    """
    first_day = date(year, month, 1)
    last_day = date(year, month, calendar.monthrange(year, month)[1])
    repo = WorkoutsRepository(db)
    rows = await repo.list_workouts_in_range(user_id=current_user.id, date_from=first_day, date_to=last_day)

    items = []
    for w in rows:
        completed = w.duration is not None and int(w.duration) > 0
        title = (w.comments or "").strip() or f"Тренировка #{w.id}"
        items.append(
            {
                "id": int(w.id),
                "title": title,
                "type": "strength",  # TODO: derive from template/type metadata
                "status": "completed" if completed else "planned",
                "duration_minutes": int(w.duration or 0),
                "calories_burned": None,
                "scheduled_at": w.date.isoformat(),
                "completed_at": (w.updated_at.isoformat() if completed else None),
            }
        )
    return items
