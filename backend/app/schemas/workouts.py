"""
Workouts Schemas
Pydantic models for workout endpoints
"""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, List, Optional

from pydantic import BaseModel, Field, model_validator

from app.schemas.enums import (
    PersonalRecordType,
    ProgressionPolicy,
    WorkoutBlockType,
    WorkoutSessionSourceType,
    WorkoutSessionType,
    WorkoutSetType,
    WorkoutStatus,
    WorkoutTemplateType,
)


class ExerciseInTemplate(BaseModel):
    """Exercise within a workout template"""
    exercise_id: int = Field(
        ...,
        ge=1,
        description="Exercise ID",
    )
    name: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Exercise name",
    )
    sets: int = Field(
        default=3,
        ge=1,
        le=20,
        description="Number of sets",
    )
    reps: Optional[int] = Field(
        None,
        ge=1,
        le=1000,
        description="Reps per set",
    )
    duration: Optional[int] = Field(
        None,
        ge=1,
        le=86400,
        description="Duration in seconds (max 24h)",
    )
    rest_seconds: int = Field(
        default=60,
        ge=0,
        le=600,
        description="Rest between sets",
    )
    weight: Optional[float] = Field(
        None,
        ge=0,
        le=2000,
        description="Weight in kg",
    )
    notes: Optional[str] = Field(
        None,
        max_length=500,
    )


class CompletedExerciseUpdate(BaseModel):
    """PATCH payload for a session exercise (SPEC-005 §59)."""

    status: Optional[str] = Field(
        None,
        description="Set to 'skipped' to skip the exercise for this session only.",
    )
    notes: Optional[str] = Field(None, max_length=1000)
    target_order_index: Optional[int] = Field(
        None, ge=0, description="Reposition the exercise within the session."
    )
    replacement_exercise_id: Optional[int] = Field(
        None, ge=1, description="Replace the exercise (session-only) with this exercise.",
    )
    replacement_name: Optional[str] = Field(None, max_length=255)
    source_exercise_id: Optional[int] = Field(
        None, ge=1, description="Current exercise id used to resolve the row when several entries share it.",
    )


class CompletedSet(BaseModel):
    """Completed set data"""
    id: Optional[int] = Field(
        None,
        description="Database ID of the workout_set row, if persisted.",
    )
    set_number: int = Field(
        ...,
        ge=1,
        le=1000,
        description="1-based set index within the exercise.",
    )
    set_type: WorkoutSetType = Field(
        default=WorkoutSetType.WORKING,
        description="Set type: warmup, working, dropset, failure.",
    )
    reps: Optional[int] = Field(
        None,
        ge=0,
        le=10000,
    )
    weight: Optional[float] = Field(
        None,
        ge=0,
        le=2000,
    )
    rpe: Optional[Decimal] = Field(
        None,
        ge=1,
        le=10,
        max_digits=3,
        decimal_places=1,
        description="Rate of Perceived Exertion (1-10).",
    )
    rir: Optional[Decimal] = Field(
        None,
        ge=0,
        le=10,
        max_digits=3,
        decimal_places=1,
        description="Reps in Reserve",
    )
    planned_rest_seconds: Optional[int] = Field(
        None,
        ge=0,
        le=3600,
        description="Planned rest for the set, in seconds.",
    )
    actual_rest_seconds: Optional[int] = Field(
        None,
        ge=0,
        le=3600,
        description="Tracked actual rest before the set, in seconds.",
    )
    rest_seconds: Optional[int] = Field(
        None,
        ge=0,
        le=3600,
        description="Rest before the set (single-field tracking), in seconds.",
    )
    duration: Optional[int] = Field(
        None,
        ge=0,
        le=86400,
        description="Duration in seconds",
    )
    speed_kmh: Optional[float] = Field(
        None,
        ge=0,
        le=150,
        description="Treadmill speed in km/h",
    )
    incline_pct: Optional[float] = Field(
        None,
        ge=0,
        le=100,
        description="Treadmill incline in percent",
    )
    started_at: Optional[datetime] = Field(
        None,
        description="Set start timestamp (client, for time-under-tension).",
    )
    completed_at: Optional[datetime] = Field(
        None,
        description="Set completion timestamp (client).",
    )
    completed: bool = Field(default=True)
    notes: Optional[str] = Field(
        None,
        max_length=1000,
        description="Set-level notes/comments.",
    )


