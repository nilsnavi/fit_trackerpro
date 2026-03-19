"""
Challenges Schemas
Pydantic models for challenges endpoints
"""
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from pydantic import BaseModel, Field, ConfigDict


class ChallengeGoal(BaseModel):
    """Challenge goal criteria"""
    type: str = Field(...,
                      description="Goal type: count, duration, distance, etc.")
    target: float = Field(..., description="Target value to achieve")
    unit: str = Field(..., description="Unit of measurement")
    description: Optional[str] = None


class ChallengeRules(BaseModel):
    """Challenge rules"""
    min_workouts_per_week: Optional[int] = None
    max_workouts_per_day: Optional[int] = None
    allowed_workout_types: Optional[List[str]] = None
    excluded_exercises: Optional[List[int]] = None


class ChallengeCreate(BaseModel):
    """Request model for creating challenge"""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=2000)
    type: str = Field(
        ...,
        pattern="^(workout_count|duration|calories|distance|custom)$"
    )
    goal: ChallengeGoal
    start_date: date
    end_date: date
    is_public: bool = False
    max_participants: int = Field(default=0, ge=0, description="0 = unlimited")
    rules: ChallengeRules = Field(default_factory=ChallengeRules)
    banner_url: Optional[str] = Field(None, max_length=500)


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
    model_config = ConfigDict(from_attributes=True)

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
    filters: Dict[str, Any] = Field(default_factory=dict)


class ChallengeJoinResponse(BaseModel):
    """Challenge join response"""
    success: bool
    challenge_id: int
    joined_at: datetime
    message: str
    participant_count: int


class ChallengeLeaveResponse(BaseModel):
    """Challenge leave response"""
    success: bool
    challenge_id: int
    message: str


class ChallengeProgressUpdate(BaseModel):
    """Request model for updating challenge progress"""
    progress: float = Field(..., ge=0)
    workout_id: Optional[int] = None
    notes: Optional[str] = None


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
