"""Progression engine for SPEC-005 §29–39.

Policies: MANUAL, LINEAR, DOUBLE_PROGRESSION, RPE_BASED, RIR_BASED,
PERCENT_1RM, TIME_PROGRESSION.

Every recommendation is explainable (§37) and carries the wire shape of
``ProgressionRecommendation`` (§38). Deload is a recommendation only — the
engine never mutates weights silently (§39).
"""
from __future__ import annotations

from typing import Any, Optional

from app.application.strength_math import estimate_1rm, round_to_increment
from app.schemas.enums import ProgressionPolicy

# Deload rule: N consecutive failed sessions -> -10% (SPEC-005 §39).
DELOAD_FAILED_SESSIONS = 3
DELOAD_FACTOR = 0.9

DEFAULT_INCREMENT = 2.5
DEFAULT_REP_RANGE = (8, 12)
DEFAULT_WEIGHT_INCREMENT_STEP = 2.5


def _as_float(value: Any) -> Optional[float]:
    try:
        if value is None:
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _as_int(value: Any) -> Optional[int]:
    try:
        if value is None:
            return None
        return int(value)
    except (TypeError, ValueError):
        return None


def _working_sets(sets: list[Any]) -> list[dict[str, Any]]:
    """Warm-up sets do not drive progression (SPEC-005 §10)."""
    working: list[dict[str, Any]] = []
    for raw in sets or []:
        if not isinstance(raw, dict):
            continue
        set_type = str(raw.get("set_type") or "working")
        if set_type == "warmup":
            continue
        working.append(raw)
    return working


def _completed_working_sets(exercise: dict[str, Any]) -> list[dict[str, Any]]:
    return [s for s in _working_sets(exercise.get("sets_completed") or []) if s.get("completed")]


def _extract_history(history: Optional[list[dict[str, Any]]]) -> list[dict[str, Any]]:
    """Flatten session history payloads into (session_id, date, sets) tuples."""
    sessions: list[dict[str, Any]] = []
    for item in history or []:
        if not isinstance(item, dict):
            continue
        exercise = item.get("exercise") if isinstance(item.get("exercise"), dict) else item
        sessions.append(
            {
                "session_id": item.get("session_id") or item.get("workout_id"),
                "date": item.get("date"),
                "sets": exercise.get("sets_completed") or [],
                "completed": item.get("completed", True),
            }
        )
    return sessions


def _round_volume(value: Optional[float]) -> Optional[float]:
    return round(value, 2) if value is not None else None


def _recommendation(
    *,
    policy: ProgressionPolicy,
    previous_value: Optional[float],
    recommended_value: Optional[float],
    reason_code: str,
    reason_text: str,
    confidence: str,
    source_session_id: Optional[int] = None,
) -> dict[str, Any]:
    difference = None
    if recommended_value is not None and previous_value is not None:
        difference = round(recommended_value - previous_value, 2)
    return {
        "recommended_value": _round_volume(recommended_value),
        "previous_value": _round_volume(previous_value),
        "difference": difference,
        "policy": policy.value,
        "reason_code": reason_code,
        "reason_text": reason_text,
        "confidence": confidence,
        "source_session_id": source_session_id,
    }


