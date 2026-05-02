from __future__ import annotations

from datetime import date
from typing import Optional

from sqlalchemy import and_, desc, func, select

from app.domain.body_measurement import BodyMeasurement
from app.domain.daily_wellness import DailyWellness
from app.domain.glucose_log import GlucoseLog
from app.domain.water_entry import WaterEntry
from app.domain.water_goal import WaterGoal
from app.domain.water_reminder import WaterReminder
from app.domain.workout_log import WorkoutLog
from app.infrastructure.repositories.base import SQLAlchemyRepository


class HealthRepository(SQLAlchemyRepository):

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

    async def count_body_measurements(
        self,
        user_id: int,
        date_from: Optional[date],
        date_to: Optional[date],
        measurement_type: Optional[str],
    ) -> int:
        query = select(func.count(BodyMeasurement.id)).where(BodyMeasurement.user_id == user_id)
        if date_from:
            query = query.where(BodyMeasurement.measured_at >= date_from)
        if date_to:
            query = query.where(BodyMeasurement.measured_at <= date_to)
        if measurement_type:
            query = query.where(BodyMeasurement.measurement_type == measurement_type)
        result = await self.db.execute(query)
        return int(result.scalar() or 0)

    async def list_body_measurements(
        self,
        user_id: int,
        page: int,
        page_size: int,
        date_from: Optional[date],
        date_to: Optional[date],
        measurement_type: Optional[str],
    ):
        query = select(BodyMeasurement).where(BodyMeasurement.user_id == user_id)
        if date_from:
            query = query.where(BodyMeasurement.measured_at >= date_from)
        if date_to:
            query = query.where(BodyMeasurement.measured_at <= date_to)
        if measurement_type:
            query = query.where(BodyMeasurement.measurement_type == measurement_type)
        query = query.order_by(
            desc(BodyMeasurement.measured_at),
            desc(BodyMeasurement.id),
        ).offset((page - 1) * page_size).limit(page_size)
        result = await self.db.execute(query)
        return result.scalars().all()

    async def list_latest_body_measurements(self, user_id: int):
        result = await self.db.execute(
            select(BodyMeasurement)
            .where(BodyMeasurement.user_id == user_id)
            .order_by(
                BodyMeasurement.measurement_type,
                desc(BodyMeasurement.measured_at),
                desc(BodyMeasurement.id),
            )
        )
        latest = {}
        for measurement in result.scalars().all():
            latest.setdefault(measurement.measurement_type, measurement)
        return list(latest.values())

    async def get_body_measurement(
        self,
        user_id: int,
        measurement_id: int,
    ) -> Optional[BodyMeasurement]:
        result = await self.db.execute(
            select(BodyMeasurement).where(
                and_(
                    BodyMeasurement.id == measurement_id,
                    BodyMeasurement.user_id == user_id,
                )
            )
        )
        return result.scalar_one_or_none()

    async def create_body_measurement(self, measurement: BodyMeasurement) -> BodyMeasurement:
        self.add(measurement)
        await self.commit()
        await self.refresh(measurement)
        return measurement

    async def update_body_measurement(self, measurement: BodyMeasurement) -> BodyMeasurement:
        await self.commit()
        await self.refresh(measurement)
        return measurement

    async def delete_body_measurement(self, measurement: BodyMeasurement) -> None:
        await self.delete(measurement)
        await self.commit()

    async def count_glucose_logs(
        self,
        user_id: int,
        date_from: Optional[date],
        date_to: Optional[date],
        measurement_type: Optional[str],
    ) -> int:
        query = select(func.count(GlucoseLog.id)).where(
            GlucoseLog.user_id == user_id)
        if date_from:
            query = query.where(func.date(GlucoseLog.timestamp) >= date_from)
        if date_to:
            query = query.where(func.date(GlucoseLog.timestamp) <= date_to)
        if measurement_type:
            query = query.where(
                GlucoseLog.measurement_type == measurement_type)
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
            query = query.where(
                GlucoseLog.measurement_type == measurement_type)
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
            query = query.where(
                GlucoseLog.measurement_type == measurement_type)
        query = query.order_by(desc(GlucoseLog.timestamp)).offset(
            (page - 1) * page_size).limit(page_size)
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

    async def create_glucose_log(self, log: GlucoseLog) -> GlucoseLog:
        self.add(log)
        await self.commit()
        await self.refresh(log)
        return log

    async def delete_glucose_log(self, log: GlucoseLog) -> None:
        await self.delete(log)
        await self.commit()

    async def update_wellness_entry(self, wellness: DailyWellness) -> DailyWellness:
        await self.commit()
        await self.refresh(wellness)
        return wellness

    async def create_wellness_entry(self, wellness: DailyWellness) -> DailyWellness:
        self.add(wellness)
        await self.commit()
        await self.refresh(wellness)
        return wellness

    # ==================== Water Entry Methods ====================

    async def create_water_entry(self, entry: WaterEntry) -> WaterEntry:
        self.add(entry)
        await self.commit()
        await self.refresh(entry)
        return entry

    async def get_water_entry(self, user_id: int, entry_id: int) -> Optional[WaterEntry]:
        result = await self.db.execute(
            select(WaterEntry).where(
                and_(
                    WaterEntry.id == entry_id,
                    WaterEntry.user_id == user_id,
                )
            )
        )
        return result.scalar_one_or_none()

    async def list_water_entries(
        self,
        user_id: int,
        page: int,
        page_size: int,
        date_from: Optional[date],
        date_to: Optional[date],
    ):
        query = select(WaterEntry).where(WaterEntry.user_id == user_id)
        if date_from:
            query = query.where(func.date(WaterEntry.recorded_at) >= date_from)
        if date_to:
            query = query.where(func.date(WaterEntry.recorded_at) <= date_to)
        query = query.order_by(desc(WaterEntry.recorded_at)).offset(
            (page - 1) * page_size).limit(page_size)
        result = await self.db.execute(query)
        return result.scalars().all()

    async def count_water_entries(
        self,
        user_id: int,
        date_from: Optional[date],
        date_to: Optional[date],
    ) -> int:
        query = select(func.count(WaterEntry.id)).where(
            WaterEntry.user_id == user_id)
        if date_from:
            query = query.where(func.date(WaterEntry.recorded_at) >= date_from)
        if date_to:
            query = query.where(func.date(WaterEntry.recorded_at) <= date_to)
        result = await self.db.execute(query)
        return int(result.scalar() or 0)

    async def sum_water_entries(
        self,
        user_id: int,
        date_from: Optional[date],
        date_to: Optional[date],
    ) -> int:
        query = select(func.coalesce(func.sum(WaterEntry.amount), 0)).where(
            WaterEntry.user_id == user_id)
        if date_from:
            query = query.where(func.date(WaterEntry.recorded_at) >= date_from)
        if date_to:
            query = query.where(func.date(WaterEntry.recorded_at) <= date_to)
        result = await self.db.execute(query)
        return int(result.scalar() or 0)

    async def delete_water_entry(self, entry: WaterEntry) -> None:
        await self.delete(entry)
        await self.commit()

    async def get_water_entries_by_date(self, user_id: int, target_date: date):
        result = await self.db.execute(
            select(WaterEntry).where(
                and_(
                    WaterEntry.user_id == user_id,
                    func.date(WaterEntry.recorded_at) == target_date,
                )
            ).order_by(desc(WaterEntry.recorded_at))
        )
        return result.scalars().all()

    async def sum_water_by_date(self, user_id: int, target_date: date) -> int:
        result = await self.db.execute(
            select(func.coalesce(func.sum(WaterEntry.amount), 0)).where(
                and_(
                    WaterEntry.user_id == user_id,
                    func.date(WaterEntry.recorded_at) == target_date,
                )
            )
        )
        return int(result.scalar() or 0)

    # ==================== Water Goal Methods ====================

    async def get_water_goal(self, user_id: int) -> Optional[WaterGoal]:
        result = await self.db.execute(
            select(WaterGoal).where(WaterGoal.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def create_water_goal(self, goal: WaterGoal) -> WaterGoal:
        self.add(goal)
        await self.commit()
        await self.refresh(goal)
        return goal

    async def update_water_goal(self, goal: WaterGoal) -> WaterGoal:
        await self.commit()
        await self.refresh(goal)
        return goal

    # ==================== Water Reminder Methods ====================

    async def get_water_reminder(self, user_id: int) -> Optional[WaterReminder]:
        result = await self.db.execute(
            select(WaterReminder).where(WaterReminder.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def create_water_reminder(self, reminder: WaterReminder) -> WaterReminder:
        self.add(reminder)
        await self.commit()
        await self.refresh(reminder)
        return reminder

    async def update_water_reminder(self, reminder: WaterReminder) -> WaterReminder:
        await self.commit()
        await self.refresh(reminder)
        return reminder
