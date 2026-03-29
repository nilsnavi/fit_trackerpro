from __future__ import annotations

from datetime import date
from typing import List, Optional

from sqlalchemy import and_, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain import (
    DailyWellness,
    Exercise,
    MuscleLoad,
    RecoveryState,
    TrainingLoadDaily,
    WorkoutLog,
    WorkoutTemplate,
)


class WorkoutsRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def count_templates(self, user_id: int, template_type: Optional[str]) -> int:
        query = select(func.count(WorkoutTemplate.id)).where(WorkoutTemplate.user_id == user_id)
        if template_type:
            query = query.where(WorkoutTemplate.type == template_type)
        result = await self.db.execute(query)
        return int(result.scalar() or 0)

    async def list_templates(
        self,
        user_id: int,
        page: int,
        page_size: int,
        template_type: Optional[str],
    ) -> List[WorkoutTemplate]:
        query = select(WorkoutTemplate).where(WorkoutTemplate.user_id == user_id)
        if template_type:
            query = query.where(WorkoutTemplate.type == template_type)
        query = (
            query.order_by(desc(WorkoutTemplate.created_at))
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        result = await self.db.execute(query)
        return result.scalars().all()

    async def get_template(self, user_id: int, template_id: int) -> Optional[WorkoutTemplate]:
        result = await self.db.execute(
            select(WorkoutTemplate).where(
                and_(
                    WorkoutTemplate.id == template_id,
                    WorkoutTemplate.user_id == user_id,
                )
            )
        )
        return result.scalar_one_or_none()

    async def count_history(
        self,
        user_id: int,
        date_from: Optional[date],
        date_to: Optional[date],
    ) -> int:
        query = select(func.count(WorkoutLog.id)).where(WorkoutLog.user_id == user_id)
        if date_from:
            query = query.where(WorkoutLog.date >= date_from)
        if date_to:
            query = query.where(WorkoutLog.date <= date_to)
        result = await self.db.execute(query)
        return int(result.scalar() or 0)

    async def list_history(
        self,
        user_id: int,
        page: int,
        page_size: int,
        date_from: Optional[date],
        date_to: Optional[date],
    ) -> List[WorkoutLog]:
        query = select(WorkoutLog).where(WorkoutLog.user_id == user_id)
        if date_from:
            query = query.where(WorkoutLog.date >= date_from)
        if date_to:
            query = query.where(WorkoutLog.date <= date_to)
        query = query.order_by(desc(WorkoutLog.date)).offset((page - 1) * page_size).limit(page_size)
        result = await self.db.execute(query)
        return result.scalars().all()

    async def get_workout(self, user_id: int, workout_id: int) -> Optional[WorkoutLog]:
        result = await self.db.execute(
            select(WorkoutLog).where(
                and_(
                    WorkoutLog.id == workout_id,
                    WorkoutLog.user_id == user_id,
                )
            )
        )
        return result.scalar_one_or_none()

    async def list_workouts_for_day(self, user_id: int, target_date: date) -> List[WorkoutLog]:
        result = await self.db.execute(
            select(WorkoutLog).where(
                and_(
                    WorkoutLog.user_id == user_id,
                    WorkoutLog.date == target_date,
                )
            )
        )
        return result.scalars().all()

    async def list_exercises_by_ids(self, exercise_ids: set[int]) -> List[Exercise]:
        if not exercise_ids:
            return []
        result = await self.db.execute(select(Exercise).where(Exercise.id.in_(exercise_ids)))
        return result.scalars().all()

    async def get_training_load(self, user_id: int, target_date: date) -> Optional[TrainingLoadDaily]:
        result = await self.db.execute(
            select(TrainingLoadDaily).where(
                and_(
                    TrainingLoadDaily.user_id == user_id,
                    TrainingLoadDaily.date == target_date,
                )
            )
        )
        return result.scalar_one_or_none()

    async def list_muscle_load_for_day(self, user_id: int, target_date: date) -> List[MuscleLoad]:
        result = await self.db.execute(
            select(MuscleLoad).where(
                and_(
                    MuscleLoad.user_id == user_id,
                    MuscleLoad.date == target_date,
                )
            )
        )
        return result.scalars().all()

    async def get_latest_wellness_on_or_before(
        self,
        user_id: int,
        target_date: date,
    ) -> Optional[DailyWellness]:
        result = await self.db.execute(
            select(DailyWellness)
            .where(
                and_(
                    DailyWellness.user_id == user_id,
                    DailyWellness.date <= target_date,
                )
            )
            .order_by(DailyWellness.date.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def get_recovery_state(self, user_id: int) -> Optional[RecoveryState]:
        result = await self.db.execute(
            select(RecoveryState).where(RecoveryState.user_id == user_id)
        )
        return result.scalar_one_or_none()
