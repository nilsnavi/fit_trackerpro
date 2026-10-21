from __future__ import annotations

from datetime import date, datetime
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field

from app.domain.coach_client import CoachClientStatus
from app.domain.coach_program import CoachProgramAssignmentStatus


class AttentionSeverity(StrEnum):
    INFO = "INFO"
    NOTICE = "NOTICE"
    ATTENTION = "ATTENTION"
    HIGH = "HIGH"


class MonitoringStatus(StrEnum):
    OK = "OK"
    NOTICE = "NOTICE"
    ATTENTION = "ATTENTION"
    HIGH = "HIGH"


class AttentionSignal(BaseModel):
    code: str
    severity: AttentionSeverity
    title: str
    description: str
    occurred_at: datetime
    source_type: str
    source_id: int | None = None
    metadata: dict[str, str | int | None] = Field(default_factory=dict)


class MonitoringAssignment(BaseModel):
    assignment_id: int
    program_id: int
    program_name: str
    status: CoachProgramAssignmentStatus
    start_date: date | None
    program_version: int


class ActiveWorkoutSummary(BaseModel):
    workout_id: int
    status: str
    started_at: datetime | None


class ClientMonitoringSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    client_id: int
    display_name: str
    relationship_status: CoachClientStatus
    active_assignment: MonitoringAssignment | None
    last_completed_workout_at: datetime | None
    days_since_last_workout: int | None
    active_workout: ActiveWorkoutSummary | None
    attention_status: MonitoringStatus
    signals: list[AttentionSignal]
    signal_count: int
    sort_priority: int


class ClientMonitoringPage(BaseModel):
    items: list[ClientMonitoringSummary]
    total: int
    attention_count: int
    ok_count: int
