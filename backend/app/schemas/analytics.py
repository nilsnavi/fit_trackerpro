"""
Analytics Schemas
Pydantic models for analytics endpoints
"""
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from pydantic import BaseModel, Field, ConfigDict


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
