"""
Achievements Schemas
Pydantic models for achievements endpoints
"""
from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict


class AchievementCondition(BaseModel):
    """Achievement unlock condition"""
    type: str
    value: int
    description: Optional[str] = None


class AchievementResponse(BaseModel):
    """Achievement response"""
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    name: str
    description: str
    icon_url: Optional[str]
    condition: Dict[str, Any]
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
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    achievement_id: int
    achievement: AchievementResponse
    earned_at: datetime
    progress: int
    progress_data: Dict[str, Any]
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


class AchievementProgressUpdate(BaseModel):
    """Request model for updating achievement progress"""
    progress: int = Field(..., ge=0)
    progress_data: Optional[Dict[str, Any]] = None


class AchievementUnlockResponse(BaseModel):
    """Achievement unlock response"""
    unlocked: bool
    achievement: Optional[AchievementResponse]
    points_earned: int
    new_total_points: int
    message: str