class CompletedExercise(BaseModel):
    """Completed exercise data"""
    exercise_id: int = Field(..., ge=1)
    name: str = Field(
        ...,
        min_length=1,
        max_length=255,
    )
    sets_completed: List[CompletedSet] = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Recorded sets (max 100 per exercise).",
    )
    notes: Optional[str] = Field(
        None,
        max_length=1000,
    )
    # SPEC-005 §6: WorkoutSessionExercise row id for PATCH/DELETE targeting.
    id: Optional[int] = Field(
        None,
        ge=1,
        description="Database row id of the session exercise, when persisted.",
    )
    # SPEC-005 §26: skipped exercises remain in session, excluded from volume.
    status: Optional[str] = Field(
        None,
        description="Exercise status inside the session ('skipped' when skipped).",
    )
    # SPEC-005 §24: block membership (superset/triset/circuit).
    block_id: Optional[int] = Field(None, ge=1)
    block_type: Optional[WorkoutBlockType] = None
    block_order: Optional[int] = Field(None, ge=0)
    block_rounds: Optional[int] = Field(None, ge=1)
    block_rest_seconds: Optional[int] = Field(None, ge=0)


class SessionFatigueTrend(BaseModel):
    opening_avg_rpe: float
    closing_avg_rpe: float
    delta: float


class SessionEffortDistribution(BaseModel):
    easy: int = 0
    moderate: int = 0
    hard: int = 0
    maximal: int = 0


class WorkoutSessionMetrics(BaseModel):
    completed_sets: int = 0
    # SPEC-005 §52: extended session metrics.
    warmup_sets: int = 0
    working_sets: int = 0
    total_reps: int = 0
    total_volume: Optional[float] = None
    exercise_count: int = 0
    max_weight: Optional[float] = None
    avg_rpe: Optional[float] = None
    avg_rir: Optional[float] = None
    total_rest_seconds: int = 0
    avg_rest_seconds: Optional[float] = None
    rest_tracked_sets: int = 0
    rest_tracking_ratio: float = 0.0
    rest_consistency_score: Optional[float] = None
    fatigue_trend: Optional[SessionFatigueTrend] = None
    effort_distribution: SessionEffortDistribution = Field(
        default_factory=SessionEffortDistribution)
    volume_per_minute: Optional[float] = None


_Tag = Annotated[str, Field(min_length=1, max_length=64)]


class WorkoutTemplateCreate(BaseModel):
    """Request model for creating workout template"""
    name: str = Field(
        ...,
        min_length=1,
        max_length=255,
    )
    type: WorkoutTemplateType = Field(
        ...,
        description="Template category.",
    )
    exercises: List[ExerciseInTemplate] = Field(
        ...,
        min_length=1,
        max_length=100,
        description="At least one exercise; at most 100.",
    )
    is_public: bool = Field(default=False)


class WorkoutTemplateResponse(BaseModel):
    """Workout template response"""

    id: int
    user_id: int
    name: str
    type: str
    exercises: List[ExerciseInTemplate]
    is_public: bool
    is_archived: bool
    version: int
    created_at: datetime
    updated_at: datetime


class WorkoutTemplateList(BaseModel):
    """List of workout templates"""
    items: List[WorkoutTemplateResponse]
    total: int
    page: int
    page_size: int


