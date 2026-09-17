"""SPEC-006 Progression Engine — pure domain package.

No HTTP, no SQL, no UI state, no AI: prepared data in, explainable
recommendation out. Persistence lives in
``app.infrastructure.repositories.progression_repository`` and orchestration in
``app.application.progression_engine_service``.
"""
from app.domain.progression.engine import evaluate_progression, failure_streak
from app.domain.progression.equipment import (
    DEFAULT_EQUIPMENT_INCREMENTS,
    advance_weight,
    resolve_increment_step,
    snap_to_equipment,
)
from app.domain.progression.types import (
    DEFAULT_DELOAD_PERCENT,
    DEFAULT_E1RM_MAX_REPS,
    DEFAULT_FAILURE_THRESHOLD,
    DEFAULT_INCREMENT,
    DEFAULT_REP_RANGE,
    DEFAULT_SETS_TARGET,
    Confidence,
    ExerciseProgressionSettings,
    ExerciseSessionRecord,
    PolicyVersion,
    ProgressionEvaluation,
    ProgressionScope,
    ReasonCode,
    RecommendationLifecycle,
    RecommendationStatus,
    SetRecord,
    TimePriority,
    normalize_sets,
)

__all__ = [
    "DEFAULT_DELOAD_PERCENT",
    "DEFAULT_E1RM_MAX_REPS",
    "DEFAULT_EQUIPMENT_INCREMENTS",
    "DEFAULT_FAILURE_THRESHOLD",
    "DEFAULT_INCREMENT",
    "DEFAULT_REP_RANGE",
    "DEFAULT_SETS_TARGET",
    "Confidence",
    "ExerciseProgressionSettings",
    "ExerciseSessionRecord",
    "PolicyVersion",
    "ProgressionEvaluation",
    "ProgressionScope",
    "ReasonCode",
    "RecommendationLifecycle",
    "RecommendationStatus",
    "SetRecord",
    "TimePriority",
    "advance_weight",
    "evaluate_progression",
    "failure_streak",
    "normalize_sets",
    "resolve_increment_step",
    "snap_to_equipment",
]
