"""SPEC-006 Progression Engine — deterministic, explainable rule evaluation.

``evaluate_progression`` is a pure function: same input + same policy + same
``policy_version`` always produces the same result (SPEC §37). It never mutates
anything, never calls AI and never changes a program target — it only returns a
:class:`ProgressionEvaluation` that the application layer may persist as a
recommendation (SPEC §39).
"""
from __future__ import annotations

from typing import Optional, Sequence

from app.application.strength_math import estimate_1rm
from app.domain.progression.equipment import advance_weight, snap_to_equipment
from app.domain.progression.types import (
    Confidence,
    ExerciseProgressionSettings,
    ExerciseSessionRecord,
    ProgressionEvaluation,
    ReasonCode,
    RecommendationStatus,
    SetRecord,
    TimePriority,
)
from app.schemas.enums import ProgressionPolicy

# Policies where a deload streak may trigger (SPEC §39 rides on SPEC-006 §26).
_DELOAD_POLICIES = frozenset(
    {
        ProgressionPolicy.LINEAR,
        ProgressionPolicy.DOUBLE_PROGRESSION,
        ProgressionPolicy.RPE_BASED,
        ProgressionPolicy.RIR_BASED,
    }
)


def evaluate_progression(
    *,
    policy: ProgressionPolicy,
    current_session: ExerciseSessionRecord,
    previous_sessions: Sequence[ExerciseSessionRecord] = (),
    settings: Optional[ExerciseProgressionSettings] = None,
) -> ProgressionEvaluation:
    """Evaluate the next training target for one exercise (SPEC §5).

    Args:
        policy: progression policy that applies to the progression scope.
        current_session: the session being evaluated (usually the one that just
            finished). Newest-first ``previous_sessions`` are used for the
            failure streak and as a fallback when the current session has no
            usable working sets.
        settings: resolved policy settings; defaults are applied internally.
    """
    resolved = settings or ExerciseProgressionSettings(policy=policy)
    ordered = _relevant_sessions(current_session, previous_sessions)
    latest = _latest_session_with_data(ordered)
    latest_sets = _target_sets(latest, resolved.explicit_sets_target) if latest else ()

    if policy == ProgressionPolicy.MANUAL:
        # SPEC §11: MANUAL never computes an increase/decrease.
        weight, duration, reps = _last_performance(latest_sets)
        return ProgressionEvaluation(
            policy=policy,
            policy_version=resolved.effective_policy_version,
            status=RecommendationStatus.MANUAL,
            reason_code=ReasonCode.MANUAL_POLICY.value,
            reason_text="Ручная прогрессия: следующую цель задаёт пользователь, движок её не рассчитывает.",
            confidence=Confidence.HIGH.value if latest else Confidence.LOW.value,
            previous_value=weight if weight is not None else duration,
            previous_reps=reps,
            previous_duration=duration,
            source_session_id=latest.session_id if latest else current_session.session_id,
        )

    if not resolved.enabled:
        return _insufficient(
            policy=policy,
            resolved=resolved,
            latest=latest,
            current_session=current_session,
            reason_code=ReasonCode.POLICY_DISABLED,
            reason_text="Политика прогрессии отключена для этого упражнения.",
        )

    if latest is None:
        # SPEC §30: no history -> never invent a weight, fall back to the program target.
        return _insufficient(
            policy=policy,
            resolved=resolved,
            latest=None,
            current_session=current_session,
            reason_code=ReasonCode.NO_PREVIOUS_HISTORY,
            reason_text=(
                "Нет предыдущей истории упражнения — используем цель программы или ручной ввод."
            ),
        )

    current_weight, current_duration, current_reps = _last_performance(latest_sets)

    # SPEC §25–§26: consecutive failures produce a deload *recommendation*.
    streak = failure_streak(ordered, resolved)
    if policy in _DELOAD_POLICIES and streak >= resolved.resolved_failure_threshold:
        return _deload_evaluation(
            policy=policy,
            resolved=resolved,
            ordered=ordered,
            latest=latest,
            current_weight=current_weight,
            streak=streak,
        )

    if policy == ProgressionPolicy.LINEAR:
        return _linear(policy, resolved, latest, latest_sets, current_weight, current_reps)
    if policy == ProgressionPolicy.DOUBLE_PROGRESSION:
        return _double_progression(
            policy, resolved, latest, latest_sets, current_weight, current_reps
        )
    if policy == ProgressionPolicy.RPE_BASED:
        return _effort_based(
            policy, resolved, latest, latest_sets, current_weight, current_reps, use_rpe=True
        )
    if policy == ProgressionPolicy.RIR_BASED:
        return _effort_based(
            policy, resolved, latest, latest_sets, current_weight, current_reps, use_rpe=False
        )
    if policy == ProgressionPolicy.PERCENT_1RM:
        return _percent_1rm(policy, resolved, latest, latest_sets, current_weight, current_reps)
    if policy == ProgressionPolicy.TIME_PROGRESSION:
        return _time_progression(policy, resolved, latest, latest_sets, current_duration)

    return _insufficient(
        policy=policy,
        resolved=resolved,
        latest=latest,
        current_session=current_session,
        reason_code=ReasonCode.NO_PREVIOUS_HISTORY,
        reason_text="Политика прогрессии не поддерживается движком.",
    )


