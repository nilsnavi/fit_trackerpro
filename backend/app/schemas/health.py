"""
Health Schemas
Pydantic models for health tracking endpoints
"""
from __future__ import annotations

from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, Field

from app.schemas.enums import GlucoseMeasurementType, HealthDashboardPeriod


class WaterEntryCreate(BaseModel):
    """Request model for creating water entry"""
    amount: int = Field(
        ...,
        ge=0,
        le=10000,
        description="Water amount in milliliters.",
    )
    recorded_at: Optional[datetime] = Field(
        None,
        description="When water was consumed (default: now)",
    )


class WaterEntryResponse(BaseModel):
    """Water entry response"""
    id: int
    user_id: int
    amount: int
    recorded_at: datetime
    created_at: datetime


class WaterGoalCreate(BaseModel):
    """Request model for creating/updating water goal"""
    daily_goal: int = Field(
        2000,
        ge=500,
        le=10000,
        description="Daily water goal in milliliters.",
    )
    workout_increase: int = Field(
        500,
        ge=0,
        le=3000,
        description="Extra water on workout days.",
    )
    is_workout_day: bool = Field(
        False,
        description="Whether today is a workout day",
    )


class WaterGoalResponse(BaseModel):
    """Water goal response"""
    id: int
    user_id: int
    daily_goal: int
    workout_increase: int
    is_workout_day: bool
    created_at: datetime
    updated_at: datetime


class WaterReminderCreate(BaseModel):
    """Request model for creating/updating water reminder"""
    enabled: bool = Field(True, description="Whether reminders are enabled")
    interval_hours: int = Field(
        2,
        ge=1,
        le=12,
        description="Hours between reminders",
    )
    start_time: str = Field(
        "08:00",
        description="Reminder start time (HH:MM)",
    )
    end_time: str = Field(
        "22:00",
        description="Reminder end time (HH:MM)",
    )
    quiet_hours_start: Optional[str] = Field(
        None,
        description="Quiet hours start time (HH:MM)",
    )
    quiet_hours_end: Optional[str] = Field(
        None,
        description="Quiet hours end time (HH:MM)",
    )
    telegram_notifications: bool = Field(
        True,
        description="Send reminders via Telegram",
    )


class WaterReminderResponse(BaseModel):
    """Water reminder response"""
    id: int
    user_id: int
    enabled: bool
    interval_hours: int
    start_time: str
    end_time: str
    quiet_hours_start: Optional[str]
    quiet_hours_end: Optional[str]
    telegram_notifications: bool
    created_at: datetime
    updated_at: datetime


class WaterDailyStats(BaseModel):
    """Water daily statistics"""
    date: date
    total: int
    goal: int
    percentage: float
    is_goal_reached: bool
    entry_count: int


class WaterWeeklyStats(BaseModel):
    """Water weekly statistics"""
    days: List[WaterDailyStats]
    average: float
    best_day: Optional[WaterDailyStats]
    total_entries: int


class WaterHistoryResponse(BaseModel):
    """Water history response"""
    items: List[WaterEntryResponse]
    total: int
    page: int
    page_size: int
    date_from: Optional[date]
    date_to: Optional[date]
    total_amount: int


class GlucoseLogCreate(BaseModel):
    """Request model for creating glucose log"""
    value: float = Field(
        ...,
        ge=2.0,
        le=30.0,
        description="Blood glucose in mmol/L (clinical range enforced).",
    )
    measurement_type: GlucoseMeasurementType = Field(
        ...,
        description="When or how the reading was taken.",
    )
    timestamp: Optional[datetime] = Field(
        None,
        description="Measurement time (default: now)",
    )
    notes: Optional[str] = Field(
        None,
        max_length=500,
        description="Optional note (max 500 characters).",
    )
    workout_id: Optional[int] = Field(
        None,
        ge=1,
        description="Associated workout ID",
    )


class GlucoseLogResponse(BaseModel):
    """Glucose log response"""

    id: int
    user_id: int
    workout_id: Optional[int]
    value: float
    measurement_type: str
    timestamp: datetime
    notes: Optional[str]
    created_at: datetime


class GlucoseHistoryResponse(BaseModel):
    """Glucose history response"""
    items: List[GlucoseLogResponse]
    total: int
    page: int
    page_size: int
    date_from: Optional[date]
    date_to: Optional[date]
    average: Optional[float]
    min_value: Optional[float]
    max_value: Optional[float]


class PainZones(BaseModel):
    """Pain levels by body zone"""
    head: int = Field(default=0, ge=0, le=10)
    neck: int = Field(default=0, ge=0, le=10)
    shoulders: int = Field(default=0, ge=0, le=10)
    chest: int = Field(default=0, ge=0, le=10)
    back: int = Field(default=0, ge=0, le=10)
    arms: int = Field(default=0, ge=0, le=10)
    wrists: int = Field(default=0, ge=0, le=10)
    hips: int = Field(default=0, ge=0, le=10)
    knees: int = Field(default=0, ge=0, le=10)
    ankles: int = Field(default=0, ge=0, le=10)


class DailyWellnessCreate(BaseModel):
    """Request model for creating daily wellness entry"""
    date: date
    sleep_score: int = Field(
        ...,
        ge=0,
        le=100,
        description="Sleep quality 0-100",
    )
    sleep_hours: Optional[float] = Field(
        None,
        ge=0,
        le=24,
        description="Hours slept (0-24).",
    )
    energy_score: int = Field(
        ...,
        ge=0,
        le=100,
        description="Energy level 0-100",
    )
    pain_zones: PainZones = Field(default_factory=PainZones)
    stress_level: Optional[int] = Field(
        None,
        ge=0,
        le=10,
        description="Stress 0-10.",
    )
    mood_score: Optional[int] = Field(
        None,
        ge=0,
        le=100,
        description="Mood 0-100.",
    )
    notes: Optional[str] = Field(
        None,
        max_length=1000,
        description="Optional journal text.",
    )


class DailyWellnessResponse(BaseModel):
    """Daily wellness response"""

    id: int
    user_id: int
    date: date
    sleep_score: int
    sleep_hours: Optional[float]
    energy_score: int
    pain_zones: PainZones
    stress_level: Optional[int]
    mood_score: Optional[int]
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime


class GlucoseStats(BaseModel):
    """Glucose statistics"""
    average_7d: Optional[float]
    average_30d: Optional[float]
    readings_count_7d: int
    readings_count_30d: int
    in_range_percentage: Optional[float]


class WorkoutStats(BaseModel):
    """Workout statistics"""
    total_workouts_7d: int
    total_workouts_30d: int
    total_duration_7d: int
    total_duration_30d: int
    avg_duration: Optional[float]
    favorite_type: Optional[str]


class WellnessStats(BaseModel):
    """Wellness statistics"""
    avg_sleep_score_7d: Optional[float]
    avg_sleep_score_30d: Optional[float]
    avg_energy_score_7d: Optional[float]
    avg_energy_score_30d: Optional[float]
    avg_sleep_hours_7d: Optional[float]
    avg_sleep_hours_30d: Optional[float]


class HealthStatsResponse(BaseModel):
    """Health statistics response"""
    period: HealthDashboardPeriod = Field(
        default=HealthDashboardPeriod.THIRTY_D,
        description="Aggregation window for dashboard stats.",
    )
    glucose: Optional[GlucoseStats]
    workouts: WorkoutStats
    wellness: WellnessStats
    generated_at: datetime
