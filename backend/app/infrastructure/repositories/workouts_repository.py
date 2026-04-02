from __future__ import annotations

from datetime import date
from typing import List, Optional

from sqlalchemy import and_, desc, func, select

from app.domain.daily_wellness import DailyWellness
from app.domain.exercise import Exercise
from app.domain.muscle_load import MuscleLoad
from app.domain.recovery_state import RecoveryState
from app.domain.training_load_daily import TrainingLoadDaily
from app.domain.workout_log import WorkoutLog
from app.domain.workout_template import WorkoutTemplate
from app.infrastructure.repositories.base import SQLAlchemyRepository


class WorkoutsRepository(SQLAlchemyRepository):

    async def count_templates(
        self,
        user_id: int,
        template_type: Optional[str],
        include_archived: bool = False,
    ) -> int:
        query = select(func.count(WorkoutTemplate.id)).where(WorkoutTemplate.user_id == user_id)
        if not include_archived:
            query = query.where(WorkoutTemplate.is_archived.is_(False))
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
        include_archived: bool = False,
    ) -> List[WorkoutTemplate]:
        query = select(WorkoutTemplate).where(WorkoutTemplate.user_id == user_id)
        if not include_archived:
            query = query.where(WorkoutTemplate.is_archived.is_(False))
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

    async def list_workouts_in_range(self, user_id: int, date_from: date, date_to: date) -> List[WorkoutLog]:
        result = await self.db.execute(
            select(WorkoutLog)
            .where(
                and_(
                    WorkoutLog.user_id == user_id,
                    WorkoutLog.date >= date_from,
                    WorkoutLog.date <= date_to,
                )
            )
            .order_by(WorkoutLog.date.asc(), WorkoutLog.id.asc())
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

    async def create_template(self, template: WorkoutTemplate) -> WorkoutTemplate:
        self.add(template)
        await self.commit()
        await self.refresh(template)
        return template

    async def update_template(self, template: WorkoutTemplate) -> WorkoutTemplate:
        await self.commit()
        await self.refresh(template)
        return template

    async def delete_template(self, template: WorkoutTemplate) -> None:
        await self.delete(template)
        await self.commit()

    async def create_workout_log(self, workout: WorkoutLog) -> WorkoutLog:
        self.add(workout)
        await self.commit()
        await self.refresh(workout)
        return workout

    async def commit_workout_update(self, workout: WorkoutLog) -> WorkoutLog:
        await self.commit()
        await self.refresh(workout)
        return workout

    def add_training_load_daily(self, row: TrainingLoadDaily) -> None:
        self.add(row)

    def add_muscle_load(self, row: MuscleLoad) -> None:
        self.add(row)

    async def delete_muscle_load(self, row: MuscleLoad) -> None:
        await self.delete(row)

    def add_recovery_state(self, row: RecoveryState) -> None:
        self.add(row)

    async def commit_workout_completion(self, workout: WorkoutLog) -> None:
        await self.commit()
        await self.refresh(workout)
