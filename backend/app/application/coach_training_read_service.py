"""Minimal Coach-owned training reads with per-request grant and relationship locks."""
from __future__ import annotations

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException

from app.domain.coach_client import CoachClient, CoachClientStatus
from app.domain.coach_client_grant import (
    COACH_GRANT_CONSENT_VERSION,
    TRAINING_SUMMARY_READ,
    WORKOUT_HISTORY_READ,
    CoachClientGrant,
    CoachGrantStatus,
)
from app.domain.coach_profile import CoachProfile
from app.domain.workout_log import WorkoutLog
from app.schemas.coach_training_reads import CoachTrainingSummary, CoachWorkoutHistory, CoachWorkoutHistoryItem


class CoachTrainingReadService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def _authorize_locked(self, *, coach_id: int, client_id: int, scope: str) -> None:
        if coach_id == client_id or coach_id <= 0 or client_id <= 0:
            raise HTTPException(404, "Client unavailable")
        # Lock relationship FIRST. Client grant/revoke takes this same row lock.
        # PostgreSQL serializes a read with a concurrent revoke; once a revoke
        # commits, any subsequent read sees REVOKED. Do not cache decisions.
        relationship = await self.db.scalar(
            select(CoachClient)
            .join(CoachProfile, CoachProfile.user_id == CoachClient.coach_id)
            .where(
                CoachClient.coach_id == coach_id,
                CoachClient.client_id == client_id,
                CoachClient.status == CoachClientStatus.ACTIVE,
                CoachClient.ended_at.is_(None),
                CoachClient.archived_at.is_(None),
                CoachProfile.is_active.is_(True),
            )
            .with_for_update(of=CoachClient)
        )
        if relationship is None:
            raise HTTPException(404, "Client unavailable")
        grant = await self.db.scalar(
            select(CoachClientGrant.id)
            .where(
                CoachClientGrant.relationship_id == relationship.id,
                CoachClientGrant.coach_id == coach_id,
                CoachClientGrant.client_id == client_id,
                CoachClientGrant.scope == scope,
                CoachClientGrant.status == CoachGrantStatus.ACTIVE,
                CoachClientGrant.consent_version == COACH_GRANT_CONSENT_VERSION,
                CoachClientGrant.revoked_at.is_(None),
                or_(CoachClientGrant.expires_at.is_(None), CoachClientGrant.expires_at > func.now()),
            )
        )
        if grant is None:
            raise HTTPException(404, "Client unavailable")

    async def summary(self, *, coach_id: int, client_id: int) -> CoachTrainingSummary:
        try:
            await self._authorize_locked(
                coach_id=coach_id, client_id=client_id, scope=TRAINING_SUMMARY_READ,
            )
            row = (await self.db.execute(
                select(
                    func.count(WorkoutLog.id),
                    func.max(WorkoutLog.completed_at),
                    func.coalesce(func.sum(WorkoutLog.duration), 0),
                ).where(WorkoutLog.user_id == client_id, WorkoutLog.status == "completed")
            )).one()
            result = CoachTrainingSummary(
                client_id=client_id,
                completed_workouts=int(row[0]),
                last_completed_at=row[1],
                total_duration_minutes=int(row[2]),
            )
            await self.db.commit()
            return result
        except Exception:
            await self.db.rollback()
            raise

    async def history(
        self, *, coach_id: int, client_id: int, limit: int, offset: int,
    ) -> CoachWorkoutHistory:
        try:
            await self._authorize_locked(
                coach_id=coach_id, client_id=client_id, scope=WORKOUT_HISTORY_READ,
            )
            filters = (WorkoutLog.user_id == client_id, WorkoutLog.status == "completed")
            count = int(await self.db.scalar(select(func.count(WorkoutLog.id)).where(*filters)) or 0)
            rows = (await self.db.execute(
                select(
                    WorkoutLog.id, WorkoutLog.date, WorkoutLog.duration,
                    WorkoutLog.status, WorkoutLog.completed_at,
                ).where(*filters)
                .order_by(WorkoutLog.completed_at.desc(), WorkoutLog.id.desc())
                .offset(offset).limit(limit)
            )).all()
            result = CoachWorkoutHistory(
                client_id=client_id,
                total=count,
                items=[
                    CoachWorkoutHistoryItem(
                        id=r[0], date=r[1], duration_minutes=r[2],
                        status=r[3], completed_at=r[4],
                    ) for r in rows
                ],
            )
            await self.db.commit()
            return result
        except Exception:
            await self.db.rollback()
            raise
