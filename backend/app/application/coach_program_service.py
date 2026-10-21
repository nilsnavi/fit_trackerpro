from __future__ import annotations

from datetime import UTC, date, datetime

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.workouts_service import WorkoutsService
from app.core.audit import (
    CLIENT_ASSIGNED_WORKOUT_STARTED,
    COACH_ASSIGNMENT_CREATED,
    COACH_ASSIGNMENT_STATUS_CHANGED,
    COACH_PROGRAM_ACTIVATED,
    COACH_PROGRAM_ARCHIVED,
    COACH_PROGRAM_CREATED,
    COACH_PROGRAM_DAY_CREATED,
    COACH_PROGRAM_DAY_DELETED,
    COACH_PROGRAM_DAY_UPDATED,
    COACH_PROGRAM_UPDATED,
    audit_log,
)
from app.domain.coach_program import (
    CoachProgram,
    CoachProgramAssignment,
    CoachProgramAssignmentStatus,
    CoachProgramDay,
    CoachProgramStatus,
)
from app.domain.exceptions import (
    CoachClientRelationshipNotFound,
    WorkoutConflictError,
    WorkoutNotFoundError,
)
from app.domain.user import User
from app.domain.workout_template import WorkoutTemplate
from app.infrastructure.idempotency import run_idempotent
from app.infrastructure.repositories.coach_program_repository import CoachProgramRepository
from app.infrastructure.repositories.coach_repository import CoachClientRepository
from app.schemas.coach_programs import (
    CoachProgramAssignmentCreate,
    CoachProgramAssignmentResponse,
    CoachProgramAssignmentStatusUpdate,
    CoachProgramCreate,
    CoachProgramDayCreate,
    CoachProgramDayResponse,
    CoachProgramDayUpdate,
    CoachProgramResponse,
    CoachProgramStatusUpdate,
    CoachProgramUpdate,
    CoachProgramWorkoutStartResponse,
)
from app.schemas.enums import WorkoutSessionSourceType, WorkoutSessionType
from app.schemas.workouts import WorkoutSessionCreateRequest
from app.settings import settings