# ─── session helpers ────────────────────────────────────────────────────────


def _relevant_sessions(
    current_session: ExerciseSessionRecord,
    previous_sessions: Sequence[ExerciseSessionRecord],
) -> list[ExerciseSessionRecord]:
    """Newest-first relevant history; cancelled/skipped sessions are dropped."""
    candidates = [current_session, *(previous_sessions or ())]
    return [session for session in candidates if session is not None and session.is_relevant]


def _latest_session_with_data(
    ordered: Sequence[ExerciseSessionRecord],
) -> Optional[ExerciseSessionRecord]:
    for session in ordered:
        if session.has_data():
            return session
    return None


def _target_sets(
    session: Optional[ExerciseSessionRecord], sets_target: Optional[int]
) -> tuple[SetRecord, ...]:
    """SPEC §14/§15: working sets drive the evaluation.

    Warm-up, dropset and failure sets are always excluded. When the scope
    configures a target set count, only the first ``sets_target`` working sets
    count so extra sets can never cancel an achieved goal; otherwise every
    performed working set is evaluated.
    """
    if session is None:
        return ()
    performed = session.target_sets
    if sets_target is None:
        return performed
    return performed[: max(sets_target, 1)]


def _is_incomplete(
    session: ExerciseSessionRecord, settings: ExerciseProgressionSettings
) -> bool:
    target = settings.explicit_sets_target
    return target is not None and len(session.target_sets) < target


def _last_performance(
    sets: Sequence[SetRecord],
) -> tuple[Optional[float], Optional[int], Optional[int]]:
    """(weight, duration, reps) of the first usable set, deterministically."""
    weight = next((s.weight for s in sets if s.weight is not None), None)
    duration = next((s.duration for s in sets if s.duration is not None), None)
    reps = next((s.reps for s in sets if s.reps is not None), None)
    return weight, duration, reps


def _sessions_with_weight(ordered: Sequence[ExerciseSessionRecord]) -> Optional[float]:
    for session in ordered:
        weight = next(
            (s.weight for s in session.target_sets if s.weight is not None and s.weight > 0),
            None,
        )
        if weight is not None:
            return float(weight)
    return None


# ─── failure streak & deload ────────────────────────────────────────────────


def _session_failure_state(
    session: ExerciseSessionRecord, settings: ExerciseProgressionSettings
) -> Optional[bool]:
    """``True`` failed, ``False`` succeeded, ``None`` not enough data to judge."""
    performed = session.target_sets
    if not performed:
        return None  # warm-up-only session (SPEC §25)

    explicit_target = settings.explicit_sets_target
    if explicit_target is not None and len(performed) < explicit_target:
        return True

    timed = any(s.duration is not None for s in performed)
    if timed:
        target_duration = settings.time_target_seconds
        durations = [s.duration for s in performed if s.duration is not None]
        if not durations:
            return None
        if target_duration is not None and any(d < target_duration for d in durations):
            return True
        return False

    reps = [s.reps for s in performed]
    if any(value is None for value in reps):
        return None
    return any(int(value) < settings.resolved_reps_min for value in reps if value is not None)


