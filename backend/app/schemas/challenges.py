"""
Challenges Schemas
Pydantic models for challenges endpoints
"""
from __future__ import annotations

from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, Field, model_validator

from app.schemas.enums import ChallengeType


class ChallengeListFilters(BaseModel):
    """Echo of list query parameters (for clients and OpenAPI)."""

    status: Optional[str] = None
    type: Optional[str] = None
    is_public: Optional[bool] = None


class ChallengeGoal(BaseModel):
    """Challenge goal criteria"""
    type: str = Field(
        ...,
        min_length=1,
        max_length=64,
        pattern=r"^[a-z][a-z0-9_]*$",
        description="Goal discriminator, e.g. count, duration, distance.",
    )
    target: float = Field(
        ...,
        gt=0,
        le=1e12,
        description="Target value to achieve (must be positive).",
    )
    unit: str = Field(
        ...,
        min_length=1,
        max_length=32,
        description="Unit of measurement (e.g. kg, km, kcal).",
    )
    description: Optional[str] = Field(
        None,
        max_length=1000,
        description="Optional human-readable goal text.",
    )


class ChallengeRules(BaseModel):
    """Challenge rules"""
    min_workouts_per_week: Optional[int] = Field(
        None,
        ge=0,
        le=21,
        description="Minimum weekly workouts (0–21).",
    )
    max_workouts_per_day: Optional[int] = Field(
        None,
        ge=0,
        le=24,
        description="Cap on workouts per day.",
    )
    allowed_workout_types: Optional[List[str]] = Field(
        None,
        max_length=20,
        description="Allowed workout types; each entry up to 32 chars.",
    )
    excluded_exercises: Optional[List[int]] = Field(
        None,
        max_length=500,
        description="Exercise IDs to exclude from the challenge.",
    )

    @model_validator(mode="after")
    def _validate_workout_lists(self) -> ChallengeRules:
        if self.allowed_workout_types:
            for t in self.allowed_workout_types:
                if len(t) > 32:
                    raise ValueError(
                        "Each allowed_workout_types entry must be at most 32 characters."
                    )
        if self.excluded_exercises:
            for eid in self.excluded_exercises:
                if eid < 1:
                    raise ValueError("excluded_exercises IDs must be positive integers.")
        return self


class ChallengeCreate(BaseModel):
    """Request model for creating challenge"""
    name: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Challenge title.",
    )
    description: Optional[str] = Field(
        None,
        max_length=2000,
    )
    type: ChallengeType = Field(
        ...,
        description="Challenge scoring mode.",
    )
    goal: ChallengeGoal
    start_date: date
    end_date: date
    is_public: bool = False
    max_participants: int = Field(
        default=0,
        ge=0,
        le=1_000_000,
        description="0 = unlimited participants.",
    )
    rules: ChallengeRules = Field(default_factory=ChallengeRules)
    banner_url: Optional[str] = Field(
        None,
        max_length=2000,
        description="URL to banner image.",
    )

    @model_validator(mode="after")
    def _validate_date_range(self) -> ChallengeCreate:
        if self.end_date < self.start_date:
            raise ValueError("end_date must be on or after start_date.")
        return self


class ChallengeParticipant(BaseModel):
    """Challenge participant info"""
    user_id: int
    username: Optional[str]
    first_name: Optional[str]
    joined_at: datetime
    progress: float
    rank: Optional[int]


class ChallengeResponse(BaseModel):
    """Challenge response"""

    id: int
    creator_id: int
    creator_name: Optional[str]
    name: str
    description: Optional[str]
    type: str
    goal: ChallengeGoal
    start_date: date
    end_date: date
    is_public: bool
    join_code: Optional[str]
    max_participants: int
    current_participants: int
    rules: ChallengeRules
    banner_url: Optional[str]
    status: str
    created_at: datetime
    updated_at: datetime


class ChallengeDetailResponse(ChallengeResponse):
    """Challenge detail response with participants"""
    participants: List[ChallengeParticipant]
    user_progress: Optional[float] = None
    user_rank: Optional[int] = None


class ChallengeListResponse(BaseModel):
    """List of challenges response"""
    items: List[ChallengeResponse]
    total: int
    page: int
    page_size: int
    filters: ChallengeListFilters = Field(default_factory=ChallengeListFilters)


class ChallengeJoinResponse(BaseModel):
    """Challenge join response"""
    success: bool
    challenge_id: int
    joined_at: datetime
    message: str = Field(..., max_length=2000)
    participant_count: int


class ChallengeLeaveResponse(BaseModel):
    """Challenge leave response"""
    success: bool
    challenge_id: int
    message: str = Field(..., max_length=2000)


class ChallengeMyActiveResponse(BaseModel):
    """Current user's active challenges"""
    items: List[ChallengeResponse]
    total: int


class ChallengeProgressUpdate(BaseModel):
    """Request model for updating challenge progress"""
    progress: float = Field(
        ...,
        ge=0,
        le=1e15,
        description="Non-negative progress value in challenge units.",
    )
    workout_id: Optional[int] = Field(
        None,
        ge=1,
        description="Related workout, if any.",
    )
    notes: Optional[str] = Field(
        None,
        max_length=2000,
        description="Optional note for this progress update.",
    )


class ChallengeLeaderboardEntry(BaseModel):
    """Leaderboard entry"""
    rank: int
    user_id: int
    username: Optional[str]
    first_name: Optional[str]
    progress: float
    completion_percentage: float
    last_activity: Optional[datetime]


class ChallengeLeaderboardResponse(BaseModel):
    """Challenge leaderboard response"""
    challenge_id: int
    entries: List[ChallengeLeaderboardEntry]
    user_rank: Optional[int]
    total_participants: int
