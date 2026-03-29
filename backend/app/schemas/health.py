"""
Health Schemas
Pydantic models for health tracking endpoints
"""
from __future__ import annotations

from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, Field

from app.schemas.enums import GlucoseMeasurementType, HealthDashboardPeriod


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
