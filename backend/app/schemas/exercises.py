"""
Exercises Schemas
Pydantic models for exercise endpoints
"""
from __future__ import annotations

from datetime import datetime
from typing import Annotated, List, Optional

from pydantic import BaseModel, Field

from app.schemas.enums import ExerciseCategory, ExerciseListStatusFilter, ExerciseStatus


class ExerciseListFilters(BaseModel):
    """Echo of list query parameters (for clients and OpenAPI)."""

    category: Optional[str] = None
    muscle_group: Optional[str] = None
    equipment: Optional[str] = None
    search: Optional[str] = None
    status: str = "active"


class ExerciseFilterParams(BaseModel):
    """Query parameters for exercise filtering"""
    category: Optional[ExerciseCategory] = Field(
        None,
        description="Filter by category",
    )
    muscle_group: Optional[str] = Field(
        None,
        max_length=64,
        description="Filter by muscle group",
    )
    equipment: Optional[str] = Field(
        None,
        max_length=64,
        description="Filter by equipment needed",
    )
    search: Optional[str] = Field(
        None,
        max_length=200,
        description="Search in name and description",
    )
    status: ExerciseListStatusFilter = Field(
        default=ExerciseListStatusFilter.ACTIVE,
        description="Filter by status; use ``all`` to disable status filter.",
    )
    page: int = Field(
        default=1,
        ge=1,
        le=1_000_000,
        description="Page number (1-based).",
    )
    page_size: int = Field(
        default=20,
        ge=1,
        le=100,
        description="Items per page.",
    )


class RiskFlags(BaseModel):
    """Risk flags for health conditions"""
    high_blood_pressure: bool = False
    diabetes: bool = False
    joint_problems: bool = False
    back_problems: bool = False
    heart_conditions: bool = False


_Label = Annotated[str, Field(min_length=1, max_length=64)]


class ExerciseCreate(BaseModel):
    """Request model for creating exercise"""
    name: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Exercise display name.",
    )
    description: Optional[str] = Field(
        None,
        max_length=2000,
        description="Optional long description.",
    )
    category: ExerciseCategory = Field(
        ...,
        description="Exercise category.",
    )
    equipment: List[_Label] = Field(
        default_factory=list,
        max_length=50,
        description="Equipment tags; at most 50 entries.",
    )
    muscle_groups: List[_Label] = Field(
        default_factory=list,
        max_length=30,
        description="Muscle groups; at most 30 entries.",
    )
    risk_flags: RiskFlags = Field(default_factory=RiskFlags)
    media_url: Optional[str] = Field(
        None,
        max_length=2000,
        description="URL to image or video.",
    )


class ExerciseUpdate(BaseModel):
    """Request model for updating exercise"""
    name: Optional[str] = Field(
        None,
        min_length=1,
        max_length=255,
        description="Exercise display name.",
    )
    description: Optional[str] = Field(
        None,
        max_length=2000,
    )
    category: Optional[ExerciseCategory] = None
    equipment: Optional[List[_Label]] = Field(
        None,
        max_length=50,
    )
    muscle_groups: Optional[List[_Label]] = Field(
        None,
        max_length=30,
    )
    risk_flags: Optional[RiskFlags] = None
    media_url: Optional[str] = Field(
        None,
        max_length=2000,
    )
    status: Optional[ExerciseStatus] = None


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
    filters: ExerciseListFilters = Field(default_factory=ExerciseListFilters)


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
