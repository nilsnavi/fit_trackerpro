from __future__ import annotations

import logging
from datetime import UTC, date, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import (
    COACH_CLIENT_PACKAGE_CANCELLED,
    COACH_CLIENT_PACKAGE_CONSUMED,
    COACH_CLIENT_PACKAGE_CREATED,
    COACH_CLIENT_PACKAGE_REVERSED,
    COACH_PACKAGE_ARCHIVED,
    COACH_PACKAGE_CREATED,
    COACH_PACKAGE_UPDATED,
    COACH_PAYMENT_RECORDED,
    COACH_PAYMENT_REVERSED,
    COACH_TASK_COMPLETED,
    COACH_TASK_CREATED,
    COACH_TASK_DELETED,
    COACH_TASK_UPDATED,
    audit_log,
)
from app.domain.coach_business import (
    CoachClientPackage,
    CoachClientPackageStatus,
    CoachPackage,
    CoachPackageStatus,
    CoachPackageUsage,
    CoachPayment,
    CoachPaymentStatus,
    CoachTask,
)
from app.domain.exceptions import (
    CoachClientRelationshipNotFound,
    CoachPackageAlreadyConsumed,
    CoachPackageExhausted,
    CoachPackageNotFound,
    CoachPackageNothingToReverse,
    CoachPaymentAlreadyReversed,
    CoachPaymentNotFound,
    CoachTaskNotFound,
)
from app.infrastructure.repositories.coach_business_repository import CoachBusinessRepository
from app.schemas.coach_business import (
    CoachClientPackageCreate,
    CoachClientPackageDetailResponse,
    CoachClientPackageResponse,
    CoachPackageConsumeRequest,
    CoachPackageCreate,
    CoachPackageResponse,
    CoachPackageReverseRequest,
    CoachPackageUpdate,
    CoachPackageUsageResponse,
    CoachPaymentCreate,
    CoachPaymentResponse,
    CoachTaskCreate,
    CoachTaskResponse,
    CoachTaskUpdate,
)

logger = logging.getLogger(__name__)

PACKAGE_LOW_THRESHOLD = 2


def _now() -> datetime:
    return datetime.now(UTC)


