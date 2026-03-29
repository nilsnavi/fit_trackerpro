"""
Emergency Schemas
Pydantic models for emergency contact endpoints
"""
from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.enums import EmergencyRelationship, EmergencySeverity


class EmergencyContactCreate(BaseModel):
    """Request model for creating emergency contact"""
    contact_name: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Display name for this contact.",
    )
    contact_username: Optional[str] = Field(
        None,
        max_length=255,
        description="Telegram username without @.",
    )
    phone: Optional[str] = Field(
        None,
        max_length=50,
        description="E.164 or local phone digits.",
    )
    relationship_type: Optional[EmergencyRelationship] = Field(
        None,
        description="How this person relates to the user.",
    )
    is_active: bool = True
    notify_on_workout_start: bool = False
    notify_on_workout_end: bool = False
    notify_on_emergency: bool = True
    priority: int = Field(
        default=1,
        ge=1,
        le=10,
        description="Lower number = higher priority when notifying.",
    )


class EmergencyContactUpdate(BaseModel):
    """Request model for updating emergency contact"""
    contact_name: Optional[str] = Field(
        None,
        min_length=1,
        max_length=255,
    )
    contact_username: Optional[str] = Field(
        None,
        max_length=255,
    )
    phone: Optional[str] = Field(
        None,
        max_length=50,
    )
    relationship_type: Optional[EmergencyRelationship] = None
    is_active: Optional[bool] = None
    notify_on_workout_start: Optional[bool] = None
    notify_on_workout_end: Optional[bool] = None
    notify_on_emergency: Optional[bool] = None
    priority: Optional[int] = Field(
        None,
        ge=1,
        le=10,
    )


class EmergencyContactResponse(BaseModel):
    """Emergency contact response"""

    id: int
    user_id: int
    contact_name: str
    contact_username: Optional[str]
    phone: Optional[str]
    relationship_type: Optional[str]
    is_active: bool
    notify_on_workout_start: bool
    notify_on_workout_end: bool
    notify_on_emergency: bool
    priority: int
    created_at: datetime
    updated_at: datetime


class EmergencyContactListResponse(BaseModel):
    """List of emergency contacts response"""
    items: List[EmergencyContactResponse]
    total: int
    active_count: int


class EmergencyNotifyRequest(BaseModel):
    """Request model for emergency notification"""
    message: Optional[str] = Field(
        None,
        max_length=1000,
        description="Custom emergency message",
    )
    location: Optional[str] = Field(
        None,
        max_length=500,
        description="Optional location hint.",
    )
    workout_id: Optional[int] = Field(
        None,
        ge=1,
        description="Related workout, if any.",
    )
    severity: EmergencySeverity = Field(
        default=EmergencySeverity.HIGH,
        description="Severity drives routing and copy.",
    )


class NotificationResult(BaseModel):
    """Individual notification result"""
    contact_id: int
    contact_name: str
    method: str = Field(
        ...,
        description="Notification channel used",
        max_length=64,
    )
    success: bool
    error: Optional[str] = Field(
        None,
        max_length=2000,
    )


class EmergencyNotifyResponse(BaseModel):
    """Emergency notification response"""
    notified_at: datetime
    severity: str
    message_sent: str = Field(..., max_length=5000)
    results: List[NotificationResult]
    successful_count: int
    failed_count: int


class WorkoutStartNotification(BaseModel):
    """Workout start notification data"""
    workout_id: int
    workout_type: str
    start_time: datetime
    estimated_duration: Optional[int]
    location: Optional[str]


class WorkoutEndNotification(BaseModel):
    """Workout end notification data"""
    workout_id: int
    workout_type: str
    start_time: datetime
    end_time: datetime
    duration: int
    completed_successfully: bool


class EmergencyWorkoutNotifyResponse(BaseModel):
    """Result of workout start/end notify-to-contacts action"""
    message: str = Field(..., max_length=2000)
    contacts_notified: Optional[int] = Field(
        None,
        ge=0,
        le=1000,
    )
    preview: Optional[str] = Field(
        None,
        max_length=2000,
    )


class EmergencySettingsResponse(BaseModel):
    """User emergency feature settings snapshot"""
    auto_notify_on_workout: bool
    emergency_timeout_minutes: int
    location_sharing: bool
    contacts_count: int
    active_contacts_count: int


class EmergencyLogEventRequest(BaseModel):
    """Client-reported emergency-related event (audit / support)."""
    model_config = ConfigDict(populate_by_name=True)

    symptom: Optional[str] = Field(
        None,
        max_length=500,
    )
    protocol_started: Optional[bool] = Field(default=None, alias="protocolStarted")
    contact_notified: Optional[bool] = Field(default=None, alias="contactNotified")


class EmergencyLogEventResponse(BaseModel):
    """Acknowledgement after logging an emergency-related client event"""
    logged: bool
    event_id: str = Field(..., min_length=1, max_length=128)
