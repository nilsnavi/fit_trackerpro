"""Persistence for SPEC-006 progression policies and recommendations.

Data-access rules honoured here (SPEC §61–§62):

* history is fetched with a bounded, per-exercise limit — never the user's whole
  workout log;
* a batch call loads every exercise of a finished session with a fixed number of
  queries (no per-exercise / per-set N+1);
* scope resolution (``user + template + exercise + template slot``) happens in
  Python over already-loaded rows, since the legacy template payload has no slot
  ids; the deterministic slot order makes it reproducible.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Iterable, Optional, Sequence

from sqlalchemy import and_, desc, func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from app.domain.exercise import Exercise
from app.domain.progression.types import (
    ExerciseSessionRecord,
    ProgressionScope,
    normalize_sets,
)
from app.domain.progression_policy import ProgressionPolicyRecord
from app.domain.progression_recommendation import ProgressionRecommendationRecord
from app.domain.template_exercise import TemplateExercise
from app.domain.workout_log import WorkoutLog
from app.domain.workout_session_exercise import WorkoutSessionExercise
from app.infrastructure.repositories.base import SQLAlchemyRepository

# Hard cap on sessions scanned per user when building exercise history.
HISTORY_SESSION_SCAN_LIMIT = 200
DEFAULT_HISTORY_LIMIT = 10

# SPEC §42/§43: only an explicit user decision may become a next target.
ACCEPTED_LIFECYCLES: tuple[str, ...] = ("accepted", "modified")


class ProgressionRepository(SQLAlchemyRepository):
    # ─── policies ───────────────────────────────────────────────────────────

    async def get_policy(
        self, *, user_id: int, scope_key: str
    ) -> Optional[ProgressionPolicyRecord]:
        result = await self.db.execute(
            select(ProgressionPolicyRecord)
            .where(
                and_(
                    ProgressionPolicyRecord.user_id == user_id,
                    ProgressionPolicyRecord.scope_key == scope_key,
                )
            )
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def get_policies_by_keys(
        self, *, user_id: int, scope_keys: Sequence[str]
    ) -> dict[str, ProgressionPolicyRecord]:
        """Batch lookup for the policy fallback chain (one query per evaluation)."""
        keys = [key for key in dict.fromkeys(scope_keys) if key]
        if not keys:
            return {}
        result = await self.db.execute(
            select(ProgressionPolicyRecord).where(
                and_(
                    ProgressionPolicyRecord.user_id == user_id,
                    ProgressionPolicyRecord.scope_key.in_(keys),
                )
            )
        )
        return {record.scope_key: record for record in result.scalars().all()}

    async def get_policy_by_id(
        self, *, user_id: int, policy_id: int
    ) -> Optional[ProgressionPolicyRecord]:
        result = await self.db.execute(
            select(ProgressionPolicyRecord)
            .where(
                and_(
                    ProgressionPolicyRecord.id == policy_id,
                    ProgressionPolicyRecord.user_id == user_id,
                )
            )
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def list_policies(
        self,
        *,
        user_id: int,
        exercise_id: Optional[int] = None,
        template_id: Optional[int] = None,
    ) -> list[ProgressionPolicyRecord]:
        conditions = [ProgressionPolicyRecord.user_id == user_id]
        if exercise_id is not None:
            conditions.append(ProgressionPolicyRecord.exercise_id == exercise_id)
        if template_id is not None:
            conditions.append(ProgressionPolicyRecord.template_id == template_id)
        result = await self.db.execute(
            select(ProgressionPolicyRecord)
            .where(and_(*conditions))
            .order_by(desc(ProgressionPolicyRecord.updated_at))
        )
        return list(result.scalars().all())

    async def upsert_policy(
        self,
        *,
        user_id: int,
        scope: ProgressionScope,
        values: dict,
    ) -> ProgressionPolicyRecord:
        """Create or replace the single policy row for one progression scope."""
        record = await self.get_policy(user_id=user_id, scope_key=scope.key)
        if record is None:
            record = ProgressionPolicyRecord(
                user_id=user_id,
                exercise_id=scope.exercise_id,
                template_id=scope.template_id,
                template_exercise_id=scope.template_exercise_id,
                scope_key=scope.key,
            )
            self.add(record)
        for field, value in values.items():
            setattr(record, field, value)
        try:
            await self.commit()
        except IntegrityError:
            # Concurrent first write for the same scope: re-read and update.
            await self.rollback()
            record = await self.get_policy(user_id=user_id, scope_key=scope.key)
            if record is None:
                raise
            for field, value in values.items():
                setattr(record, field, value)
            await self.commit()
        await self.refresh(record)
        return record

    async def delete_policy(self, record: ProgressionPolicyRecord) -> None:
        await self.delete(record)
        await self.commit()

    # ─── recommendations ────────────────────────────────────────────────────

    async def get_recommendation(
        self, *, user_id: int, recommendation_id: int
    ) -> Optional[ProgressionRecommendationRecord]:
        result = await self.db.execute(
            select(ProgressionRecommendationRecord)
            .where(
                and_(
                    ProgressionRecommendationRecord.id == recommendation_id,
                    ProgressionRecommendationRecord.user_id == user_id,
                )
            )
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def get_recommendation_by_key(
        self,
        *,
        source_session_id: int,
        scope_key: str,
        policy_version: str,
    ) -> Optional[ProgressionRecommendationRecord]:
        result = await self.db.execute(
            select(ProgressionRecommendationRecord)
            .where(
                and_(
                    ProgressionRecommendationRecord.source_session_id == source_session_id,
                    ProgressionRecommendationRecord.scope_key == scope_key,
                    ProgressionRecommendationRecord.policy_version == policy_version,
                )
            )
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def latest_accepted_recommendations(
        self, *, user_id: int, scope_keys: Sequence[str]
    ) -> dict[str, ProgressionRecommendationRecord]:
        """Newest *accepted/modified* target per progression scope (SPEC §42/§43).

        ``generated`` recommendations are deliberately excluded: a proposal may
        prefill a session only after the user accepted (or modified) it. So are
        declined ones — undoing a prefill switches it off until a newer target is
        accepted (SPEC §58). One query with a window function keeps this bounded
        by the requested scopes instead of scanning the user's whole
        recommendation history.
        """
        keys = [key for key in dict.fromkeys(scope_keys) if key]
        if not keys:
            return {}
        ranked = (
            select(
                ProgressionRecommendationRecord.id.label("recommendation_id"),
                func.row_number()
                .over(
                    partition_by=ProgressionRecommendationRecord.scope_key,
                    order_by=(
                        ProgressionRecommendationRecord.created_at.desc(),
                        ProgressionRecommendationRecord.id.desc(),
                    ),
                )
                .label("scope_rank"),
            )
            .where(
                and_(
                    ProgressionRecommendationRecord.user_id == user_id,
                    ProgressionRecommendationRecord.scope_key.in_(keys),
                    ProgressionRecommendationRecord.lifecycle_status.in_(ACCEPTED_LIFECYCLES),
                    ProgressionRecommendationRecord.actual_selected_value.is_not(None),
                    ProgressionRecommendationRecord.prefill_declined_at.is_(None),
                )
            )
            .subquery()
        )
        result = await self.db.execute(
            select(ProgressionRecommendationRecord).join(
                ranked,
                ProgressionRecommendationRecord.id == ranked.c.recommendation_id,
            ).where(ranked.c.scope_rank == 1)
        )
        return {record.scope_key: record for record in result.scalars().all()}

    async def latest_recommendation_for_exercise(
        self, *, user_id: int, exercise_id: int
    ) -> Optional[ProgressionRecommendationRecord]:
        """Newest recommendation for an exercise across all its scopes.

        Used when a caller does not know (or does not send) the program context,
        e.g. the Active Workout UI opened without a template id.
        """
        result = await self.db.execute(
            select(ProgressionRecommendationRecord)
            .where(
                and_(
                    ProgressionRecommendationRecord.user_id == user_id,
                    ProgressionRecommendationRecord.exercise_id == exercise_id,
                )
            )
            .order_by(
                desc(ProgressionRecommendationRecord.created_at),
                desc(ProgressionRecommendationRecord.id),
            )
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def latest_recommendation(
        self, *, user_id: int, scope_key: str
    ) -> Optional[ProgressionRecommendationRecord]:
        result = await self.db.execute(
            select(ProgressionRecommendationRecord)
            .where(
                and_(
                    ProgressionRecommendationRecord.user_id == user_id,
                    ProgressionRecommendationRecord.scope_key == scope_key,
                )
            )
            .order_by(desc(ProgressionRecommendationRecord.created_at),
                      desc(ProgressionRecommendationRecord.id))
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def list_recommendations(
        self,
        *,
        user_id: int,
        scope_key: Optional[str] = None,
        exercise_id: Optional[int] = None,
        limit: int = 20,
    ) -> list[ProgressionRecommendationRecord]:
        conditions = [ProgressionRecommendationRecord.user_id == user_id]
        if scope_key is not None:
            conditions.append(ProgressionRecommendationRecord.scope_key == scope_key)
        if exercise_id is not None:
            conditions.append(ProgressionRecommendationRecord.exercise_id == exercise_id)
        result = await self.db.execute(
            select(ProgressionRecommendationRecord)
            .where(and_(*conditions))
            .order_by(desc(ProgressionRecommendationRecord.created_at),
                      desc(ProgressionRecommendationRecord.id))
            .limit(max(1, min(limit, 100)))
        )
        return list(result.scalars().all())

    async def create_recommendation(
        self, payload: dict
    ) -> tuple[ProgressionRecommendationRecord, bool]:
        """Idempotent insert; returns ``(record, created)`` (SPEC §38/§52)."""
        source_session_id = payload.get("source_session_id")
        if source_session_id is not None:
            existing = await self.get_recommendation_by_key(
                source_session_id=int(source_session_id),
                scope_key=str(payload["scope_key"]),
                policy_version=str(payload["policy_version"]),
            )
            if existing is not None:
                return existing, False
        record = ProgressionRecommendationRecord(**payload)
        self.add(record)
        try:
            await self.commit()
        except IntegrityError:
            # Lost a race with a concurrent evaluation of the same session.
            await self.rollback()
            existing = await self.get_recommendation_by_key(
                source_session_id=int(source_session_id),
                scope_key=str(payload["scope_key"]),
                policy_version=str(payload["policy_version"]),
            )
            if existing is None:
                raise
            return existing, False
        await self.refresh(record)
        return record, True

    async def update_recommendation_lifecycle(
        self,
        *,
        record: ProgressionRecommendationRecord,
        lifecycle_status: str,
        actual_selected_value: Optional[float],
        difference: Optional[float] = None,
    ) -> ProgressionRecommendationRecord:
        """Lifecycle transitions never touch workout history (SPEC §42–§44)."""
        record.lifecycle_status = lifecycle_status
        if actual_selected_value is not None:
            record.actual_selected_value = actual_selected_value
        # Editing the target moves the goal itself, so the stored delta follows
        # the edited value instead of the proposal it was computed from.
        if difference is not None:
            record.difference = difference
        record.decided_at = datetime.now(timezone.utc)
        await self.commit()
        await self.refresh(record)
        return record

    async def decline_prefill(
        self, *, user_id: int, recommendation_ids: Sequence[int]
    ) -> int:
        """Switch off the automatic prefill of these accepted targets (SPEC §58).

        The lifecycle is left untouched — the target is still the agreed next
        number, it is only no longer substituted silently. Idempotent: already
        declined records are counted but not rewritten.
        """
        ids = [int(value) for value in dict.fromkeys(recommendation_ids) if value]
        if not ids:
            return 0
        result = await self.db.execute(
            update(ProgressionRecommendationRecord)
            .where(
                and_(
                    ProgressionRecommendationRecord.user_id == user_id,
                    ProgressionRecommendationRecord.id.in_(ids),
                    ProgressionRecommendationRecord.prefill_declined_at.is_(None),
                )
            )
            .values(prefill_declined_at=datetime.now(timezone.utc))
        )
        await self.commit()
        return int(result.rowcount or 0)

    async def enable_prefill(
        self, *, user_id: int, recommendation_id: int
    ) -> Optional[ProgressionRecommendationRecord]:
        """Turn an accepted target's automatic prefill back on (SPEC §58)."""
        record = await self.get_recommendation(
            user_id=user_id, recommendation_id=recommendation_id
        )
        if record is None:
            return None
        if record.prefill_declined_at is not None:
            record.prefill_declined_at = None
            await self.commit()
            await self.refresh(record)
        return record

    async def disable_prefill(
        self, *, user_id: int, recommendation_id: int
    ) -> Optional[ProgressionRecommendationRecord]:
        """Switch one accepted target's automatic prefill off (SPEC §58).

        The lifecycle is left untouched — this is a display/substitution choice,
        not a rejection: the target keeps being the agreed next number and stays
        visible in the UI. Idempotent, so a repeated toggle does not rewrite the
        timestamp and muddies "when was this switched off".
        """
        record = await self.get_recommendation(
            user_id=user_id, recommendation_id=recommendation_id
        )
        if record is None:
            return None
        if record.prefill_declined_at is None:
            record.prefill_declined_at = datetime.now(timezone.utc)
            await self.commit()
            await self.refresh(record)
        return record

    async def latest_targets(
        self,
        *,
        user_id: int,
        declined_only: bool = False,
        limit: int = 50,
    ) -> list[ProgressionRecommendationRecord]:
        """Newest accepted/modified target per scope, newest scopes first.

        Ranking happens inside each scope *before* any prefill filter, so a scope
        whose newest target was declined is reported as declined instead of
        resurfacing an older, still-prefilling record (SPEC §58). Bounded by
        ``limit`` — one row per scope, never the whole recommendation history.
        """
        ranked = (
            select(
                ProgressionRecommendationRecord.id.label("recommendation_id"),
                func.row_number()
                .over(
                    partition_by=ProgressionRecommendationRecord.scope_key,
                    order_by=(
                        ProgressionRecommendationRecord.created_at.desc(),
                        ProgressionRecommendationRecord.id.desc(),
                    ),
                )
                .label("scope_rank"),
            )
            .where(
                and_(
                    ProgressionRecommendationRecord.user_id == user_id,
                    ProgressionRecommendationRecord.lifecycle_status.in_(ACCEPTED_LIFECYCLES),
                    ProgressionRecommendationRecord.actual_selected_value.is_not(None),
                )
            )
            .subquery()
        )
        query = (
            select(ProgressionRecommendationRecord)
            .join(
                ranked,
                ProgressionRecommendationRecord.id == ranked.c.recommendation_id,
            )
            .where(ranked.c.scope_rank == 1)
        )
        if declined_only:
            query = query.where(ProgressionRecommendationRecord.prefill_declined_at.is_not(None))
        result = await self.db.execute(
            query.order_by(
                ProgressionRecommendationRecord.created_at.desc(),
                ProgressionRecommendationRecord.id.desc(),
            ).limit(int(limit))
        )
        return list(result.scalars().all())

    async def targets_by_ids(
        self, *, user_id: int, recommendation_ids: Sequence[int]
    ) -> list[ProgressionRecommendationRecord]:
        """Accepted targets among these ids (one query, user-scoped).

        Used by the bulk actions of the settings screen: only ``accepted`` /
        ``modified`` records carrying a chosen value count as targets, so a bulk
        call can never reach a superseded or rejected recommendation. Foreign or
        unknown ids simply do not come back.
        """
        ids = [int(value) for value in dict.fromkeys(recommendation_ids) if value]
        if not ids:
            return []
        result = await self.db.execute(
            select(ProgressionRecommendationRecord).where(
                and_(
                    ProgressionRecommendationRecord.user_id == user_id,
                    ProgressionRecommendationRecord.id.in_(ids),
                    ProgressionRecommendationRecord.lifecycle_status.in_(ACCEPTED_LIFECYCLES),
                    ProgressionRecommendationRecord.actual_selected_value.is_not(None),
                )
            )
        )
        return list(result.scalars().all())

    # ─── history (bounded + batched) ────────────────────────────────────────

    async def get_exercise_names(self, exercise_ids: Iterable[int]) -> dict[int, str]:
        """Display names for a batch of exercises, one query (no N+1)."""
        ids = {int(value) for value in exercise_ids}
        if not ids:
            return {}
        result = await self.db.execute(
            select(Exercise.id, Exercise.name).where(Exercise.id.in_(ids))
        )
        return {int(row[0]): str(row[1]) for row in result.all()}

    async def get_exercise_equipment(self, exercise_ids: Iterable[int]) -> dict[int, list[str]]:
        ids = {int(value) for value in exercise_ids}
        if not ids:
            return {}
        result = await self.db.execute(
            select(Exercise.id, Exercise.equipment).where(Exercise.id.in_(ids))
        )
        return {int(row[0]): list(row[1] or []) for row in result.all()}

    async def list_exercise_history_batch(
        self,
        *,
        user_id: int,
        exercise_ids: Sequence[int],
        limit: int = DEFAULT_HISTORY_LIMIT,
        exclude_session_ids: Optional[Iterable[int]] = None,
    ) -> dict[int, list[ExerciseSessionRecord]]:
        """Newest-first per-exercise history with a fixed number of queries."""
        wanted = {int(value) for value in exercise_ids}
        if not wanted:
            return {}
        excluded = {int(value) for value in (exclude_session_ids or ())}

        session_rows = await self._load_completed_sessions(user_id=user_id, exclude=excluded)
        if not session_rows:
            return {exercise_id: [] for exercise_id in wanted}

        session_ids = [int(row.id) for row in session_rows]
        exercises_by_session = await self._load_session_exercises(
            user_id=user_id, session_ids=session_ids, exercise_ids=wanted
        )
        slot_index: dict[tuple[int, int], list[tuple[int, Optional[int]]]] = {}
        for template_id in {row.template_id for row in session_rows if row.template_id is not None}:
            slot_index.update(await self.get_template_slots(template_id=int(template_id)))

        history: dict[int, list[ExerciseSessionRecord]] = {exercise_id: [] for exercise_id in wanted}
        for session in session_rows:
            rows = exercises_by_session.get(int(session.id), [])
            if not rows:
                continue
            occurrences: dict[int, int] = {}
            for row in sorted(rows, key=lambda item: (item.order_index, item.id)):
                exercise_id = int(row.exercise_id)
                if exercise_id not in wanted:
                    continue
                occurrence = occurrences.get(exercise_id, 0)
                occurrences[exercise_id] = occurrence + 1
                if len(history[exercise_id]) >= limit:
                    continue
                slot_id = row.source_template_exercise_id or resolve_slot_id(
                    slot_index,
                    template_id=session.template_id,
                    exercise_id=exercise_id,
                    occurrence=occurrence,
                )
                history[exercise_id].append(
                    ExerciseSessionRecord(
                        session_id=int(session.id),
                        session_date=session.date,
                        status=str(session.status or "completed"),
                        skipped=str(row.status or "") == "skipped",
                        sets=normalize_sets(row.sets),
                        template_id=int(session.template_id)
                        if session.template_id is not None
                        else None,
                        template_exercise_id=int(slot_id) if slot_id is not None else None,
                    )
                )
        return history

    async def _load_completed_sessions(
        self, *, user_id: int, exclude: set[int]
    ) -> list:
        result = await self.db.execute(
            select(
                WorkoutLog.id,
                WorkoutLog.date,
                WorkoutLog.status,
                WorkoutLog.template_id,
            )
            .where(
                and_(
                    WorkoutLog.user_id == user_id,
                    WorkoutLog.status == "completed",
                )
            )
            .order_by(desc(WorkoutLog.date), desc(WorkoutLog.id))
            .limit(HISTORY_SESSION_SCAN_LIMIT)
        )
        return [row for row in result.all() if int(row.id) not in exclude]

    async def _load_session_exercises(
        self, *, user_id: int, session_ids: Sequence[int], exercise_ids: set[int]
    ) -> dict[int, list[WorkoutSessionExercise]]:
        result = await self.db.execute(
            select(WorkoutSessionExercise)
            .options(selectinload(WorkoutSessionExercise.sets))
            .where(
                and_(
                    WorkoutSessionExercise.user_id == user_id,
                    WorkoutSessionExercise.workout_session_id.in_(session_ids),
                    WorkoutSessionExercise.exercise_id.in_(exercise_ids),
                )
            )
            .order_by(WorkoutSessionExercise.order_index, WorkoutSessionExercise.id)
        )
        grouped: dict[int, list[WorkoutSessionExercise]] = {}
        for row in result.scalars().all():
            grouped.setdefault(int(row.workout_session_id), []).append(row)
        return grouped

    async def get_template_slots(
        self, *, template_id: int
    ) -> dict[tuple[int, int], list[tuple[int, Optional[int]]]]:
        """Template slots keyed by (template_id, exercise_id) in program order.

        Returns ``(template_exercise_id, sets)`` per slot so callers can both
        resolve the progression scope and inherit the program's target sets.
        """
        result = await self.db.execute(
            select(
                TemplateExercise.template_id,
                TemplateExercise.exercise_id,
                TemplateExercise.id,
                TemplateExercise.sets,
            )
            .where(TemplateExercise.template_id == template_id)
            .order_by(TemplateExercise.order_index, TemplateExercise.id)
        )
        index: dict[tuple[int, int], list[tuple[int, Optional[int]]]] = {}
        for row in result.all():
            index.setdefault((int(row.template_id), int(row.exercise_id)), []).append(
                (int(row.id), int(row.sets) if row.sets is not None else None)
            )
        return index


def resolve_slot_id(
    slot_index: dict[tuple[int, int], list[tuple[int, Optional[int]]]],
    *,
    template_id: Optional[int],
    exercise_id: int,
    occurrence: int,
) -> Optional[int]:
    """Deterministic template slot for the N-th occurrence of an exercise."""
    if template_id is None:
        return None
    slots = slot_index.get((int(template_id), int(exercise_id))) or []
    if occurrence < len(slots):
        return slots[occurrence][0]
    return None


def resolve_slot_sets(
    slot_index: dict[tuple[int, int], list[tuple[int, Optional[int]]]],
    *,
    template_id: Optional[int],
    exercise_id: int,
    occurrence: int,
) -> Optional[int]:
    """Target set count of the matching program slot, when resolvable."""
    if template_id is None:
        return None
    slots = slot_index.get((int(template_id), int(exercise_id))) or []
    if occurrence < len(slots):
        return slots[occurrence][1]
    return None