class WorkoutStartRequest(BaseModel):
    """Request model for starting a workout"""
    template_id: Optional[int] = Field(
        None,
        ge=1,
        description="Template ID if using template",
    )
    name: Optional[str] = Field(
        None,
        min_length=1,
        max_length=255,
        description="Custom workout name",
    )
    type: WorkoutSessionType = Field(
        default=WorkoutSessionType.CUSTOM,
        description="Workout category for ad-hoc sessions.",
    )


class StartWorkoutTemplateOverrides(BaseModel):
    """Optional template overrides for start workflow without mutating source template."""

    exercises: List[ExerciseInTemplate] = Field(
        default_factory=list,
        max_length=100,
        description="Override exercise plan for this session only.",
    )
    comments: Optional[str] = Field(None, max_length=1000)
    tags: List[_Tag] = Field(default_factory=list, max_length=50)


class WorkoutStartFromTemplateRequest(BaseModel):
    """Start workout from template with optional per-session overrides."""

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    type: WorkoutSessionType = Field(default=WorkoutSessionType.CUSTOM)
    overrides: Optional[StartWorkoutTemplateOverrides] = None


class WorkoutSessionCreateRequest(BaseModel):
    """Canonical request for creating a WorkoutSession from any start source."""

    source_type: WorkoutSessionSourceType = Field(
        default=WorkoutSessionSourceType.QUICK_START,
        description="Canonical start source for the workout session.",
    )
    source_id: Optional[int] = Field(
        None,
        ge=1,
        description="Source entity ID. Required for all sources except quick_start.",
    )
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    type: WorkoutSessionType = Field(default=WorkoutSessionType.CUSTOM)
    overrides: Optional[StartWorkoutTemplateOverrides] = None

    @model_validator(mode="after")
    def validate_source_id(self) -> "WorkoutSessionCreateRequest":
        if self.source_type == WorkoutSessionSourceType.QUICK_START:
            return self
        if self.source_id is None:
            raise ValueError("source_id is required for this source_type")
        return self


class WorkoutTemplateFromWorkoutCreate(BaseModel):
    """Create template from completed workout session."""

    workout_id: int = Field(..., ge=1)
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    is_public: bool = Field(default=False)


class WorkoutTemplateCloneRequest(BaseModel):
    """Clone existing template."""

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    is_public: Optional[bool] = None


class WorkoutTemplatePatchRequest(BaseModel):
    """Partial template update payload with optimistic concurrency."""

    expected_version: int = Field(..., ge=1)
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    type: Optional[WorkoutTemplateType] = None
    exercises: Optional[List[ExerciseInTemplate]] = Field(
        None, min_length=1, max_length=100)
    is_public: Optional[bool] = None
    exercise_order: Optional[List[int]] = Field(
        None,
        min_length=1,
        description="0-based order of existing exercise indexes for lightweight reorder operations.",
    )


class WorkoutStartResponse(BaseModel):
    """Response for started workout"""

    id: int
    user_id: int
    template_id: Optional[int]
    source_type: WorkoutSessionSourceType = WorkoutSessionSourceType.QUICK_START
    source_id: Optional[int] = None
    date: date
    start_time: datetime
    status: str = "in_progress"
    message: str = Field(
        default="Workout started successfully",
        max_length=500,
    )
    # SPEC-005 §3: lifecycle status of the created/restored session.
    session_status: WorkoutStatus = WorkoutStatus.ACTIVE


class WorkoutBlockPayload(BaseModel):
    """Block definition attached to a session create/update (SPEC-005 §24)."""

    client_id: Optional[str] = Field(
        None,
        max_length=64,
        description="Client-side identifier to correlate exercises with the block.",
    )
    type: WorkoutBlockType = WorkoutBlockType.NORMAL
    order: int = Field(0, ge=0)
    rounds: int = Field(1, ge=1, le=50)
    rest_seconds: Optional[int] = Field(None, ge=0, le=3600)


