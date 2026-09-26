from __future__ import annotations

from sqlalchemy import select

from app.domain.exercise import Exercise
from app.domain.progression_policy import ProgressionPolicyRecord
from app.domain.progression_recommendation import ProgressionRecommendationRecord
from app.domain.template_exercise import TemplateExercise
from app.domain.user import User
from app.domain.workout_session_exercise import WorkoutSessionExercise
from app.infrastructure.repositories.base import SQLAlchemyRepository


class AuthRepository(SQLAlchemyRepository):
    async def get_user_by_telegram_id(self, telegram_id: int):
        result = await self.db.execute(select(User).where(User.telegram_id == telegram_id))
        return result.scalar_one_or_none()

    async def delete_user(self, user: User) -> None:
        try:
            exercises = (await self.db.execute(
                select(Exercise).where(Exercise.author_user_id == user.id).with_for_update()
            )).scalars().all()
            for exercise in exercises:
                if exercise.source == "imported":
                    exercise.author_user_id = None
                    continue
                if exercise.source not in {"user", "system"}:
                    continue
                referenced = (
                    await self.db.scalar(select(TemplateExercise.id).where(TemplateExercise.exercise_id == exercise.id).limit(1))
                    or await self.db.scalar(select(WorkoutSessionExercise.id).where(WorkoutSessionExercise.exercise_id == exercise.id).limit(1))
                    or await self.db.scalar(select(ProgressionPolicyRecord.id).where(ProgressionPolicyRecord.exercise_id == exercise.id).limit(1))
                    or await self.db.scalar(select(ProgressionRecommendationRecord.id).where(ProgressionRecommendationRecord.exercise_id == exercise.id).limit(1))
                )
                if referenced is None:
                    await self.delete(exercise)
                    continue
                exercise.author_user_id = None
                exercise.description = None
                exercise.aliases = []
                exercise.media_url = None
                exercise.slug = None
                if exercise.status == "pending":
                    exercise.status = "archived"
            await self.db.flush()
            await self.delete(user)
            await self.commit()
        except Exception:
            await self.rollback()
            raise

    async def insert_user(self, user: User) -> User:
        self.add(user)
        await self.commit()
        await self.refresh(user)
        return user

    async def commit_user_fields(self) -> None:
        await self.commit()

    async def save_profile(self, user: User) -> User:
        await self.commit()
        await self.refresh(user)
        return user
