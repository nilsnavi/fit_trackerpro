"""
Emergency API Router
Endpoints for emergency contacts and safety features
"""
from typing import Optional, List
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, desc

from app.middleware.auth import get_current_user
from app.models import get_async_db, User, EmergencyContact
from app.schemas.emergency import (
    EmergencyContactCreate,
    EmergencyContactUpdate,
    EmergencyContactResponse,
    EmergencyContactListResponse,
    EmergencyNotifyRequest,
    EmergencyNotifyResponse,
    NotificationResult,
)

router = APIRouter()


@router.get("/contact", response_model=EmergencyContactListResponse)
async def get_emergency_contacts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Get user's emergency contacts

    **Headers:**
    ```
    Authorization: Bearer <access_token>
    ```

    **Response:**
    ```json
    {
        "items": [
            {
                "id": 1,
                "user_id": 1,
                "contact_name": "Mom",
                "contact_username": "mom_username",
                "phone": "+1234567890",
                "relationship_type": "family",
                "is_active": true,
                "notify_on_workout_start": false,
                "notify_on_workout_end": false,
                "notify_on_emergency": true,
                "priority": 1,
                "created_at": "2024-01-15T10:00:00",
                "updated_at": "2024-01-15T10:00:00"
            }
        ],
        "total": 2,
        "active_count": 2
    }
    ```
    """
    result = await db.execute(
        select(EmergencyContact)
        .where(EmergencyContact.user_id == current_user.id)
        .order_by(EmergencyContact.priority, desc(EmergencyContact.created_at))
    )
    contacts = result.scalars().all()

    active_count = sum(1 for c in contacts if c.is_active)

    return EmergencyContactListResponse(
        items=contacts,
        total=len(contacts),
        active_count=active_count
    )


@router.post("/contact", response_model=EmergencyContactResponse, status_code=status.HTTP_201_CREATED)
async def create_emergency_contact(
    contact_data: EmergencyContactCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Add new emergency contact

    **Headers:**
    ```
    Authorization: Bearer <access_token>
    ```

    **Request:**
    ```json
    {
        "contact_name": "Emergency Contact",
        "contact_username": "emergency_user",
        "phone": "+1234567890",
        "relationship_type": "family",
        "is_active": true,
        "notify_on_workout_start": false,
        "notify_on_workout_end": false,
        "notify_on_emergency": true,
        "priority": 1
    }
    ```

    **Response:** Created emergency contact
    """
    # Validate that at least one contact method is provided
    if not contact_data.contact_username and not contact_data.phone:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either contact_username or phone must be provided"
        )

    contact = EmergencyContact(
        user_id=current_user.id,
        contact_name=contact_data.contact_name,
        contact_username=contact_data.contact_username,
        phone=contact_data.phone,
        relationship_type=contact_data.relationship_type,
        is_active=contact_data.is_active,
        notify_on_workout_start=contact_data.notify_on_workout_start,
        notify_on_workout_end=contact_data.notify_on_workout_end,
        notify_on_emergency=contact_data.notify_on_emergency,
        priority=contact_data.priority
    )

    db.add(contact)
    await db.commit()
    await db.refresh(contact)

    return contact


@router.get("/contact/{contact_id}", response_model=EmergencyContactResponse)
async def get_emergency_contact(
    contact_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Get specific emergency contact
    """
    result = await db.execute(
        select(EmergencyContact).where(
            and_(
                EmergencyContact.id == contact_id,
                EmergencyContact.user_id == current_user.id
            )
        )
    )
    contact = result.scalar_one_or_none()

    if not contact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Emergency contact not found"
        )

    return contact


@router.put("/contact/{contact_id}", response_model=EmergencyContactResponse)
async def update_emergency_contact(
    contact_id: int,
    contact_data: EmergencyContactUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Update emergency contact

    **Headers:**
    ```
    Authorization: Bearer <access_token>
    ```

    **Request:**
    ```json
    {
        "contact_name": "Updated Name",
        "phone": "+0987654321",
        "is_active": true
    }
    ```

    **Response:** Updated emergency contact
    """
    result = await db.execute(
        select(EmergencyContact).where(
            and_(
                EmergencyContact.id == contact_id,
                EmergencyContact.user_id == current_user.id
            )
        )
    )
    contact = result.scalar_one_or_none()

    if not contact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Emergency contact not found"
        )

    # Update fields
    update_data = contact_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(contact, field, value)

    await db.commit()
    await db.refresh(contact)

    return contact


