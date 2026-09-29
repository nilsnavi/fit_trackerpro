from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, time

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.coach_client import CoachClient, CoachClientStatus
from app.domain.coach_program import (
    CoachProgram,
    CoachProgramAssignment,
    CoachProgramAssignmentStatus,
    CoachProgramDay,
)
from app.domain.user import User
from app.domain.workout_log import WorkoutLog
from app.domain.workout_template import WorkoutTemplate
from app.schemas.coach_monitoring import (
    ActiveWorkoutSummary,
    AttentionSeverity,
    AttentionSignal,
    ClientMonitoringPage,
    ClientMonitoringSummary,
    MonitoringAssignment,
    MonitoringStatus,
)
from app.settings import settings

SEVERITY_PRIORITY = {
    MonitoringStatus.HIGH: 300,
    MonitoringStatus.ATTENTION: 200,
    MonitoringStatus.NOTICE: 100,
    MonitoringStatus.OK: 0,
}
DEFAULT_NO_WORKOUT_DAYS = 7


@dataclass(frozen=True)
class MonitoringContext:
    relationship: CoachClient
    client: User
    assignment: CoachProgramAssignment | None
    program: CoachProgram | None
    template_versions_match: bool | None
    last_completed_at: datetime | None
    active_workout: WorkoutLog | None
    last_program_activity_at: datetime | None
    now: datetime
    no_workout_days: int


