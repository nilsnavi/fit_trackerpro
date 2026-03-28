"""
Exercises Schemas
Pydantic models for exercise endpoints
"""
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field


class ExerciseFilterParams(BaseModel):
    """Query parameters for exercise filtering"""
    category: Optional[str] = Field(None, description="Filter by category")
    muscle_group: Optional[str] = Field(
        None, description="Filter by muscle group")
    equipment: Optional[str] = Field(
        None, description="Filter by equipment needed")
    search: Optional[str] = Field(
        None, description="Search in name and description")
    status: Optional[str] = Field(
        default="active", description="Filter by status")
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)


class RiskFlags(BaseModel):
    """Risk flags for health conditions"""
    high_blood_pressure: bool = False
    diabetes: bool = False
    joint_problems: bool = False
    back_problems: bool = False
    heart_conditions: bool = False


class ExerciseCreate(BaseModel):
    """Request model for creating exercise"""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=2000)
    category: str = Field(...,
                          pattern="^(strength|cardio|flexibility|balance|sport)$")
    equipment: List[str] = Field(default_factory=list)
    muscle_groups: List[str] = Field(default_factory=list)
    risk_flags: RiskFlags = Field(default_factory=RiskFlags)
    media_url: Optional[str] = Field(None, max_length=500)


class ExerciseUpdate(BaseModel):
    """Request model for updating exercise"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=2000)
    category: Optional[str] = Field(
        None, pattern="^(strength|cardio|flexibility|balance|sport)$")
    equipment: Optional[List[str]] = None
    muscle_groups: Optional[List[str]] = None
    risk_flags: Optional[RiskFlags] = None
    media_url: Optional[str] = Field(None, max_length=500)
    status: Optional[str] = Field(None, pattern="^(active|pending|archived)$")


class ExerciseResponse(BaseModel):
    """Exercise response"""

    id: int
    name: str
    description: Optional[str]
    category: str
    equipment: List[str]
    muscle_groups: List[str]
    risk_flags: RiskFlags
    media_url: Optional[str]
    status: str
    author_user_id: Optional[int]
    created_at: datetime
    updated_at: datetime


class ExerciseListResponse(BaseModel):
    """List of exercises response"""
    items: List[ExerciseResponse]
    total: int
    page: int
    page_size: int
    filters: dict = Field(default_factory=dict)


class ExerciseCategoryItem(BaseModel):
    value: str
    label: str
    icon: str


class ExerciseCategoriesResponse(BaseModel):
    categories: List[ExerciseCategoryItem]


class ExerciseEquipmentItem(BaseModel):
    value: str
    label: str


class ExerciseEquipmentListResponse(BaseModel):
    equipment: List[ExerciseEquipmentItem]


class ExerciseMuscleGroupItem(BaseModel):
    value: str
    label: str


class ExerciseMuscleGroupsResponse(BaseModel):
    muscle_groups: List[ExerciseMuscleGroupItem]
