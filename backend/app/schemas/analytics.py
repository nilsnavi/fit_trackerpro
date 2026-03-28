"""
Analytics Schemas
Pydantic models for analytics endpoints
"""
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from pydantic import BaseModel, Field, ConfigDict, field_validator


class ExerciseProgressData(BaseModel):
    """Progress data for a single exercise"""
    exercise_id: int
    exercise_name: str
    total_sets: int
    total_reps: int
    max_weight: Optional[float]
    avg_weight: Optional[float]
    first_date: date
    last_date: date
    progress_percentage: Optional[float]


class ExerciseProgressResponse(BaseModel):
    """Exercise progress response"""
    exercise_id: int
    exercise_name: str
    period: str
    data_points: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Time series data for charting"
    )
    summary: ExerciseProgressData
    best_performance: Optional[Dict[str, Any]]


class CalendarDayEntry(BaseModel):
    """Single day entry for workout calendar"""
    date: date
    has_workout: bool
    workout_count: int = 0
    total_duration: int = 0
    workout_types: List[str] = Field(default_factory=list)
    glucose_logged: bool = False
    wellness_logged: bool = False


class WorkoutCalendarResponse(BaseModel):
    """Workout calendar response"""
    year: int
    month: int
    days: List[CalendarDayEntry]
    summary: Dict[str, Any] = Field(
        default_factory=dict,
        description="Monthly summary statistics"
    )


class DataExportRequest(BaseModel):
    """Request model for data export"""
    format: str = Field(default="json", pattern="^(json|csv|xlsx)$")
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    include_workouts: bool = True
    include_glucose: bool = True
    include_wellness: bool = True
    include_achievements: bool = True


class DataExportResponse(BaseModel):
    """Data export response"""
    export_id: str
    status: str = Field(..., pattern="^(pending|processing|completed|failed)$")
    format: str
    download_url: Optional[str] = None
    expires_at: Optional[datetime] = None
    requested_at: datetime
    file_size: Optional[int] = None


class WorkoutStreak(BaseModel):
    """Workout streak information"""
    current_streak: int
    longest_streak: int
    last_workout_date: Optional[date]
    streak_history: List[Dict[str, Any]]


class PersonalRecord(BaseModel):
    """Personal record entry"""
    exercise_id: int
    exercise_name: str
    record_type: str
    value: float
    unit: str
    date_achieved: date
    previous_record: Optional[float]
    improvement: Optional[float]


class AnalyticsSummaryResponse(BaseModel):
    """Analytics summary response"""
    total_workouts: int
    total_duration: int
    total_exercises: int
    current_streak: int
    longest_streak: int
    personal_records: List[PersonalRecord]
    favorite_exercises: List[Dict[str, Any]]
    weekly_average: float
    monthly_average: float
    muscle_imbalance_signals: Optional[Dict[str, Any]] = None


class TrainingLoadDailyEntry(BaseModel):
    """Daily training load aggregate entry"""
    model_config = ConfigDict(populate_by_name=True)

    id: int
    user_id: int = Field(..., serialization_alias="userId")
    date: date
    volume: float
    fatigue_score: float = Field(..., serialization_alias="fatigueScore")
    avg_rpe: Optional[float] = Field(None, serialization_alias="avgRpe")


class TrainingLoadDailyTableResponse(BaseModel):
    """Paginated daily training load response for table views"""
    model_config = ConfigDict(populate_by_name=True)

    items: List[TrainingLoadDailyEntry]
    total: int
    page: int
    page_size: int = Field(..., serialization_alias="pageSize")
    date_from: date = Field(..., serialization_alias="dateFrom")
    date_to: date = Field(..., serialization_alias="dateTo")


class MuscleLoadEntry(BaseModel):
    """Daily muscle load aggregate entry"""
    model_config = ConfigDict(populate_by_name=True)

    id: int
    user_id: int = Field(..., serialization_alias="userId")
    muscle_group: str = Field(..., serialization_alias="muscleGroup")
    date: date
    load_score: float = Field(..., serialization_alias="loadScore")


class MuscleLoadTableResponse(BaseModel):
    """Paginated muscle load response for table views"""
    model_config = ConfigDict(populate_by_name=True)

    items: List[MuscleLoadEntry]
    total: int
    page: int
    page_size: int = Field(..., serialization_alias="pageSize")
    date_from: date = Field(..., serialization_alias="dateFrom")
    date_to: date = Field(..., serialization_alias="dateTo")


class RecoveryStateResponse(BaseModel):
    """Current user recovery state"""
    model_config = ConfigDict(populate_by_name=True)

    id: int
    user_id: int = Field(..., serialization_alias="userId")
    fatigue_level: int = Field(..., serialization_alias="fatigueLevel")
    readiness_score: float = Field(..., serialization_alias="readinessScore")


class RecoveryStateRecalculateResponse(RecoveryStateResponse):
    """Recovery state after manual recalculation"""
    recalculated_for_date: date = Field(..., serialization_alias="recalculatedForDate")
    date_from: date = Field(..., serialization_alias="dateFrom")
    date_to: date = Field(..., serialization_alias="dateTo")


class MuscleImbalanceSignalsResponse(BaseModel):
    """Muscle imbalance signals payload (stable API envelope)."""
    available: bool
    signals: Dict[str, Any] = Field(
        default_factory=dict,
        description="Feature-specific signal data from analytics repository",
    )

    @field_validator("signals", mode="before")
    @classmethod
    def _signals_none_as_empty(cls, v: Any) -> Any:
        return {} if v is None else v