class AttentionRuleEngine:
    """Pure deterministic rules; all context data is loaded by the query layer."""

    @staticmethod
    def evaluate(context: MonitoringContext) -> list[AttentionSignal]:
        signals: list[AttentionSignal] = []
        last = context.last_completed_at
        days_since = None
        if last is not None:
            if last.tzinfo is None:
                last = last.replace(tzinfo=UTC)
            days_since = max(0, int((context.now - last.astimezone(UTC)).total_seconds() // 86400))
        if days_since is None or days_since >= context.no_workout_days:
            days = days_since if days_since is not None else context.no_workout_days
            signals.append(AttentionSignal(
                code="NO_RECENT_WORKOUT", severity=AttentionSeverity.ATTENTION,
                title="Нет недавних тренировок", description=f"Нет завершённых тренировок {days} дней",
                occurred_at=context.now, source_type="workout_log",
                source_id=None, metadata={"days": days, "threshold_days": context.no_workout_days},
            ))
        assignment = context.assignment
        if assignment and assignment.status == CoachProgramAssignmentStatus.ACTIVE.value:
            activity = context.last_program_activity_at
            if assignment.start_date and assignment.start_date > context.now.date():
                activity = None
            elif activity is None:
                started = assignment.start_date
                activity = datetime.combine(started, time.min, tzinfo=UTC) if started else assignment.created_at
            if activity is not None:
                if activity.tzinfo is None:
                    activity = activity.replace(tzinfo=UTC)
                inactivity_days = max(0, int((context.now - activity.astimezone(UTC)).total_seconds() // 86400))
                if inactivity_days >= context.no_workout_days:
                    signals.append(AttentionSignal(
                        code="MISSED_PROGRAM_ACTIVITY", severity=AttentionSeverity.ATTENTION,
                        title="Нет активности по программе",
                        description=f"Нет активности по назначенной программе {inactivity_days} дней",
                        occurred_at=activity, source_type="coach_program_assignment", source_id=assignment.id,
                        metadata={"days": inactivity_days, "threshold_days": context.no_workout_days},
                    ))
        if assignment and assignment.status == CoachProgramAssignmentStatus.PAUSED.value:
            signals.append(AttentionSignal(
                code="ASSIGNMENT_PAUSED", severity=AttentionSeverity.NOTICE,
                title="Программа приостановлена", description="Назначенная программа приостановлена",
                occurred_at=assignment.paused_at or assignment.updated_at, source_type="coach_program_assignment",
                source_id=assignment.id,
            ))
        if assignment and assignment.status == CoachProgramAssignmentStatus.ACTIVE.value and context.program:
            if context.program.version != assignment.program_version or context.template_versions_match is False:
                signals.append(AttentionSignal(
                    code="PROGRAM_VERSION_BLOCKED", severity=AttentionSeverity.ATTENTION,
                    title="Версия программы изменилась",
                    description="Запуск программы заблокирован: версия программы или шаблона отличается от снимка назначения",
                    occurred_at=context.program.updated_at, source_type="coach_program_assignment", source_id=assignment.id,
                    metadata={"assignment_version": assignment.program_version, "current_version": context.program.version},
                ))
        workout = context.active_workout
        if workout:
            started = workout.started_at or workout.created_at
            if started.tzinfo is None:
                started = started.replace(tzinfo=UTC)
            stale_days = max(0, int((context.now - started.astimezone(UTC)).total_seconds() // 86400))
            if stale_days >= context.no_workout_days:
                signals.append(AttentionSignal(
                    code="ACTIVE_WORKOUT_STALE", severity=AttentionSeverity.NOTICE,
                    title="Есть незавершённая тренировка",
                    description=f"Тренировка остаётся незавершённой {stale_days} дней",
                    occurred_at=started, source_type="workout_log", source_id=workout.id,
                    metadata={"days": stale_days, "status": workout.status},
                ))
        if context.relationship.status == CoachClientStatus.PAUSED:
            signals.append(AttentionSignal(
                code="RELATIONSHIP_PAUSED", severity=AttentionSeverity.NOTICE,
                title="Связь с клиентом приостановлена", description="Мониторинг активных тренировок приостановлен",
                occurred_at=context.relationship.updated_at, source_type="coach_client", source_id=context.relationship.id,
            ))
        return signals


class CoachMonitoringService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.rules = AttentionRuleEngine()

    @staticmethod
    def _display_name(client: User) -> str:
        return (client.first_name or client.username or f"Клиент {client.id}").strip()

    async def _contexts(self, coach_id: int) -> list[MonitoringContext]:
        last_completed = (
            select(WorkoutLog.user_id.label("user_id"), func.max(WorkoutLog.completed_at).label("last_completed_at"))
            .where(WorkoutLog.status == "completed", WorkoutLog.completed_at.is_not(None))
            .group_by(WorkoutLog.user_id).subquery()
        )
        active_workouts = (
            select(WorkoutLog.user_id.label("user_id"), func.max(WorkoutLog.id).label("workout_id"))
            .where(WorkoutLog.status.in_(("active", "paused")))
            .group_by(WorkoutLog.user_id).subquery()
        )
        program_activity = (
            select(
                WorkoutLog.source_id.label("assignment_id"),
                func.max(func.coalesce(WorkoutLog.completed_at, WorkoutLog.started_at, WorkoutLog.created_at)).label("last_activity_at"),
            )
            .where(WorkoutLog.source_type == "coach_program", WorkoutLog.source_id.is_not(None))
            .group_by(WorkoutLog.source_id).subquery()
        )
        assignment_ranked = (
            select(
                CoachProgramAssignment.id.label("assignment_id"),
                CoachProgramAssignment.client_id.label("client_id"),
                func.row_number().over(
                    partition_by=CoachProgramAssignment.client_id,
                    order_by=(
                        case((CoachProgramAssignment.status == "ACTIVE", 0), else_=1),
                        CoachProgramAssignment.updated_at.desc(),
                        CoachProgramAssignment.id.desc(),
                    ),
                ).label("row_number"),
            )
            .where(CoachProgramAssignment.coach_id == coach_id,
                   CoachProgramAssignment.status.in_(("ACTIVE", "PAUSED")))
            .subquery()
        )
        latest_assignment = select(
            assignment_ranked.c.client_id, assignment_ranked.c.assignment_id
        ).where(assignment_ranked.c.row_number == 1).subquery()
        statement = (
            select(CoachClient, User, last_completed.c.last_completed_at, WorkoutLog,
                   CoachProgramAssignment, CoachProgram, program_activity.c.last_activity_at)
            .join(User, User.id == CoachClient.client_id)
            .outerjoin(last_completed, last_completed.c.user_id == User.id)
            .outerjoin(active_workouts, active_workouts.c.user_id == User.id)
            .outerjoin(WorkoutLog, WorkoutLog.id == active_workouts.c.workout_id)
            .outerjoin(latest_assignment, latest_assignment.c.client_id == User.id)
            .outerjoin(CoachProgramAssignment, CoachProgramAssignment.id == latest_assignment.c.assignment_id)
            .outerjoin(CoachProgram, CoachProgram.id == CoachProgramAssignment.program_id)
            .outerjoin(program_activity, program_activity.c.assignment_id == CoachProgramAssignment.id)
            .where(CoachClient.coach_id == coach_id,
                   CoachClient.status.in_((CoachClientStatus.ACTIVE, CoachClientStatus.PAUSED)))
            .order_by(CoachClient.client_id, CoachClient.id.desc())
        )
        rows = (await self.db.execute(statement)).all()
        contexts: list[MonitoringContext] = []
        now = datetime.now(UTC)
        by_client: set[int] = set()
        for relationship, client, last_at, active_workout, assignment, program, activity_at in rows:
            if relationship.client_id in by_client:
                continue
            by_client.add(relationship.client_id)
            contexts.append(MonitoringContext(
                relationship=relationship, client=client, assignment=assignment, program=program,
                template_versions_match=None, last_completed_at=last_at, active_workout=active_workout,
                last_program_activity_at=activity_at,
                now=now, no_workout_days=max(1, int(getattr(settings, "COACH_MONITORING_NO_WORKOUT_DAYS", DEFAULT_NO_WORKOUT_DAYS))),
            ))
        # The template comparison is fetched for all active assignments in one query.
        assignment_ids = [c.assignment.id for c in contexts if c.assignment]
        if assignment_ids:
            version_statement = (
                select(CoachProgramAssignment.id, CoachProgramDay.template_version, WorkoutTemplate.version)
                .join(CoachProgramDay, CoachProgramDay.program_id == CoachProgramAssignment.program_id)
                .outerjoin(WorkoutTemplate, WorkoutTemplate.id == CoachProgramDay.workout_template_id)
                .where(CoachProgramAssignment.id.in_(assignment_ids))
            )
            versions = (await self.db.execute(version_statement)).all()
            matches: dict[int, bool] = {}
            has_days: set[int] = set()
            for assignment_id, expected, actual in versions:
                has_days.add(assignment_id)
                matches[assignment_id] = matches.get(assignment_id, True) and actual == expected
            for assignment_id in assignment_ids:
                matches.setdefault(assignment_id, assignment_id in has_days)
            contexts = [
                MonitoringContext(**{**context.__dict__, "template_versions_match": matches.get(context.assignment.id, False)})
                if context.assignment and context.assignment.status == "ACTIVE" else context
                for context in contexts
            ]
        return contexts

    def _summary(self, context: MonitoringContext) -> ClientMonitoringSummary:
        signals = self.rules.evaluate(context)
        severity_order = {AttentionSeverity.HIGH: 3, AttentionSeverity.ATTENTION: 2, AttentionSeverity.NOTICE: 1, AttentionSeverity.INFO: 0}
        highest = max((signal.severity for signal in signals), key=severity_order.get, default=None)
        status = MonitoringStatus(highest.value) if highest else MonitoringStatus.OK
        last = context.last_completed_at
        if last and last.tzinfo is None:
            last = last.replace(tzinfo=UTC)
        days_since = max(0, int((context.now - last.astimezone(UTC)).total_seconds() // 86400)) if last else None
        active = context.assignment
        assignment = None
        if active and context.program:
            assignment = MonitoringAssignment(
                assignment_id=active.id, program_id=active.program_id, program_name=context.program.name,
                status=active.status, start_date=active.start_date, program_version=active.program_version,
            )
        active_workout = None
        if context.active_workout:
            active_workout = ActiveWorkoutSummary(
                workout_id=context.active_workout.id, status=context.active_workout.status,
                started_at=context.active_workout.started_at,
            )
        return ClientMonitoringSummary(
            client_id=context.client.id, display_name=self._display_name(context.client),
            relationship_status=context.relationship.status, active_assignment=assignment,
            last_completed_workout_at=last, days_since_last_workout=days_since,
            active_workout=active_workout, attention_status=status, signals=signals,
            signal_count=len(signals), sort_priority=SEVERITY_PRIORITY[status],
        )

    async def list_clients(self, coach_id: int, *, status: str = "all", severity: str | None = None,
                           search: str | None = None, limit: int = 50, offset: int = 0) -> ClientMonitoringPage:
        summaries = [self._summary(context) for context in await self._contexts(coach_id)]
        if severity:
            summaries = [item for item in summaries if any(signal.severity.value == severity for signal in item.signals)]
        if search:
            term = search.strip().casefold()
            summaries = [item for item in summaries if term in item.display_name.casefold()]
        attention_count = sum(item.attention_status != MonitoringStatus.OK for item in summaries)
        ok_count = sum(item.attention_status == MonitoringStatus.OK for item in summaries)
        if status == "attention":
            summaries = [item for item in summaries if item.attention_status != MonitoringStatus.OK]
        elif status == "ok":
            summaries = [item for item in summaries if item.attention_status == MonitoringStatus.OK]
        severity_rank = {MonitoringStatus.HIGH: 0, MonitoringStatus.ATTENTION: 1, MonitoringStatus.NOTICE: 2, MonitoringStatus.OK: 3}
        summaries.sort(key=lambda item: (
            severity_rank[item.attention_status],
            -max((signal.occurred_at.timestamp() for signal in item.signals), default=0),
            item.display_name.casefold(), item.client_id,
        ))
        return ClientMonitoringPage(
            items=summaries[offset:offset + limit], total=len(summaries),
            attention_count=attention_count,
            ok_count=ok_count,
        )

    async def get_client(self, coach_id: int, client_id: int) -> ClientMonitoringSummary:
        contexts = await self._contexts(coach_id)
        for context in contexts:
            if context.client.id == client_id:
                if context.relationship.status != CoachClientStatus.ACTIVE:
                    from app.domain.exceptions import CoachClientRelationshipNotFound
                    raise CoachClientRelationshipNotFound()
                return self._summary(context)
        from app.domain.exceptions import CoachClientRelationshipNotFound
        raise CoachClientRelationshipNotFound()
