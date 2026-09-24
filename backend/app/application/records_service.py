"""Personal record detection for SPEC-005 §40.

Only completed **working** sets can set PRs; warm-up sets are excluded.
Record types: MAX_WEIGHT, MAX_REPS_AT_WEIGHT, ESTIMATED_1RM, MAX_VOLUME,
MAX_DURATION (SPEC-005 §40).
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Iterable, Optional

from app.application.strength_math import estimate_1rm
from app.schemas.enums import PersonalRecordType, WorkoutSetType

WARMUP_TYPES = {WorkoutSetType.WARMUP.value}


def is_working_set(set_item: dict[str, Any]) -> bool:
    """Warm-up sets never create PRs (SPEC-005 §40)."""
    set_type = str(set_item.get("set_type") or WorkoutSetType.WORKING.value)
    return set_type not in WARMUP_TYPES and bool(set_item.get("completed", False))


def _as_float(value: Any) -> Optional[float]:
    try:
        if value is None:
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _set_metrics(set_item: dict[str, Any]) -> dict[str, Optional[float]]:
    return {
        "weight": _as_float(set_item.get("weight")),
        "reps": _as_float(set_item.get("reps")),
        "duration": _as_float(set_item.get("duration")),
    }


def evaluate_set_records(
    *,
    exercise_id: int,
    exercise_name: str,
    set_item: dict[str, Any],
    previous_bests: dict[str, Optional[float]],
    now: Optional[datetime] = None,
) -> list[dict[str, Any]]:
    """Evaluate a single completed working set against previous bests.

    ``previous_bests`` maps record type -> best value so far (None when the
    user has no history yet). Returns a list of newly-achieved record dicts in
    the wire format of ``PersonalRecordEntry``.
    """
    if not is_working_set(set_item):
        return []

    metrics = _set_metrics(set_item)
    weight = metrics["weight"]
    reps = metrics["reps"]
    duration = metrics["duration"]
    volume = (
        round(weight * reps, 2)
        if weight is not None and reps is not None
        else None
    )
    e1rm = estimate_1rm(weight, int(reps)) if weight is not None and reps is not None else None

    candidates: dict[PersonalRecordType, Optional[float]] = {
        PersonalRecordType.MAX_WEIGHT: weight,
        PersonalRecordType.MAX_VOLUME: volume,
        PersonalRecordType.ESTIMATED_1RM: e1rm,
        PersonalRecordType.MAX_DURATION: duration,
    }
    if weight is not None and reps is not None:
        # MAX_REPS_AT_WEIGHT only meaningful for a specific load above zero.
        if weight > 0:
            candidates[PersonalRecordType.MAX_REPS_AT_WEIGHT] = reps

    records: list[dict[str, Any]] = []
    for record_type, value in candidates.items():
        if value is None or value <= 0:
            continue
        previous = previous_bests.get(record_type.value)
        if previous is not None and value <= previous + 1e-9:
            continue

        unit = "sec" if record_type == PersonalRecordType.MAX_DURATION else "kg"
        records.append(
            {
                "record_type": record_type.value,
                "exercise_id": exercise_id,
                "exercise_name": exercise_name,
                "value": value,
                "unit": unit,
                "is_new_record": True,
                "previous_value": previous,
                "set_number": set_item.get("set_number"),
                "achieved_at": (now or datetime.utcnow()).isoformat(),
            }
        )
        previous_bests[record_type.value] = value

    return records


def collect_session_records(
    exercises: Iterable[dict[str, Any]],
    now: Optional[datetime] = None,
) -> list[dict[str, Any]]:
    """Evaluate all working sets of a session payload, in order."""
    records: list[dict[str, Any]] = []
    for exercise in exercises:
        if not isinstance(exercise, dict):
            continue
        exercise_id_raw = exercise.get("exercise_id")
        try:
            exercise_id = int(exercise_id_raw)
        except (TypeError, ValueError):
            continue
        name = str(exercise.get("name") or f"Exercise #{exercise_id}")
        sets = exercise.get("sets_completed")
        if not isinstance(sets, list):
            continue
        for set_item in sets:
            if not isinstance(set_item, dict):
                continue
            records.extend(
                evaluate_set_records(
                    exercise_id=exercise_id,
                    exercise_name=name,
                    set_item=set_item,
                    previous_bests={},
                    now=now,
                )
            )
    return records