class WorkoutSessionUpdateRequest(BaseModel):
    """Request model for updating an in-progress workout session."""

    exercises: List[CompletedExercise] = Field(
        default_factory=list,
        max_length=200,
        description="Current session exercises persisted before workout completion.",
    )
    comments: Optional[str] = Field(
        None,
        max_length=1000,
    )
    tags: List[_Tag] = Field(
        default_factory=list,
        max_length=50,
        description="Session tags kept while workout is in progress.",
    )
    glucose_before: Optional[float] = Field(
        None,
        ge=2.0,
        le=30.0,
    )
    glucose_after: Optional[float] = Field(
        None,
        ge=2.0,
        le=30.0,
    )
    idempotency_key: Optional[str] = Field(
        None,
        min_length=1,
        max_length=128,
        description="Optional idempotency key for replay-safe updates.",
    )
    expected_version: Optional[int] = Field(
        None,
        ge=1,
        description="Expected workout version for optimistic locking.",
    )
    # SPEC-005 §3: pause/resume lifecycle transitions.
    status: Optional[WorkoutStatus] = Field(
        None,
        description="Lifecycle transition target: 'active' (resume) or 'paused'.",
    )
    # SPEC-005 §24: blocks for superset/triset/circuit support.
    blocks: Optional[List[WorkoutBlockPayload]] = Field(
        None,
        max_length=100,
        description="Full replacement list of session blocks (when provided).",
    )


class WorkoutCompleteRequest(BaseModel):
    """Request model for completing a workout"""
    duration: int = Field(
        ...,
        ge=1,
        le=1440,
        description="Duration in minutes (max 24 hours).",
    )
    exercises: List[CompletedExercise] = Field(
        ...,
        min_length=1,
        max_length=200,
        description="Completed exercises (max 200 per workout).",
    )
    comments: Optional[str] = Field(
        None,
        max_length=1000,
    )
    tags: List[_Tag] = Field(
        default_factory=list,
        max_length=50,
        description="Workout tags (max 50, each up to 64 chars).",
    )
    glucose_before: Optional[float] = Field(
        None,
        ge=2.0,
        le=30.0,
        description="Glucose before workout (mmol/L).",
    )
    glucose_after: Optional[float] = Field(
        None,
        ge=2.0,
        le=30.0,
        description="Glucose after workout (mmol/L).",
    )
    idempotency_key: Optional[str] = Field(
        None,
        min_length=1,
        max_length=128,
        description="Optional idempotency key for replay-safe completion.",
    )
    expected_version: Optional[int] = Field(
        None,
        ge=1,
        description="Expected workout version for optimistic locking.",
    )


class WorkoutCompleteResponse(BaseModel):
    """Response for completed workout"""

    id: int
    user_id: int
    template_id: Optional[int]
    source_type: WorkoutSessionSourceType = WorkoutSessionSourceType.QUICK_START
    source_id: Optional[int] = None
    date: date
    duration: int
    exercises: List[CompletedExercise]
    comments: Optional[str]
    tags: List[str]
    glucose_before: Optional[float]
    glucose_after: Optional[float]
    session_metrics: Optional[WorkoutSessionMetrics] = None
    version: int
    completed_at: datetime
    message: str = Field(
        default="Workout completed successfully",
        max_length=500,
    )
    # SPEC-005 §40/§51: PRs achieved during this session.
    personal_records: List[PersonalRecordEntry] = Field(default_factory=list)
    # SPEC-005 §51: next targets recommended by the progression engine.
    progression_recommendations: List[ProgressionRecommendation] = Field(default_factory=list)