def failure_streak(
    ordered_sessions: Sequence[ExerciseSessionRecord],
    settings: ExerciseProgressionSettings,
) -> int:
    """Consecutive failed relevant sessions, newest first (SPEC §25)."""
    streak = 0
    for session in ordered_sessions:
        state = _session_failure_state(session, settings)
        if state is None:
            break
        if not state:
            break
        streak += 1
    return streak


def _deload_evaluation(
    *,
    policy: ProgressionPolicy,
    resolved: ExerciseProgressionSettings,
    ordered: Sequence[ExerciseSessionRecord],
    latest: ExerciseSessionRecord,
    current_weight: Optional[float],
    streak: int,
) -> ProgressionEvaluation:
    """SPEC §26: reduce the working weight, as a recommendation only."""
    base_weight = current_weight if current_weight is not None else _sessions_with_weight(ordered)
    if base_weight is None:
        return _insufficient(
            policy=policy,
            resolved=resolved,
            latest=latest,
            current_session=latest,
            reason_code=ReasonCode.FAILURE_THRESHOLD_REACHED,
            reason_text=(
                f"Цель не достигнута в {streak} тренировках подряд, но вес в истории "
                "отсутствует — снижение рассчитать нельзя."
            ),
        )
    target = snap_to_equipment(
        base_weight * (1 - resolved.resolved_deload_percent / 100.0),
        resolved.resolved_increment_step,
    )
    target = _apply_bounds(target, resolved)
    return ProgressionEvaluation(
        policy=policy,
        policy_version=resolved.effective_policy_version,
        status=RecommendationStatus.DELOAD,
        reason_code=ReasonCode.FAILURE_THRESHOLD_REACHED.value,
        reason_text=(
            f"Цель не достигнута в {streak} тренировках подряд. Рекомендуем разгрузку: "
            f"{_fmt(base_weight)} → {_fmt(target)} кг "
            f"(−{_fmt(resolved.resolved_deload_percent)}%)."
        ),
        confidence=Confidence.HIGH.value,
        previous_value=base_weight,
        recommended_value=target,
        difference=_diff(target, base_weight),
        source_session_id=latest.session_id,
        failure_streak=streak,
    )


# ─── policies ───────────────────────────────────────────────────────────────


def _linear(
    policy: ProgressionPolicy,
    resolved: ExerciseProgressionSettings,
    latest: ExerciseSessionRecord,
    target_sets: Sequence[SetRecord],
    current_weight: Optional[float],
    current_reps: Optional[int],
) -> ProgressionEvaluation:
    """SPEC §12: fixed reps, add weight once every target set hits the target."""
    target_reps = resolved.resolved_reps_min
    incomplete = _is_incomplete(latest, resolved)
    reps = [s.reps for s in target_sets]

    if incomplete:
        return _keep(
            policy=policy,
            resolved=resolved,
            latest=latest,
            current_weight=current_weight,
            current_reps=current_reps,
            reason_code=ReasonCode.TARGET_SETS_INCOMPLETE,
            reason_text=(
                f"Выполнено {len(latest.target_sets)} из "
                f"{resolved.resolved_sets_target} рабочих подходов — цель считается "
                "частичной, вес остаётся."
            ),
            confidence=Confidence.MEDIUM.value,
        )

    if reps and all(value is not None and int(value) >= target_reps for value in reps):
        return _increase(
            policy=policy,
            resolved=resolved,
            latest=latest,
            current_weight=current_weight,
            current_reps=current_reps,
            reason_code=ReasonCode.TARGET_COMPLETED,
            reason_text=(
                f"Все целевые рабочие подходы достигли {target_reps} повторений — "
                f"линейная прогрессия: +{_fmt(resolved.resolved_increment)} кг."
            ),
            confidence=_confidence(resolved, latest, target_sets, required_field=None),
        )

    return _keep(
        policy=policy,
        resolved=resolved,
        latest=latest,
        current_weight=current_weight,
        current_reps=current_reps,
        reason_code=ReasonCode.TARGET_NOT_COMPLETED,
        reason_text=(
            f"Не все рабочие подходы достигли {target_reps} повторений "
            f"({_format_reps(reps)}) — вес остаётся {_fmt(current_weight)} кг."
        ),
    )


