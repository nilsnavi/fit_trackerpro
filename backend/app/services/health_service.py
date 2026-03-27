from __future__ import annotations

from collections import Counter
from datetime import date, datetime, timedelta
from typing import List, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import DailyWellness, GlucoseLog
from app.repositories.health_repository import HealthRepository
from app.schemas.health import (
    DailyWellnessCreate,
    GlucoseHistoryResponse,
    GlucoseLogCreate,
    GlucoseStats,
    HealthStatsResponse,
    WellnessStats,
    WorkoutStats,
)
from app.utils.cache import invalidate_user_analytics_cache


class HealthNotFoundError(Exception):
    pass


class HealthService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repository = HealthRepository(db)

    async def create_glucose_log(self, user_id: int, data: GlucoseLogCreate) -> GlucoseLog:
        if data.workout_id:
            workout = await self.repository.get_workout(user_id=user_id, workout_id=data.workout_id)
            if not workout:
                raise HealthNotFoundError("Workout not found")

        glucose_log = GlucoseLog(
            user_id=user_id,
            workout_id=data.workout_id,
            value=data.value,
            measurement_type=data.measurement_type,
            timestamp=data.timestamp or datetime.utcnow(),
            notes=data.notes,
        )
        self.db.add(glucose_log)
        await self.db.commit()
        await self.db.refresh(glucose_log)
        return glucose_log

    async def get_glucose_history(
        self,
        user_id: int,
        page: int,
        page_size: int,
        date_from: Optional[date],
        date_to: Optional[date],
        measurement_type: Optional[str],
    ) -> GlucoseHistoryResponse:
        total = await self.repository.count_glucose_logs(
            user_id=user_id,
            date_from=date_from,
            date_to=date_to,
            measurement_type=measurement_type,
        )
        avg_val, min_val, max_val = await self.repository.get_glucose_stats(
            user_id=user_id,
            date_from=date_from,
            date_to=date_to,
            measurement_type=measurement_type,
        )
        logs = await self.repository.list_glucose_logs(
            user_id=user_id,
            page=page,
            page_size=page_size,
            date_from=date_from,
            date_to=date_to,
            measurement_type=measurement_type,
        )
        return GlucoseHistoryResponse(
            items=logs,
            total=total,
            page=page,
            page_size=page_size,
            date_from=date_from,
            date_to=date_to,
            average=round(avg_val, 2) if avg_val else None,
            min_value=round(min_val, 2) if min_val else None,
            max_value=round(max_val, 2) if max_val else None,
        )

    async def get_glucose_log(self, user_id: int, log_id: int) -> GlucoseLog:
        log = await self.repository.get_glucose_log(user_id=user_id, log_id=log_id)
        if not log:
            raise HealthNotFoundError("Glucose log not found")
        return log

    async def delete_glucose_log(self, user_id: int, log_id: int) -> None:
        log = await self.repository.get_glucose_log(user_id=user_id, log_id=log_id)
        if not log:
            raise HealthNotFoundError("Glucose log not found")
        await self.db.delete(log)
        await self.db.commit()

    async def create_or_update_wellness(self, user_id: int, data: DailyWellnessCreate) -> DailyWellness:
        existing = await self.repository.get_wellness_by_date(user_id=user_id, entry_date=data.date)
        if existing:
            existing.sleep_score = data.sleep_score
            existing.sleep_hours = data.sleep_hours
            existing.energy_score = data.energy_score
            existing.pain_zones = data.pain_zones.model_dump()
            existing.stress_level = data.stress_level
            existing.mood_score = data.mood_score
            existing.notes = data.notes
            await self.db.commit()
            await self.db.refresh(existing)
            await invalidate_user_analytics_cache(user_id)
            return existing

        wellness = DailyWellness(
            user_id=user_id,
            date=data.date,
            sleep_score=data.sleep_score,
            sleep_hours=data.sleep_hours,
            energy_score=data.energy_score,
            pain_zones=data.pain_zones.model_dump(),
            stress_level=data.stress_level,
            mood_score=data.mood_score,
            notes=data.notes,
        )
        self.db.add(wellness)
        await self.db.commit()
        await self.db.refresh(wellness)
        await invalidate_user_analytics_cache(user_id)
        return wellness

    async def get_wellness_history(
        self,
        user_id: int,
        date_from: Optional[date],
        date_to: Optional[date],
        limit: int,
    ) -> List[DailyWellness]:
        return await self.repository.list_wellness_entries(
            user_id=user_id,
            date_from=date_from,
            date_to=date_to,
            limit=limit,
        )

    async def get_wellness_entry(self, user_id: int, entry_id: int) -> DailyWellness:
        entry = await self.repository.get_wellness_entry(user_id=user_id, entry_id=entry_id)
        if not entry:
            raise HealthNotFoundError("Wellness entry not found")
        return entry

    async def get_health_stats(self, user_id: int, period: str) -> HealthStatsResponse:
        days_map = {"7d": 7, "30d": 30, "90d": 90, "1y": 365}
        days = days_map.get(period, 30)

        date_7d = date.today() - timedelta(days=7)
        date_30d = date.today() - timedelta(days=30)

        avg_7d, count_7d = await self.repository.get_glucose_aggregate_since(user_id=user_id, from_date=date_7d)
        avg_30d, count_30d = await self.repository.get_glucose_aggregate_since(user_id=user_id, from_date=date_30d)
        in_range_count = await self.repository.count_glucose_in_range_since(user_id=user_id, from_date=date_30d)
        in_range_pct = (in_range_count / count_30d * 100) if count_30d and count_30d > 0 else None

        glucose = GlucoseStats(
            average_7d=round(avg_7d, 2) if avg_7d else None,
            average_30d=round(avg_30d, 2) if avg_30d else None,
            readings_count_7d=int(count_7d or 0),
            readings_count_30d=int(count_30d or 0),
            in_range_percentage=round(in_range_pct, 1) if in_range_pct else None,
        )

        workouts_7d, duration_7d, _ = await self.repository.get_workout_aggregate_since(
            user_id=user_id, from_date=date_7d
        )
        workouts_30d, duration_30d, avg_duration = await self.repository.get_workout_aggregate_since(
            user_id=user_id, from_date=date_30d
        )
        tags_list = await self.repository.list_workout_tags_since(user_id=user_id, from_date=date_30d)
        all_tags = [tag for tags in tags_list for tag in tags] if tags_list else []
        favorite_type = Counter(all_tags).most_common(1)[0][0] if all_tags else None

        workouts = WorkoutStats(
            total_workouts_7d=int(workouts_7d or 0),
            total_workouts_30d=int(workouts_30d or 0),
            total_duration_7d=int(duration_7d or 0),
            total_duration_30d=int(duration_30d or 0),
            avg_duration=round(avg_duration, 1) if avg_duration else None,
            favorite_type=favorite_type,
        )

        sleep_7d, energy_7d, hours_7d = await self.repository.get_wellness_aggregate_since(
            user_id=user_id, from_date=date_7d
        )
        sleep_30d, energy_30d, hours_30d = await self.repository.get_wellness_aggregate_since(
            user_id=user_id, from_date=date_30d
        )
        wellness = WellnessStats(
            avg_sleep_score_7d=round(sleep_7d, 1) if sleep_7d else None,
            avg_sleep_score_30d=round(sleep_30d, 1) if sleep_30d else None,
            avg_energy_score_7d=round(energy_7d, 1) if energy_7d else None,
            avg_energy_score_30d=round(energy_30d, 1) if energy_30d else None,
            avg_sleep_hours_7d=round(hours_7d, 1) if hours_7d else None,
            avg_sleep_hours_30d=round(hours_30d, 1) if hours_30d else None,
        )

        return HealthStatsResponse(
            period=period,
            glucose=glucose,
            workouts=workouts,
            wellness=wellness,
            generated_at=datetime.utcnow(),
        )
