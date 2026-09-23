"""Legacy entry points for the progression preview (SPEC-005 §29–§39).

The actual rules now live in the single SPEC-006 domain engine
(``app.domain.progression.engine``). This module only adapts the legacy dict/
``sets_completed`` payloads to the engine inputs and maps the result back to the
wire shape the existing ``GET /workouts/progression/recommendation`` endpoint
and its tests expect — there is deliberately no second implementation of the
progression rules (SPEC-006 §71).

Behaviour intentionally changed by SPEC-006 (documented conflict resolution):

* reason codes come from the canonical :class:`ReasonCode` enum instead of
  ad-hoc strings;
* ``INCREASE`` preserves the current weight offset (``81 + 2.5 -> 83.5``);
* effort above the RPE target keeps the weight instead of dropping it 10%.
"""
from __future__ import annotations

from typing import Any, Optional

from app.domain.progression.engine import evaluate_progression, failure_streak
from app.domain.progression.types import (
    DEFAULT_DELOAD_PERCENT,
    DEFAULT_E1RM_MAX_REPS,
    DEFAULT_FAILURE_THRESHOLD,
    DEFAULT_INCREMENT,
    DEFAULT_REP_RANGE,
    DEFAULT_TIME_INCREMENT_SECONDS,
    ExerciseProgressionSettings,
    ExerciseSessionRecord,
    RecommendationStatus,
    normalize_sets,
)
from app.schemas.enums import ProgressionPolicy

# Kept for backward compatibility with SPEC-005 consumers/tests.
DELOAD_FAILED_SESSIONS = DEFAULT_FAILURE_THRESHOLD
DELOAD_FACTOR = 1 - DEFAULT_DELOAD_PERCENT / 100.0
DEFAULT_INCREMENT_LEGACY = DEFAULT_INCREMENT
DEFAULT_REP_RANGE_LEGACY = DEFAULT_REP_RANGE
DEFAULT_WEIGHT_INCREMENT_STEP = 2.5


def _as_float(value: Any) -> Optional[float]:
    try:
        return None if value is None else float(value)
    except (TypeError, ValueError):
        return None


def _session_record(payload: dict[str, Any]) -> ExerciseSessionRecord:
    """Build an engine session record from the legacy ``sets_completed`` shape.

    Legacy payloads flagged ``completed: false`` describe a session where the
    target was missed, so they are normalized into a single failed working set;
    the engine then sees exactly the same failure signal as real data.
    """
    exercise: dict[str, Any] = payload
    nested = payload.get("exercise")
    if isinstance(nested, dict):
        exercise = nested
    raw_sets = exercise.get("sets_completed")
    if raw_sets is None:
        raw_sets = exercise.get("sets")
    if not isinstance(raw_sets, list):
        raw_sets = []
    status = str(payload.get("status") or "completed")
    completed_flag = payload.get("completed")
    sets = normalize_sets(raw_sets)
    if completed_flag is False and not sets:
        sets = normalize_sets(
            [{"set_type": "working", "reps": 0, "weight": payload.get("weight"),
              "completed": True}]
        )
    return ExerciseSessionRecord(
        session_id=payload.get("session_id") or payload.get("workout_id"),
        status="cancelled" if status == "cancelled" else "completed",
        skipped=status == "skipped",
        sets=sets,
        template_id=payload.get("template_id"),
        template_exercise_id=payload.get("template_exercise_id"),
    )


def _settings(
    *,
    policy: ProgressionPolicy,
    increment: float,
    rep_range: tuple[int, int],
    target_rpe: Optional[float],
    target_rir: Optional[float],
    percent_1rm: Optional[float],
    time_increment_seconds: int,
    weight_increment_step: float,
    failure_threshold: int = DEFAULT_FAILURE_THRESHOLD,
    deload_percent: float = DEFAULT_DELOAD_PERCENT,
) -> ExerciseProgressionSettings:
    return ExerciseProgressionSettings(
        policy=policy,
        increment=increment,
        reps_min=rep_range[0],
        reps_max=rep_range[1],
        target_rpe=target_rpe,
        target_rir=target_rir,
        percent_1rm=percent_1rm,
        time_increment_seconds=time_increment_seconds,
        failure_threshold=failure_threshold,
        deload_percent=deload_percent,
        increment_step=weight_increment_step,
        e1rm_max_reps=max(DEFAULT_E1RM_MAX_REPS, rep_range[1]),
    )


