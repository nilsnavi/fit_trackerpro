"""
Workouts Schemas
Pydantic models for workout endpoints
"""
from typing import Optional, List
from datetime import datetime, date
from pydantic import BaseModel, Field, ConfigDict


class ExerciseInTemplate(BaseModel):
    """Exercise within a workout template"""
    exercise_id: int = Field(..., description="Exercise ID")
    name: str = Field(..., description="Exercise name")
    sets: int = Field(default=3, ge=1, le=20, description="Number of sets")
    reps: Optional[int] = Field(None, ge=1, le=100, description="Reps per set")
    duration: Optional[int] = Field(
        None, ge=1, description="Duration in seconds")
    rest_seconds: int = Field(default=60, ge=0, le=600,
                              description="Rest between sets")
    weight: Optional[float] = Field(None, ge=0, description="Weight in kg")
    notes: Optional[str] = Field(None, max_length=500)


class CompletedSet(BaseModel):
    """Completed set data"""
    set_number: int = Field(..., ge=1)
    reps: Optional[int] = Field(None, ge=0)
    weight: Optional[float] = Field(None, ge=0)
    rpe: Optional[float] = Field(None, ge=0, le=10, description="Rate of Perceived Exertion")
    rir: Optional[float] = Field(None, ge=0, le=10, description="Reps in Reserve")
    duration: Optional[int] = Field(
        None, ge=0, description="Duration in seconds")
    completed: bool = Field(default=True)


class CompletedExercise(BaseModel):
    """Completed exercise data"""
    exercise_id: int
    name: str
    sets_completed: List[CompletedSet]
    notes: Optional[str] = None


class WorkoutTemplateCreate(BaseModel):
    """Request model for creating workout template"""
    name: str = Field(..., min_length=1, max_length=255)
    type: str = Field(..., pattern="^(cardio|strength|flexibility|mixed)$")
    exercises: List[ExerciseInTemplate] = Field(..., min_length=1)
    is_public: bool = Field(default=False)


class WorkoutTemplateResponse(BaseModel):
    """Workout template response"""
    model_config = ConfigDict(from_attributes=True)

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
        None, description="Template ID if using template")
    name: Optional[str] = Field(
        None, max_length=255, description="Custom workout name")
    type: str = Field(default="custom",
                      pattern="^(cardio|strength|flexibility|mixed|custom)$")


class WorkoutStartResponse(BaseModel):
    """Response for started workout"""
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    template_id: Optional[int]
    date: date
    start_time: datetime
    status: str = "in_progress"
    message: str = "Workout started successfully"


class WorkoutCompleteRequest(BaseModel):
    """Request model for completing a workout"""
    duration: int = Field(..., ge=1, description="Duration in minutes")
    exercises: List[CompletedExercise] = Field(..., min_length=1)
    comments: Optional[str] = Field(None, max_length=1000)
    tags: List[str] = Field(default_factory=list)
    glucose_before: Optional[float] = Field(None, ge=2.0, le=30.0)
    glucose_after: Optional[float] = Field(None, ge=2.0, le=30.0)


class WorkoutCompleteResponse(BaseModel):
    """Response for completed workout"""
    model_config = ConfigDict(from_attributes=True)

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
    message: str = "Workout completed successfully"


class WorkoutHistoryItem(BaseModel):
    """Single workout history entry"""
    model_config = ConfigDict(from_attributes=True)

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
