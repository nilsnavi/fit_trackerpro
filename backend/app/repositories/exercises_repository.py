from __future__ import annotations

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Exercise


class ExercisesRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    def _base_filtered_query(
        self,
        category: str | None,
        muscle_group: str | None,
        equipment: str | None,
        search: str | None,
        status: str,
    ):
        query = select(Exercise)
        if category:
            query = query.where(Exercise.category == category)
        if status != "all":
            query = query.where(Exercise.status == status)
        if muscle_group:
            query = query.where(Exercise.muscle_groups.contains([muscle_group]))
        if equipment:
            query = query.where(Exercise.equipment.contains([equipment]))
        if search:
            query = query.where(
                or_(
                    Exercise.name.ilike(f"%{search}%"),
                    Exercise.description.ilike(f"%{search}%"),
                )
            )
        return query

    async def count_exercises(
        self,
        category: str | None,
        muscle_group: str | None,
        equipment: str | None,
        search: str | None,
        status: str,
    ) -> int:
        query = self._base_filtered_query(category, muscle_group, equipment, search, status)
        count_query = select(func.count()).select_from(query.subquery())
        result = await self.db.execute(count_query)
        return int(result.scalar() or 0)

    async def list_exercises(
        self,
        category: str | None,
        muscle_group: str | None,
        equipment: str | None,
        search: str | None,
        status: str,
        page: int,
        page_size: int,
    ):
        query = self._base_filtered_query(category, muscle_group, equipment, search, status)
        query = query.order_by(Exercise.name).offset((page - 1) * page_size).limit(page_size)
        result = await self.db.execute(query)
        return result.scalars().all()

    async def get_exercise(self, exercise_id: int):
        result = await self.db.execute(select(Exercise).where(Exercise.id == exercise_id))
        return result.scalar_one_or_none()

    async def get_pending_exercise(self, exercise_id: int):
        result = await self.db.execute(
            select(Exercise).where(
                Exercise.id == exercise_id,
                Exercise.status == "pending",
            )
        )
        return result.scalar_one_or_none()
