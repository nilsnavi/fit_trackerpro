"""
Emergency Schemas
Pydantic models for emergency contact endpoints
"""
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict


class EmergencyContactCreate(BaseModel):
    """Request model for creating emergency contact"""
    contact_name: str = Field(..., min_length=1, max_length=255)
    contact_username: Optional[str] = Field(None, max_length=255)
    phone: Optional[str] = Field(None, max_length=50)
    relationship_type: Optional[str] = Field(
        None,
        pattern="^(family|friend|doctor|trainer|other)$"
    )
    is_active: bool = True
    notify_on_workout_start: bool = False
    notify_on_workout_end: bool = False
    notify_on_emergency: bool = True
    priority: int = Field(default=1, ge=1, le=10)


class EmergencyContactUpdate(BaseModel):
    """Request model for updating emergency contact"""
    contact_name: Optional[str] = Field(None, min_length=1, max_length=255)
    contact_username: Optional[str] = Field(None, max_length=255)
    phone: Optional[str] = Field(None, max_length=50)
    relationship_type: Optional[str] = Field(
        None,
        pattern="^(family|friend|doctor|trainer|other)$"
    )
    is_active: Optional[bool] = None
    notify_on_workout_start: Optional[bool] = None
    notify_on_workout_end: Optional[bool] = None
    notify_on_emergency: Optional[bool] = None
    priority: Optional[int] = Field(None, ge=1, le=10)


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
        description="Custom emergency message"
    )
    location: Optional[str] = Field(None, max_length=500)
    workout_id: Optional[int] = None
    severity: str = Field(
        default="high", pattern="^(low|medium|high|critical)$")


class NotificationResult(BaseModel):
    """Individual notification result"""
    contact_id: int
    contact_name: str
    method: str = Field(..., description="Notification method used")
    success: bool
    error: Optional[str] = None


class EmergencyNotifyResponse(BaseModel):
    """Emergency notification response"""
    notified_at: datetime
    severity: str
    message_sent: str
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
    message: str
    contacts_notified: Optional[int] = None
    preview: Optional[str] = None


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

    symptom: Optional[str] = Field(None, max_length=500)
    protocol_started: Optional[bool] = Field(default=None, alias="protocolStarted")
    contact_notified: Optional[bool] = Field(default=None, alias="contactNotified")


class EmergencyLogEventResponse(BaseModel):
    """Acknowledgement after logging an emergency-related client event"""
    logged: bool
    event_id: str
