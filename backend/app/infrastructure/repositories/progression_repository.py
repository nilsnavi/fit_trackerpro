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
        commit: bool = True,
    ) -> ProgressionPolicyRecord:
        """Create or replace the single policy row for one progression scope.

        ``commit=False`` leaves the write pending in the caller's transaction so a
        batch of scope edits is committed as one unit — see
        :meth:`ProgressionEngineService.update_targets_bulk`, which writes every
        selected scope this way and rolls the whole batch back on any failure.
        """
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
        if not commit:
            # Surface an insert conflict here, but leave the COMMIT to the batch
            # that owns the transaction.
            await self.db.flush()
            return record
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
        declined ones — and a newer accepted target inherits that refusal instead
        of ending it (see :meth:`carry_prefill_consent`), so switching the
        substitution off lasts until the user turns it back on (SPEC §58). One
        query with a window function keeps this bounded
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

    async def carry_prefill_consent(
        self, *, user_id: int, source_id: int, target_id: int, commit: bool = False
    ) -> bool:
        """Hand a switched-off prefill to the target that replaces this one (§58).

        The refusal belongs to the *slot*, not to one row: a user who stopped the
        silent substitution meant it until they said otherwise, and a training
        cycle should not quietly overrule that. So when a newer target is accepted
        for a scope whose previous target was switched off, the new one starts
        switched off too — with the original moment kept, so the journal still says
        when the decision was made — and the sweep stamp travels with it, which is
        what keeps the bulk action addressable through the goal that owns the slot
        now.

        The replaced row keeps its own ``prefill_declined_at`` and loses only the
        stamp: it is the historical record of that decision, but it can never be
        switched back on through a sweep again (see
        :meth:`release_prefill_sweeps`). Returns ``False`` — and writes nothing —
        when there is nothing to carry, which is the common case.
        """
        if int(source_id) == int(target_id):
            return False
        source = await self.get_recommendation(
            user_id=user_id, recommendation_id=int(source_id)
        )
        target = await self.get_recommendation(
            user_id=user_id, recommendation_id=int(target_id)
        )
        if source is None or target is None or source.prefill_declined_at is None:
            return False
        target.prefill_declined_at = source.prefill_declined_at
        target.prefill_sweep_id = source.prefill_sweep_id
        source.prefill_sweep_id = None
        if not commit:
            await self.db.flush()
            return True
        await self.commit()
        return True

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
        commit: bool = True,
    ) -> ProgressionRecommendationRecord:
        """Lifecycle transitions never touch workout history (SPEC §42–§44).

        ``commit=False`` leaves the write pending in the caller's transaction so a
        combined edit (value + policy) is committed as one unit — see
        :meth:`ProgressionEngineService.update_target`.
        """
        record.lifecycle_status = lifecycle_status
        if actual_selected_value is not None:
            record.actual_selected_value = actual_selected_value
        # Editing the target moves the goal itself, so the stored delta follows
        # the edited value instead of the proposal it was computed from.
        if difference is not None:
            record.difference = difference
        record.decided_at = datetime.now(timezone.utc)
        if not commit:
            await self.db.flush()
            return record
        await self.commit()
        await self.refresh(record)
        return record

    async def decline_prefill(
        self,
        *,
        user_id: int,
        recommendation_ids: Sequence[int],
        sweep_id: Optional[str] = None,
        commit: bool = True,
    ) -> list[int]:
        """Switch off the automatic prefill of these accepted targets (SPEC §58).

        The lifecycle is left untouched — the target is still the agreed next
        number, it is only no longer substituted silently. Idempotent: already
        declined records are left alone, and the return value names exactly the
        rows this call changed (``RETURNING``), not the set it was asked for —
        under a concurrent write the two can differ.

        ``sweep_id`` stamps one bulk action on every target it changed, which is
        what lets the undo be resolved later (and on another device) instead of
        being handed around by the caller.
        """
        ids = [int(value) for value in dict.fromkeys(recommendation_ids) if value]
        if not ids:
            return []
        result = await self.db.execute(
            update(ProgressionRecommendationRecord)
            .where(
                and_(
                    ProgressionRecommendationRecord.user_id == user_id,
                    ProgressionRecommendationRecord.id.in_(ids),
                    ProgressionRecommendationRecord.prefill_declined_at.is_(None),
                )
            )
            .values(
                prefill_declined_at=datetime.now(timezone.utc),
                prefill_sweep_id=sweep_id,
            )
            # Only the rows this statement really switched off, so a target that
            # lost a race with a concurrent write is not promised as changed.
            .returning(ProgressionRecommendationRecord.id)
        )
        changed = [int(value) for value in result.scalars().all()]
        if commit:
            await self.commit()
        return changed

    async def enable_prefill_bulk(
        self,
        *,
        user_id: int,
        recommendation_ids: Sequence[int],
        commit: bool = True,
    ) -> list[int]:
        """Switch the automatic prefill of these accepted targets back on (§58).

        The mirror of :meth:`decline_prefill`, and the undo of a bulk switch-off:
        only records that are currently switched off are rewritten, so undoing an
        action that was already undone is a no-op instead of a second write. The
        sweep stamp is cleared with the switch, which is what shrinks a sweep to
        the targets it still holds. The lifecycle, the value and the policy are
        never touched. The return value names exactly the rows this call changed
        (``RETURNING``).
        """
        ids = [int(value) for value in dict.fromkeys(recommendation_ids) if value]
        if not ids:
            return []
        result = await self.db.execute(
            update(ProgressionRecommendationRecord)
            .where(
                and_(
                    ProgressionRecommendationRecord.user_id == user_id,
                    ProgressionRecommendationRecord.id.in_(ids),
                    ProgressionRecommendationRecord.prefill_declined_at.is_not(None),
                )
            )
            .values(prefill_declined_at=None, prefill_sweep_id=None)
            .returning(ProgressionRecommendationRecord.id)
        )
        changed = [int(value) for value in result.scalars().all()]
        if commit:
            await self.commit()
        return changed

    def _current_target_ids(self, user_id: int):
        """Newest accepted/modified target per scope, as a subquery.

        The ranking the settings screen is built on (SPEC §58): a scope is
        represented by its newest target only, so a superseded record can never
        resurface — neither in the list nor in what a bulk sweep still owes.
        """
        return (
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

    async def prefill_sweeps(
        self, *, user_id: int, limit: int = 5
    ) -> list[tuple[str, Optional[datetime], list[ProgressionRecommendationRecord]]]:
        """The bulk switch-offs that still have targets switched off (SPEC §58).

        One entry per sweep — ``(sweep_id, declined_at, targets)``, newest first
        — so the whole chain is addressable instead of only its last link. Every
        target one bulk action changed shares a ``prefill_sweep_id``, which makes
        the sweep a fact in the data rather than something the caller has to
        remember; a target switched back on by hand (or undone) drops its stamp
        and leaves the sweep, and a sweep with nothing left is not listed at all.

        A member a newer target replaced is *kept* in the entry: dropping it would
        hide the action while its stamp stayed on a row nobody can act on, so the
        caller is handed both the members it can still switch back on and the ones
        a newer target took over (:meth:`ProgressionEngineService` names which is
        which). Two queries for the whole chain, user-scoped, no N+1.
        """
        stamped = and_(
            ProgressionRecommendationRecord.user_id == user_id,
            ProgressionRecommendationRecord.prefill_sweep_id.is_not(None),
            ProgressionRecommendationRecord.prefill_declined_at.is_not(None),
            # Still a decided target, so a record that was rejected (and whose
            # stamp is therefore meaningless) never shows up here.
            ProgressionRecommendationRecord.lifecycle_status.in_(ACCEPTED_LIFECYCLES),
            ProgressionRecommendationRecord.actual_selected_value.is_not(None),
        )
        declined_at = func.max(ProgressionRecommendationRecord.prefill_declined_at)
        grouped = await self.db.execute(
            select(ProgressionRecommendationRecord.prefill_sweep_id, declined_at)
            .where(stamped)
            .group_by(ProgressionRecommendationRecord.prefill_sweep_id)
            # Ids break ties so the chain has one stable order even if two sweeps
            # were stamped within the same instant.
            .order_by(
                declined_at.desc(),
                ProgressionRecommendationRecord.prefill_sweep_id.desc(),
            )
            .limit(int(limit))
        )
        ordered = [(str(row[0]), row[1]) for row in grouped.all()]
        if not ordered:
            return []
        result = await self.db.execute(
            select(ProgressionRecommendationRecord)
            .where(
                and_(
                    stamped,
                    ProgressionRecommendationRecord.prefill_sweep_id.in_(
                        [sweep_id for sweep_id, _ in ordered]
                    ),
                )
            )
            .order_by(ProgressionRecommendationRecord.id.asc())
        )
        by_sweep: dict[str, list[ProgressionRecommendationRecord]] = {
            sweep_id: [] for sweep_id, _ in ordered
        }
        for record in result.scalars().all():
            by_sweep.setdefault(str(record.prefill_sweep_id), []).append(record)
        return [(sweep_id, when, by_sweep[sweep_id]) for sweep_id, when in ordered]

    async def release_prefill_sweeps(
        self,
        *,
        user_id: int,
        recommendation_ids: Sequence[int],
        commit: bool = False,
    ) -> list[int]:
        """Drop these targets from their sweep, leaving them switched off (§58).

        A record a newer target replaced can never be switched back on through the
        sweep it is part of, so holding it would keep the journal offering an undo
        that promises nothing and outlive every action able to clear it. Releasing
        it ends that: only ``prefill_sweep_id`` is cleared, while
        ``prefill_declined_at`` stays, because the decision belongs to that target
        and switching it off is not being undone here. ``RETURNING`` names exactly
        the rows this call released.
        """
        ids = [int(value) for value in dict.fromkeys(recommendation_ids) if value]
        if not ids:
            return []
        result = await self.db.execute(
            update(ProgressionRecommendationRecord)
            .where(
                and_(
                    ProgressionRecommendationRecord.user_id == user_id,
                    ProgressionRecommendationRecord.id.in_(ids),
                    ProgressionRecommendationRecord.prefill_sweep_id.is_not(None),
                )
            )
            .values(prefill_sweep_id=None)
            .returning(ProgressionRecommendationRecord.id)
        )
        released = [int(value) for value in result.scalars().all()]
        if commit:
            await self.commit()
        return released

    async def targets_by_prefill_sweeps(
        self, *, user_id: int, sweep_ids: Sequence[str]
    ) -> list[ProgressionRecommendationRecord]:
        """The targets these sweeps still have switched off (one query, scoped).

        Addressing an undo by sweep rather than by an enumerated set of ids keeps
        the two ends of the action in one place: the caller asks for what it was
        shown, and the server resolves the targets that are still switched off —
        including a chain longer than any list of ids could carry. Unknown or
        foreign sweep ids simply resolve to nothing.
        """
        ids = [str(value) for value in dict.fromkeys(sweep_ids) if value]
        if not ids:
            return []
        result = await self.db.execute(
            select(ProgressionRecommendationRecord).where(
                and_(
                    ProgressionRecommendationRecord.user_id == user_id,
                    ProgressionRecommendationRecord.prefill_sweep_id.in_(ids),
                    ProgressionRecommendationRecord.prefill_declined_at.is_not(None),
                )
            )
        )
        return list(result.scalars().all())

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
            # A single flip is nobody's sweep, so it stops being part of one.
            record.prefill_sweep_id = None
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
            # Switching one target off by hand is not a sweep: nothing about it
            # is offered for a bulk undo later.
            record.prefill_sweep_id = None
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
        ranked = self._current_target_ids(user_id)
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

    async def current_target_ids(
        self, *, user_id: int, scope_keys: Sequence[str]
    ) -> dict[str, int]:
        """Id of the target that represents each of these scopes *now* (SPEC §58).

        The very ranking the settings screen is built on (newest accepted/modified
        record per scope), resolved for an explicit set of scopes in one query, so
        a caller can tell a current target from one a newer record replaced — and
        name the newer one — without reading the whole list. A scope with no
        current target at all is simply absent.
        """
        keys = [key for key in dict.fromkeys(scope_keys) if key]
        if not keys:
            return {}
        ranked = self._current_target_ids(user_id)
        result = await self.db.execute(
            select(
                ProgressionRecommendationRecord.scope_key,
                ranked.c.recommendation_id,
            )
            .join(
                ranked,
                ProgressionRecommendationRecord.id == ranked.c.recommendation_id,
            )
            .where(
                ranked.c.scope_rank == 1,
                ProgressionRecommendationRecord.scope_key.in_(keys),
            )
        )
        return {str(row[0]): int(row[1]) for row in result.all()}

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
