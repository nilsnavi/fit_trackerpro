"""
Analytics Schemas
Pydantic models for analytics endpoints
"""
from typing import Optional, List, Any
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


class ExerciseProgressDataPoint(BaseModel):
    """Single time-series point for exercise progress charts."""

    date: date
    max_weight: Optional[float] = None
    reps: Optional[int] = None


class ExerciseBestPerformance(BaseModel):
    """Best single-session performance in the selected window."""

    date: date
    weight: Optional[float] = None
    reps: Optional[int] = None


class ExerciseProgressResponse(BaseModel):
    """Exercise progress response"""
    exercise_id: int
    exercise_name: str
    period: str
    data_points: List[ExerciseProgressDataPoint] = Field(
        default_factory=list,
        description="Time series data for charting"
    )
    summary: ExerciseProgressData
    best_performance: Optional[ExerciseBestPerformance] = None


class CalendarDayEntry(BaseModel):
    """Single day entry for workout calendar"""
    date: date
    has_workout: bool
    workout_count: int = 0
    total_duration: int = 0
    workout_types: List[str] = Field(default_factory=list)
    glucose_logged: bool = False
    wellness_logged: bool = False


class WorkoutCalendarSummary(BaseModel):
    """Monthly aggregate stats for the calendar view."""

    total_workouts: int
    total_duration: int
    active_days: int
    rest_days: int


class WorkoutCalendarResponse(BaseModel):
    """Workout calendar response"""
    year: int
    month: int
    days: List[CalendarDayEntry]
    summary: WorkoutCalendarSummary


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


class StreakHistoryEntry(BaseModel):
    """One streak segment (for future streak visualizations)."""

    model_config = ConfigDict(extra="allow")
    day: Optional[date] = None


class WorkoutStreak(BaseModel):
    """Workout streak information"""
    current_streak: int
    longest_streak: int
    last_workout_date: Optional[date]
    streak_history: List[StreakHistoryEntry] = Field(default_factory=list)


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


class FavoriteExercise(BaseModel):
    """Aggregated favorite exercise row for analytics summary."""

    exercise_id: int
    name: str
    count: int


class MuscleImbalanceSignalsDetail(BaseModel):
    """Row from ``muscle_imbalance_signals_by_user`` (see DB migration)."""

    model_config = ConfigDict(extra="allow")

    user_id: int
    back_volume_7d: Optional[float] = None
    chest_volume_7d: Optional[float] = None
    back_volume_28d: Optional[float] = None
    chest_volume_28d: Optional[float] = None
    shoulders_volume_28d: Optional[float] = None
    triceps_volume_28d: Optional[float] = None
    biceps_volume_28d: Optional[float] = None
    forearms_volume_28d: Optional[float] = None
    hamstrings_volume_28d: Optional[float] = None
    quads_volume_28d: Optional[float] = None
    glutes_volume_28d: Optional[float] = None
    core_volume_28d: Optional[float] = None
    total_volume_28d: Optional[float] = None
    avg_rpe_7d: Optional[float] = None
    avg_rir_7d: Optional[float] = None
    back_vs_chest_ratio_28d: Optional[float] = None
    posterior_vs_anterior_ratio_28d: Optional[float] = None
    pull_vs_push_ratio_28d: Optional[float] = None
    hamstrings_vs_quads_ratio_28d: Optional[float] = None
    core_share_ratio_28d: Optional[float] = None
    days_since_back_session: Optional[int] = None
    days_since_chest_session: Optional[int] = None
    weak_back_signal: Optional[bool] = None
    pull_underload_signal: Optional[bool] = None
    posterior_leg_underload_signal: Optional[bool] = None

    @field_validator("user_id", mode="before")
    @classmethod
    def _coerce_user_id(cls, v: Any) -> Any:
        return int(v) if v is not None else v


class AnalyticsSummaryResponse(BaseModel):
    """Analytics summary response"""
    total_workouts: int
    total_duration: int
    total_exercises: int
    current_streak: int
    longest_streak: int
    personal_records: List[PersonalRecord]
    favorite_exercises: List[FavoriteExercise]
    weekly_average: float
    monthly_average: float
    muscle_imbalance_signals: Optional[MuscleImbalanceSignalsDetail] = None


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
    signals: Optional[MuscleImbalanceSignalsDetail] = Field(
        default=None,
        description="Feature-specific signal data from analytics repository",
    )

    @field_validator("signals", mode="before")
    @classmethod
    def _signals_none_as_empty(cls, v: Any) -> Any:
        return None if v is None or v == {} else v