class CoachProgramService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repository = CoachProgramRepository(db)
        self.relationships = CoachClientRepository(db)

    @staticmethod
    def _program_response(program: CoachProgram, days: list[CoachProgramDay]) -> CoachProgramResponse:
        return CoachProgramResponse(
            id=program.id, coach_id=program.coach_id, name=program.name,
            description=program.description, status=CoachProgramStatus(program.status),
            version=program.version,
            days=[CoachProgramDayResponse(
                id=day.id, day_number=day.day_number, name=day.name,
                workout_template_id=day.workout_template_id, template_version=day.template_version,
                workout_template_name=day.workout_template_name,
                notes=day.notes, position=day.position,
            ) for day in days],
            created_at=program.created_at, updated_at=program.updated_at,
        )

    async def _owned_program(self, coach_id: int, program_id: int, *, lock: bool = False) -> CoachProgram:
        program = await self.repository.get_program(coach_id, program_id, lock=lock)
        if not program:
            raise WorkoutNotFoundError("Coach program not found")
        return program

    async def _serialize_assignment(self, assignment: CoachProgramAssignment) -> CoachProgramAssignmentResponse:
        program = await self.repository.get_program(assignment.coach_id, assignment.program_id)
        if not program:
            # Program and assignment are protected by FKs; this guards corrupt snapshots.
            raise WorkoutNotFoundError("Coach program not found")
        days = await self.repository.list_days(assignment.program_id)
        current = self._program_response(program, days)
        snapshot = assignment.program_snapshot
        if assignment.program_version != program.version:
            current = CoachProgramResponse(
                id=program.id, coach_id=program.coach_id,
                name=snapshot["name"], description=snapshot.get("description"),
                status=CoachProgramStatus(program.status), version=assignment.program_version,
                days=[CoachProgramDayResponse(**day) for day in snapshot["days"]],
                created_at=program.created_at, updated_at=program.updated_at,
            )
        return CoachProgramAssignmentResponse(
            id=assignment.id, coach_id=assignment.coach_id, client_id=assignment.client_id,
            relationship_id=assignment.relationship_id, program_id=assignment.program_id,
            program_version=assignment.program_version,
            status=CoachProgramAssignmentStatus(assignment.status), program=current,
            start_date=assignment.start_date, end_date=assignment.end_date,
            coach_message=assignment.coach_message, client_message=assignment.client_message,
            paused_at=assignment.paused_at, completed_at=assignment.completed_at,
            cancelled_at=assignment.cancelled_at,
            coach_name=await self.db.scalar(select(User.first_name).where(User.id == assignment.coach_id)),
            created_at=assignment.created_at, updated_at=assignment.updated_at,
        )

    async def list_programs(self, coach_id: int) -> list[CoachProgramResponse]:
        programs = await self.repository.list_programs(coach_id)
        return [self._program_response(program, await self.repository.list_days(program.id)) for program in programs]

    async def get_program(self, coach_id: int, program_id: int) -> CoachProgramResponse:
        program = await self._owned_program(coach_id, program_id)
        return self._program_response(program, await self.repository.list_days(program.id))

    async def _ensure_draft(self, coach_id: int, program_id: int) -> CoachProgram:
        program = await self._owned_program(coach_id, program_id, lock=True)
        if program.status != CoachProgramStatus.DRAFT.value:
            raise WorkoutConflictError("Only draft programs can be edited")
        return program

    async def create_day(self, coach_id: int, program_id: int, data: CoachProgramDayCreate) -> CoachProgramResponse:
        program = await self._ensure_draft(coach_id, program_id)
        template = await self.repository.get_template(coach_id, data.workout_template_id)
        if not template:
            raise WorkoutNotFoundError("Workout template not found")
        existing = await self.repository.list_days(program.id)
        position = data.position if data.position is not None else max((day.position for day in existing), default=-1) + 1
        if any(day.day_number == data.day_number for day in existing):
            raise WorkoutConflictError("Program day numbers must be unique")
        self.db.add(CoachProgramDay(
            program_id=program.id, day_number=data.day_number, name=data.name.strip(),
            workout_template_id=template.id, workout_template_name=template.name, template_version=template.version,
            notes=data.notes, position=position,
        ))
        program.version += 1
        await self.db.commit()
        await self.db.refresh(program)
        audit_log(action=COACH_PROGRAM_DAY_CREATED, user_db_id=coach_id, resource_type="coach_program_day", resource_id=program.id, meta={"program_id": program.id, "program_version": program.version})
        return self._program_response(program, await self.repository.list_days(program.id))

    async def update_day(self, coach_id: int, program_id: int, day_id: int, data: CoachProgramDayUpdate) -> CoachProgramResponse:
        program = await self._ensure_draft(coach_id, program_id)
        day = await self.repository.get_day(program.id, day_id)
        if not day:
            raise WorkoutNotFoundError("Program day not found")
        values = data.model_dump(exclude_unset=True)
        if "workout_template_id" in values and values["workout_template_id"] is not None:
            template = await self.repository.get_template(coach_id, values["workout_template_id"])
            if not template:
                raise WorkoutNotFoundError("Workout template not found")
            day.template_version = template.version
            day.workout_template_name = template.name
        if "position" in values and values["position"] is None:
            values["position"] = max((item.position for item in await self.repository.list_days(program.id) if item.id != day.id), default=-1) + 1
        for field, value in values.items():
            if value is not None or field == "notes":
                setattr(day, field, value.strip() if field == "name" and value else value)
        others = [item for item in await self.repository.list_days(program.id) if item.id != day.id]
        if any(item.day_number == day.day_number for item in others):
            raise WorkoutConflictError("Program day numbers must be unique")
        program.version += 1
        await self.db.commit()
        await self.db.refresh(program)
        audit_log(action=COACH_PROGRAM_DAY_UPDATED, user_db_id=coach_id, resource_type="coach_program_day", resource_id=day.id, meta={"program_id": program.id, "program_version": program.version, "day_id": day.id})
        return self._program_response(program, await self.repository.list_days(program.id))

    async def delete_day(self, coach_id: int, program_id: int, day_id: int) -> None:
        program = await self._ensure_draft(coach_id, program_id)
        day = await self.repository.get_day(program.id, day_id)
        if not day:
            raise WorkoutNotFoundError("Program day not found")
        await self.db.delete(day)
        program.version += 1
        await self.db.commit()
        audit_log(action=COACH_PROGRAM_DAY_DELETED, user_db_id=coach_id, resource_type="coach_program_day", resource_id=day_id, meta={"program_id": program.id, "program_version": program.version, "day_id": day_id})

    async def create_program(self, coach_id: int, data: CoachProgramCreate) -> CoachProgramResponse:
        numbers = [day.day_number for day in data.days]
        if len(numbers) != len(set(numbers)):
            raise WorkoutConflictError("Program day numbers must be unique")
        templates: dict[int, WorkoutTemplate] = {}
        for item in data.days:
            template = await self.repository.get_template(coach_id, item.workout_template_id)
            if not template:
                raise WorkoutNotFoundError("Workout template not found")
            templates[item.workout_template_id] = template
        program = CoachProgram(coach_id=coach_id, name=data.name.strip(), description=data.description, status=CoachProgramStatus.DRAFT.value, version=1)
        self.db.add(program)
        await self.db.flush()
        for index, item in enumerate(sorted(data.days, key=lambda day: (day.position if day.position is not None else day.day_number, day.day_number))):
            self.db.add(CoachProgramDay(
                program_id=program.id, day_number=item.day_number, name=item.name.strip(),
                workout_template_id=item.workout_template_id,
                workout_template_name=templates[item.workout_template_id].name,
                template_version=templates[item.workout_template_id].version,
                notes=item.notes, position=item.position if item.position is not None else index,
            ))
        await self.db.commit()
        await self.db.refresh(program)
        audit_log(action=COACH_PROGRAM_CREATED, user_db_id=coach_id, resource_type="coach_program", resource_id=program.id, meta={"program_id": program.id, "program_version": program.version})
        return self._program_response(program, await self.repository.list_days(program.id))

    async def update_program(self, coach_id: int, program_id: int, data: CoachProgramUpdate) -> CoachProgramResponse:
        program = await self._owned_program(coach_id, program_id, lock=True)
        if program.status != CoachProgramStatus.DRAFT.value:
            raise WorkoutConflictError("Only draft programs can be edited; create a new draft for changed content")
        values = data.model_dump(exclude_unset=True)
        if not values:
            return self._program_response(program, await self.repository.list_days(program.id))
        if "name" in values and values["name"] is not None:
            values["name"] = values["name"].strip()
            if not values["name"]:
                raise WorkoutConflictError("Program name must not be blank")
        for field, value in values.items():
            setattr(program, field, value)
        program.version += 1
        await self.db.commit()
        await self.db.refresh(program)
        audit_log(action=COACH_PROGRAM_UPDATED, user_db_id=coach_id, resource_type="coach_program", resource_id=program.id, meta={"program_id": program.id, "program_version": program.version})
        return self._program_response(program, await self.repository.list_days(program.id))

    async def set_program_status(self, coach_id: int, program_id: int, data: CoachProgramStatusUpdate) -> CoachProgramResponse:
        program = await self._owned_program(coach_id, program_id, lock=True)
        requested = data.status
        allowed = {
            CoachProgramStatus.DRAFT: {CoachProgramStatus.ACTIVE, CoachProgramStatus.ARCHIVED},
            CoachProgramStatus.ACTIVE: {CoachProgramStatus.ARCHIVED},
            CoachProgramStatus.ARCHIVED: set(),
        }
        current = CoachProgramStatus(program.status)
        if requested not in allowed[current]:
            raise WorkoutConflictError("Invalid program status transition")
        if requested == CoachProgramStatus.ACTIVE:
            days = await self.repository.list_days(program.id)
            if not days:
                raise WorkoutConflictError("A program requires at least one day before activation")
            for day in days:
                template = await self.repository.get_template(coach_id, day.workout_template_id)
                if not template:
                    raise WorkoutConflictError("Program contains an unavailable workout template")
                if template.version != day.template_version:
                    raise WorkoutConflictError("A workout template changed; rebuild the draft before activation")
        program.status = requested.value
        if requested == CoachProgramStatus.ACTIVE:
            program.activated_at = datetime.now(UTC)
        else:
            program.archived_at = datetime.now(UTC)
        await self.db.commit()
        await self.db.refresh(program)
        audit_log(
            action=COACH_PROGRAM_ACTIVATED if requested == CoachProgramStatus.ACTIVE else COACH_PROGRAM_ARCHIVED,
            user_db_id=coach_id, resource_type="coach_program", resource_id=program.id,
            meta={"program_id": program.id, "program_version": program.version},
        )
        return self._program_response(program, await self.repository.list_days(program.id))

    async def assign(self, coach_id: int, data: CoachProgramAssignmentCreate) -> CoachProgramAssignmentResponse:
        if data.program_id is None:
            raise WorkoutNotFoundError("Coach program not found")
        relationship = await self.relationships.get_for_coach(coach_id, data.client_id, active_only=True, lock=True)
        if not relationship:
            raise CoachClientRelationshipNotFound()
        program = await self._owned_program(coach_id, data.program_id, lock=True)
        if program.status != CoachProgramStatus.ACTIVE.value:
            raise WorkoutConflictError("Only active programs can be assigned")
        days = await self.repository.list_days(program.id)
        snapshot = {
            "name": program.name, "description": program.description,
            "days": [
                {"id": day.id, "day_number": day.day_number, "name": day.name,
                 "workout_template_id": day.workout_template_id, "template_version": day.template_version,
                 "workout_template_name": day.workout_template_name,
                 "notes": day.notes, "position": day.position}
                for day in days
            ],
        }
        assignment = CoachProgramAssignment(
            coach_id=coach_id, client_id=data.client_id, relationship_id=relationship.id,
            program_id=program.id, program_version=program.version,
            program_snapshot=snapshot, status=CoachProgramAssignmentStatus.ACTIVE.value,
            start_date=data.start_date, coach_message=data.coach_message,
        )
        self.db.add(assignment)
        try:
            await self.db.commit()
        except IntegrityError as exc:
            await self.db.rollback()
            raise WorkoutConflictError("This client already has this program version") from exc
        await self.db.refresh(assignment)
        audit_log(action=COACH_ASSIGNMENT_CREATED, user_db_id=coach_id, resource_type="coach_program_assignment", resource_id=assignment.id, meta={"program_id": program.id, "assignment_id": assignment.id, "client_id": assignment.client_id, "program_version": assignment.program_version})
        return await self._serialize_assignment(assignment)

    async def list_assignments(self, *, coach_id: int | None = None, client_id: int | None = None) -> list[CoachProgramAssignmentResponse]:
        assignments = await self.repository.list_assignments(coach_id=coach_id, client_id=client_id)
        return [await self._serialize_assignment(item) for item in assignments]

    async def list_client_programs_for_coach(self, coach_id: int, client_id: int) -> list[CoachProgramAssignmentResponse]:
        relationship = await self.relationships.get_for_coach(coach_id, client_id, current_only=True)
        if not relationship:
            raise CoachClientRelationshipNotFound()
        assignments = await self.list_assignments(coach_id=coach_id, client_id=client_id)
        return [item for item in assignments if item.relationship_id == relationship.id]

    async def get_assignment(self, *, assignment_id: int, client_id: int) -> CoachProgramAssignmentResponse:
        assignment = await self.repository.get_assignment(assignment_id, client_id=client_id)
        if not assignment:
            raise WorkoutNotFoundError("Program assignment not found")
        return await self._serialize_assignment(assignment)

    async def update_assignment(self, coach_id: int, assignment_id: int, data: CoachProgramAssignmentStatusUpdate) -> CoachProgramAssignmentResponse:
        assignment = await self.repository.get_assignment(assignment_id, coach_id=coach_id, lock=True)
        if not assignment:
            raise WorkoutNotFoundError("Program assignment not found")
        relationship = await self.relationships.get_for_coach(coach_id, assignment.client_id, active_only=True, lock=True)
        if not relationship or relationship.id != assignment.relationship_id:
            raise CoachClientRelationshipNotFound()
        current = CoachProgramAssignmentStatus(assignment.status)
        allowed = {
            CoachProgramAssignmentStatus.ACTIVE: {CoachProgramAssignmentStatus.PAUSED, CoachProgramAssignmentStatus.COMPLETED, CoachProgramAssignmentStatus.CANCELLED},
            CoachProgramAssignmentStatus.PAUSED: {CoachProgramAssignmentStatus.ACTIVE, CoachProgramAssignmentStatus.COMPLETED, CoachProgramAssignmentStatus.CANCELLED},
            CoachProgramAssignmentStatus.COMPLETED: set(),
            CoachProgramAssignmentStatus.CANCELLED: set(),
        }
        if data.status not in allowed[current]:
            raise WorkoutConflictError("Invalid program assignment status transition")
        assignment.status = data.status.value
        assignment.client_message = data.client_message
        now = datetime.now(UTC)
        if data.status == CoachProgramAssignmentStatus.PAUSED:
            assignment.paused_at = now
        elif data.status == CoachProgramAssignmentStatus.COMPLETED:
            assignment.completed_at = now
            assignment.end_date = now.date()
        elif data.status == CoachProgramAssignmentStatus.CANCELLED:
            assignment.cancelled_at = now
            assignment.end_date = now.date()
        await self.db.commit()
        await self.db.refresh(assignment)
        audit_log(action=COACH_ASSIGNMENT_STATUS_CHANGED, user_db_id=coach_id, resource_type="coach_program_assignment", resource_id=assignment.id, meta={"program_id": assignment.program_id, "assignment_id": assignment.id, "client_id": assignment.client_id, "program_version": assignment.program_version, "status": assignment.status})
        return await self._serialize_assignment(assignment)

    async def start_day(self, client_id: int, assignment_id: int, day_id: int, idempotency_key: str) -> CoachProgramWorkoutStartResponse:
        # Validate current authorization before consulting the idempotency cache. A cached
        # response must not let a client start/replay after an assignment or relationship
        # has been paused or revoked.
        assignment = await self.repository.get_assignment(assignment_id, client_id=client_id)
        if not assignment:
            raise WorkoutNotFoundError("Program assignment not found")
        relationship = await self.relationships.get_for_coach(assignment.coach_id, client_id, active_only=True)
        if not relationship or relationship.id != assignment.relationship_id:
            raise CoachClientRelationshipNotFound()
        if assignment.status != CoachProgramAssignmentStatus.ACTIVE.value:
            raise WorkoutConflictError("Only active program assignments can start a day")
        if assignment.start_date and assignment.start_date > date.today():
            raise WorkoutConflictError("Program assignment has not started yet")
        return await run_idempotent(
            user_id=client_id,
            scope=f"coach_program_start:{assignment_id}:{day_id}",
            raw_key=idempotency_key,
            ttl_seconds=settings.IDEMPOTENCY_DEFAULT_TTL_SECONDS,
            execute=lambda: self._start_day_once(client_id, assignment_id, day_id, idempotency_key),
            serialize_result=lambda response: response.model_dump(mode="json"),
            deserialize_result=CoachProgramWorkoutStartResponse.model_validate,
        )

    async def _start_day_once(self, client_id: int, assignment_id: int, day_id: int, idempotency_key: str) -> CoachProgramWorkoutStartResponse:
        assignment = await self.repository.get_assignment(assignment_id, client_id=client_id, lock=True)
        if not assignment:
            raise WorkoutNotFoundError("Program assignment not found")
        relationship = await self.relationships.get_for_coach(assignment.coach_id, client_id, active_only=True, lock=True)
        if not relationship or relationship.id != assignment.relationship_id:
            raise CoachClientRelationshipNotFound()
        if assignment.status != CoachProgramAssignmentStatus.ACTIVE.value:
            raise WorkoutConflictError("Only active program assignments can start a day")
        if assignment.start_date and assignment.start_date > date.today():
            raise WorkoutConflictError("Program assignment has not started yet")
        program = await self._owned_program(assignment.coach_id, assignment.program_id, lock=True)
        if program.status != CoachProgramStatus.ACTIVE.value or program.version != assignment.program_version:
            raise WorkoutConflictError("Program assignment is no longer startable")
        day = await self.repository.get_day(program.id, day_id)
        if not day:
            raise WorkoutNotFoundError("Program day not found")
        template = await self.repository.get_template(assignment.coach_id, day.workout_template_id)
        if not template or template.version != day.template_version:
            raise WorkoutConflictError("Workout template changed or is unavailable")
        metadata = {
            "assignment_id": assignment.id, "program_id": program.id,
            "program_version": assignment.program_version, "program_day_id": day.id,
            "workout_template_id": template.id,
        }
        started = await WorkoutsService(self.db).create_workout_session(
            user_id=client_id,
            data=WorkoutSessionCreateRequest(
                source_type=WorkoutSessionSourceType.COACH_PROGRAM,
                source_id=assignment.id,
                name=f"{program.name} — {day.name}",
                type=WorkoutSessionType(template.type),
            ),
            authorized_template=template,
            source_metadata=metadata,
            idempotency_key=idempotency_key,
        )
        audit_log(action=CLIENT_ASSIGNED_WORKOUT_STARTED, user_db_id=client_id, resource_type="workout_log", resource_id=started.id, meta={"program_id": program.id, "assignment_id": assignment.id, "client_id": client_id, "program_version": assignment.program_version, "day_id": day.id})
        return CoachProgramWorkoutStartResponse(
            assignment_id=assignment.id, program_id=program.id,
            program_version=assignment.program_version, program_day_id=day.id,
            workout_template_id=template.id, workout_session_id=started.id,
            source_type=started.source_type.value, source_metadata=metadata,
        )