def _double_progression(
    policy: ProgressionPolicy,
    resolved: ExerciseProgressionSettings,
    latest: ExerciseSessionRecord,
    target_sets: Sequence[SetRecord],
    current_weight: Optional[float],
    current_reps: Optional[int],
) -> ProgressionEvaluation:
    """SPEC §13/§14: reps climb within the range, then the weight climbs."""
    reps_min = resolved.resolved_reps_min
    reps_max = resolved.resolved_reps_max
    incomplete = _is_incomplete(latest, resolved)
    reps = [s.reps for s in target_sets]

    if incomplete:
        return _keep(
            policy=policy,
            resolved=resolved,
            latest=latest,
            current_weight=current_weight,
            current_reps=current_reps,
            reason_code=ReasonCode.TARGET_SETS_INCOMPLETE,
            reason_text=(
                f"Выполнено {len(latest.target_sets)} из "
                f"{resolved.resolved_sets_target} целевых рабочих подходов — "
                "двойная прогрессия не завершена, вес остаётся."
            ),
            confidence=Confidence.MEDIUM.value,
        )

    if reps and all(value is not None and int(value) >= reps_max for value in reps):
        return _increase(
            policy=policy,
            resolved=resolved,
            latest=latest,
            current_weight=current_weight,
            current_reps=current_reps,
            reason_code=ReasonCode.REP_RANGE_COMPLETED,
            reason_text=(
                f"Все {len(target_sets)} целевых рабочих подхода достигли верхней границы "
                f"{reps_max} повторений — шаг +{_fmt(resolved.resolved_increment)} кг, "
                f"диапазон остаётся {reps_min}–{reps_max}."
            ),
            confidence=_confidence(resolved, latest, target_sets, required_field=None),
            recommended_reps=reps_max,
        )

    return _keep(
        policy=policy,
        resolved=resolved,
        latest=latest,
        current_weight=current_weight,
        current_reps=current_reps,
        reason_code=ReasonCode.TARGET_NOT_COMPLETED,
        reason_text=(
            f"Для увеличения веса необходимо {reps_max} повторений во всех целевых "
            f"подходах, выполнено {_format_reps(reps)} — вес остаётся "
            f"{_fmt(current_weight)} кг."
        ),
    )


def _effort_based(
    policy: ProgressionPolicy,
    resolved: ExerciseProgressionSettings,
    latest: ExerciseSessionRecord,
    target_sets: Sequence[SetRecord],
    current_weight: Optional[float],
    current_reps: Optional[int],
    *,
    use_rpe: bool,
) -> ProgressionEvaluation:
    """SPEC §16–§18: effort (RPE/RIR) drives the decision, never guessed."""
    field_name = "rpe" if use_rpe else "rir"
    values = [getattr(s, field_name) for s in target_sets if getattr(s, field_name) is not None]
    insufficient_reason = (
        ReasonCode.INSUFFICIENT_RPE_DATA if use_rpe else ReasonCode.INSUFFICIENT_RIR_DATA
    )
    label = "RPE" if use_rpe else "RIR"

    if not target_sets:
        return _insufficient(
            policy=policy,
            resolved=resolved,
            latest=latest,
            current_session=latest,
            reason_code=insufficient_reason,
            reason_text=f"Нет завершённых рабочих подходов с {label}.",
        )

    incomplete = _is_incomplete(latest, resolved)
    if len(values) < len(target_sets) or incomplete:
        # SPEC §17: never increase the load on incomplete effort information.
        missing = len(target_sets) - len(values)
        detail = (
            f"Нет {label} в {missing} из {len(target_sets)} целевых подходов"
            if missing
            else f"выполнено {len(latest.target_sets)} из "
            f"{resolved.resolved_sets_target} целевых подходов"
        )
        return _insufficient(
            policy=policy,
            resolved=resolved,
            latest=latest,
            current_session=latest,
            reason_code=insufficient_reason,
            reason_text=(
                f"Недостаточно данных {label} ({detail}) — вес не увеличиваем, "
                f"остаётся {_fmt(current_weight)} кг."
            ),
            current_weight=current_weight,
            current_reps=current_reps,
        )

    if use_rpe:
        declared_target = resolved.resolved_target_rpe
        average = sum(float(v) for v in values) / len(values)
        met = average <= declared_target
        reason_code = ReasonCode.TARGET_RPE_MET if met else ReasonCode.TARGET_RPE_EXCEEDED
        detail = (
            f"Средний RPE {_fmt(average)} не выше целевого {_fmt(declared_target)} — "
            "нагрузку можно увеличить."
            if met
            else f"Средний RPE {_fmt(average)} выше целевого {_fmt(declared_target)} — "
            "нагрузка слишком тяжёлая, вес остаётся."
        )
    else:
        declared_target = resolved.resolved_target_rir
        minimum = min(float(v) for v in values)
        met = minimum >= declared_target
        reason_code = ReasonCode.TARGET_RIR_MET if met else ReasonCode.TARGET_RIR_EXCEEDED
        detail = (
            f"Минимальный RIR {_fmt(minimum)} не ниже целевого {_fmt(declared_target)} — "
            "запас повторений достаточный, вес можно увеличить."
            if met
            else f"Минимальный RIR {_fmt(minimum)} ниже целевого {_fmt(declared_target)} — "
            "запас повторений исчерпан, вес остаётся."
        )

    confidence = _confidence(
        resolved, latest, target_sets, required_field=field_name,
    )
    if met:
        return _increase(
            policy=policy,
            resolved=resolved,
            latest=latest,
            current_weight=current_weight,
            current_reps=current_reps,
            reason_code=reason_code,
            reason_text=detail,
            confidence=confidence,
        )
    return _keep(
        policy=policy,
        resolved=resolved,
        latest=latest,
        current_weight=current_weight,
        current_reps=current_reps,
        reason_code=reason_code,
        reason_text=detail,
        confidence=confidence,
    )


