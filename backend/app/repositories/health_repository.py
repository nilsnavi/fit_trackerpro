from __future__ import annotations

from datetime import date
from typing import Optional

from sqlalchemy import and_, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain import DailyWellness, GlucoseLog, WorkoutLog


class HealthRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

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

    async def count_glucose_logs(
        self,
        user_id: int,
        date_from: Optional[date],
        date_to: Optional[date],
        measurement_type: Optional[str],
    ) -> int:
        query = select(func.count(GlucoseLog.id)).where(GlucoseLog.user_id == user_id)
        if date_from:
            query = query.where(func.date(GlucoseLog.timestamp) >= date_from)
        if date_to:
            query = query.where(func.date(GlucoseLog.timestamp) <= date_to)
        if measurement_type:
            query = query.where(GlucoseLog.measurement_type == measurement_type)
        result = await self.db.execute(query)
        return int(result.scalar() or 0)

    async def get_glucose_stats(
        self,
        user_id: int,
        date_from: Optional[date],
        date_to: Optional[date],
        measurement_type: Optional[str],
    ):
        query = select(
            func.avg(GlucoseLog.value),
            func.min(GlucoseLog.value),
            func.max(GlucoseLog.value),
        ).where(GlucoseLog.user_id == user_id)
        if date_from:
            query = query.where(func.date(GlucoseLog.timestamp) >= date_from)
        if date_to:
            query = query.where(func.date(GlucoseLog.timestamp) <= date_to)
        if measurement_type:
            query = query.where(GlucoseLog.measurement_type == measurement_type)
        result = await self.db.execute(query)
        return result.first()

    async def list_glucose_logs(
        self,
        user_id: int,
        page: int,
        page_size: int,
        date_from: Optional[date],
        date_to: Optional[date],
        measurement_type: Optional[str],
    ):
        query = select(GlucoseLog).where(GlucoseLog.user_id == user_id)
        if date_from:
            query = query.where(func.date(GlucoseLog.timestamp) >= date_from)
        if date_to:
            query = query.where(func.date(GlucoseLog.timestamp) <= date_to)
        if measurement_type:
            query = query.where(GlucoseLog.measurement_type == measurement_type)
        query = query.order_by(desc(GlucoseLog.timestamp)).offset((page - 1) * page_size).limit(page_size)
        result = await self.db.execute(query)
        return result.scalars().all()

    async def get_glucose_log(self, user_id: int, log_id: int) -> Optional[GlucoseLog]:
        result = await self.db.execute(
            select(GlucoseLog).where(
                and_(
                    GlucoseLog.id == log_id,
                    GlucoseLog.user_id == user_id,
                )
            )
        )
        return result.scalar_one_or_none()

    async def get_wellness_by_date(self, user_id: int, entry_date: date) -> Optional[DailyWellness]:
        result = await self.db.execute(
            select(DailyWellness).where(
                and_(
                    DailyWellness.user_id == user_id,
                    DailyWellness.date == entry_date,
                )
            )
        )
        return result.scalar_one_or_none()

    async def list_wellness_entries(
        self,
        user_id: int,
        date_from: Optional[date],
        date_to: Optional[date],
        limit: int,
    ):
        query = select(DailyWellness).where(DailyWellness.user_id == user_id)
        if date_from:
            query = query.where(DailyWellness.date >= date_from)
        if date_to:
            query = query.where(DailyWellness.date <= date_to)
        query = query.order_by(desc(DailyWellness.date)).limit(limit)
        result = await self.db.execute(query)
        return result.scalars().all()

    async def get_wellness_entry(self, user_id: int, entry_id: int) -> Optional[DailyWellness]:
        result = await self.db.execute(
            select(DailyWellness).where(
                and_(
                    DailyWellness.id == entry_id,
                    DailyWellness.user_id == user_id,
                )
            )
        )
        return result.scalar_one_or_none()

    async def get_glucose_aggregate_since(self, user_id: int, from_date: date):
        result = await self.db.execute(
            select(
                func.avg(GlucoseLog.value),
                func.count(GlucoseLog.id),
            ).where(
                and_(
                    GlucoseLog.user_id == user_id,
                    func.date(GlucoseLog.timestamp) >= from_date,
                )
            )
        )
        return result.first()

    async def count_glucose_in_range_since(
        self,
        user_id: int,
        from_date: date,
        lower: float = 4.0,
        upper: float = 7.0,
    ) -> int:
        result = await self.db.execute(
            select(func.count(GlucoseLog.id)).where(
                and_(
                    GlucoseLog.user_id == user_id,
                    func.date(GlucoseLog.timestamp) >= from_date,
                    GlucoseLog.value >= lower,
                    GlucoseLog.value <= upper,
                )
            )
        )
        return int(result.scalar() or 0)

    async def get_workout_aggregate_since(self, user_id: int, from_date: date):
        result = await self.db.execute(
            select(
                func.count(WorkoutLog.id),
                func.coalesce(func.sum(WorkoutLog.duration), 0),
                func.avg(WorkoutLog.duration),
            ).where(
                and_(
                    WorkoutLog.user_id == user_id,
                    WorkoutLog.date >= from_date,
                )
            )
        )
        return result.first()

    async def list_workout_tags_since(self, user_id: int, from_date: date):
        result = await self.db.execute(
            select(WorkoutLog.tags).where(
                and_(
                    WorkoutLog.user_id == user_id,
                    WorkoutLog.date >= from_date,
                )
            )
        )
        return result.scalars().all()

    async def get_wellness_aggregate_since(self, user_id: int, from_date: date):
        result = await self.db.execute(
            select(
                func.avg(DailyWellness.sleep_score),
                func.avg(DailyWellness.energy_score),
                func.avg(DailyWellness.sleep_hours),
            ).where(
                and_(
                    DailyWellness.user_id == user_id,
                    DailyWellness.date >= from_date,
                )
            )
        )
        return result.first()
