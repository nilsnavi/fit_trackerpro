"""
Workouts Schemas
Pydantic models for workout endpoints
"""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, List, Optional

from pydantic import BaseModel, Field

from app.schemas.enums import WorkoutSessionType, WorkoutTemplateType


class ExerciseInTemplate(BaseModel):
    """Exercise within a workout template"""
    exercise_id: int = Field(
        ...,
        ge=1,
        description="Exercise ID",
    )
    name: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Exercise name",
    )
    sets: int = Field(
        default=3,
        ge=1,
        le=20,
        description="Number of sets",
    )
    reps: Optional[int] = Field(
        None,
        ge=1,
        le=1000,
        description="Reps per set",
    )
    duration: Optional[int] = Field(
        None,
        ge=1,
        le=86400,
        description="Duration in seconds (max 24h)",
    )
    rest_seconds: int = Field(
        default=60,
        ge=0,
        le=600,
        description="Rest between sets",
    )
    weight: Optional[float] = Field(
        None,
        ge=0,
        le=2000,
        description="Weight in kg",
    )
    notes: Optional[str] = Field(
        None,
        max_length=500,
    )


class CompletedSet(BaseModel):
    """Completed set data"""
    set_number: int = Field(
        ...,
        ge=1,
        le=1000,
        description="1-based set index within the exercise.",
    )
    reps: Optional[int] = Field(
        None,
        ge=0,
        le=10000,
    )
    weight: Optional[float] = Field(
        None,
        ge=0,
        le=2000,
    )
    rpe: Optional[Decimal] = Field(
        None,
        ge=0,
        le=10,
        max_digits=3,
        decimal_places=1,
        description="Rate of Perceived Exertion (0-10).",
    )
    rir: Optional[Decimal] = Field(
        None,
        ge=0,
        le=10,
        max_digits=3,
        decimal_places=1,
        description="Reps in Reserve",
    )
    duration: Optional[int] = Field(
        None,
        ge=0,
        le=86400,
        description="Duration in seconds",
    )
    completed: bool = Field(default=True)


class CompletedExercise(BaseModel):
    """Completed exercise data"""
    exercise_id: int = Field(..., ge=1)
    name: str = Field(
        ...,
        min_length=1,
        max_length=255,
    )
    sets_completed: List[CompletedSet] = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Recorded sets (max 100 per exercise).",
    )
    notes: Optional[str] = Field(
        None,
        max_length=1000,
    )


_Tag = Annotated[str, Field(min_length=1, max_length=64)]


class WorkoutTemplateCreate(BaseModel):
    """Request model for creating workout template"""
    name: str = Field(
        ...,
        min_length=1,
        max_length=255,
    )
    type: WorkoutTemplateType = Field(
        ...,
        description="Template category.",
    )
    exercises: List[ExerciseInTemplate] = Field(
        ...,
        min_length=1,
        max_length=100,
        description="At least one exercise; at most 100.",
    )
    is_public: bool = Field(default=False)


class WorkoutTemplateResponse(BaseModel):
    """Workout template response"""

    id: int
    user_id: int
    name: str
    type: str
    exercises: List[ExerciseInTemplate]
    is_public: bool
    created_at: datetime
    updated_at: datetime


class WorkoutTemplateList(BaseModel):
    """List of workout templates"""
    items: List[WorkoutTemplateResponse]
    total: int
    page: int
    page_size: int


class WorkoutStartRequest(BaseModel):
    """Request model for starting a workout"""
    template_id: Optional[int] = Field(
        None,
        ge=1,
        description="Template ID if using template",
    )
    name: Optional[str] = Field(
        None,
        min_length=1,
        max_length=255,
        description="Custom workout name",
    )
    type: WorkoutSessionType = Field(
        default=WorkoutSessionType.CUSTOM,
        description="Workout category for ad-hoc sessions.",
    )


class WorkoutStartResponse(BaseModel):
    """Response for started workout"""

    id: int
    user_id: int
    template_id: Optional[int]
    date: date
    start_time: datetime
    status: str = "in_progress"
    message: str = Field(
        default="Workout started successfully",
        max_length=500,
    )


class WorkoutCompleteRequest(BaseModel):
    """Request model for completing a workout"""
    duration: int = Field(
        ...,
        ge=1,
        le=1440,
        description="Duration in minutes (max 24 hours).",
    )
    exercises: List[CompletedExercise] = Field(
        ...,
        min_length=1,
        max_length=200,
        description="Completed exercises (max 200 per workout).",
    )
    comments: Optional[str] = Field(
        None,
        max_length=1000,
    )
    tags: List[_Tag] = Field(
        default_factory=list,
        max_length=50,
        description="Workout tags (max 50, each up to 64 chars).",
    )
    glucose_before: Optional[float] = Field(
        None,
        ge=2.0,
        le=30.0,
        description="Glucose before workout (mmol/L).",
    )
    glucose_after: Optional[float] = Field(
        None,
        ge=2.0,
        le=30.0,
        description="Glucose after workout (mmol/L).",
    )


class WorkoutCompleteResponse(BaseModel):
    """Response for completed workout"""

    id: int
    user_id: int
    template_id: Optional[int]
    date: date
    duration: int
    exercises: List[CompletedExercise]
    comments: Optional[str]
    tags: List[str]
    glucose_before: Optional[float]
    glucose_after: Optional[float]
    completed_at: datetime
    message: str = Field(
        default="Workout completed successfully",
        max_length=500,
    )


class WorkoutHistoryItem(BaseModel):
    """Single workout history entry"""

    id: int
    date: date
    duration: Optional[int]
    exercises: List[CompletedExercise]
    comments: Optional[str]
    tags: List[str]
    glucose_before: Optional[float]
    glucose_after: Optional[float]
    created_at: datetime


class WorkoutHistoryResponse(BaseModel):
    """Workout history response"""
    items: List[WorkoutHistoryItem]
    total: int
    page: int
    page_size: int
    date_from: Optional[date]
    date_to: Optional[date]
