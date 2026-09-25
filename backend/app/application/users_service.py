"""User management use cases (not Telegram auth)."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.body_measurement import BodyMeasurement
from app.domain.exceptions import UserNotFoundError
from app.domain.user import User
from app.domain.workout_log import WorkoutLog
from app.domain.workout_template import WorkoutTemplate
from app.schemas.users import UserCreate, UserResponse

VALID_WORKOUT_TYPES = {"cardio", "strength", "flexibility", "mixed"}


class UsersService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    @staticmethod
    def _to_user_response(user: User) -> UserResponse:
        return UserResponse(
            id=int(user.id),
            telegram_id=int(user.telegram_id),
            username=user.username,
            first_name=user.first_name,
            last_name=None,
            created_at=user.created_at,
            updated_at=user.updated_at,
        )

    async def _get_user_by_telegram_id(self, telegram_id: int) -> User | None:
        result = await self.db.execute(select(User).where(User.telegram_id == telegram_id))
        return result.scalar_one_or_none()

    async def _get_user_model_by_id(self, user_id: int) -> User:
        result = await self.db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if user is None:
            raise UserNotFoundError()
        return user

    async def build_export_payload(self, user: User) -> dict:
        templates_result = await self.db.execute(
            select(WorkoutTemplate)
            .where(WorkoutTemplate.user_id == user.id)
            .order_by(desc(WorkoutTemplate.updated_at))
            .limit(200)
        )
        templates = templates_result.scalars().all()

        workouts_result = await self.db.execute(
            select(WorkoutLog)
            .where(WorkoutLog.user_id == user.id)
            .order_by(desc(WorkoutLog.date), desc(WorkoutLog.id))
            .limit(300)
        )
        workouts = workouts_result.scalars().all()

        body_measurements_result = await self.db.execute(
            select(BodyMeasurement)
            .where(BodyMeasurement.user_id == user.id)
            .order_by(desc(BodyMeasurement.measured_at), desc(BodyMeasurement.id))
            .limit(1000)
        )
        body_measurements = body_measurements_result.scalars().all()

        valid_templates = [t for t in templates if t.type in VALID_WORKOUT_TYPES]
        type_distribution = {
            t: sum(1 for row in valid_templates if row.type == t) for t in sorted(VALID_WORKOUT_TYPES)
        }

        return {
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "user": {
                "id": int(user.id),
                "telegram_id": int(user.telegram_id),
                "username": user.username,
                "first_name": user.first_name,
                "profile": user.profile or {},
                "settings": user.settings or {},
                "created_at": user.created_at.isoformat() if user.created_at else None,
                "updated_at": user.updated_at.isoformat() if user.updated_at else None,
            },
            "summary": {
                "total_templates": len(templates),
                "total_workouts": len(workouts),
                "completed_workouts": sum(1 for w in workouts if int(w.duration or 0) > 0),
                "total_duration_minutes": sum(int(w.duration or 0) for w in workouts),
                "template_type_distribution": type_distribution,
            },
            "templates": [
                {
                    "id": int(t.id),
                    "name": t.name,
                    "type": t.type,
                    "is_public": bool(t.is_public),
                    "is_archived": bool(t.is_archived),
                    "exercise_count": len(t.exercises or []),
                    "created_at": t.created_at.isoformat() if t.created_at else None,
                    "updated_at": t.updated_at.isoformat() if t.updated_at else None,
                }
                for t in templates
            ],
            "recent_workouts": [
                {
                    "id": int(w.id),
                    "date": w.date.isoformat() if w.date else None,
                    "duration": int(w.duration or 0),
                    "template_id": int(w.template_id) if w.template_id is not None else None,
                    "exercise_count": len(w.exercises or []),
                    "tags": list(w.tags or []),
                    "comments": w.comments,
                }
                for w in workouts[:100]
            ],
            "body_measurements": [
                {
                    "id": int(m.id),
                    "measurement_type": m.measurement_type,
                    "value_cm": float(m.value_cm),
                    "measured_at": m.measured_at.isoformat() if m.measured_at else None,
                    "created_at": m.created_at.isoformat() if m.created_at else None,
                    "updated_at": m.updated_at.isoformat() if m.updated_at else None,
                }
                for m in body_measurements
            ],
        }

    async def create_user(self, data: UserCreate) -> UserResponse:
        user = await self._get_user_by_telegram_id(telegram_id=data.telegram_id)
        if user is None:
            user = User(
                telegram_id=data.telegram_id,
                username=data.username,
                first_name=data.first_name,
                profile={"equipment": [], "limitations": [], "goals": []},
                settings={"theme": "telegram", "notifications": True, "units": "metric"},
            )
            self.db.add(user)
            await self.db.commit()
            await self.db.refresh(user)
            return self._to_user_response(user)

        user.username = data.username
        user.first_name = data.first_name
        await self.db.commit()
        await self.db.refresh(user)
        return self._to_user_response(user)

    async def get_user_by_id(self, user_id: int) -> UserResponse:
        user = await self._get_user_model_by_id(user_id)
        return self._to_user_response(user)

    async def get_user_model_by_id(self, user_id: int) -> User:
        return await self._get_user_model_by_id(user_id)

    async def get_user_model_by_telegram_id(self, telegram_id: int) -> User | None:
        return await self._get_user_by_telegram_id(telegram_id)

    async def get_user_model_by_id_or_none(self, user_id: int) -> User | None:
        result = await self.db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()
