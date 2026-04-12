"""
Analytics Schemas
Pydantic models for analytics endpoints
"""
from __future__ import annotations

from datetime import date, datetime
from typing import Any, List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.enums import DataExportStatus, ExportFormat


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
    format: ExportFormat = Field(
        default=ExportFormat.JSON,
        description="Export file format.",
    )
    date_from: Optional[date] = Field(
        None,
        description="Inclusive start date for exported rows.",
    )
    date_to: Optional[date] = Field(
        None,
        description="Inclusive end date for exported rows.",
    )
    include_workouts: bool = True
    include_glucose: bool = True
    include_wellness: bool = True
    include_achievements: bool = True

    @model_validator(mode="after")
    def _validate_date_range(self) -> DataExportRequest:
        if (
            self.date_from is not None
            and self.date_to is not None
            and self.date_from > self.date_to
        ):
            raise ValueError("date_from must be on or before date_to.")
        return self


class DataExportResponse(BaseModel):
    """Data export response"""
    export_id: str = Field(..., min_length=1, max_length=128)
    status: DataExportStatus
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


class AnalyticsWeeklyChartPoint(BaseModel):
    """Single point for workout frequency chart (day or week bucket)."""

    date: date
    count: int


class AnalyticsIntensityWeekPoint(BaseModel):
    """Weekly aggregate for custom intensity score chart."""

    date: date
    intensity_score: Optional[float] = Field(
        None,
        description="avg_rpe × (completed_sets / avg_rest_minutes) for sets in the ISO week starting at date.",
    )


class AnalyticsDashboardResponse(BaseModel):
    """Aggregated analytics for the main dashboard (period filter)."""

    period: str = Field(..., description="Echo of requested window: week | month | all.")
    total_workouts: int
    total_duration_minutes: int
    avg_duration: float = Field(
        ...,
        description="Mean workout duration in minutes within the selected period.",
    )
    workouts_this_week: int = Field(
        ...,
        description="Workouts logged in the current calendar week (Mon–Sun).",
    )
    workouts_this_month: int = Field(
        ...,
        description="Workouts logged in the current calendar month.",
    )
    favorite_exercise: Optional[str] = Field(
        None,
        description="Most frequent exercise name in the selected period.",
    )
    streak_days: int = Field(
        ...,
        description="Current consecutive-day workout streak (today or yesterday counts as active).",
    )
    weekly_chart: List[AnalyticsWeeklyChartPoint] = Field(
        default_factory=list,
        description="Workout counts by day or by ISO week start within the chart window.",
    )
    avg_rpe_per_workout: Optional[float] = Field(
        None,
        description="Mean of per-workout average RPE (only sets with RPE logged).",
    )
    avg_rpe_previous_period: Optional[float] = Field(
        None,
        description="Same metric for the immediately preceding period of equal length.",
    )
    avg_rpe_trend: Optional[str] = Field(
        None,
        description="up | down | flat when both current and previous period have RPE data.",
    )
    avg_rest_time_seconds: Optional[float] = Field(
        None,
        description="Mean actual_rest_seconds across sets where rest was tracked.",
    )
    total_time_under_tension_seconds: Optional[float] = Field(
        None,
        description="Sum of (completed_at - started_at) in seconds where both timestamps exist.",
    )
    intensity_score: Optional[float] = Field(
        None,
        description="avg_rpe × (sets_count / avg_rest_minutes); None if rest or RPE insufficient.",
    )
    intensity_weekly_chart: List[AnalyticsIntensityWeekPoint] = Field(
        default_factory=list,
        description="Intensity score by ISO week (for longer windows).",
    )
    workouts_with_rpe_count: int = Field(
        0,
        description="Number of completed workouts in the window that logged at least one RPE value.",
    )


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


class ProgressInsightsVolumePoint(BaseModel):
    """Daily volume aggregate point for trend charts."""

    date: date
    workout_count: int
    total_sets: int
    total_reps: int
    total_volume: float


class ProgressInsightsFrequencyPoint(BaseModel):
    """Weekly frequency aggregate point."""

    week_start: date
    week_end: date
    active_days: int
    workout_count: int


class ProgressInsightsPRItem(BaseModel):
    """Detected personal record event for an exercise."""

    exercise_id: int
    exercise_name: str
    date: date
    weight: Optional[float] = None
    reps: Optional[int] = None
    previous_best_weight: Optional[float] = None
    improvement: Optional[float] = None
    improvement_pct: Optional[float] = None
    is_first_entry: bool = False


class ProgressInsightsBestSetItem(BaseModel):
    """Top set by volume/weight in selected period."""

    exercise_id: int
    exercise_name: str
    date: date
    set_number: Optional[int] = None
    weight: Optional[float] = None
    reps: Optional[int] = None
    volume: float


class ProgressInsightsSummary(BaseModel):
    """Compact overview of progress in selected period."""

    total_workouts: int
    active_days: int
    total_sets: int
    total_reps: int
    total_volume: float
    average_workouts_per_week: float


class ProgressInsightsResponse(BaseModel):
    """Combined progress analytics payload for overview screens."""

    period: str
    date_from: date
    date_to: date
    summary: ProgressInsightsSummary
    volume_trend: List[ProgressInsightsVolumePoint] = Field(default_factory=list)
    frequency_trend: List[ProgressInsightsFrequencyPoint] = Field(default_factory=list)
    best_sets: List[ProgressInsightsBestSetItem] = Field(default_factory=list)
    pr_events: List[ProgressInsightsPRItem] = Field(default_factory=list)


class AnalyticsPerformanceTrendPoint(BaseModel):
    """Daily trend point for high-level performance analytics."""

    date: date
    workout_count: int
    total_volume: float
    best_estimated_1rm: Optional[float] = None


class AnalyticsPerformanceOverviewResponse(BaseModel):
    """Overview metrics for volume, frequency, progress over time and estimated 1RM."""

    period: str
    date_from: date
    date_to: date
    total_workouts: int
    active_days: int
    average_workouts_per_week: float
    total_volume: float
    average_volume_per_workout: float
    baseline_estimated_1rm: Optional[float] = None
    current_estimated_1rm: Optional[float] = None
    estimated_1rm_progress_pct: Optional[float] = None
    trend: List[AnalyticsPerformanceTrendPoint] = Field(default_factory=list)


class WorkoutSessionInsightItem(BaseModel):
    code: str
    title: str
    level: str
    message: str


class WorkoutPostSummaryResponse(BaseModel):
    """Post-workout snapshot focused on immediate user feedback."""

    workout_id: int
    date: date
    duration: int
    total_sets: int
    total_reps: int
    total_volume: float
    session_metrics: Optional[dict[str, Any]] = None
    insights: List[WorkoutSessionInsightItem] = Field(default_factory=list)
    best_sets: List[ProgressInsightsBestSetItem] = Field(default_factory=list)
    pr_events: List[ProgressInsightsPRItem] = Field(default_factory=list)
