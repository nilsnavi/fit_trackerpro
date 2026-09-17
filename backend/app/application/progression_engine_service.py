"""SPEC-006 orchestration: DB -> engine -> persisted recommendation.

This layer owns everything the pure engine must not know about: scope
resolution, policy lookup and defaults, persistence, idempotency, lifecycle
transitions, logging and metrics. The engine itself stays deterministic and
side-effect free (SPEC §4/§37).
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Iterable, Optional, Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.telemetry.progression_metrics import record_progression_metric
from app.domain.progression.engine import evaluate_progression
from app.domain.progression.equipment import resolve_increment_step
from app.domain.progression.types import (
    DEFAULT_E1RM_MAX_REPS,
    DEFAULT_INCREMENT,
    DEFAULT_REP_RANGE,
    DEFAULT_SETS_TARGET,
    ExerciseProgressionSettings,
    ExerciseSessionRecord,
    PolicyVersion,
    ProgressionEvaluation,
    ProgressionScope,
    ReasonCode,
    RecommendationLifecycle,
    RecommendationStatus,
    TimePriority,
    normalize_sets,
)
from app.domain.progression_policy import ProgressionPolicyRecord
from app.domain.progression_recommendation import ProgressionRecommendationRecord
from app.domain.recovery_state import RecoveryState
from app.domain.workout_log import WorkoutLog
from app.infrastructure.repositories.progression_repository import (
    DEFAULT_HISTORY_LIMIT,
    ProgressionRepository,
    resolve_slot_id,
    resolve_slot_sets,
)
from app.schemas.enums import ProgressionPolicy

logger = logging.getLogger("app.progression")

# History depth is bounded: failure streak + previous result never need more.
HISTORY_LIMIT = DEFAULT_HISTORY_LIMIT
# Advisory only — recovery never changes a recommendation (SPEC §34).
RECOVERY_WARNING_READINESS = 60.0


@dataclass(frozen=True, slots=True)
class AcceptedProgressionTarget:
    """Accepted next target that may prefill the next session (SPEC §42/§43).

    ``generated`` recommendations never reach this type — it exists only for
    values the user explicitly accepted or modified.
    """

    recommendation_id: Optional[int] = None
    scope_key: Optional[str] = None
    lifecycle_status: Optional[str] = None
    policy: Optional[str] = None
    value: Optional[float] = None
    weight: Optional[float] = None
    duration: Optional[int] = None


def _to_float(value: Any) -> Optional[float]:
    try:
        return None if value is None else float(value)
    except (TypeError, ValueError):
        return None


def _to_int(value: Any) -> Optional[int]:
    try:
        return None if value is None else int(value)
    except (TypeError, ValueError):
        return None


def parse_policy_type(value: Any, fallback: ProgressionPolicy) -> ProgressionPolicy:
    try:
        return ProgressionPolicy(str(value))
    except ValueError:
        return fallback


class ProgressionEngineService:
    def __init__(self, db: AsyncSession) -> None:
        self.repository = ProgressionRepository(db)

    # ─── scope & settings ───────────────────────────────────────────────────

    @staticmethod
    def build_scope(
        *,
        user_id: int,
        exercise_id: int,
        template_id: Optional[int] = None,
        template_exercise_id: Optional[int] = None,
    ) -> ProgressionScope:
        return ProgressionScope(
            user_id=int(user_id),
            exercise_id=int(exercise_id),
            template_id=int(template_id) if template_id is not None else None,
            template_exercise_id=(
                int(template_exercise_id) if template_exercise_id is not None else None
            ),
        )

    async def resolve_request_scope(
        self,
        *,
        user_id: int,
        exercise_id: int,
        template_id: Optional[int],
        template_exercise_id: Optional[int],
    ) -> ProgressionScope:
        """Resolve the scope, falling back to the template's first matching slot."""
        if template_exercise_id is None and template_id is not None:
            slots = await self.repository.get_template_slots(template_id=int(template_id))
            template_exercise_id = resolve_slot_id(
                slots, template_id=int(template_id), exercise_id=int(exercise_id), occurrence=0
            )
        return self.build_scope(
            user_id=user_id,
            exercise_id=exercise_id,
            template_id=template_id,
            template_exercise_id=template_exercise_id,
        )

    @staticmethod
    def policy_chain_keys(scope: ProgressionScope) -> list[str]:
        """Deterministic policy fallback chain for a progression scope (SPEC §7).

        The slot's own policy always wins, so two program slots for the same
        exercise stay independent; a template-level or user-level policy is only
        used when the slot has none, which keeps configuration affordable for
        users without ever merging two slots' progression history.
        """
        keys = [scope.key]
        if scope.template_id is not None and scope.template_exercise_id is not None:
            keys.append(
                ProgressionScope(
                    user_id=scope.user_id,
                    exercise_id=scope.exercise_id,
                    template_id=scope.template_id,
                ).key
            )
        keys.append(
            ProgressionScope(user_id=scope.user_id, exercise_id=scope.exercise_id).key
        )
        return list(dict.fromkeys(keys))

    @staticmethod
    def prefill_scope_keys(scope: ProgressionScope) -> list[str]:
        """Scopes whose accepted target may prefill this slot, slot first (§7).

        Deliberately narrower than :meth:`policy_chain_keys`: the user-level
        ``user + exercise`` scope is *not* consulted, because the same exercise
        in two programs keeps two independent progression sequences. Only the
        slot's own scope (and its template scope, used when a session could not
        be resolved to a slot) may seed the next session.
        """
        keys = [scope.key]
        if scope.template_id is not None and scope.template_exercise_id is not None:
            keys.append(
                ProgressionScope(
                    user_id=scope.user_id,
                    exercise_id=scope.exercise_id,
                    template_id=scope.template_id,
                ).key
            )
        return keys

    @classmethod
    def pick_policy(
        cls,
        scope: ProgressionScope,
        policies: dict[str, ProgressionPolicyRecord],
    ) -> Optional[ProgressionPolicyRecord]:
        for key in cls.policy_chain_keys(scope):
            record = policies.get(key)
            if record is not None:
                return record
        return None

    async def resolve_policy_record(
        self, *, user_id: int, scope: ProgressionScope
    ) -> Optional[ProgressionPolicyRecord]:
        records = await self.repository.get_policies_by_keys(
            user_id=user_id, scope_keys=self.policy_chain_keys(scope)
        )
        return self.pick_policy(scope, records)

    def settings_from_record(
        self,
        record: Optional[ProgressionPolicyRecord],
        *,
        equipment: Sequence[str] = (),
        default_sets_target: Optional[int] = None,
    ) -> ExerciseProgressionSettings:
        """Merge a stored policy with engine defaults (never invents values)."""
        if record is None:
            # SPEC §30/§63: an unconfigured exercise stays MANUAL — the engine
            # never silently changes a program target.
            return ExerciseProgressionSettings(
                policy=ProgressionPolicy.MANUAL,
                policy_version=PolicyVersion.MANUAL_V1.value,
                sets_target=default_sets_target,
                increment_step=resolve_increment_step(equipment_codes=equipment),
            )

        policy = parse_policy_type(record.policy_type, ProgressionPolicy.MANUAL)
        increment = _to_float(record.increment)
        return ExerciseProgressionSettings(
            policy=policy,
            policy_version=record.policy_version
            or PolicyVersion.for_policy(policy).value,
            enabled=bool(record.enabled),
            increment=increment,
            min_value=_to_float(record.min_value),
            max_value=_to_float(record.max_value),
            reps_min=_to_int(record.reps_min),
            reps_max=_to_int(record.reps_max),
            sets_target=_to_int(record.sets_target) or default_sets_target,
            target_rpe=_to_float(record.target_rpe),
            target_rir=_to_float(record.target_rir),
            percent_1rm=_to_float(record.percent_1rm),
            time_increment_seconds=_to_int(record.time_increment_seconds),
            time_target_seconds=_to_int(record.time_target_seconds),
            time_priority=(
                TimePriority(str(record.time_priority)) if record.time_priority else None
            ),
            failure_threshold=_to_int(record.failure_threshold),
            deload_percent=_to_float(record.deload_percent),
            increment_step=resolve_increment_step(
                equipment_codes=equipment,
                explicit_step=_to_float(record.equipment_increment),
                policy_increment=increment,
            ),
            e1rm_max_reps=DEFAULT_E1RM_MAX_REPS,
        )

    def _policy_payload(
        self,
        record: ProgressionPolicyRecord,
        *,
        requested_scope: Optional[ProgressionScope] = None,
    ) -> dict[str, Any]:
        scope = requested_scope or ProgressionScope(
            user_id=int(record.user_id),
            exercise_id=int(record.exercise_id),
            template_id=_to_int(record.template_id),
            template_exercise_id=_to_int(record.template_exercise_id),
        )
        return {
            "id": int(record.id),
            "user_id": int(record.user_id),
            "exercise_id": int(record.exercise_id),
            "template_id": requested_scope.template_id
            if requested_scope is not None
            else _to_int(record.template_id),
            "template_exercise_id": requested_scope.template_exercise_id
            if requested_scope is not None
            else _to_int(record.template_exercise_id),
            "scope_key": scope.key,
            "policy_scope_key": record.scope_key,
            "type": record.policy_type,
            "policy_version": record.policy_version,
            "increment": _to_float(record.increment),
            "min_value": _to_float(record.min_value),
            "max_value": _to_float(record.max_value),
            "reps_min": _to_int(record.reps_min),
            "reps_max": _to_int(record.reps_max),
            "sets_target": _to_int(record.sets_target),
            "target_rpe": _to_float(record.target_rpe),
            "target_rir": _to_float(record.target_rir),
            "percent_1rm": _to_float(record.percent_1rm),
            "time_increment_seconds": _to_int(record.time_increment_seconds),
            "time_target_seconds": _to_int(record.time_target_seconds),
            "time_priority": record.time_priority,
            "failure_threshold": _to_int(record.failure_threshold),
            "deload_percent": _to_float(record.deload_percent),
            "equipment_increment": _to_float(record.equipment_increment),
            "enabled": bool(record.enabled),
        }

    def _default_policy_payload(self, scope: ProgressionScope) -> dict[str, Any]:
        """Effective defaults for a scope with no stored policy row."""
        return {
            "id": None,
            "user_id": scope.user_id,
            "exercise_id": scope.exercise_id,
            "template_id": scope.template_id,
            "template_exercise_id": scope.template_exercise_id,
            "scope_key": scope.key,
            "policy_scope_key": None,
            "type": ProgressionPolicy.MANUAL.value,
            "policy_version": PolicyVersion.MANUAL_V1.value,
            "increment": DEFAULT_INCREMENT,
            "min_value": None,
            "max_value": None,
            "reps_min": DEFAULT_REP_RANGE[0],
            "reps_max": DEFAULT_REP_RANGE[1],
            "sets_target": DEFAULT_SETS_TARGET,
            "target_rpe": None,
            "target_rir": None,
            "percent_1rm": None,
            "time_increment_seconds": None,
            "time_target_seconds": None,
            "time_priority": None,
            "failure_threshold": None,
            "deload_percent": None,
            "equipment_increment": None,
            "enabled": True,
        }

    # ─── read paths ─────────────────────────────────────────────────────────

    async def resolve_accepted_targets(
        self,
        *,
        user_id: int,
        template_id: Optional[int],
        exercises: Sequence[Any],
    ) -> dict[int, AcceptedProgressionTarget]:
        """Accepted next target per draft exercise, keyed by its list index.

        Used when a workout is started from a template (SPEC §58): the session
        then shows the accepted target (e.g. ``82.5 kg``) instead of the
        template's original weight, while the template itself stays untouched
        and any ``generated`` proposal is ignored (SPEC §42/§63/§64).
        """
        if template_id is None or not exercises:
            return {}
        slots = await self.repository.get_template_slots(template_id=int(template_id))
        keys_by_index: dict[int, list[str]] = {}
        exercise_id_by_index: dict[int, int] = {}
        occurrences: dict[int, int] = {}
        for index, exercise in enumerate(exercises):
            if not isinstance(exercise, dict):
                continue
            exercise_id = _to_int(exercise.get("exercise_id"))
            if exercise_id is None or exercise_id < 1:
                continue
            occurrence = occurrences.get(exercise_id, 0)
            occurrences[exercise_id] = occurrence + 1
            scope = self.build_scope(
                user_id=user_id,
                exercise_id=exercise_id,
                template_id=template_id,
                template_exercise_id=resolve_slot_id(
                    slots,
                    template_id=template_id,
                    exercise_id=exercise_id,
                    occurrence=occurrence,
                ),
            )
            exercise_id_by_index[index] = exercise_id
            keys_by_index.setdefault(index, []).extend(self.prefill_scope_keys(scope))
        if not keys_by_index:
            return {}

        records = await self.repository.latest_accepted_recommendations(
            user_id=user_id,
            scope_keys=[key for keys in keys_by_index.values() for key in keys],
        )
        targets: dict[int, AcceptedProgressionTarget] = {}
        for index, keys in keys_by_index.items():
            for key in keys:
                record = records.get(key)
                if record is None:
                    continue
                value = _to_float(record.actual_selected_value)
                if value is None or value <= 0:
                    continue
                is_timed = str(record.policy_type) == ProgressionPolicy.TIME_PROGRESSION.value
                target = AcceptedProgressionTarget(
                    recommendation_id=int(record.id),
                    scope_key=record.scope_key,
                    lifecycle_status=record.lifecycle_status,
                    policy=record.policy_type,
                    value=value,
                    weight=None if is_timed else float(value),
                    duration=int(round(value)) if is_timed else None,
                )
                targets[index] = target
                logger.info(
                    "progression_target_prefilled",
                    extra={
                        "event": "progression_target_prefilled",
                        "user_id": user_id,
                        "template_id": _to_int(template_id),
                        "exercise_id": exercise_id_by_index.get(index),
                        "recommendation_id": target.recommendation_id,
                        "scope_key": target.scope_key,
                        "lifecycle_status": target.lifecycle_status,
                        "policy": target.policy,
                        "value": target.value,
                    },
                )
                record_progression_metric("progression_recommendations_total", "prefilled")
                break
        return targets

    async def get_policy_view(
        self,
        *,
        user_id: int,
        exercise_id: int,
        template_id: Optional[int] = None,
        template_exercise_id: Optional[int] = None,
    ) -> dict[str, Any]:
        scope = await self.resolve_request_scope(
            user_id=user_id,
            exercise_id=exercise_id,
            template_id=template_id,
            template_exercise_id=template_exercise_id,
        )
        record = await self.resolve_policy_record(user_id=user_id, scope=scope)
        if record is None:
            return self._default_policy_payload(scope)
        return self._policy_payload(record, requested_scope=scope)

    async def get_recommendation_view(
        self,
        *,
        user_id: int,
        exercise_id: int,
        template_id: Optional[int] = None,
        template_exercise_id: Optional[int] = None,
    ) -> Optional[dict[str, Any]]:
        """Latest persisted recommendation; otherwise a read-only preview.

        SPEC §39: the backend is the source of truth for persisted results, but
        the UI may show a preview that is computed without writing anything.

        Without program context the newest recommendation for the exercise wins,
        so the Active Workout UI can ask for "the next target" without knowing
        which template slot the user is training.
        """
        if template_id is None and template_exercise_id is None:
            record = await self.repository.latest_recommendation_for_exercise(
                user_id=user_id, exercise_id=exercise_id
            )
            if record is not None:
                return await self._recommendation_payload(record, user_id=user_id)
            return await self.preview_recommendation(
                user_id=user_id, exercise_id=exercise_id
            )

        scope = await self.resolve_request_scope(
            user_id=user_id,
            exercise_id=exercise_id,
            template_id=template_id,
            template_exercise_id=template_exercise_id,
        )
        record = await self.repository.latest_recommendation(user_id=user_id, scope_key=scope.key)
        if record is not None:
            return await self._recommendation_payload(record, user_id=user_id)
        return await self.preview_recommendation(
            user_id=user_id,
            exercise_id=exercise_id,
            template_id=template_id,
            template_exercise_id=template_exercise_id,
        )

    async def preview_recommendation(
        self,
        *,
        user_id: int,
        exercise_id: int,
        template_id: Optional[int] = None,
        template_exercise_id: Optional[int] = None,
    ) -> Optional[dict[str, Any]]:
        history = await self.repository.list_exercise_history_batch(
            user_id=user_id, exercise_ids=[exercise_id], limit=HISTORY_LIMIT
        )
        sessions = history.get(int(exercise_id)) or []
        if not sessions:
            return None
        newest = sessions[0]
        resolved_scope = await self.resolve_request_scope(
            user_id=user_id,
            exercise_id=exercise_id,
            template_id=template_id if template_id is not None else newest.template_id,
            template_exercise_id=(
                template_exercise_id
                if template_exercise_id is not None
                else newest.template_exercise_id
            ),
        )
        record = await self.resolve_policy_record(user_id=user_id, scope=resolved_scope)
        equipment = (await self.repository.get_exercise_equipment([exercise_id])).get(
            int(exercise_id), []
        )
        settings = self.settings_from_record(
            record, equipment=equipment, default_sets_target=None
        )
        evaluation = evaluate_progression(
            policy=settings.policy,
            current_session=newest,
            previous_sessions=sessions[1:],
            settings=settings,
        )
        return self._preview_payload(
            evaluation,
            scope=resolved_scope,
            exercise_id=exercise_id,
            persisted=False,
        )

    async def list_history(
        self,
        *,
        user_id: int,
        exercise_id: int,
        template_id: Optional[int] = None,
        template_exercise_id: Optional[int] = None,
        limit: int = 20,
    ) -> list[dict[str, Any]]:
        if template_id is None and template_exercise_id is None:
            records = await self.repository.list_recommendations(
                user_id=user_id, exercise_id=exercise_id, limit=limit
            )
            return [self._recommendation_payload_sync(record) for record in records]
        scope = await self.resolve_request_scope(
            user_id=user_id,
            exercise_id=exercise_id,
            template_id=template_id,
            template_exercise_id=template_exercise_id,
        )
        records = await self.repository.list_recommendations(
            user_id=user_id, scope_key=scope.key, limit=limit
        )
        return [self._recommendation_payload_sync(record) for record in records]

    # ─── policy write ───────────────────────────────────────────────────────

    async def upsert_policy(
        self,
        *,
        user_id: int,
        exercise_id: int,
        template_id: Optional[int],
        template_exercise_id: Optional[int],
        data: dict[str, Any],
    ) -> dict[str, Any]:
        scope = await self.resolve_request_scope(
            user_id=user_id,
            exercise_id=exercise_id,
            template_id=template_id,
            template_exercise_id=template_exercise_id,
        )
        policy_type = parse_policy_type(data.get("type"), ProgressionPolicy.MANUAL)
        values = {
            "policy_type": policy_type.value,
            "policy_version": PolicyVersion.for_policy(policy_type).value,
            "enabled": bool(data.get("enabled", True)),
        }
        if "increment" in data and data["increment"] is not None:
            values["increment"] = data["increment"]
        if "min_value" in data:
            values["min_value"] = data["min_value"]
        if "max_value" in data:
            values["max_value"] = data["max_value"]
        if "reps_min" in data:
            values["reps_min"] = data["reps_min"]
        if "reps_max" in data:
            values["reps_max"] = data["reps_max"]
        if "sets_target" in data:
            values["sets_target"] = data["sets_target"]
        if "target_rpe" in data:
            values["target_rpe"] = data["target_rpe"]
        if "target_rir" in data:
            values["target_rir"] = data["target_rir"]
        if "percent_1rm" in data:
            values["percent_1rm"] = data["percent_1rm"]
        if "time_increment_seconds" in data:
            values["time_increment_seconds"] = data["time_increment_seconds"]
        if "time_target_seconds" in data:
            values["time_target_seconds"] = data["time_target_seconds"]
        if "time_priority" in data:
            values["time_priority"] = data["time_priority"]
        if "failure_threshold" in data:
            values["failure_threshold"] = data["failure_threshold"]
        if "deload_percent" in data:
            values["deload_percent"] = data["deload_percent"]
        if "equipment_increment" in data:
            values["equipment_increment"] = data["equipment_increment"]

        record = await self.repository.upsert_policy(
            user_id=user_id, scope=scope, values=values
        )
        logger.info(
            "progression_policy_saved",
            extra={
                "event": "progression_policy_saved",
                "user_id": user_id,
                "exercise_id": exercise_id,
                "scope_key": scope.key,
                "policy": values["policy_type"],
                "policy_version": values["policy_version"],
            },
        )
        return self._policy_payload(record)

    # ─── lifecycle ──────────────────────────────────────────────────────────

    async def accept_recommendation(
        self,
        *,
        user_id: int,
        recommendation_id: int,
        selected_value: Optional[float] = None,
    ) -> tuple[bool, dict[str, Any]]:
        record = await self.repository.get_recommendation(
            user_id=user_id, recommendation_id=recommendation_id
        )
        if record is None:
            return False, {}
        recommended = _to_float(record.recommended_value)
        chosen = selected_value if selected_value is not None else recommended

        if chosen is not None and recommended is not None and abs(chosen - recommended) > 1e-9:
            lifecycle = RecommendationLifecycle.MODIFIED
        elif chosen is not None and recommended is None:
            lifecycle = RecommendationLifecycle.MODIFIED
        else:
            lifecycle = RecommendationLifecycle.ACCEPTED

        record = await self.repository.update_recommendation_lifecycle(
            record=record,
            lifecycle_status=lifecycle.value,
            actual_selected_value=chosen,
        )
        event = (
            "recommendation_modified" if lifecycle is RecommendationLifecycle.MODIFIED
            else "recommendation_accepted"
        )
        logger.info(
            event,
            extra={
                "event": event,
                "user_id": user_id,
                "recommendation_id": int(record.id),
                "exercise_id": int(record.exercise_id),
                "scope_key": record.scope_key,
                "recommended_value": recommended,
                "actual_selected_value": chosen,
            },
        )
        record_progression_metric("progression_recommendations_total", lifecycle.value)
        return True, self._recommendation_payload_sync(record)

    async def reject_recommendation(
        self, *, user_id: int, recommendation_id: int
    ) -> tuple[bool, dict[str, Any]]:
        record = await self.repository.get_recommendation(
            user_id=user_id, recommendation_id=recommendation_id
        )
        if record is None:
            return False, {}
        record = await self.repository.update_recommendation_lifecycle(
            record=record,
            lifecycle_status=RecommendationLifecycle.REJECTED.value,
            actual_selected_value=None,
        )
        logger.info(
            "recommendation_rejected",
            extra={
                "event": "recommendation_rejected",
                "user_id": user_id,
                "recommendation_id": int(record.id),
                "exercise_id": int(record.exercise_id),
                "scope_key": record.scope_key,
            },
        )
        record_progression_metric("progression_recommendations_total", "rejected")
        return True, self._recommendation_payload_sync(record)

    # ─── evaluation of a finished session ────────────────────────────────────

    async def evaluate_finished_session(
        self,
        *,
        user_id: int,
        workout: WorkoutLog,
        exercises_payload: Optional[list[dict]] = None,
    ) -> list[dict[str, Any]]:
        """Generate (and persist) next targets for a completed session.

        Called after ``Complete Workout`` (SPEC §40). Skipped exercises are
        ignored, cancelled sessions never reach this method, and repeated calls
        are idempotent (SPEC §38).
        """
        payload = exercises_payload if exercises_payload is not None else (workout.exercises or [])
        candidates = self._session_candidates(payload)
        if not candidates:
            return []

        exercise_ids = [item["exercise_id"] for item in candidates]
        template_id = _to_int(workout.template_id)
        slot_index = (
            await self.repository.get_template_slots(template_id=template_id)
            if template_id is not None
            else {}
        )
        history = await self.repository.list_exercise_history_batch(
            user_id=user_id,
            exercise_ids=exercise_ids,
            limit=HISTORY_LIMIT,
            exclude_session_ids=[int(workout.id)],
        )
        equipment_map = await self.repository.get_exercise_equipment(exercise_ids)
        recovery_warning = await self._recovery_warning(user_id=user_id)
        # One batched policy lookup for every scope chain (no per-exercise N+1).
        chain_keys: list[str] = []
        for candidate in candidates:
            scope = self.build_scope(
                user_id=user_id,
                exercise_id=int(candidate["exercise_id"]),
                template_id=template_id,
                template_exercise_id=resolve_slot_id(
                    slot_index,
                    template_id=template_id,
                    exercise_id=int(candidate["exercise_id"]),
                    occurrence=candidate["occurrence"],
                ),
            )
            candidate["scope"] = scope
            chain_keys.extend(self.policy_chain_keys(scope))
        policies = await self.repository.get_policies_by_keys(
            user_id=user_id, scope_keys=chain_keys
        )

        recommendations: list[dict[str, Any]] = []
        for candidate in candidates:
            try:
                recommendations.append(
                    await self._evaluate_candidate(
                        user_id=user_id,
                        workout=workout,
                        candidate=candidate,
                        slot_index=slot_index,
                        history=history,
                        equipment_map=equipment_map,
                        template_id=template_id,
                        recovery_warning=recovery_warning,
                        policies=policies,
                    )
                )
            except Exception:  # pragma: no cover - never break workout completion
                logger.exception(
                    "progression_evaluation_failed",
                    extra={
                        "event": "progression_evaluation_failed",
                        "user_id": user_id,
                        "session_id": int(workout.id),
                        "exercise_id": candidate["exercise_id"],
                    },
                )
                record_progression_metric("progression_errors_total", "evaluation")
        return recommendations

    async def _evaluate_candidate(
        self,
        *,
        user_id: int,
        workout: WorkoutLog,
        candidate: dict[str, Any],
        slot_index: dict,
        history: dict[int, list[ExerciseSessionRecord]],
        equipment_map: dict[int, list[str]],
        template_id: Optional[int],
        recovery_warning: Optional[str],
        policies: dict[str, ProgressionPolicyRecord],
    ) -> dict[str, Any]:
        exercise_id = int(candidate["exercise_id"])
        slot_id = resolve_slot_id(
            slot_index,
            template_id=template_id,
            exercise_id=exercise_id,
            occurrence=candidate["occurrence"],
        )
        scope = candidate.get("scope") or self.build_scope(
            user_id=user_id,
            exercise_id=exercise_id,
            template_id=template_id,
            template_exercise_id=slot_id,
        )
        policy_record = self.pick_policy(scope, policies)
        settings = self.settings_from_record(
            policy_record,
            equipment=equipment_map.get(exercise_id, []),
            default_sets_target=resolve_slot_sets(
                slot_index,
                template_id=template_id,
                exercise_id=exercise_id,
                occurrence=candidate["occurrence"],
            ),
        )

        current_session = ExerciseSessionRecord(
            session_id=int(workout.id),
            session_date=workout.date,
            status=str(workout.status or "completed"),
            skipped=False,
            sets=normalize_sets(candidate["sets"]),
            template_id=template_id,
            template_exercise_id=slot_id,
        )
        previous_sessions = [
            session
            for session in (history.get(exercise_id) or [])
            if session.session_id != current_session.session_id
        ][:HISTORY_LIMIT]

        evaluation = evaluate_progression(
            policy=settings.policy,
            current_session=current_session,
            previous_sessions=previous_sessions,
            settings=settings,
        )

        logger.info(
            "progression_evaluated",
            extra={
                "event": "progression_evaluated",
                "user_id": user_id,
                "exercise_id": exercise_id,
                "scope_key": scope.key,
                "policy": evaluation.policy.value,
                "policy_version": evaluation.policy_version,
                "status": evaluation.status.value,
                "reason_code": evaluation.reason_code,
                "confidence": evaluation.confidence,
            },
        )
        record_progression_metric("progression_evaluations_total", evaluation.status.value)

        payload = {
            "user_id": user_id,
            "exercise_id": exercise_id,
            "template_id": template_id,
            "template_exercise_id": slot_id,
            "scope_key": scope.key,
            "policy_id": int(policy_record.id) if policy_record is not None else None,
            "policy_type": evaluation.policy.value,
            "policy_version": evaluation.policy_version,
            "status": evaluation.status.value,
            "lifecycle_status": RecommendationLifecycle.GENERATED.value,
            "previous_value": evaluation.previous_value,
            "recommended_value": evaluation.recommended_value,
            "difference": evaluation.difference,
            "previous_reps": evaluation.previous_reps,
            "recommended_reps": evaluation.recommended_reps,
            "previous_duration": evaluation.previous_duration,
            "recommended_duration": evaluation.recommended_duration,
            "reason_code": evaluation.reason_code,
            "reason_text": evaluation.reason_text,
            "confidence": evaluation.confidence,
            "failure_streak": evaluation.failure_streak,
            "source_session_id": evaluation.source_session_id or int(workout.id),
        }
        record, created = await self.repository.create_recommendation(payload)
        if created:
            if evaluation.status is RecommendationStatus.DELOAD:
                logger.info(
                    "deload_recommended",
                    extra={
                        "event": "deload_recommended",
                        "user_id": user_id,
                        "exercise_id": exercise_id,
                        "scope_key": scope.key,
                        "recommended_value": evaluation.recommended_value,
                        "failure_streak": evaluation.failure_streak,
                    },
                )
                record_progression_metric("progression_deloads_total", "deload")
            logger.info(
                "recommendation_created",
                extra={
                    "event": "recommendation_created",
                    "user_id": user_id,
                    "recommendation_id": int(record.id),
                    "exercise_id": exercise_id,
                    "scope_key": scope.key,
                    "status": evaluation.status.value,
                    "policy_version": evaluation.policy_version,
                },
            )
            record_progression_metric("progression_recommendations_total", "created")
        return self._recommendation_payload_sync(
            record,
            exercise_name=candidate.get("name"),
            scope=scope,
            recovery_warning=recovery_warning if created else None,
            idempotent_replay=not created,
            recommended_reps_range=(settings.resolved_reps_min, settings.resolved_reps_max)
            if settings.policy
            in {
                ProgressionPolicy.LINEAR,
                ProgressionPolicy.DOUBLE_PROGRESSION,
                ProgressionPolicy.RPE_BASED,
                ProgressionPolicy.RIR_BASED,
                ProgressionPolicy.PERCENT_1RM,
            }
            else None,
        )

    @staticmethod
    def _session_candidates(payload: Iterable[dict]) -> list[dict[str, Any]]:
        """Exercises eligible for progression (skipped ones are ignored, §32)."""
        candidates: list[dict[str, Any]] = []
        occurrences: dict[int, int] = {}
        for exercise in payload or ():
            if not isinstance(exercise, dict):
                continue
            if str(exercise.get("status") or "") == "skipped":
                continue
            exercise_id = _to_int(exercise.get("exercise_id"))
            if exercise_id is None or exercise_id < 1:
                continue
            occurrence = occurrences.get(exercise_id, 0)
            occurrences[exercise_id] = occurrence + 1
            sets = exercise.get("sets_completed")
            candidates.append(
                {
                    "exercise_id": exercise_id,
                    "name": exercise.get("name"),
                    "occurrence": occurrence,
                    "sets": sets if isinstance(sets, list) else [],
                }
            )
        return candidates

    async def _recovery_warning(self, *, user_id: int) -> Optional[str]:
        """SPEC §34: recovery is advisory in the UI, never a recommendation input."""
        try:
            result = await self.repository.db.execute(
                select(RecoveryState.readiness_score).where(RecoveryState.user_id == user_id)
            )
            readiness = result.scalar_one_or_none()
        except Exception:  # pragma: no cover - advisory data must never block
            return None
        score = _to_float(readiness)
        if score is None or score >= RECOVERY_WARNING_READINESS:
            return None
        return (
            f"Готовность организма {score:.0f}% — рекомендация не изменена, "
            "но стоит учесть восстановление."
        )

    # ─── payload mappers ────────────────────────────────────────────────────

    def _preview_payload(
        self,
        evaluation: ProgressionEvaluation,
        *,
        scope: ProgressionScope,
        exercise_id: int,
        persisted: bool,
    ) -> dict[str, Any]:
        payload = evaluation.as_dict()
        payload.update(
            {
                "id": None,
                "exercise_id": exercise_id,
                "scope_key": scope.key,
                "template_id": scope.template_id,
                "template_exercise_id": scope.template_exercise_id,
                "lifecycle_status": RecommendationLifecycle.GENERATED.value,
                "actual_selected_value": None,
                "failure_streak": evaluation.failure_streak,
                "persisted": persisted,
            }
        )
        return payload

    def _recommendation_payload_sync(
        self,
        record: ProgressionRecommendationRecord,
        *,
        exercise_name: Optional[str] = None,
        scope: Optional[ProgressionScope] = None,
        recovery_warning: Optional[str] = None,
        idempotent_replay: bool = False,
        recommended_reps_range: Optional[tuple[int, int]] = None,
    ) -> dict[str, Any]:
        payload = {
            "id": int(record.id),
            "exercise_id": int(record.exercise_id),
            "exercise_name": exercise_name,
            "scope_key": scope.key if scope is not None else record.scope_key,
            "template_id": _to_int(record.template_id),
            "template_exercise_id": _to_int(record.template_exercise_id),
            "policy": record.policy_type,
            "policy_version": record.policy_version,
            "status": record.status,
            "lifecycle_status": record.lifecycle_status,
            "previous_value": _to_float(record.previous_value),
            "recommended_value": _to_float(record.recommended_value),
            "actual_selected_value": _to_float(record.actual_selected_value),
            "difference": _to_float(record.difference),
            "previous_reps": _to_int(record.previous_reps),
            "recommended_reps": _to_int(record.recommended_reps),
            "previous_duration": _to_int(record.previous_duration),
            "recommended_duration": _to_int(record.recommended_duration),
            "reason_code": record.reason_code,
            "reason_text": record.reason_text,
            "confidence": record.confidence,
            "failure_streak": int(record.failure_streak or 0),
            "source_session_id": _to_int(record.source_session_id),
            "created_at": record.created_at,
            "persisted": True,
            "idempotent_replay": idempotent_replay,
            "recovery_warning": recovery_warning,
            "reps_min": recommended_reps_range[0] if recommended_reps_range else None,
            "reps_max": recommended_reps_range[1] if recommended_reps_range else None,
        }
        if scope is not None:
            payload["template_id"] = scope.template_id
            payload["template_exercise_id"] = scope.template_exercise_id
        return payload

    async def _recommendation_payload(
        self, record: ProgressionRecommendationRecord, *, user_id: int
    ) -> dict[str, Any]:
        warning = await self._recovery_warning(user_id=user_id)
        scope = self.build_scope(
            user_id=user_id,
            exercise_id=int(record.exercise_id),
            template_id=_to_int(record.template_id),
            template_exercise_id=_to_int(record.template_exercise_id),
        )
        policy = await self.resolve_policy_record(user_id=user_id, scope=scope)
        settings = self.settings_from_record(
            policy,
            equipment=(await self.repository.get_exercise_equipment([record.exercise_id])).get(
                int(record.exercise_id), []
            ),
        )
        return self._recommendation_payload_sync(
            record,
            scope=scope,
            recovery_warning=warning,
            recommended_reps_range=(settings.resolved_reps_min, settings.resolved_reps_max),
        )


def is_manual_scope(settings: ExerciseProgressionSettings) -> bool:
    """True when the engine will not compute anything for this scope."""
    return settings.policy is ProgressionPolicy.MANUAL


def insufficient_reason_codes() -> set[str]:
    return {
        ReasonCode.NO_PREVIOUS_HISTORY.value,
        ReasonCode.INSUFFICIENT_RPE_DATA.value,
        ReasonCode.INSUFFICIENT_RIR_DATA.value,
    }
