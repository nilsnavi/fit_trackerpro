"""Explicit minimal non-health DTOs for Coach-authorized training reads."""
from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class CoachTrainingSummary(BaseModel):
    model_config = ConfigDict(extra="forbid")
    client_id: int
    completed_workouts: int
    last_completed_at: datetime | None
    total_duration_minutes: int


class CoachWorkoutHistoryItem(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: int
    date: date
    duration_minutes: int | None
    status: str
    completed_at: datetime | None


class CoachWorkoutHistory(BaseModel):
    model_config = ConfigDict(extra="forbid")
    client_id: int
    total: int
    items: list[CoachWorkoutHistoryItem]