def _percent_1rm(
    policy: ProgressionPolicy,
    resolved: ExerciseProgressionSettings,
    latest: ExerciseSessionRecord,
    target_sets: Sequence[SetRecord],
    current_weight: Optional[float],
    current_reps: Optional[int],
) -> ProgressionEvaluation:
    """SPEC §19–§20: percentage of the estimated 1RM, then equipment rounding."""
    estimates = [
        (estimate_1rm(float(s.weight), int(s.reps), max_reps=resolved.e1rm_max_reps), s)
        for s in target_sets
        if s.weight is not None
        and s.reps is not None
        and float(s.weight) > 0
        and 0 < int(s.reps) <= resolved.e1rm_max_reps
    ]
    valid = [(value, s) for value, s in estimates if value is not None]
    if not valid:
        return _insufficient(
            policy=policy,
            resolved=resolved,
            latest=latest,
            current_session=latest,
            reason_code=ReasonCode.NO_PREVIOUS_HISTORY,
            reason_text=(
                "Нет рабочих подходов в диапазоне 1–"
                f"{resolved.e1rm_max_reps} повторений — e1RM рассчитать нельзя."
            ),
            current_weight=current_weight,
            current_reps=current_reps,
        )

    e1rm, best_set = max(valid, key=lambda item: item[0])
    e1rm = float(e1rm)
    percent = resolved.resolved_percent_1rm or 0.0
    target = snap_to_equipment(e1rm * percent / 100.0, resolved.resolved_increment_step)
    target = _apply_bounds(target, resolved)
    status = (
        RecommendationStatus.INCREASE
        if current_weight is None or target > current_weight
        else RecommendationStatus.DECREASE
        if target < current_weight
        else RecommendationStatus.KEEP
    )
    return ProgressionEvaluation(
        policy=policy,
        policy_version=resolved.effective_policy_version,
        status=status,
        reason_code=ReasonCode.TARGET_COMPLETED.value,
        reason_text=(
            f"e1RM {_fmt(e1rm)} кг ({_fmt(best_set.weight)} кг × {best_set.reps}) × "
            f"{_fmt(percent)}% = {_fmt(target)} кг, округлено до шага "
            f"{_fmt(resolved.resolved_increment_step)} кг."
        ),
        confidence=_confidence(
            resolved, latest, target_sets, required_field=None
        ),
        previous_value=current_weight,
        recommended_value=target,
        difference=_diff(target, current_weight),
        previous_reps=current_reps,
        recommended_reps=resolved.resolved_reps_max,
        source_session_id=latest.session_id,
    )