def _count_consecutive_failures(history: list[dict[str, Any]]) -> int:
    """Count trailing sessions where the working target was not reached."""
    failures = 0
    for session in history:
        if not session.get("completed", True):
            failures += 1
            continue
        break
    return failures


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
    time_increment_seconds: int = 5,
    weight_increment_step: float = DEFAULT_WEIGHT_INCREMENT_STEP,
    exercise_id: Optional[int] = None,
) -> dict[str, Any]:
    """Produce an explainable next-target recommendation for one exercise.

    ``history`` is ordered newest-first; each item references the same
    exercise and contains ``sets_completed``. ``current_exercise`` holds the
    in-progress session data (may be empty before the first set).
    """
    sessions = _extract_history(history)
    latest = current_exercise if current_exercise.get("sets_completed") else (
        sessions[0] if sessions else current_exercise
    )
    latest_sets = _completed_working_sets(latest) or _working_sets(latest.get("sets_completed") or [])
    latest_session_id = latest.get("session_id") if isinstance(latest, dict) else None

    # Latest working values (first completed working set wins).
    latest_weight = next(
        (_as_float(s.get("weight")) for s in latest_sets if _as_float(s.get("weight")) is not None),
        None,
    )
    latest_reps = next(
        (_as_int(s.get("reps")) for s in latest_sets if _as_int(s.get("reps")) is not None),
        None,
    )
    latest_duration = next(
        (_as_int(s.get("duration")) for s in latest_sets if _as_int(s.get("duration")) is not None),
        None,
    )

    if policy == ProgressionPolicy.MANUAL:
        if latest_weight is None and latest_duration is None:
            return _recommendation(
                policy=policy,
                previous_value=None,
                recommended_value=None,
                reason_code="NO_HISTORY",
                reason_text="Первое выполнение упражнения — рекомендуемого значения нет.",
                confidence="low",
                source_session_id=latest_session_id,
            )
        return _recommendation(
            policy=policy,
            previous_value=latest_weight if latest_weight is not None else latest_duration,
            recommended_value=None,
            reason_code="MANUAL_POLICY",
            reason_text="Ручная прогрессия: значения задаёт пользователь.",
            confidence="high",
            source_session_id=latest_session_id,
        )

    if policy == ProgressionPolicy.PERCENT_1RM:
        if latest_weight is None or latest_reps is None:
            return _recommendation(
                policy=policy,
                previous_value=latest_weight,
                recommended_value=None,
                reason_code="NO_DATA",
                reason_text="Недостаточно данных для расчёта e1RM.",
                confidence="low",
                source_session_id=latest_session_id,
            )
        e1rm = estimate_1rm(latest_weight, latest_reps)
        if e1rm is None or percent_1rm is None:
            return _recommendation(
                policy=policy,
                previous_value=latest_weight,
                recommended_value=None,
                reason_code="NO_DATA",
                reason_text="e1RM недоступен (слишком много повторений или нет данных).",
                confidence="low",
                source_session_id=latest_session_id,
            )
        recommended = round_to_increment(e1rm * percent_1rm / 100.0, weight_increment_step)
        return _recommendation(
            policy=policy,
            previous_value=latest_weight,
            recommended_value=recommended,
            reason_code="PERCENT_1RM_TARGET",
            reason_text=(
                f"e1RM {e1rm} кг × {percent_1rm}% = {recommended} кг "
                f"(округлено до {weight_increment_step} кг)."
            ),
            confidence="high",
            source_session_id=latest_session_id,
        )

    if policy == ProgressionPolicy.TIME_PROGRESSION:
        if latest_duration is None:
            return _recommendation(
                policy=policy,
                previous_value=None,
                recommended_value=None,
                reason_code="NO_DATA",
                reason_text="Нет данных о длительности подхода.",
                confidence="low",
                source_session_id=latest_session_id,
            )
        recommended = latest_duration + time_increment_seconds
        return _recommendation(
            policy=policy,
            previous_value=float(latest_duration),
            recommended_value=float(recommended),
            reason_code="TIME_TARGET_COMPLETED",
            reason_text=(
                f"Цель {latest_duration} сек достигнута — следующий подход "
                f"{recommended} сек (+{time_increment_seconds})."
            ),
            confidence="high",
            source_session_id=latest_session_id,
        )

    # Weight-based policies below need both weight and reps history.
    if latest_weight is None or latest_reps is None:
        return _recommendation(
            policy=policy,
            previous_value=latest_weight,
            recommended_value=None,
            reason_code="NO_HISTORY",
            reason_text="Первое выполнение упражнения — рекомендуемого значения нет.",
            confidence="low",
            source_session_id=latest_session_id,
        )

    if policy == ProgressionPolicy.LINEAR:
        target_reps = rep_range[0]
        all_hit_target = bool(latest_sets) and all(
            (_as_int(s.get("reps")) or 0) >= target_reps for s in latest_sets
        )
        if all_hit_target:
            recommended = round_to_increment(latest_weight + increment, weight_increment_step)
            return _recommendation(
                policy=policy,
                previous_value=latest_weight,
                recommended_value=recommended,
                reason_code="LINEAR_TARGET_COMPLETED",
                reason_text=(
                    f"Все рабочие подходы достигли {target_reps} повторений — "
                    f"{latest_weight} + {increment} = {recommended} кг."
                ),
                confidence="high",
                source_session_id=latest_session_id,
            )
        return _recommendation(
            policy=policy,
            previous_value=latest_weight,
            recommended_value=latest_weight,
            reason_code="TARGET_NOT_REACHED",
            reason_text="Цель по повторениям не достигнута — вес остаётся прежним.",
            confidence="high",
            source_session_id=latest_session_id,
        )

    if policy == ProgressionPolicy.DOUBLE_PROGRESSION:
        low, high = rep_range
        all_hit_high = bool(latest_sets) and all(
            (_as_int(s.get("reps")) or 0) >= high for s in latest_sets
        )
        if all_hit_high:
            recommended = round_to_increment(latest_weight + increment, weight_increment_step)
            return _recommendation(
                policy=policy,
                previous_value=latest_weight,
                recommended_value=recommended,
                reason_code="REP_RANGE_COMPLETED",
                reason_text=(
                    f"Верхняя граница {low}–{high} достигнута во всех рабочих подходах — "
                    f"двойная прогрессия: {latest_weight} + {increment} = {recommended} кг."
                ),
                confidence="high",
                source_session_id=latest_session_id,
            )
        return _recommendation(
            policy=policy,
            previous_value=latest_weight,
            recommended_value=latest_weight,
            reason_code="REP_RANGE_NOT_COMPLETED",
            reason_text=(
                f"Верхняя граница {high} повторений ещё не достигнута во всех "
                f"подходах — вес остаётся {latest_weight} кг."
            ),
            confidence="high",
            source_session_id=latest_session_id,
        )

    if policy == ProgressionPolicy.RPE_BASED:
        rpe_values = [
            _as_float(s.get("rpe")) for s in latest_sets if _as_float(s.get("rpe")) is not None
        ]
        if not rpe_values:
            return _recommendation(
                policy=policy,
                previous_value=latest_weight,
                recommended_value=None,
                reason_code="NO_RPE_DATA",
                reason_text="Нет RPE в завершённых рабочих подходах.",
                confidence="low",
                source_session_id=latest_session_id,
            )
        avg_rpe = sum(rpe_values) / len(rpe_values)
        threshold = target_rpe if target_rpe is not None else 8.0
        if avg_rpe <= threshold:
            recommended = round_to_increment(latest_weight + increment, weight_increment_step)
            return _recommendation(
                policy=policy,
                previous_value=latest_weight,
                recommended_value=recommended,
                reason_code="RPE_BELOW_TARGET",
                reason_text=(
                    f"Средний RPE {round(avg_rpe, 1)} ≤ {threshold} — "
                    f"увеличиваем вес до {recommended} кг."
                ),
                confidence="medium",
                source_session_id=latest_session_id,
            )
        if avg_rpe >= threshold + 2.0:
            recommended = round_to_increment(latest_weight * DELOAD_FACTOR, weight_increment_step)
            return _recommendation(
                policy=policy,
                previous_value=latest_weight,
                recommended_value=recommended,
                reason_code="RPE_TOO_HIGH",
                reason_text=(
                    f"Средний RPE {round(avg_rpe, 1)} сильно выше цели {threshold} — "
                    f"рекомендуем снизить вес до {recommended} кг."
                ),
                confidence="medium",
                source_session_id=latest_session_id,
            )
        return _recommendation(
            policy=policy,
            previous_value=latest_weight,
            recommended_value=latest_weight,
            reason_code="RPE_AT_TARGET",
            reason_text=f"Средний RPE {round(avg_rpe, 1)} в пределах цели — вес остаётся.",
            confidence="medium",
            source_session_id=latest_session_id,
        )

    if policy == ProgressionPolicy.RIR_BASED:
        rir_values = [
            _as_float(s.get("rir")) for s in latest_sets if _as_float(s.get("rir")) is not None
        ]
        if not rir_values:
            return _recommendation(
                policy=policy,
                previous_value=latest_weight,
                recommended_value=None,
                reason_code="NO_RIR_DATA",
                reason_text="Нет RIR в завершённых рабочих подходах.",
                confidence="low",
                source_session_id=latest_session_id,
            )
        avg_rir = sum(rir_values) / len(rir_values)
        threshold = target_rir if target_rir is not None else 2.0
        if avg_rir >= threshold:
            recommended = round_to_increment(latest_weight + increment, weight_increment_step)
            return _recommendation(
                policy=policy,
                previous_value=latest_weight,
                recommended_value=recommended,
                reason_code="RIR_AT_OR_ABOVE_TARGET",
                reason_text=(
                    f"Средний RIR {round(avg_rir, 1)} ≥ {threshold} — уверенное "
                    f"выполнение, следующий вес {recommended} кг."
                ),
                confidence="medium",
                source_session_id=latest_session_id,
            )
        return _recommendation(
            policy=policy,
            previous_value=latest_weight,
            recommended_value=latest_weight,
            reason_code="RIR_BELOW_TARGET",
            reason_text=f"Средний RIR {round(avg_rir, 1)} ниже цели {threshold} — вес остаётся.",
            confidence="medium",
            source_session_id=latest_session_id,
        )

    return _recommendation(
        policy=policy,
        previous_value=latest_weight,
        recommended_value=None,
        reason_code="UNSUPPORTED_POLICY",
        reason_text="Политика прогрессии не поддерживается.",
        confidence="low",
        source_session_id=latest_session_id,
    )


def deload_recommendation(
    *,
    policy: ProgressionPolicy,
    current_weight: float,
    history: Optional[list[dict[str, Any]]] = None,
    weight_increment_step: float = DEFAULT_WEIGHT_INCREMENT_STEP,
) -> Optional[dict[str, Any]]:
    """Deload after ``DELOAD_FAILED_SESSIONS`` consecutive failures (§39)."""
    if policy in (ProgressionPolicy.MANUAL, ProgressionPolicy.TIME_PROGRESSION, ProgressionPolicy.PERCENT_1RM):
        return None
    failures = _count_consecutive_failures(history or [])
    if failures < DELOAD_FAILED_SESSIONS:
        return None
    recommended = round_to_increment(current_weight * DELOAD_FACTOR, weight_increment_step)
    return _recommendation(
        policy=policy,
        previous_value=current_weight,
        recommended_value=recommended,
        reason_code="DELOAD_AFTER_FAILURES",
        reason_text=(
            f"Цель не достигнута в последних {failures} тренировках — "
            f"рекомендуем снизить вес: {current_weight} → {recommended} кг."
        ),
        confidence="medium",
    )
