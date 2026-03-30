from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.domain.exercise import Exercise
from app.domain.reference_data import RefEquipment, RefExerciseCategory, RefMuscleGroup
from app.domain.exceptions import ExerciseNotFoundError
from app.infrastructure.repositories.exercises_repository import ExercisesRepository
from app.schemas.exercises import (
    ExerciseCategoriesResponse,
    ExerciseCreate,
    ExerciseEquipmentListResponse,
    ExerciseListFilters,
    ExerciseListResponse,
    ExerciseMuscleGroupsResponse,
    ExerciseResponse,
    ExerciseUpdate,
)


class ExercisesService:
    def __init__(self, db: AsyncSession) -> None:
        self.repository = ExercisesRepository(db)
        self.db = db

    async def get_exercises(
        self,
        category: str | None,
        muscle_group: str | None,
        equipment: str | None,
        search: str | None,
        status: str,
        page: int,
        page_size: int,
    ) -> ExerciseListResponse:
        total = await self.repository.count_exercises(
            category=category,
            muscle_group=muscle_group,
            equipment=equipment,
            search=search,
            status=status,
        )
        exercises = await self.repository.list_exercises(
            category=category,
            muscle_group=muscle_group,
            equipment=equipment,
            search=search,
            status=status,
            page=page,
            page_size=page_size,
        )
        return ExerciseListResponse(
            items=[ExerciseResponse.model_validate(e, from_attributes=True) for e in exercises],
            total=total,
            page=page,
            page_size=page_size,
            filters=ExerciseListFilters(
                category=category,
                muscle_group=muscle_group,
                equipment=equipment,
                search=search,
                status=status,
            ),
        )

    async def get_exercise(self, exercise_id: int) -> ExerciseResponse:
        exercise = await self.repository.get_exercise(exercise_id=exercise_id)
        if not exercise:
            raise ExerciseNotFoundError("Exercise not found")
        return ExerciseResponse.model_validate(exercise, from_attributes=True)

    async def create_exercise(self, user_id: int, data: ExerciseCreate) -> ExerciseResponse:
        exercise = Exercise(
            name=data.name,
            description=data.description,
            category=data.category,
            equipment=data.equipment,
            muscle_groups=data.muscle_groups,
            risk_flags=data.risk_flags.model_dump(),
            media_url=data.media_url,
            status="pending",
            author_user_id=user_id,
        )
        exercise = await self.repository.create_exercise(exercise)
        return ExerciseResponse.model_validate(exercise, from_attributes=True)

    async def update_exercise(self, exercise_id: int, data: ExerciseUpdate) -> ExerciseResponse:
        exercise = await self.repository.get_exercise(exercise_id=exercise_id)
        if not exercise:
            raise ExerciseNotFoundError("Exercise not found")

        for field, value in data.model_dump(exclude_unset=True).items():
            if field == "risk_flags" and value is not None:
                exercise.risk_flags = value.model_dump()
            else:
                setattr(exercise, field, value)
        exercise = await self.repository.update_exercise(exercise)
        return ExerciseResponse.model_validate(exercise, from_attributes=True)

    async def delete_exercise(self, exercise_id: int) -> None:
        exercise = await self.repository.get_exercise(exercise_id=exercise_id)
        if not exercise:
            raise ExerciseNotFoundError("Exercise not found")
        await self.repository.delete_exercise(exercise)

    async def approve_exercise(self, exercise_id: int) -> ExerciseResponse:
        exercise = await self.repository.get_pending_exercise(exercise_id=exercise_id)
        if not exercise:
            raise ExerciseNotFoundError("Pending exercise not found")
        exercise.status = "active"
        exercise = await self.repository.approve_exercise(exercise)
        return ExerciseResponse.model_validate(exercise, from_attributes=True)

    async def get_categories(self) -> ExerciseCategoriesResponse:
        rows = (
            await self.db.execute(
                select(RefExerciseCategory)
                .where(RefExerciseCategory.is_active.is_(True))
                .order_by(RefExerciseCategory.sort_order.asc(), RefExerciseCategory.code.asc())
            )
        ).scalars().all()
        return ExerciseCategoriesResponse.model_validate(
            {"categories": [{"value": r.code, "label": r.label, "icon": r.icon or ""} for r in rows]}
        )

    async def get_equipment(self) -> ExerciseEquipmentListResponse:
        rows = (
            await self.db.execute(
                select(RefEquipment)
                .where(RefEquipment.is_active.is_(True))
                .order_by(RefEquipment.sort_order.asc(), RefEquipment.code.asc())
            )
        ).scalars().all()
        return ExerciseEquipmentListResponse.model_validate(
            {"equipment": [{"value": r.code, "label": r.label} for r in rows]}
        )

    async def get_muscle_groups(self) -> ExerciseMuscleGroupsResponse:
        rows = (
            await self.db.execute(
                select(RefMuscleGroup)
                .where(RefMuscleGroup.is_active.is_(True))
                .order_by(RefMuscleGroup.sort_order.asc(), RefMuscleGroup.code.asc())
            )
        ).scalars().all()
        return ExerciseMuscleGroupsResponse.model_validate(
            {"muscle_groups": [{"value": r.code, "label": r.label} for r in rows]}
        )