def _time_progression(
    policy: ProgressionPolicy,
    resolved: ExerciseProgressionSettings,
    latest: ExerciseSessionRecord,
    target_sets: Sequence[SetRecord],
    current_duration: Optional[int],
) -> ProgressionEvaluation:
    """SPEC §23–§24: progress the hold; ``WEIGHT_FIRST`` moves load instead."""
    weight_based = (
        resolved.time_priority == TimePriority.WEIGHT_FIRST
        and any(s.weight is not None and s.weight > 0 for s in target_sets)
    )
    if weight_based:
        current_weight, _duration, reps = _last_performance(target_sets)
        if not _is_incomplete(latest, resolved):
            return _increase(
                policy=policy,
                resolved=resolved,
                latest=latest,
                current_weight=current_weight,
                current_reps=reps,
                reason_code=ReasonCode.TARGET_COMPLETED,
                reason_text=(
                    "Вес-приоритет: целевые подходы выполнены, увеличиваем нагрузку на "
                    f"{_fmt(resolved.resolved_increment)} кг."
                ),
                confidence=_confidence(resolved, latest, target_sets, required_field=None),
            )
        return _keep(
            policy=policy,
            resolved=resolved,
            latest=latest,
            current_weight=current_weight,
            current_reps=reps,
            reason_code=ReasonCode.TARGET_SETS_INCOMPLETE,
            reason_text="Вес-приоритет: выполнены не все целевые подходы, вес остаётся.",
            confidence=Confidence.MEDIUM.value,
        )

    durations = [s.duration for s in target_sets if s.duration is not None]
    if not durations:
        return _insufficient(
            policy=policy,
            resolved=resolved,
            latest=latest,
            current_session=latest,
            reason_code=ReasonCode.NO_PREVIOUS_HISTORY,
            reason_text="Нет данных о длительности подходов — цель по времени не рассчитать.",
        )

    longest = max(int(value) for value in durations)
    incomplete = _is_incomplete(latest, resolved)
    target_seconds = resolved.time_target_seconds
    completed = not incomplete and (
        target_seconds is None or all(int(d) >= int(target_seconds) for d in durations)
    )
    if not completed:
        return ProgressionEvaluation(
            policy=policy,
            policy_version=resolved.effective_policy_version,
            status=RecommendationStatus.KEEP,
            reason_code=ReasonCode.TARGET_NOT_COMPLETED_TIME.value,
            reason_text=(
                f"Целевое время не достигнуто во всех подходах "
                f"({_format_durations(durations)}), цель остаётся {longest} сек."
            ),
            confidence=Confidence.MEDIUM.value if durations else Confidence.LOW.value,
            previous_value=float(longest),
            recommended_value=float(longest),
            difference=0.0,
            previous_duration=int(current_duration) if current_duration is not None else longest,
            recommended_duration=longest,
            source_session_id=latest.session_id,
        )

    recommended = longest + resolved.resolved_time_increment
    return ProgressionEvaluation(
        policy=policy,
        policy_version=resolved.effective_policy_version,
        status=RecommendationStatus.INCREASE,
        reason_code=ReasonCode.TIME_TARGET_COMPLETED.value,
        reason_text=(
            f"Цель по времени достигнута ({longest} сек во всех целевых подходах) — "
            f"следующая цель {recommended} сек (+{resolved.resolved_time_increment})."
        ),
        confidence=_confidence(resolved, latest, target_sets, required_field="duration"),
        previous_value=float(longest),
        recommended_value=float(recommended),
        difference=float(recommended - longest),
        previous_reps=None,
        previous_duration=longest,
        recommended_duration=recommended,
        source_session_id=latest.session_id,
    )


# ─── shared result builders ─────────────────────────────────────────────────