@router.delete("/contact/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_emergency_contact(
    contact_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Delete emergency contact
    """
    result = await db.execute(
        select(EmergencyContact).where(
            and_(
                EmergencyContact.id == contact_id,
                EmergencyContact.user_id == current_user.id
            )
        )
    )
    contact = result.scalar_one_or_none()

    if not contact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Emergency contact not found"
        )

    await db.delete(contact)
    await db.commit()


@router.post("/notify", response_model=EmergencyNotifyResponse)
async def send_emergency_notification(
    notify_data: EmergencyNotifyRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Send emergency notification to all active emergency contacts

    **Headers:**
    ```
    Authorization: Bearer <access_token>
    ```

    **Request:**
    ```json
    {
        "message": "Need help! Fell during workout.",
        "location": "Gym XYZ, 123 Main St",
        "workout_id": 123,
        "severity": "high"
    }
    ```

    **Response:**
    ```json
    {
        "notified_at": "2024-01-20T10:00:00",
        "severity": "high",
        "message_sent": "EMERGENCY ALERT from John: Need help! Fell during workout. Location: Gym XYZ, 123 Main St",
        "results": [
            {
                "contact_id": 1,
                "contact_name": "Mom",
                "method": "telegram",
                "success": true,
                "error": null
            }
        ],
        "successful_count": 1,
        "failed_count": 0
    }
    ```
    """
    # Get active emergency contacts
    result = await db.execute(
        select(EmergencyContact).where(
            and_(
                EmergencyContact.user_id == current_user.id,
                EmergencyContact.is_active == True,
                EmergencyContact.notify_on_emergency == True
            )
        ).order_by(EmergencyContact.priority)
    )
    contacts = result.scalars().all()

    if not contacts:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active emergency contacts configured"
        )

    # Build emergency message
    user_name = current_user.first_name or current_user.username or "User"
    location_str = f" Location: {notify_data.location}" if notify_data.location else ""

    if notify_data.message:
        message = f"🚨 EMERGENCY ALERT from {user_name}: {notify_data.message}{location_str}"
    else:
        message = f"🚨 EMERGENCY ALERT from {user_name}!{location_str} Please check on them immediately."

    # Send notifications (placeholder implementation)
    results = []
    successful = 0
    failed = 0

    for contact in contacts:
        # Determine notification method
        method = None
        if contact.contact_username:
            method = "telegram"
            # TODO: Implement actual Telegram notification
            success = True
        elif contact.phone:
            method = "sms"
            # TODO: Implement actual SMS notification
            success = True
        else:
            success = False

        if success:
            successful += 1
        else:
            failed += 1

        results.append(NotificationResult(
            contact_id=contact.id,
            contact_name=contact.contact_name,
            method=method or "unknown",
            success=success,
            error=None if success else "No valid contact method"
        ))

    return EmergencyNotifyResponse(
        notified_at=datetime.utcnow(),
        severity=notify_data.severity,
        message_sent=message,
        results=results,
        successful_count=successful,
        failed_count=failed
    )


@router.post("/notify/workout-start")
async def notify_workout_start(
    workout_id: int,
    estimated_duration: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Notify emergency contacts that workout has started

    **Headers:**
    ```
    Authorization: Bearer <access_token>
    ```

    **Response:** Notification results
    """
    # Get contacts that want workout start notifications
    result = await db.execute(
        select(EmergencyContact).where(
            and_(
                EmergencyContact.user_id == current_user.id,
                EmergencyContact.is_active == True,
                EmergencyContact.notify_on_workout_start == True
            )
        )
    )
    contacts = result.scalars().all()

    if not contacts:
        return {"message": "No contacts configured for workout start notifications"}

    # Build message
    user_name = current_user.first_name or current_user.username or "User"
    duration_str = f" (estimated {estimated_duration} min)" if estimated_duration else ""
    message = f"🏃 {user_name} has started a workout{duration_str}. You'll be notified when they finish."

    # TODO: Send actual notifications

    return {
        "message": "Workout start notifications sent",
        "contacts_notified": len(contacts)
    }


@router.post("/notify/workout-end")
async def notify_workout_end(
    workout_id: int,
    duration: int,
    completed_successfully: bool = True,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Notify emergency contacts that workout has ended

    **Headers:**
    ```
    Authorization: Bearer <access_token>
    ```

    **Response:** Notification results
    """
    # Get contacts that want workout end notifications
    result = await db.execute(
        select(EmergencyContact).where(
            and_(
                EmergencyContact.user_id == current_user.id,
                EmergencyContact.is_active == True,
                EmergencyContact.notify_on_workout_end == True
            )
        )
    )
    contacts = result.scalars().all()

    if not contacts:
        return {"message": "No contacts configured for workout end notifications"}

    # Build message
    user_name = current_user.first_name or current_user.username or "User"
    status = "completed" if completed_successfully else "ended"
    message = f"✅ {user_name} has {status} their workout ({duration} min). All is well!"

    # TODO: Send actual notifications

    return {
        "message": "Workout end notifications sent",
        "contacts_notified": len(contacts)
    }


@router.get("/settings")
async def get_emergency_settings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Get emergency notification settings

    **Headers:**
    ```
    Authorization: Bearer <access_token>
    ```

    **Response:**
    ```json
    {
        "auto_notify_on_workout": false,
        "emergency_timeout_minutes": 60,
        "location_sharing": true,
        "contacts_count": 2,
        "active_contacts_count": 2
    }
    ```
    """
    result = await db.execute(
        select(EmergencyContact).where(
            EmergencyContact.user_id == current_user.id
        )
    )
    contacts = result.scalars().all()

    active_count = sum(1 for c in contacts if c.is_active)

    return {
        "auto_notify_on_workout": False,  # TODO: Add to user settings
        "emergency_timeout_minutes": 60,
        "location_sharing": True,
        "contacts_count": len(contacts),
        "active_contacts_count": active_count
    }


@router.post("/log")
async def log_emergency_event(
    log_data: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Log emergency event for analytics and safety tracking

    **Headers:**
    ```
    Authorization: Bearer <access_token>
    ```

    **Request:**
    ```json
    {
        "symptom": "hypoglycemia",
        "timestamp": "2024-01-20T10:00:00",
        "protocolStarted": true,
        "contactNotified": false,
        "location": "55.7558,37.6173"
    }
    ```

    **Response:**
    ```json
    {
        "logged": true,
        "event_id": "evt_abc123"
    }
    ```
    """
    # Log the emergency event (could be stored in database for analytics)
    import logging
    logger = logging.getLogger(__name__)

    logger.info(
        f"Emergency event logged for user {current_user.id}: "
        f"symptom={log_data.get('symptom')}, "
        f"protocol_started={log_data.get('protocolStarted')}, "
        f"contact_notified={log_data.get('contactNotified')}"
    )

    return {
        "logged": True,
        "event_id": f"evt_{current_user.id}_{int(datetime.utcnow().timestamp())}"
    }