def _normalize_dt(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value


class CoachBusinessService:
    """Packages, payments, and tasks for the coach business context (Sprint 10.4)."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repository = CoachBusinessRepository(db)

    # ------------------------------------------------------------------
    # Package templates
    # ------------------------------------------------------------------
    async def list_packages(self, coach_id: int, *, include_archived: bool = False) -> list[CoachPackageResponse]:
        packages = await self.repository.list_packages(coach_id, include_archived=include_archived)
        return [CoachPackageResponse.model_validate(item) for item in packages]

    async def create_package(
        self, coach_id: int, data: CoachPackageCreate, client_ip: str | None = None
    ) -> CoachPackageResponse:
        package = CoachPackage(
            coach_id=coach_id,
            name=data.name.strip(),
            description=data.description,
            sessions_total=data.sessions_total,
            validity_days=data.validity_days,
            price_amount=data.price_amount,
            currency=data.currency.upper(),
        )
        self.db.add(package)
        await self.db.commit()
        await self.db.refresh(package)
        audit_log(
            action=COACH_PACKAGE_CREATED,
            user_db_id=coach_id,
            resource_type="coach_package",
            resource_id=package.id,
            client_ip=client_ip,
            meta={"sessions_total": package.sessions_total},
        )
        return CoachPackageResponse.model_validate(package)

    async def update_package(
        self, coach_id: int, package_id: int, data: CoachPackageUpdate, client_ip: str | None = None
    ) -> CoachPackageResponse:
        package = await self.repository.get_package(coach_id, package_id)
        if not package:
            raise CoachPackageNotFound()
        updates = data.model_dump(exclude_unset=True)
        if "currency" in updates and updates["currency"] is not None:
            updates["currency"] = updates["currency"].upper()
        for field, value in updates.items():
            setattr(package, field, value)
        await self.db.commit()
        await self.db.refresh(package)
        audit_log(
            action=COACH_PACKAGE_UPDATED,
            user_db_id=coach_id,
            resource_type="coach_package",
            resource_id=package.id,
            client_ip=client_ip,
        )
        return CoachPackageResponse.model_validate(package)

    async def archive_package(self, coach_id: int, package_id: int, client_ip: str | None = None) -> CoachPackageResponse:
        package = await self.repository.get_package(coach_id, package_id)
        if not package:
            raise CoachPackageNotFound()
        package.status = CoachPackageStatus.ARCHIVED.value
        package.archived_at = _now()
        await self.db.commit()
        await self.db.refresh(package)
        audit_log(
            action=COACH_PACKAGE_ARCHIVED,
            user_db_id=coach_id,
            resource_type="coach_package",
            resource_id=package.id,
            client_ip=client_ip,
        )
        return CoachPackageResponse.model_validate(package)

    # ------------------------------------------------------------------
    # Client packages
    # ------------------------------------------------------------------
    async def list_client_packages(self, coach_id: int, client_id: int) -> list[CoachClientPackageResponse]:
        packages = await self.repository.list_client_packages(coach_id, client_id)
        return [self._client_package_response(item) for item in packages]

    async def get_client_package(self, coach_id: int, client_id: int, client_package_id: int) -> CoachClientPackageDetailResponse:
        package = await self._scoped_client_package(coach_id, client_id, client_package_id)
        usage = await self.repository.usage_history(package.id)
        return CoachClientPackageDetailResponse(
            **self._client_package_response(package).model_dump(),
            usage=[CoachPackageUsageResponse.model_validate(item) for item in usage],
        )

    async def assign_package(
        self, coach_id: int, client_id: int, data: CoachClientPackageCreate, client_ip: str | None = None
    ) -> CoachClientPackageResponse:
        relationship = await self.repository.active_relationship(coach_id, client_id)
        if not relationship:
            raise CoachClientRelationshipNotFound()

        template: CoachPackage | None = None
        if data.package_id is not None:
            template = await self.repository.get_package(coach_id, data.package_id)
            if not template or template.status != CoachPackageStatus.ACTIVE.value:
                raise CoachPackageNotFound()

        purchased_at = _now()
        expires_at = data.expires_at
        if expires_at is None and template is not None and template.validity_days is not None:
            expires_at = (purchased_at + timedelta(days=template.validity_days)).date()

        package = CoachClientPackage(
            coach_id=coach_id,
            client_id=client_id,
            relationship_id=relationship.id,
            package_id=template.id if template else None,
            name=(data.name or (template.name if template else "Package")).strip(),
            sessions_total=data.sessions_total if data.sessions_total is not None else (template.sessions_total if template else None),
            price_amount=data.price_amount if data.price_amount is not None else template.price_amount if template else None,
            currency=(data.currency or (template.currency if template else "RUB")).upper(),
            purchased_at=purchased_at,
            expires_at=expires_at,
            auto_consume=data.auto_consume,
        )
        if package.sessions_total is None:
            raise CoachPackageNotFound("sessions_total is required when no package template is referenced")
        self.db.add(package)
        await self.db.commit()
        await self.db.refresh(package)
        audit_log(
            action=COACH_CLIENT_PACKAGE_CREATED,
            user_db_id=coach_id,
            resource_type="coach_client_package",
            resource_id=package.id,
            client_ip=client_ip,
            meta={"client_id": client_id, "sessions_total": package.sessions_total},
        )
        return self._client_package_response(package)

    async def consume_session(
        self,
        coach_id: int,
        client_id: int,
        client_package_id: int,
        data: CoachPackageConsumeRequest,
        *,
        idempotency_key: str | None = None,
        reason: str = "CONSUME",
        client_ip: str | None = None,
    ) -> CoachClientPackageResponse:
        package = await self._scoped_client_package(coach_id, client_id, client_package_id, lock=True)
        self._ensure_consummable(package)

        if idempotency_key:
            existing = await self.repository.find_usage_by_idempotency_key(package.id, idempotency_key)
            if existing:
                raise CoachPackageAlreadyConsumed()
        if data.workout_id is not None:
            existing = await self.repository.find_usage_by_workout(package.id, data.workout_id)
            if existing:
                raise CoachPackageAlreadyConsumed()

        usage = CoachPackageUsage(
            client_package_id=package.id,
            delta=-1,
            reason=reason,
            workout_id=data.workout_id,
            actor_user_id=coach_id,
            idempotency_key=idempotency_key,
            note=data.note,
        )
        self.db.add(usage)
        package.sessions_used += 1
        if package.sessions_used >= package.sessions_total:
            package.status = CoachClientPackageStatus.EXHAUSTED.value
        await self.db.commit()
        await self.db.refresh(package)
        audit_log(
            action=COACH_CLIENT_PACKAGE_CONSUMED,
            user_db_id=coach_id,
            resource_type="coach_client_package",
            resource_id=package.id,
            client_ip=client_ip,
            meta={"client_id": client_id, "reason": reason, "workout_id": data.workout_id},
        )
        return self._client_package_response(package)

    async def reverse_last_session(
        self,
        coach_id: int,
        client_id: int,
        client_package_id: int,
        data: CoachPackageReverseRequest | None = None,
        client_ip: str | None = None,
    ) -> CoachClientPackageResponse:
        package = await self._scoped_client_package(coach_id, client_id, client_package_id, lock=True)
        if package.sessions_used <= 0:
            raise CoachPackageNothingToReverse()
        target = await self.repository.last_consumable_usage(package.id)
        if target is None:
            raise CoachPackageNothingToReverse()

        reversal = CoachPackageUsage(
            client_package_id=package.id,
            delta=1,
            reason="REVERSE",
            workout_id=target.workout_id,
            actor_user_id=coach_id,
            reversal_of_usage_id=target.id,
            note=(data.note if data else None),
        )
        self.db.add(reversal)
        package.sessions_used -= 1
        if package.status == CoachClientPackageStatus.EXHAUSTED.value:
            package.status = CoachClientPackageStatus.ACTIVE.value
        await self.db.commit()
        await self.db.refresh(package)
        audit_log(
            action=COACH_CLIENT_PACKAGE_REVERSED,
            user_db_id=coach_id,
            resource_type="coach_client_package",
            resource_id=package.id,
            client_ip=client_ip,
            meta={"client_id": client_id, "reversal_of_usage_id": target.id},
        )
        return self._client_package_response(package)

    async def cancel_client_package(
        self, coach_id: int, client_id: int, client_package_id: int, client_ip: str | None = None
    ) -> CoachClientPackageResponse:
        package = await self._scoped_client_package(coach_id, client_id, client_package_id, lock=True)
        if package.status != CoachClientPackageStatus.CANCELLED.value:
            package.status = CoachClientPackageStatus.CANCELLED.value
            package.cancelled_at = _now()
            await self.db.commit()
            await self.db.refresh(package)
            audit_log(
                action=COACH_CLIENT_PACKAGE_CANCELLED,
                user_db_id=coach_id,
                resource_type="coach_client_package",
                resource_id=package.id,
                client_ip=client_ip,
                meta={"client_id": client_id},
            )
        return self._client_package_response(package)

    async def auto_consume_completed_workout(
        self, coach_id: int, client_id: int, workout_id: int
    ) -> CoachClientPackageResponse | None:
        """Consume one session after a coach-program workout; idempotent by workout id."""
        package = await self.repository.active_auto_consume_package(coach_id, client_id)
        if package is None:
            return None
        if await self.repository.find_usage_by_workout(package.id, workout_id) is not None:
            return self._client_package_response(package)
        return await self.consume_session(
            coach_id,
            client_id,
            package.id,
            CoachPackageConsumeRequest(workout_id=workout_id, note="Auto-consume for completed workout"),
            reason="AUTO_CONSUME",
        )

    # ------------------------------------------------------------------
    # Payments
    # ------------------------------------------------------------------
    async def list_payments(self, coach_id: int, client_id: int) -> list[CoachPaymentResponse]:
        payments = await self.repository.list_payments(coach_id, client_id)
        return [CoachPaymentResponse.model_validate(item) for item in payments]

    async def record_payment(
        self, coach_id: int, client_id: int, data: CoachPaymentCreate, client_ip: str | None = None
    ) -> CoachPaymentResponse:
        relationship = await self.repository.active_relationship(coach_id, client_id)
        if not relationship:
            raise CoachClientRelationshipNotFound()
        package = None
        if data.client_package_id is not None:
            package = await self._scoped_client_package(coach_id, client_id, data.client_package_id)
        payment = CoachPayment(
            coach_id=coach_id,
            client_id=client_id,
            relationship_id=relationship.id,
            client_package_id=package.id if package else None,
            amount=data.amount,
            currency=data.currency.upper(),
            method=data.method,
            paid_at=_normalize_dt(data.paid_at) or _now(),
            comment=data.comment,
        )
        self.db.add(payment)
        await self.db.commit()
        await self.db.refresh(payment)
        audit_log(
            action=COACH_PAYMENT_RECORDED,
            user_db_id=coach_id,
            resource_type="coach_payment",
            resource_id=payment.id,
            client_ip=client_ip,
            meta={"client_id": client_id, "amount": float(payment.amount), "currency": payment.currency},
        )
        return CoachPaymentResponse.model_validate(payment)

    async def reverse_payment(
        self, coach_id: int, client_id: int, payment_id: int, client_ip: str | None = None
    ) -> CoachPaymentResponse:
        payment = await self.repository.get_payment(coach_id, payment_id)
        if not payment or payment.client_id != client_id:
            raise CoachPaymentNotFound()
        if payment.status == CoachPaymentStatus.REVERSED.value:
            raise CoachPaymentAlreadyReversed()
        payment.status = CoachPaymentStatus.REVERSED.value
        payment.reversed_at = _now()
        await self.db.commit()
        await self.db.refresh(payment)
        audit_log(
            action=COACH_PAYMENT_REVERSED,
            user_db_id=coach_id,
            resource_type="coach_payment",
            resource_id=payment.id,
            client_ip=client_ip,
            meta={"client_id": client_id},
        )
        return CoachPaymentResponse.model_validate(payment)

    # ------------------------------------------------------------------
    # Tasks
    # ------------------------------------------------------------------
    async def list_tasks(
        self,
        coach_id: int,
        *,
        client_id: int | None = None,
        completed: bool | None = None,
        due_today: bool = False,
    ) -> list[CoachTaskResponse]:
        tasks = await self.repository.list_tasks(
            coach_id, client_id=client_id, completed=completed, due_today=due_today
        )
        return [CoachTaskResponse.model_validate(item) for item in tasks]

    async def create_task(
        self, coach_id: int, data: CoachTaskCreate, client_ip: str | None = None
    ) -> CoachTaskResponse:
        if data.client_id is not None:
            relationship = await self.repository.active_relationship(coach_id, data.client_id)
            if not relationship:
                raise CoachClientRelationshipNotFound()
        task = CoachTask(
            coach_id=coach_id,
            client_id=data.client_id,
            title=data.title.strip(),
            description=data.description,
            priority=data.priority.value,
            due_at=_normalize_dt(data.due_at),
        )
        self.db.add(task)
        await self.db.commit()
        await self.db.refresh(task)
        audit_log(
            action=COACH_TASK_CREATED,
            user_db_id=coach_id,
            resource_type="coach_task",
            resource_id=task.id,
            client_ip=client_ip,
            meta={"client_id": data.client_id, "priority": task.priority},
        )
        return CoachTaskResponse.model_validate(task)

    async def update_task(
        self, coach_id: int, task_id: int, data: CoachTaskUpdate, client_ip: str | None = None
    ) -> CoachTaskResponse:
        task = await self.repository.get_task(coach_id, task_id)
        if not task:
            raise CoachTaskNotFound()
        updates = data.model_dump(exclude_unset=True)
        if "priority" in updates and updates["priority"] is not None:
            updates["priority"] = updates["priority"].value
        if "completed_at" in updates:
            updates["completed_at"] = _normalize_dt(updates["completed_at"])
        if "due_at" in updates:
            updates["due_at"] = _normalize_dt(updates["due_at"])
        for field, value in updates.items():
            setattr(task, field, value)
        await self.db.commit()
        await self.db.refresh(task)
        audit_log(
            action=COACH_TASK_UPDATED,
            user_db_id=coach_id,
            resource_type="coach_task",
            resource_id=task.id,
            client_ip=client_ip,
        )
        return CoachTaskResponse.model_validate(task)

    async def complete_task(self, coach_id: int, task_id: int, client_ip: str | None = None) -> CoachTaskResponse:
        task = await self.repository.get_task(coach_id, task_id)
        if not task:
            raise CoachTaskNotFound()
        if task.completed_at is None:
            task.completed_at = _now()
            await self.db.commit()
            await self.db.refresh(task)
            audit_log(
                action=COACH_TASK_COMPLETED,
                user_db_id=coach_id,
                resource_type="coach_task",
                resource_id=task.id,
                client_ip=client_ip,
            )
        return CoachTaskResponse.model_validate(task)

    async def delete_task(self, coach_id: int, task_id: int, client_ip: str | None = None) -> None:
        task = await self.repository.get_task(coach_id, task_id)
        if not task:
            raise CoachTaskNotFound()
        task.deleted_at = _now()
        await self.db.commit()
        audit_log(
            action=COACH_TASK_DELETED,
            user_db_id=coach_id,
            resource_type="coach_task",
            resource_id=task.id,
            client_ip=client_ip,
        )

    # ------------------------------------------------------------------
    # Attention helpers
    # ------------------------------------------------------------------
    def package_attention(self, package: CoachClientPackage, *, today: date | None = None) -> str | None:
        """Return PACKAGE_LOW / PACKAGE_EXPIRED codes for monitoring signals."""
        today = today or date.today()
        if package.status not in (CoachClientPackageStatus.ACTIVE.value, CoachClientPackageStatus.EXHAUSTED.value):
            return None
        if package.expires_at is not None and package.expires_at < today:
            return "PACKAGE_EXPIRED"
        remaining = package.sessions_total - package.sessions_used
        if remaining <= PACKAGE_LOW_THRESHOLD:
            return "PACKAGE_LOW"
        return None

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------
    async def _scoped_client_package(
        self, coach_id: int, client_id: int, client_package_id: int, *, lock: bool = False
    ) -> CoachClientPackage:
        package = await self.repository.get_client_package(coach_id, client_package_id, lock=lock)
        if not package or package.client_id != client_id:
            raise CoachPackageNotFound()
        return package

    def _ensure_consummable(self, package: CoachClientPackage) -> None:
        today = date.today()
        if package.status == CoachClientPackageStatus.CANCELLED.value:
            raise CoachPackageNotFound("Package is cancelled")
        if package.expires_at is not None and package.expires_at < today:
            if package.status != CoachClientPackageStatus.EXPIRED.value:
                package.status = CoachClientPackageStatus.EXPIRED.value
            raise CoachPackageExhausted("Package has expired")
        if package.sessions_used >= package.sessions_total:
            raise CoachPackageExhausted()

    @staticmethod
    def _client_package_response(package: CoachClientPackage) -> CoachClientPackageResponse:
        data = {
            column.name: getattr(package, column.name)
            for column in package.__table__.columns
        }
        data["sessions_remaining"] = max(0, package.sessions_total - package.sessions_used)
        return CoachClientPackageResponse.model_validate(data)