class WorkoutHistoryItem(BaseModel):
    """Single workout history entry"""

    id: int
    template_id: Optional[int] = None
    source_type: WorkoutSessionSourceType = WorkoutSessionSourceType.QUICK_START
    source_id: Optional[int] = None
    date: date
    duration: Optional[int]
    exercises: List[CompletedExercise]
    comments: Optional[str]
    tags: List[str]
    glucose_before: Optional[float]
    glucose_after: Optional[float]
    session_metrics: Optional[WorkoutSessionMetrics] = None
    version: int
    created_at: datetime
    # SPEC-005 §3/§48: lifecycle status for session restore.
    status: WorkoutStatus = WorkoutStatus.ACTIVE
    started_at: Optional[datetime] = None
    # SPEC-005 §24: superset/triset/circuit blocks of the session.
    blocks: List["WorkoutBlockResponse"] = Field(default_factory=list)


class WorkoutHistoryResponse(BaseModel):
    """Workout history response"""
    items: List[WorkoutHistoryItem]
    total: int
    page: int
    page_size: int
    date_from: Optional[date]
    date_to: Optional[date]


class WorkoutSetPatchRequest(BaseModel):
    """Editable fields for a completed set from workout history."""
    reps: Optional[int] = Field(None, ge=0, le=1000)
    weight: Optional[Decimal] = Field(
        None, ge=0, le=5000, max_digits=7, decimal_places=2)
    rpe: Optional[Decimal] = Field(
        None, ge=1, le=10, max_digits=3, decimal_places=1)
    rest_seconds: Optional[int] = Field(None, ge=0, le=3600)
    # SPEC-005 §20: timed sets persist the actual duration instead of reps.
    duration: Optional[int] = Field(None, ge=0, le=86400)
    completed: Optional[bool] = None
    notes: Optional[str] = Field(None, max_length=1000)


class WorkoutSetResponse(BaseModel):
    """Response after patching a workout set."""
    id: int
    workout_id: int
    exercise_id: int
    set_number: int
    reps: Optional[int] = None
    weight: Optional[Decimal] = None
    rpe: Optional[Decimal] = None
    rest_seconds: Optional[int] = None
    # SPEC-005 §20: timed sets report duration instead of reps.
    duration: Optional[int] = None
    completed: bool = True
    notes: Optional[str] = None
    # SPEC-005 §40: PR detected by this set (null when none).
    personal_records: Optional[List["PersonalRecordEntry"]] = None


class WorkoutExercisePatchRequest(BaseModel):
    """PATCH payload for a session exercise row (SPEC-005 §6/§25-28)."""

    status: Optional[str] = Field(
        None,
        description="Set to 'skipped' to skip the exercise for this session only.",
    )
    notes: Optional[str] = Field(None, max_length=1000)
    target_order_index: Optional[int] = Field(
        None, ge=0, description="Reposition the exercise within the session."
    )
    replacement_exercise_id: Optional[int] = Field(
        None, ge=1, description="Replace the exercise (session-only) with this exercise.",
    )
    replacement_name: Optional[str] = Field(None, max_length=255)


class WorkoutCancelRequest(BaseModel):
    """Request model for cancelling an in-progress session (SPEC-005 §3)."""

    comments: Optional[str] = Field(None, max_length=1000)
    idempotency_key: Optional[str] = Field(
        None, min_length=1, max_length=128,
        description="Optional idempotency key for replay-safe cancellation.",
    )


class WorkoutCancelResponse(BaseModel):
    """Response after cancelling a session."""

    id: int
    status: WorkoutStatus = WorkoutStatus.CANCELLED
    message: str = Field(
        default="Workout cancelled. This session is excluded from analytics.",
        max_length=500,
    )


class WorkoutBlockResponse(BaseModel):
    """Persisted session block (SPEC-005 §24)."""

    id: int
    type: WorkoutBlockType = WorkoutBlockType.NORMAL
    order: int = 0
    rounds: int = 1
    rest_seconds: Optional[int] = None


class WorkoutSessionListResponse(BaseModel):
    """Lightweight response for incomplete session restore (SPEC-005 §48)."""

    id: int
    name: Optional[str] = None
    status: WorkoutStatus
    date: date
    elapsed_seconds: Optional[int] = Field(
        None, ge=0, description="Elapsed time derived from started_at.",
    )
    exercise_count: int = 0
    completed_exercise_count: int = 0
    created_at: datetime


