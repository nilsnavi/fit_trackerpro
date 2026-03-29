"""
Achievements Schemas
Pydantic models for achievements endpoints
"""
from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class AchievementCondition(BaseModel):
    """Achievement unlock condition (JSONB in DB)."""

    model_config = ConfigDict(extra="allow")

    type: str
    target: int
    count: Optional[int] = None
    description: Optional[str] = None


class AchievementProgressData(BaseModel):
    """Progress payload for a user achievement (JSONB)."""

    model_config = ConfigDict(extra="allow")

    current: Optional[int] = None
    target: Optional[int] = None


class AchievementResponse(BaseModel):
    """Achievement response"""

    id: int
    code: str
    name: str
    description: str
    icon_url: Optional[str]
    condition: AchievementCondition
    points: int
    category: str
    is_hidden: bool
    display_order: int
    created_at: datetime


class AchievementListResponse(BaseModel):
    """List of achievements response"""
    items: List[AchievementResponse]
    total: int
    categories: List[str]


class UserAchievementResponse(BaseModel):
    """User achievement response"""

    id: int
    user_id: int
    achievement_id: int
    achievement: AchievementResponse
    earned_at: datetime
    progress: int
    progress_data: AchievementProgressData
    is_completed: bool = Field(
        default=True,
        description="Whether achievement is fully completed"
    )


class UserAchievementListResponse(BaseModel):
    """List of user achievements response"""
    items: List[UserAchievementResponse]
    total: int
    total_points: int
    completed_count: int
    in_progress_count: int
    recent_achievements: List[UserAchievementResponse]


class AchievementProgressPatch(BaseModel):
    """Validated progress_data payload for PATCH requests."""

    model_config = ConfigDict(extra="allow")

    current: Optional[int] = Field(
        None,
        ge=0,
        le=2_000_000_000,
    )
    target: Optional[int] = Field(
        None,
        ge=0,
        le=2_000_000_000,
    )


class AchievementProgressUpdate(BaseModel):
    """Request model for updating achievement progress"""
    progress: int = Field(
        ...,
        ge=0,
        le=2_000_000_000,
        description="Absolute progress value (non-negative).",
    )
    progress_data: Optional[AchievementProgressPatch] = None


class AchievementUnlockResponse(BaseModel):
    """Achievement unlock response"""
    unlocked: bool
    achievement: Optional[AchievementResponse]
    points_earned: int
    new_total_points: int
    message: str = Field(..., max_length=2000)


class AchievementLeaderboardEntry(BaseModel):
    rank: int
    user_id: int
    username: Optional[str]
    first_name: Optional[str]
    total_points: int
    achievements_count: int


class AchievementLeaderboardResponse(BaseModel):
    leaderboard: List[AchievementLeaderboardEntry]
    user_rank: int
    user_points: int
    total_users: int
