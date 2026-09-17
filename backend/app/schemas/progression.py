"""Progression Schemas (SPEC-006 §6/§8/§41)."""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.domain.progression.types import (
    Confidence,
    RecommendationLifecycle,
    RecommendationStatus,
    TimePriority,
)
from app.schemas.enums import ProgressionPolicy


class ProgressionPolicyResponse(BaseModel):
    """Effective policy for one progression scope (SPEC §6/§7)."""

    id: Optional[int] = Field(None, description="Null when the scope still uses defaults.")
    user_id: int
    exercise_id: int
    template_id: Optional[int] = None
    template_exercise_id: Optional[int] = None
    scope_key: str = Field(
        ...,
        description="Progression scope: user + template + exercise + program slot.",
    )
    policy_scope_key: Optional[str] = Field(
        None,
        description=(
            "Scope the stored policy row actually lives in; differs from scope_key when "
            "a template-level or user-level policy is inherited. Null for defaults."
        ),
    )
    type: ProgressionPolicy = ProgressionPolicy.MANUAL
    policy_version: str = "MANUAL_V1"
    increment: Optional[float] = None
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    reps_min: Optional[int] = None
    reps_max: Optional[int] = None
    sets_target: Optional[int] = None
    target_rpe: Optional[float] = None
    target_rir: Optional[float] = None
    percent_1rm: Optional[float] = None
    time_increment_seconds: Optional[int] = None
    time_target_seconds: Optional[int] = None
    time_priority: Optional[TimePriority] = None
    failure_threshold: Optional[int] = None
    deload_percent: Optional[float] = None
    equipment_increment: Optional[float] = None
    enabled: bool = True


class ProgressionPolicyUpdate(BaseModel):
    """PUT body: configure progression for one exercise scope."""

    type: ProgressionPolicy = Field(
        default=ProgressionPolicy.MANUAL,
        description="MANUAL never computes a target; the engine only proposes for other types.",
    )
    increment: Optional[float] = Field(None, gt=0, le=200)
    min_value: Optional[float] = Field(None, ge=0, le=2000)
    max_value: Optional[float] = Field(None, ge=0, le=2000)
    reps_min: Optional[int] = Field(None, ge=0, le=1000)
    reps_max: Optional[int] = Field(None, ge=0, le=1000)
    sets_target: Optional[int] = Field(None, ge=1, le=50)
    target_rpe: Optional[float] = Field(None, ge=1, le=10)
    target_rir: Optional[float] = Field(None, ge=0, le=10)
    percent_1rm: Optional[float] = Field(None, gt=0, le=200)
    time_increment_seconds: Optional[int] = Field(None, ge=1, le=3600)
    time_target_seconds: Optional[int] = Field(None, ge=1, le=86400)
    time_priority: Optional[TimePriority] = Field(
        None, description="Weight+time exercises: TIME_FIRST or WEIGHT_FIRST (SPEC §24)."
    )
    failure_threshold: Optional[int] = Field(None, ge=1, le=20)
    deload_percent: Optional[float] = Field(None, gt=0, le=90)
    equipment_increment: Optional[float] = Field(None, gt=0, le=50)
    enabled: bool = True


class ProgressionRecommendationResponse(BaseModel):
    """Explainable recommendation (SPEC §8/§27/§28/§29/§46)."""

    id: Optional[int] = Field(None, description="Null for a non-persisted preview.")
    exercise_id: int
    exercise_name: Optional[str] = None
    scope_key: str
    template_id: Optional[int] = None
    template_exercise_id: Optional[int] = None
    policy: ProgressionPolicy = ProgressionPolicy.MANUAL
    policy_version: str = "MANUAL_V1"
    status: RecommendationStatus = RecommendationStatus.INSUFFICIENT_DATA
    lifecycle_status: RecommendationLifecycle = RecommendationLifecycle.GENERATED
    previous_value: Optional[float] = None
    recommended_value: Optional[float] = None
    actual_selected_value: Optional[float] = None
    difference: Optional[float] = None
    previous_reps: Optional[int] = None
    recommended_reps: Optional[int] = None
    reps_min: Optional[int] = None
    reps_max: Optional[int] = None
    previous_duration: Optional[int] = None
    recommended_duration: Optional[int] = None
    reason_code: str = ""
    reason_text: str = ""
    confidence: Confidence = Confidence.LOW
    failure_streak: int = 0
    source_session_id: Optional[int] = None
    created_at: Optional[datetime] = None
    persisted: bool = False
    idempotent_replay: bool = False
    recovery_warning: Optional[str] = Field(
        None, description="Advisory only — recovery never changes the recommendation (SPEC §34)."
    )


class ProgressionRecommendationDecision(BaseModel):
    """POST body for accept/reject (SPEC §42–§44)."""

    selected_value: Optional[float] = Field(
        None,
        ge=0,
        le=2000,
        description=(
            "Omit to accept the recommended value; send a different own value to "
            "record the recommendation as ``modified``."
        ),
    )