class PlateCalculationRequest(BaseModel):
    """Plate calculator request (SPEC-005 §42–43)."""

    target_weight: float = Field(..., ge=0, le=2000)
    bar_weight: float = Field(20, ge=0, le=100)
    available_plates: List[float] = Field(
        default_factory=lambda: [25, 20, 15, 10, 5, 2.5, 1.25],
        description="Available plate weights in kg.",
    )


class PlateCalculationResponse(BaseModel):
    """Plate calculator result per side (SPEC-005 §42–43)."""

    achievable: bool
    plates_per_side: List[float] = Field(default_factory=list)
    exact_weight: Optional[float] = None
    nearest_weight: Optional[float] = None
    remainder: float = 0.0


class SmartRestRecommendation(BaseModel):
    """Smart rest recommendation (SPEC-005 §19)."""

    recommended_rest_seconds: int
    reason_code: str
    reason_text: str


class ProgressionRecommendation(BaseModel):
    """Explainable progression recommendation (SPEC-005 §37–38, SPEC-006 §8).

    SPEC-006 fields are additive: existing consumers keep reading the original
    keys, while the card can now show status, lifecycle and the persisted id.
    """

    # SPEC-006 §8/§9/§10 — persisted recommendation identity + lifecycle.
    id: Optional[int] = None
    exercise_id: Optional[int] = None
    scope_key: Optional[str] = None
    template_id: Optional[int] = None
    template_exercise_id: Optional[int] = None
    status: Optional[str] = None
    lifecycle_status: Optional[str] = None
    policy_version: Optional[str] = None
    actual_selected_value: Optional[float] = None
    previous_reps: Optional[int] = None
    recommended_reps: Optional[int] = None
    reps_min: Optional[int] = None
    reps_max: Optional[int] = None
    previous_duration: Optional[int] = None
    recommended_duration: Optional[int] = None
    failure_streak: int = 0
    recovery_warning: Optional[str] = None

    recommended_value: Optional[float] = None
    previous_value: Optional[float] = None
    difference: Optional[float] = None
    policy: ProgressionPolicy = ProgressionPolicy.MANUAL
    reason_code: str = "NO_DATA"
    reason_text: str = ""
    confidence: str = Field("low", pattern="^(low|medium|high)$")
    source_session_id: Optional[int] = None


class ProgressionRecommendationRequest(BaseModel):
    """Optional overrides when asking for a progression recommendation."""

    exercise_id: int = Field(..., ge=1)
    policy: Optional[ProgressionPolicy] = None
    increment: Optional[float] = Field(None, gt=0, le=200)
    rep_range_min: Optional[int] = Field(None, ge=0, le=100)
    rep_range_max: Optional[int] = Field(None, ge=0, le=100)
    target_rpe: Optional[float] = Field(None, ge=1, le=10)
    target_rir: Optional[float] = Field(None, ge=0, le=10)
    percent_1rm: Optional[float] = Field(None, gt=0, le=200)
    time_increment_seconds: Optional[int] = Field(None, ge=1, le=3600)


class PersonalRecordEntry(BaseModel):
    """Personal record achieved or matched (SPEC-005 §40)."""

    record_type: PersonalRecordType
    exercise_id: int
    exercise_name: str
    value: float
    unit: str = "kg"
    is_new_record: bool = True
    previous_value: Optional[float] = None
    set_number: Optional[int] = None
    achieved_at: Optional[datetime] = None


# Ensure Pydantic v2 resolves postponed annotations for OpenAPI export tooling.
def _rebuild_pydantic_models() -> None:
    for obj in list(globals().values()):
        if isinstance(obj, type) and issubclass(obj, BaseModel):
            if obj is BaseModel:
                continue
            obj.model_rebuild()


_rebuild_pydantic_models()
