"""User management use cases (not Telegram auth)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import uuid4

from sqlalchemy import and_, desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

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

    @staticmethod
    def _profile_coach_access(profile: dict | None) -> list[dict]:
        if not isinstance(profile, dict):
            return []
        raw = profile.get("coach_access")
        if isinstance(raw, list):
            return [row for row in raw if isinstance(row, dict)]
        return []

    async def list_coach_access(self, user: User) -> list[dict]:
        entries = self._profile_coach_access(user.profile)
        now = datetime.now(timezone.utc)
        active = [
            row
            for row in entries
            if str(row.get("status") or "active") == "active"
            and self._parse_iso_ts(row.get("expires_at")) > now
        ]
        return [
            {
                "id": str(row.get("id")),
                "code": str(row.get("code")),
                "created_at": str(row.get("created_at")),
                "expires_at": str(row.get("expires_at")),
                "status": "active",
            }
            for row in sorted(active, key=lambda x: str(x.get("created_at")), reverse=True)
        ]

    async def generate_coach_access(self, user: User) -> dict:
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(hours=24)
        entry = {
            "id": uuid4().hex,
            "code": uuid4().hex[:8].upper(),
            "created_at": now.isoformat(),
            "expires_at": expires_at.isoformat(),
            "status": "active",
        }

        profile = dict(user.profile or {})
        existing = self._profile_coach_access(profile)
        existing.append(entry)
        profile["coach_access"] = existing[-20:]
        user.profile = profile
        flag_modified(user, "profile")
        await self.db.commit()
        await self.db.refresh(user)
        return {"code": entry["code"], "expires_at": entry["expires_at"]}

    async def revoke_coach_access(self, user: User, access_id: str) -> None:
        profile = dict(user.profile or {})
        entries = self._profile_coach_access(profile)
        changed = False
        for row in entries:
            if str(row.get("id")) == access_id and str(row.get("status") or "active") == "active":
                row["status"] = "revoked"
                changed = True
        if changed:
            profile["coach_access"] = entries
            user.profile = profile
            flag_modified(user, "profile")
            await self.db.commit()

    @staticmethod
    def _parse_iso_ts(value: object) -> datetime:
        if not isinstance(value, str) or not value:
            return datetime.fromtimestamp(0, tz=timezone.utc)
        try:
            dt = datetime.fromisoformat(value)
        except ValueError:
            return datetime.fromtimestamp(0, tz=timezone.utc)
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)

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