def recommend(
    *,
    policy: ProgressionPolicy,
    current_exercise: dict[str, Any],
    history: Optional[list[dict[str, Any]]] = None,
    increment: float = DEFAULT_INCREMENT,
    rep_range: tuple[int, int] = DEFAULT_REP_RANGE,
    target_rpe: Optional[float] = None,
    target_rir: Optional[float] = None,
    percent_1rm: Optional[float] = None,
    time_increment_seconds: int = DEFAULT_TIME_INCREMENT_SECONDS,
    weight_increment_step: float = DEFAULT_WEIGHT_INCREMENT_STEP,
    exercise_id: Optional[int] = None,
) -> dict[str, Any]:
    """Produce an explainable next-target recommendation for one exercise.

    ``history`` is ordered newest-first; ``current_exercise`` holds the session
    being evaluated (may be empty before the first set).
    """
    del exercise_id  # Scope is resolved by the caller, not by the engine.
    current = _session_record(current_exercise or {})
    previous = [
        record
        for record in (_session_record(item) for item in (history or []) if isinstance(item, dict))
        # Guard against a caller passing the evaluated session again as history.
        if current.session_id is None or record.session_id != current.session_id
    ]
    evaluation = evaluate_progression(
        policy=policy,
        current_session=current,
        previous_sessions=previous,
        settings=_settings(
            policy=policy,
            increment=increment,
            rep_range=rep_range,
            target_rpe=target_rpe,
            target_rir=target_rir,
            percent_1rm=percent_1rm,
            time_increment_seconds=time_increment_seconds,
            weight_increment_step=weight_increment_step,
        ),
    )
    return evaluation.as_preview()


def deload_recommendation(
    *,
    policy: ProgressionPolicy,
    current_weight: float,
    history: Optional[list[dict[str, Any]]] = None,
    weight_increment_step: float = DEFAULT_WEIGHT_INCREMENT_STEP,
    failure_threshold: int = DEFAULT_FAILURE_THRESHOLD,
    deload_percent: float = DEFAULT_DELOAD_PERCENT,
) -> Optional[dict[str, Any]]:
    """Deload proposal after ``failure_threshold`` consecutive failures (SPEC §26)."""
    if policy in (
        ProgressionPolicy.MANUAL,
        ProgressionPolicy.TIME_PROGRESSION,
        ProgressionPolicy.PERCENT_1RM,
    ):
        return None
    settings = _settings(
        policy=policy,
        increment=DEFAULT_INCREMENT,
        rep_range=(1, 1),
        target_rpe=None,
        target_rir=None,
        percent_1rm=None,
        time_increment_seconds=DEFAULT_TIME_INCREMENT_SECONDS,
        weight_increment_step=weight_increment_step,
        failure_threshold=failure_threshold,
        deload_percent=deload_percent,
    )
    previous = [
        _session_record(item)
        for item in (history or [])
        if isinstance(item, dict)
    ]
    if failure_streak(previous, settings) < failure_threshold:
        return None
    # ``current_weight`` is authoritative in the legacy contract: the caller
    # already knows the working weight that failed.
    current = ExerciseSessionRecord(
        session_id=previous[0].session_id if previous else None,
        status="completed",
        sets=normalize_sets(
            [{"set_type": "working", "reps": 0, "weight": current_weight, "completed": True}]
        ),
    )
    evaluation = evaluate_progression(
        policy=policy,
        current_session=current,
        previous_sessions=list(previous),
        settings=settings,
    )
    if evaluation.status is not RecommendationStatus.DELOAD:
        return None
    return evaluation.as_preview()
