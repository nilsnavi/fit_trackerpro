from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.coach_business import (
    CoachClientPackage,
    CoachPackage,
    CoachPackageUsage,
    CoachPayment,
    CoachTask,
)
from app.domain.coach_client import CoachClient


class CoachBusinessRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ------------------------------------------------------------------
    # Package templates
    # ------------------------------------------------------------------
    async def get_package(self, coach_id: int, package_id: int, *, lock: bool = False) -> CoachPackage | None:
        query = select(CoachPackage).where(CoachPackage.coach_id == coach_id, CoachPackage.id == package_id)
        if lock:
            query = query.with_for_update()
        return await self.db.scalar(query)

    async def list_packages(self, coach_id: int, *, include_archived: bool = False) -> list[CoachPackage]:
        query = select(CoachPackage).where(CoachPackage.coach_id == coach_id)
        if not include_archived:
            query = query.where(CoachPackage.status == "ACTIVE")
        result = await self.db.scalars(query.order_by(CoachPackage.created_at.desc(), CoachPackage.id.desc()))
        return list(result)

    # ------------------------------------------------------------------
    # Client packages
    # ------------------------------------------------------------------
    async def get_client_package(
        self, coach_id: int, client_package_id: int, *, lock: bool = False
    ) -> CoachClientPackage | None:
        query = select(CoachClientPackage).where(
            CoachClientPackage.coach_id == coach_id,
            CoachClientPackage.id == client_package_id,
        )
        if lock:
            query = query.with_for_update().execution_options(populate_existing=True)
        return await self.db.scalar(query)

    async def list_client_packages(self, coach_id: int, client_id: int) -> list[CoachClientPackage]:
        result = await self.db.scalars(
            select(CoachClientPackage)
            .where(
                CoachClientPackage.coach_id == coach_id,
                CoachClientPackage.client_id == client_id,
                CoachClientPackage.status != "CANCELLED",
            )
            .order_by(CoachClientPackage.created_at.desc(), CoachClientPackage.id.desc())
        )
        return list(result)

    async def active_auto_consume_package(self, coach_id: int, client_id: int) -> CoachClientPackage | None:
        """Earliest active package with auto-consume enabled (usage order is FIFO)."""
        return await self.db.scalar(
            select(CoachClientPackage)
            .where(
                CoachClientPackage.coach_id == coach_id,
                CoachClientPackage.client_id == client_id,
                CoachClientPackage.status == "ACTIVE",
                CoachClientPackage.auto_consume.is_(True),
            )
            .order_by(CoachClientPackage.created_at, CoachClientPackage.id)
        )

    # ------------------------------------------------------------------
    # Usage ledger
    # ------------------------------------------------------------------
    async def find_usage_by_idempotency_key(self, client_package_id: int, idempotency_key: str) -> CoachPackageUsage | None:
        return await self.db.scalar(
            select(CoachPackageUsage).where(
                CoachPackageUsage.client_package_id == client_package_id,
                CoachPackageUsage.idempotency_key == idempotency_key,
            )
        )

    async def find_usage_by_workout(self, client_package_id: int, workout_id: int) -> CoachPackageUsage | None:
        return await self.db.scalar(
            select(CoachPackageUsage).where(
                CoachPackageUsage.client_package_id == client_package_id,
                CoachPackageUsage.workout_id == workout_id,
            )
        )

    async def find_usage_by_workout_any_package(self, coach_id: int, client_id: int, workout_id: int) -> CoachPackageUsage | None:
        return await self.db.scalar(
            select(CoachPackageUsage)
            .join(CoachClientPackage, CoachClientPackage.id == CoachPackageUsage.client_package_id)
            .where(
                CoachClientPackage.coach_id == coach_id,
                CoachClientPackage.client_id == client_id,
                CoachPackageUsage.workout_id == workout_id,
            )
        )

    async def usage_history(self, client_package_id: int) -> list[CoachPackageUsage]:
        result = await self.db.scalars(
            select(CoachPackageUsage)
            .where(CoachPackageUsage.client_package_id == client_package_id)
            .order_by(CoachPackageUsage.created_at.desc(), CoachPackageUsage.id.desc())
        )
        return list(result)

    async def last_consumable_usage(self, client_package_id: int) -> CoachPackageUsage | None:
        """Most recent CONSUME/AUTO_CONSUME row that has no reversal yet."""
        reversed_ids = (
            select(CoachPackageUsage.reversal_of_usage_id)
            .where(CoachPackageUsage.reversal_of_usage_id.is_not(None))
            .scalar_subquery()
        )
        return await self.db.scalar(
            select(CoachPackageUsage)
            .where(
                CoachPackageUsage.client_package_id == client_package_id,
                CoachPackageUsage.delta == -1,
                CoachPackageUsage.id.not_in(reversed_ids),
            )
            .order_by(CoachPackageUsage.created_at.desc(), CoachPackageUsage.id.desc())
        )

    # ------------------------------------------------------------------
    # Payments
    # ------------------------------------------------------------------
    async def get_payment(self, coach_id: int, payment_id: int) -> CoachPayment | None:
        return await self.db.scalar(
            select(CoachPayment).where(CoachPayment.coach_id == coach_id, CoachPayment.id == payment_id)
        )

    async def list_payments(self, coach_id: int, client_id: int) -> list[CoachPayment]:
        result = await self.db.scalars(
            select(CoachPayment)
            .where(CoachPayment.coach_id == coach_id, CoachPayment.client_id == client_id)
            .order_by(CoachPayment.paid_at.desc(), CoachPayment.id.desc())
        )
        return list(result)

    # ------------------------------------------------------------------
    # Tasks
    # ------------------------------------------------------------------
    async def get_task(self, coach_id: int, task_id: int) -> CoachTask | None:
        return await self.db.scalar(
            select(CoachTask).where(
                CoachTask.coach_id == coach_id,
                CoachTask.id == task_id,
                CoachTask.deleted_at.is_(None),
            )
        )

    async def list_tasks(
        self,
        coach_id: int,
        *,
        client_id: int | None = None,
        completed: bool | None = None,
        due_today: bool = False,
    ) -> list[CoachTask]:
        query = select(CoachTask).where(CoachTask.coach_id == coach_id, CoachTask.deleted_at.is_(None))
        if client_id is not None:
            query = query.where(CoachTask.client_id == client_id)
        if completed is not None:
            query = query.where(CoachTask.completed_at.is_not(None) if completed else CoachTask.completed_at.is_(None))
        if due_today:
            day_start = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
            day_end = day_start.replace(hour=23, minute=59, second=59, microsecond=999999)
            query = query.where(
                CoachTask.due_at.is_not(None),
                CoachTask.completed_at.is_(None),
                CoachTask.due_at >= day_start,
                CoachTask.due_at <= day_end,
            )
        result = await self.db.scalars(query.order_by(CoachTask.due_at.is_(None), CoachTask.due_at, CoachTask.id.desc()))
        return list(result)

    # ------------------------------------------------------------------
    # Relationships (scoped reads)
    # ------------------------------------------------------------------
    async def active_relationship(self, coach_id: int, client_id: int) -> CoachClient | None:
        return await self.db.scalar(
            select(CoachClient).where(
                CoachClient.coach_id == coach_id,
                CoachClient.client_id == client_id,
                CoachClient.status == "ACTIVE",
            )
        )

    async def count_packages_low(self, coach_id: int, *, remaining_threshold: int = 2) -> int:
        return int(
            await self.db.scalar(
                select(func.count(CoachClientPackage.id)).where(
                    CoachClientPackage.coach_id == coach_id,
                    CoachClientPackage.status == "ACTIVE",
                    (CoachClientPackage.sessions_total - CoachClientPackage.sessions_used) <= remaining_threshold,
                )
            )
            or 0
        )
