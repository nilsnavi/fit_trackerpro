from __future__ import annotations

from collections import Counter
from datetime import date, datetime, timedelta
from typing import List, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.daily_wellness import DailyWellness
from app.domain.exceptions import HealthNotFoundError
from app.domain.glucose_log import GlucoseLog
from app.domain.water_entry import WaterEntry
from app.domain.water_goal import WaterGoal
from app.domain.water_reminder import WaterReminder
from app.infrastructure.cache import invalidate_user_analytics_cache
from app.infrastructure.repositories.health_repository import HealthRepository
from app.schemas.health import (
    DailyWellnessCreate,
    DailyWellnessResponse,
    GlucoseHistoryResponse,
    GlucoseLogCreate,
    GlucoseLogResponse,
    GlucoseStats,
    HealthStatsResponse,
    WaterDailyStats,
    WaterEntryCreate,
    WaterEntryResponse,
    WaterGoalCreate,
    WaterGoalResponse,
    WaterHistoryResponse,
    WaterReminderCreate,
    WaterReminderResponse,
    WaterWeeklyStats,
    WellnessStats,
    WorkoutStats,
)


class HealthService:
    def __init__(self, db: AsyncSession) -> None:
        self.repository = HealthRepository(db)

    async def create_glucose_log(self, user_id: int, data: GlucoseLogCreate) -> GlucoseLogResponse:
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
        glucose_log = await self.repository.create_glucose_log(glucose_log)
        return GlucoseLogResponse.model_validate(glucose_log, from_attributes=True)

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
            items=[GlucoseLogResponse.model_validate(
                log, from_attributes=True) for log in logs],
            total=total,
            page=page,
            page_size=page_size,
            date_from=date_from,
            date_to=date_to,
            average=round(avg_val, 2) if avg_val else None,
            min_value=round(min_val, 2) if min_val else None,
            max_value=round(max_val, 2) if max_val else None,
        )

    async def get_glucose_log(self, user_id: int, log_id: int) -> GlucoseLogResponse:
        log = await self.repository.get_glucose_log(user_id=user_id, log_id=log_id)
        if not log:
            raise HealthNotFoundError("Glucose log not found")
        return GlucoseLogResponse.model_validate(log, from_attributes=True)

    async def delete_glucose_log(self, user_id: int, log_id: int) -> None:
        log = await self.repository.get_glucose_log(user_id=user_id, log_id=log_id)
        if not log:
            raise HealthNotFoundError("Glucose log not found")
        await self.repository.delete_glucose_log(log)

    async def create_or_update_wellness(self, user_id: int, data: DailyWellnessCreate) -> DailyWellnessResponse:
        existing = await self.repository.get_wellness_by_date(user_id=user_id, entry_date=data.date)
        if existing:
            existing.sleep_score = data.sleep_score
            existing.sleep_hours = data.sleep_hours
            existing.energy_score = data.energy_score
            existing.pain_zones = data.pain_zones.model_dump()
            existing.stress_level = data.stress_level
            existing.mood_score = data.mood_score
            existing.notes = data.notes
            existing = await self.repository.update_wellness_entry(existing)
            await invalidate_user_analytics_cache(user_id)
            return DailyWellnessResponse.model_validate(existing, from_attributes=True)

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
        wellness = await self.repository.create_wellness_entry(wellness)
        await invalidate_user_analytics_cache(user_id)
        return DailyWellnessResponse.model_validate(wellness, from_attributes=True)

    async def get_wellness_history(
        self,
        user_id: int,
        date_from: Optional[date],
        date_to: Optional[date],
        limit: int,
    ) -> List[DailyWellnessResponse]:
        rows = await self.repository.list_wellness_entries(
            user_id=user_id,
            date_from=date_from,
            date_to=date_to,
            limit=limit,
        )
        return [DailyWellnessResponse.model_validate(row, from_attributes=True) for row in rows]

    async def get_wellness_entry(self, user_id: int, entry_id: int) -> DailyWellnessResponse:
        entry = await self.repository.get_wellness_entry(user_id=user_id, entry_id=entry_id)
        if not entry:
            raise HealthNotFoundError("Wellness entry not found")
        return DailyWellnessResponse.model_validate(entry, from_attributes=True)

    async def get_health_stats(self, user_id: int, period: str) -> HealthStatsResponse:
        date_7d = date.today() - timedelta(days=7)
        date_30d = date.today() - timedelta(days=30)

        avg_7d, count_7d = await self.repository.get_glucose_aggregate_since(user_id=user_id, from_date=date_7d)
        avg_30d, count_30d = await self.repository.get_glucose_aggregate_since(user_id=user_id, from_date=date_30d)
        in_range_count = await self.repository.count_glucose_in_range_since(user_id=user_id, from_date=date_30d)
        in_range_pct = (in_range_count / count_30d *
                        100) if count_30d and count_30d > 0 else None

        glucose = GlucoseStats(
            average_7d=round(avg_7d, 2) if avg_7d else None,
            average_30d=round(avg_30d, 2) if avg_30d else None,
            readings_count_7d=int(count_7d or 0),
            readings_count_30d=int(count_30d or 0),
            in_range_percentage=round(
                in_range_pct, 1) if in_range_pct else None,
        )

        workouts_7d, duration_7d, _ = await self.repository.get_workout_aggregate_since(
            user_id=user_id, from_date=date_7d
        )
        workouts_30d, duration_30d, avg_duration = await self.repository.get_workout_aggregate_since(
            user_id=user_id, from_date=date_30d
        )
        tags_list = await self.repository.list_workout_tags_since(user_id=user_id, from_date=date_30d)
        all_tags = [
            tag for tags in tags_list for tag in tags] if tags_list else []
        favorite_type = Counter(all_tags).most_common(1)[
            0][0] if all_tags else None

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

    # ==================== Water Methods ====================

    async def create_water_entry(self, user_id: int, data: WaterEntryCreate) -> WaterEntryResponse:
        entry = WaterEntry(
            user_id=user_id,
            amount=data.amount,
            recorded_at=data.recorded_at or datetime.utcnow(),
        )
        entry = await self.repository.create_water_entry(entry)
        return WaterEntryResponse.model_validate(entry, from_attributes=True)

    async def get_water_history(
        self,
        user_id: int,
        page: int,
        page_size: int,
        date_from: Optional[date],
        date_to: Optional[date],
    ) -> WaterHistoryResponse:
        total = await self.repository.count_water_entries(
            user_id=user_id,
            date_from=date_from,
            date_to=date_to,
        )
        total_amount = await self.repository.sum_water_entries(
            user_id=user_id,
            date_from=date_from,
            date_to=date_to,
        )
        entries = await self.repository.list_water_entries(
            user_id=user_id,
            page=page,
            page_size=page_size,
            date_from=date_from,
            date_to=date_to,
        )
        return WaterHistoryResponse(
            items=[WaterEntryResponse.model_validate(
                e, from_attributes=True) for e in entries],
            total=total,
            page=page,
            page_size=page_size,
            date_from=date_from,
            date_to=date_to,
            total_amount=total_amount,
        )

    async def get_water_entry(self, user_id: int, entry_id: int) -> WaterEntryResponse:
        entry = await self.repository.get_water_entry(user_id=user_id, entry_id=entry_id)
        if not entry:
            raise HealthNotFoundError("Water entry not found")
        return WaterEntryResponse.model_validate(entry, from_attributes=True)

    async def delete_water_entry(self, user_id: int, entry_id: int) -> None:
        entry = await self.repository.get_water_entry(user_id=user_id, entry_id=entry_id)
        if not entry:
            raise HealthNotFoundError("Water entry not found")
        await self.repository.delete_water_entry(entry)

    async def get_water_daily_stats(self, user_id: int, target_date: date) -> WaterDailyStats:
        entries = await self.repository.get_water_entries_by_date(user_id=user_id, target_date=target_date)
        total = sum(e.amount for e in entries)
        goal = await self._get_effective_goal(user_id, target_date)
        percentage = round((total / goal * 100), 1) if goal > 0 else 0.0
        return WaterDailyStats(
            date=target_date,
            total=total,
            goal=goal,
            percentage=percentage,
            is_goal_reached=total >= goal,
            entry_count=len(entries),
        )

    async def get_water_weekly_stats(self, user_id: int) -> WaterWeeklyStats:
        today = date.today()
        days_stats = []
        total_entries = 0
        best_day = None
        best_total = 0

        for i in range(7):
            d = today - timedelta(days=i)
            stats = await self.get_water_daily_stats(user_id, d)
            days_stats.append(stats)
            total_entries += stats.entry_count
            if stats.total > best_total:
                best_total = stats.total
                best_day = stats

        avg = round(sum(d.total for d in days_stats) / 7, 1)
        return WaterWeeklyStats(
            days=list(reversed(days_stats)),
            average=avg,
            best_day=best_day,
            total_entries=total_entries,
        )

    async def _get_effective_goal(self, user_id: int, target_date: date) -> int:
        goal = await self.repository.get_water_goal(user_id)
        if not goal:
            return 2000  # Default goal
        base = goal.daily_goal
        if goal.is_workout_day:
            base += goal.workout_increase
        return base

    async def get_water_goal(self, user_id: int) -> WaterGoalResponse:
        goal = await self.repository.get_water_goal(user_id)
        if not goal:
            # Return default goal
            return WaterGoalResponse(
                id=0,
                user_id=user_id,
                daily_goal=2000,
                workout_increase=500,
                is_workout_day=False,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
        return WaterGoalResponse.model_validate(goal, from_attributes=True)

    async def set_water_goal(self, user_id: int, data: WaterGoalCreate) -> WaterGoalResponse:
        existing = await self.repository.get_water_goal(user_id)
        if existing:
            existing.daily_goal = data.daily_goal
            existing.workout_increase = data.workout_increase
            existing.is_workout_day = data.is_workout_day
            existing = await self.repository.update_water_goal(existing)
            return WaterGoalResponse.model_validate(existing, from_attributes=True)

        goal = WaterGoal(
            user_id=user_id,
            daily_goal=data.daily_goal,
            workout_increase=data.workout_increase,
            is_workout_day=data.is_workout_day,
        )
        goal = await self.repository.create_water_goal(goal)
        return WaterGoalResponse.model_validate(goal, from_attributes=True)

    async def get_water_reminder(self, user_id: int) -> WaterReminderResponse:
        reminder = await self.repository.get_water_reminder(user_id)
        if not reminder:
            # Return default reminder
            return WaterReminderResponse(
                id=0,
                user_id=user_id,
                enabled=True,
                interval_hours=2,
                start_time="08:00",
                end_time="22:00",
                quiet_hours_start=None,
                quiet_hours_end=None,
                telegram_notifications=True,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
        return WaterReminderResponse(
            id=reminder.id,
            user_id=reminder.user_id,
            enabled=reminder.enabled,
            interval_hours=reminder.interval_hours,
            start_time=reminder.start_time.strftime("%H:%M"),
            end_time=reminder.end_time.strftime("%H:%M"),
            quiet_hours_start=reminder.quiet_hours_start.strftime(
                "%H:%M") if reminder.quiet_hours_start else None,
            quiet_hours_end=reminder.quiet_hours_end.strftime(
                "%H:%M") if reminder.quiet_hours_end else None,
            telegram_notifications=reminder.telegram_notifications,
            created_at=reminder.created_at,
            updated_at=reminder.updated_at,
        )

    async def set_water_reminder(self, user_id: int, data: WaterReminderCreate) -> WaterReminderResponse:
        from datetime import time as time_type

        existing = await self.repository.get_water_reminder(user_id)
        start_time = time_type.fromisoformat(data.start_time)
        end_time = time_type.fromisoformat(data.end_time)
        quiet_start = time_type.fromisoformat(
            data.quiet_hours_start) if data.quiet_hours_start else None
        quiet_end = time_type.fromisoformat(
            data.quiet_hours_end) if data.quiet_hours_end else None

        if existing:
            existing.enabled = data.enabled
            existing.interval_hours = data.interval_hours
            existing.start_time = start_time
            existing.end_time = end_time
            existing.quiet_hours_start = quiet_start
            existing.quiet_hours_end = quiet_end
            existing.telegram_notifications = data.telegram_notifications
            existing = await self.repository.update_water_reminder(existing)
            return WaterReminderResponse(
                id=existing.id,
                user_id=existing.user_id,
                enabled=existing.enabled,
                interval_hours=existing.interval_hours,
                start_time=existing.start_time.strftime("%H:%M"),
                end_time=existing.end_time.strftime("%H:%M"),
                quiet_hours_start=existing.quiet_hours_start.strftime(
                    "%H:%M") if existing.quiet_hours_start else None,
                quiet_hours_end=existing.quiet_hours_end.strftime(
                    "%H:%M") if existing.quiet_hours_end else None,
                telegram_notifications=existing.telegram_notifications,
                created_at=existing.created_at,
                updated_at=existing.updated_at,
            )

        reminder = WaterReminder(
            user_id=user_id,
            enabled=data.enabled,
            interval_hours=data.interval_hours,
            start_time=start_time,
            end_time=end_time,
            quiet_hours_start=quiet_start,
            quiet_hours_end=quiet_end,
            telegram_notifications=data.telegram_notifications,
        )
        reminder = await self.repository.create_water_reminder(reminder)
        return WaterReminderResponse(
            id=reminder.id,
            user_id=reminder.user_id,
            enabled=reminder.enabled,
            interval_hours=reminder.interval_hours,
            start_time=reminder.start_time.strftime("%H:%M"),
            end_time=reminder.end_time.strftime("%H:%M"),
            quiet_hours_start=reminder.quiet_hours_start.strftime(
                "%H:%M") if reminder.quiet_hours_start else None,
            quiet_hours_end=reminder.quiet_hours_end.strftime(
                "%H:%M") if reminder.quiet_hours_end else None,
            telegram_notifications=reminder.telegram_notifications,
            created_at=reminder.created_at,
            updated_at=reminder.updated_at,
        )
