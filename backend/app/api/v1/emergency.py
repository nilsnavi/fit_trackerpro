"""
Emergency API Router
HTTP-only endpoints delegating business logic to services
"""
from typing import Optional

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.middleware.auth import get_current_user
from app.domain.user import User
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


@router.get("/contact", response_model=EmergencyContactListResponse)
async def get_emergency_contacts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = EmergencyService(db)
    return await service.get_contacts(user_id=current_user.id)


@router.post("/contact", response_model=EmergencyContactResponse, status_code=status.HTTP_201_CREATED)
async def create_emergency_contact(
    contact_data: EmergencyContactCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = EmergencyService(db)
    return await service.create_contact(user_id=current_user.id, data=contact_data)


@router.get("/contact/{contact_id}", response_model=EmergencyContactResponse)
async def get_emergency_contact(
    contact_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = EmergencyService(db)
    return await service.get_contact(user_id=current_user.id, contact_id=contact_id)


@router.put("/contact/{contact_id}", response_model=EmergencyContactResponse)
async def update_emergency_contact(
    contact_id: int,
    contact_data: EmergencyContactUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = EmergencyService(db)
    return await service.update_contact(
        user_id=current_user.id,
        contact_id=contact_id,
        data=contact_data,
    )


@router.delete("/contact/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_emergency_contact(
    contact_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = EmergencyService(db)
    await service.delete_contact(user_id=current_user.id, contact_id=contact_id)
    return None


@router.post("/notify", response_model=EmergencyNotifyResponse)
async def send_emergency_notification(
    notify_data: EmergencyNotifyRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = EmergencyService(db)
    return await service.send_emergency_notification(
        user=current_user,
        notify_data=notify_data,
    )


@router.post("/notify/workout-start", response_model=EmergencyWorkoutNotifyResponse)
async def notify_workout_start(
    workout_id: int,
    estimated_duration: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = EmergencyService(db)
    return await service.notify_workout_start(
        user=current_user,
        workout_id=workout_id,
        estimated_duration=estimated_duration,
    )


@router.post("/notify/workout-end", response_model=EmergencyWorkoutNotifyResponse)
async def notify_workout_end(
    workout_id: int,
    duration: int,
    completed_successfully: bool = True,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = EmergencyService(db)
    return await service.notify_workout_end(
        user=current_user,
        workout_id=workout_id,
        duration=duration,
        completed_successfully=completed_successfully,
    )


@router.get("/settings", response_model=EmergencySettingsResponse)
async def get_emergency_settings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = EmergencyService(db)
    return await service.get_settings(user_id=current_user.id)


@router.post("/log", response_model=EmergencyLogEventResponse)
async def log_emergency_event(
    log_data: EmergencyLogEventRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    service = EmergencyService(db)
    return await service.log_emergency_event(user_id=current_user.id, log_data=log_data)
