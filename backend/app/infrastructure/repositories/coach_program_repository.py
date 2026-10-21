from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.coach_program import CoachProgram, CoachProgramAssignment, CoachProgramDay
from app.domain.workout_template import WorkoutTemplate


class CoachProgramRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_program(self, coach_id: int, program_id: int, *, lock: bool = False) -> CoachProgram | None:
        query = select(CoachProgram).where(CoachProgram.coach_id == coach_id, CoachProgram.id == program_id)
        if lock:
            query = query.with_for_update()
        return await self.db.scalar(query)

    async def list_programs(self, coach_id: int) -> list[CoachProgram]:
        result = await self.db.scalars(select(CoachProgram).where(CoachProgram.coach_id == coach_id).order_by(CoachProgram.created_at.desc(), CoachProgram.id.desc()))
        return list(result)

    async def get_day(self, program_id: int, day_id: int) -> CoachProgramDay | None:
        return await self.db.scalar(select(CoachProgramDay).where(CoachProgramDay.program_id == program_id, CoachProgramDay.id == day_id))

    async def list_days(self, program_id: int) -> list[CoachProgramDay]:
        result = await self.db.scalars(select(CoachProgramDay).where(CoachProgramDay.program_id == program_id).order_by(CoachProgramDay.position, CoachProgramDay.day_number, CoachProgramDay.id))
        return list(result)

    async def get_template(self, coach_id: int, template_id: int) -> WorkoutTemplate | None:
        return await self.db.scalar(select(WorkoutTemplate).where(
            WorkoutTemplate.id == template_id,
            WorkoutTemplate.user_id == coach_id,
            WorkoutTemplate.is_archived.is_(False),
        ))

    async def get_assignment(self, assignment_id: int, *, coach_id: int | None = None, client_id: int | None = None, lock: bool = False) -> CoachProgramAssignment | None:
        query = select(CoachProgramAssignment).where(CoachProgramAssignment.id == assignment_id)
        if coach_id is not None:
            query = query.where(CoachProgramAssignment.coach_id == coach_id)
        if client_id is not None:
            query = query.where(CoachProgramAssignment.client_id == client_id)
        if lock:
            query = query.with_for_update().execution_options(populate_existing=True)
        return await self.db.scalar(query)

    async def list_assignments(self, *, coach_id: int | None = None, client_id: int | None = None) -> list[CoachProgramAssignment]:
        query = select(CoachProgramAssignment)
        if coach_id is not None:
            query = query.where(CoachProgramAssignment.coach_id == coach_id)
        if client_id is not None:
            query = query.where(CoachProgramAssignment.client_id == client_id)
        result = await self.db.scalars(query.order_by(CoachProgramAssignment.created_at.desc(), CoachProgramAssignment.id.desc()))
        return list(result)
