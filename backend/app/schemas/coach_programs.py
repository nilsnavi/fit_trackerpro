from __future__ import annotations

from datetime import date as Date
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.domain.coach_program import CoachProgramAssignmentStatus, CoachProgramStatus


class CoachProgramDayCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    day_number: int = Field(ge=1, le=60)
    name: str = Field(min_length=1, max_length=255)
    workout_template_id: int = Field(ge=1)
    notes: str | None = Field(default=None, max_length=1000)
    position: int | None = Field(default=None, ge=0, le=1000)


class CoachProgramCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=2000)
    days: list[CoachProgramDayCreate] = Field(default_factory=list, max_length=60)


class CoachProgramUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=2000)


class CoachProgramDayUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    day_number: int | None = Field(default=None, ge=1, le=60)
    name: str | None = Field(default=None, min_length=1, max_length=255)
    workout_template_id: int | None = Field(default=None, ge=1)
    notes: str | None = Field(default=None, max_length=1000)
    position: int | None = Field(default=None, ge=0, le=1000)


class CoachProgramStatusUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: CoachProgramStatus


class CoachProgramAssignmentCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    program_id: int | None = Field(default=None, ge=1)
    client_id: int = Field(ge=1)
    start_date: Date | None = None
    coach_message: str | None = Field(default=None, max_length=2000)


class CoachProgramAssignmentStatusUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: CoachProgramAssignmentStatus
    client_message: str | None = Field(default=None, max_length=2000)


class CoachProgramDayResponse(BaseModel):
    id: int
    day_number: int
    name: str
    workout_template_id: int
    workout_template_name: str
    template_version: int
    notes: str | None = None
    position: int


class CoachProgramResponse(BaseModel):
    id: int
    coach_id: int
    name: str
    description: str | None
    status: CoachProgramStatus
    version: int
    days: list[CoachProgramDayResponse]
    created_at: datetime
    updated_at: datetime


class CoachProgramAssignmentResponse(BaseModel):
    id: int
    coach_id: int
    client_id: int
    relationship_id: int
    program_id: int
    program_version: int
    status: CoachProgramAssignmentStatus
    start_date: Date | None = None
    end_date: Date | None = None
    coach_message: str | None = None
    client_message: str | None = None
    paused_at: datetime | None = None
    completed_at: datetime | None = None
    cancelled_at: datetime | None = None
    coach_name: str | None = None
    program: CoachProgramResponse
    created_at: datetime
    updated_at: datetime


class CoachProgramWorkoutStartResponse(BaseModel):
    assignment_id: int
    program_id: int
    program_version: int
    program_day_id: int
    workout_template_id: int
    workout_session_id: int
    source_type: str
    source_metadata: dict[str, int]
