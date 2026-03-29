"""
Emergency API Router
HTTP-only endpoints delegating business logic to services
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.middleware.auth import get_current_user
from app.domain.user import User
from app.domain.exceptions import EmergencyNotFoundError, EmergencyValidationError
from app.infrastructure.database import get_async_db
from app.schemas.emergency import (
    EmergencyContactCreate,
    EmergencyContactListResponse,
    EmergencyContactResponse,
    EmergencyContactUpdate,
    EmergencyLogEventRequest,
    EmergencyLogEventResponse,
    EmergencyNotifyRequest,
    EmergencyNotifyResponse,
    EmergencySettingsResponse,
    EmergencyWorkoutNotifyResponse,
)
from app.application.emergency_service import EmergencyService

router = APIRouter()


def _map_service_error(exc: Exception) -> HTTPException:
    if isinstance(exc, EmergencyNotFoundError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    if isinstance(exc, EmergencyValidationError):
        return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    return HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Unexpected emergency error")


@router.get("/contact", response_model=EmergencyContactListResponse)
async def get_emergency_contacts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = EmergencyService(db)
    try:
        return await service.get_contacts(user_id=current_user.id)
    except Exception as exc:
        raise _map_service_error(exc) from exc


@router.post("/contact", response_model=EmergencyContactResponse, status_code=status.HTTP_201_CREATED)
async def create_emergency_contact(
    contact_data: EmergencyContactCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = EmergencyService(db)
    try:
        return await service.create_contact(user_id=current_user.id, data=contact_data)
    except Exception as exc:
        raise _map_service_error(exc) from exc


@router.get("/contact/{contact_id}", response_model=EmergencyContactResponse)
async def get_emergency_contact(
    contact_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = EmergencyService(db)
    try:
        return await service.get_contact(user_id=current_user.id, contact_id=contact_id)
    except Exception as exc:
        raise _map_service_error(exc) from exc


@router.put("/contact/{contact_id}", response_model=EmergencyContactResponse)
async def update_emergency_contact(
    contact_id: int,
    contact_data: EmergencyContactUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = EmergencyService(db)
    try:
        return await service.update_contact(
            user_id=current_user.id,
            contact_id=contact_id,
            data=contact_data,
        )
    except Exception as exc:
        raise _map_service_error(exc) from exc


@router.delete("/contact/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_emergency_contact(
    contact_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = EmergencyService(db)
    try:
        await service.delete_contact(user_id=current_user.id, contact_id=contact_id)
        return None
    except Exception as exc:
        raise _map_service_error(exc) from exc


@router.post("/notify", response_model=EmergencyNotifyResponse)
async def send_emergency_notification(
    notify_data: EmergencyNotifyRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = EmergencyService(db)
    user_name = current_user.first_name or current_user.username or "User"
    try:
        return await service.send_emergency_notification(
            user_id=current_user.id,
            user_name=user_name,
            notify_data=notify_data,
        )
    except Exception as exc:
        raise _map_service_error(exc) from exc


@router.post("/notify/workout-start", response_model=EmergencyWorkoutNotifyResponse)
async def notify_workout_start(
    workout_id: int,
    estimated_duration: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = EmergencyService(db)
    user_name = current_user.first_name or current_user.username or "User"
    try:
        return await service.notify_workout_start(
            user_id=current_user.id,
            user_name=user_name,
            estimated_duration=estimated_duration,
        )
    except Exception as exc:
        raise _map_service_error(exc) from exc


@router.post("/notify/workout-end", response_model=EmergencyWorkoutNotifyResponse)
async def notify_workout_end(
    workout_id: int,
    duration: int,
    completed_successfully: bool = True,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = EmergencyService(db)
    user_name = current_user.first_name or current_user.username or "User"
    try:
        return await service.notify_workout_end(
            user_id=current_user.id,
            user_name=user_name,
            duration=duration,
            completed_successfully=completed_successfully,
        )
    except Exception as exc:
        raise _map_service_error(exc) from exc


@router.get("/settings", response_model=EmergencySettingsResponse)
async def get_emergency_settings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = EmergencyService(db)
    try:
        return await service.get_settings(user_id=current_user.id)
    except Exception as exc:
        raise _map_service_error(exc) from exc


@router.post("/log", response_model=EmergencyLogEventResponse)
async def log_emergency_event(
    log_data: EmergencyLogEventRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = EmergencyService(db)
    try:
        return await service.log_emergency_event(user_id=current_user.id, log_data=log_data)
    except Exception as exc:
        raise _map_service_error(exc) from exc
