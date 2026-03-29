from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.exercise import Exercise
from app.domain.exceptions import ExerciseNotFoundError
from app.infrastructure.repositories.exercises_repository import ExercisesRepository
from app.schemas.exercises import (
    ExerciseCategoriesResponse,
    ExerciseCreate,
    ExerciseEquipmentListResponse,
    ExerciseListResponse,
    ExerciseMuscleGroupsResponse,
    ExerciseResponse,
    ExerciseUpdate,
)


class ExercisesService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repository = ExercisesRepository(db)

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
            filters={
                "category": category,
                "muscle_group": muscle_group,
                "equipment": equipment,
                "search": search,
                "status": status,
            },
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
        self.db.add(exercise)
        await self.db.commit()
        await self.db.refresh(exercise)
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
        await self.db.commit()
        await self.db.refresh(exercise)
        return ExerciseResponse.model_validate(exercise, from_attributes=True)

    async def delete_exercise(self, exercise_id: int) -> None:
        exercise = await self.repository.get_exercise(exercise_id=exercise_id)
        if not exercise:
            raise ExerciseNotFoundError("Exercise not found")
        await self.db.delete(exercise)
        await self.db.commit()

    async def approve_exercise(self, exercise_id: int) -> ExerciseResponse:
        exercise = await self.repository.get_pending_exercise(exercise_id=exercise_id)
        if not exercise:
            raise ExerciseNotFoundError("Pending exercise not found")
        exercise.status = "active"
        await self.db.commit()
        await self.db.refresh(exercise)
        return ExerciseResponse.model_validate(exercise, from_attributes=True)

    @staticmethod
    def get_categories() -> ExerciseCategoriesResponse:
        return ExerciseCategoriesResponse.model_validate(
            {
                "categories": [
                    {"value": "strength", "label": "Strength", "icon": "dumbbell"},
                    {"value": "cardio", "label": "Cardio", "icon": "heart-pulse"},
                    {"value": "flexibility", "label": "Flexibility", "icon": "person-stretching"},
                    {"value": "balance", "label": "Balance", "icon": "scale-balanced"},
                    {"value": "sport", "label": "Sport", "icon": "basketball"},
                ]
            }
        )

    @staticmethod
    def get_equipment() -> ExerciseEquipmentListResponse:
        return ExerciseEquipmentListResponse.model_validate(
            {
                "equipment": [
                    {"value": "none", "label": "No Equipment"},
                    {"value": "dumbbells", "label": "Dumbbells"},
                    {"value": "barbell", "label": "Barbell"},
                    {"value": "kettlebell", "label": "Kettlebell"},
                    {"value": "resistance_bands", "label": "Resistance Bands"},
                    {"value": "pull_up_bar", "label": "Pull-up Bar"},
                    {"value": "bench", "label": "Bench"},
                    {"value": "cable_machine", "label": "Cable Machine"},
                    {"value": "smith_machine", "label": "Smith Machine"},
                    {"value": "leg_press", "label": "Leg Press Machine"},
                    {"value": "treadmill", "label": "Treadmill"},
                    {"value": "exercise_bike", "label": "Exercise Bike"},
                    {"value": "rowing_machine", "label": "Rowing Machine"},
                    {"value": "elliptical", "label": "Elliptical"},
                    {"value": "medicine_ball", "label": "Medicine Ball"},
                    {"value": "foam_roller", "label": "Foam Roller"},
                    {"value": "yoga_mat", "label": "Yoga Mat"},
                ]
            }
        )

    @staticmethod
    def get_muscle_groups() -> ExerciseMuscleGroupsResponse:
        return ExerciseMuscleGroupsResponse.model_validate(
            {
                "muscle_groups": [
                    {"value": "chest", "label": "Chest"},
                    {"value": "back", "label": "Back"},
                    {"value": "shoulders", "label": "Shoulders"},
                    {"value": "biceps", "label": "Biceps"},
                    {"value": "triceps", "label": "Triceps"},
                    {"value": "forearms", "label": "Forearms"},
                    {"value": "abs", "label": "Abs"},
                    {"value": "obliques", "label": "Obliques"},
                    {"value": "lower_back", "label": "Lower Back"},
                    {"value": "lats", "label": "Lats"},
                    {"value": "traps", "label": "Traps"},
                    {"value": "quadriceps", "label": "Quadriceps"},
                    {"value": "hamstrings", "label": "Hamstrings"},
                    {"value": "glutes", "label": "Glutes"},
                    {"value": "calves", "label": "Calves"},
                    {"value": "hip_flexors", "label": "Hip Flexors"},
                    {"value": "adductors", "label": "Adductors"},
                    {"value": "abductors", "label": "Abductors"},
                    {"value": "full_body", "label": "Full Body"},
                ]
            }
        )