def _increase(
    *,
    policy: ProgressionPolicy,
    resolved: ExerciseProgressionSettings,
    latest: ExerciseSessionRecord,
    current_weight: Optional[float],
    current_reps: Optional[int],
    reason_code: ReasonCode,
    reason_text: str,
    confidence: str,
    recommended_reps: Optional[int] = None,
) -> ProgressionEvaluation:
    if current_weight is None or current_weight <= 0:
        # SPEC §54: weight = 0 (bodyweight / timed) cannot be increased numerically.
        return _keep(
            policy=policy,
            resolved=resolved,
            latest=latest,
            current_weight=current_weight,
            current_reps=current_reps,
            reason_code=ReasonCode.TARGET_NOT_COMPLETED,
            reason_text=(
                "Рабочий вес не задан (0 кг) — числовое увеличение невозможно, "
                "используйте прогрессию по времени или повторам."
            ),
            confidence=Confidence.MEDIUM.value,
        )
    target = advance_weight(current_weight, resolved.resolved_increment, resolved.resolved_increment_step)
    target = _apply_bounds(target, resolved)
    return ProgressionEvaluation(
        policy=policy,
        policy_version=resolved.effective_policy_version,
        status=RecommendationStatus.INCREASE,
        reason_code=reason_code.value,
        reason_text=reason_text,
        confidence=confidence,
        previous_value=current_weight,
        recommended_value=target,
        difference=_diff(target, current_weight),
        previous_reps=current_reps,
        recommended_reps=recommended_reps,
        source_session_id=latest.session_id,
    )


def _keep(
    *,
    policy: ProgressionPolicy,
    resolved: ExerciseProgressionSettings,
    latest: ExerciseSessionRecord,
    current_weight: Optional[float],
    current_reps: Optional[int],
    reason_code: ReasonCode,
    reason_text: str,
    confidence: Optional[str] = None,
) -> ProgressionEvaluation:
    return ProgressionEvaluation(
        policy=policy,
        policy_version=resolved.effective_policy_version,
        status=RecommendationStatus.KEEP,
        reason_code=reason_code.value,
        reason_text=reason_text,
        confidence=confidence or Confidence.HIGH.value,
        previous_value=current_weight,
        recommended_value=current_weight,
        difference=_diff(current_weight, current_weight),
        previous_reps=current_reps,
        source_session_id=latest.session_id,
    )


def _insufficient(
    *,
    policy: ProgressionPolicy,
    resolved: ExerciseProgressionSettings,
    latest: Optional[ExerciseSessionRecord],
    current_session: ExerciseSessionRecord,
    reason_code: ReasonCode,
    reason_text: str,
    current_weight: Optional[float] = None,
    current_reps: Optional[int] = None,
) -> ProgressionEvaluation:
    """SPEC §17/§30/§49: no invented numbers, program target stays in charge."""
    source = latest or current_session
    return ProgressionEvaluation(
        policy=policy,
        policy_version=resolved.effective_policy_version,
        status=RecommendationStatus.INSUFFICIENT_DATA,
        reason_code=reason_code.value,
        reason_text=reason_text,
        confidence=Confidence.LOW.value,
        previous_value=current_weight,
        recommended_value=None,
        difference=None,
        previous_reps=current_reps,
        source_session_id=source.session_id if source else None,
    )


def _confidence(
    resolved: ExerciseProgressionSettings,
    latest: ExerciseSessionRecord,
    target_sets: Sequence[SetRecord],
    *,
    required_field: Optional[str],
) -> str:
    """SPEC §29: data quality, not model probability."""
    if len(latest.target_sets) < resolved.resolved_sets_target:
        return Confidence.MEDIUM.value if target_sets else Confidence.LOW.value
    if required_field:
        covered = all(
            getattr(s, required_field) is not None for s in target_sets
        )
        if not covered:
            return Confidence.MEDIUM.value
    return Confidence.HIGH.value


def _apply_bounds(
    value: Optional[float], resolved: ExerciseProgressionSettings
) -> Optional[float]:
    if value is None:
        return None
    if resolved.min_value is not None:
        value = max(value, float(resolved.min_value))
    if resolved.max_value is not None:
        value = min(value, float(resolved.max_value))
    return round(float(value), 2)


def _diff(value: Optional[float], reference: Optional[float]) -> Optional[float]:
    if value is None or reference is None:
        return None
    return round(float(value) - float(reference), 2)


def _fmt(value: Optional[float]) -> str:
    if value is None:
        return "—"
    numeric = float(value)
    if numeric.is_integer():
        return str(int(numeric))
    return f"{numeric:.2f}".rstrip("0").rstrip(".")


def _format_reps(reps: Sequence[Optional[int]]) -> str:
    return " / ".join("—" if r is None else str(int(r)) for r in reps)


def _format_durations(durations: Sequence[Optional[int]]) -> str:
    return " / ".join("—" if d is None else f"{int(d)}с" for d in durations)
