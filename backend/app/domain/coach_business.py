from __future__ import annotations

from datetime import date, datetime
from enum import StrEnum

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.domain.base import Base


class CoachPackageStatus(StrEnum):
    ACTIVE = "ACTIVE"
    ARCHIVED = "ARCHIVED"


class CoachClientPackageStatus(StrEnum):
    ACTIVE = "ACTIVE"
    EXHAUSTED = "EXHAUSTED"
    EXPIRED = "EXPIRED"
    CANCELLED = "CANCELLED"


class CoachPaymentStatus(StrEnum):
    RECORDED = "RECORDED"
    REVERSED = "REVERSED"


class CoachTaskPriority(StrEnum):
    LOW = "LOW"
    NORMAL = "NORMAL"
    HIGH = "HIGH"


class CoachTaskSource(StrEnum):
    MANUAL = "MANUAL"
    SYSTEM = "SYSTEM"


class CoachPackage(Base):
    """Reusable package template owned by a coach."""

    __tablename__ = "coach_packages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    coach_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(String(2000))
    sessions_total: Mapped[int] = mapped_column(Integer, nullable=False)
    validity_days: Mapped[int | None] = mapped_column(Integer)
    price_amount: Mapped[float | None] = mapped_column(Numeric(12, 2))
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="RUB", server_default="RUB")
    status: Mapped[str] = mapped_column(String(16), nullable=False, default=CoachPackageStatus.ACTIVE.value, server_default="ACTIVE")
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        CheckConstraint("trim(name) <> ''", name="ck_coach_packages_name_not_blank"),
        CheckConstraint("sessions_total >= 1", name="ck_coach_packages_sessions_total_positive"),
        CheckConstraint("validity_days IS NULL OR validity_days >= 1", name="ck_coach_packages_validity_days_positive"),
        CheckConstraint("price_amount IS NULL OR price_amount >= 0", name="ck_coach_packages_price_non_negative"),
        CheckConstraint("status IN ('ACTIVE', 'ARCHIVED')", name="ck_coach_packages_status"),
        Index("ix_coach_packages_coach_status", "coach_id", "status"),
    )


class CoachClientPackage(Base):
    """Package sold/assigned to a specific client; balance derived from the ledger."""

    __tablename__ = "coach_client_packages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    coach_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    client_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    relationship_id: Mapped[int] = mapped_column(ForeignKey("coach_clients.id", ondelete="RESTRICT"), nullable=False)
    package_id: Mapped[int | None] = mapped_column(ForeignKey("coach_packages.id", ondelete="SET NULL"), nullable=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    sessions_total: Mapped[int] = mapped_column(Integer, nullable=False)
    sessions_used: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    price_amount: Mapped[float | None] = mapped_column(Numeric(12, 2))
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="RUB", server_default="RUB")
    purchased_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    expires_at: Mapped[date | None] = mapped_column(Date)
    auto_consume: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    status: Mapped[str] = mapped_column(String(16), nullable=False, default=CoachClientPackageStatus.ACTIVE.value, server_default="ACTIVE")
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        CheckConstraint("sessions_total >= 1", name="ck_coach_client_packages_sessions_total_positive"),
        CheckConstraint("sessions_used >= 0", name="ck_coach_client_packages_sessions_used_non_negative"),
        CheckConstraint("sessions_used <= sessions_total", name="ck_coach_client_packages_sessions_used_within_total"),
        CheckConstraint("status IN ('ACTIVE', 'EXHAUSTED', 'EXPIRED', 'CANCELLED')", name="ck_coach_client_packages_status"),
        Index("ix_coach_client_packages_coach_client_status", "coach_id", "client_id", "status"),
    )


class CoachPackageUsage(Base):
    """Authoritative append-only ledger: each row is one consume or reversal."""

    __tablename__ = "coach_package_usage"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    client_package_id: Mapped[int] = mapped_column(ForeignKey("coach_client_packages.id", ondelete="CASCADE"), nullable=False)
    delta: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[str] = mapped_column(String(16), nullable=False)
    workout_id: Mapped[int | None] = mapped_column(ForeignKey("workout_logs.id", ondelete="SET NULL"), nullable=True)
    actor_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    idempotency_key: Mapped[str | None] = mapped_column(String(128))
    reversal_of_usage_id: Mapped[int | None] = mapped_column(ForeignKey("coach_package_usage.id", ondelete="SET NULL"), nullable=True)
    note: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        CheckConstraint("delta IN (-1, 1)", name="ck_coach_package_usage_delta_unit"),
        CheckConstraint("reason IN ('CONSUME', 'REVERSE', 'AUTO_CONSUME')", name="ck_coach_package_usage_reason"),
        UniqueConstraint("client_package_id", "idempotency_key", name="uq_coach_package_usage_idempotency"),
        Index("ix_coach_package_usage_package_created", "client_package_id", "created_at"),
        Index("ix_coach_package_usage_workout", "workout_id"),
        Index("uq_coach_package_usage_reversal_target", "reversal_of_usage_id", unique=True),
    )


class CoachPayment(Base):
    """Manually recorded payment; reversal keeps the original row."""

    __tablename__ = "coach_payments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    coach_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    client_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    relationship_id: Mapped[int] = mapped_column(ForeignKey("coach_clients.id", ondelete="RESTRICT"), nullable=False)
    client_package_id: Mapped[int | None] = mapped_column(ForeignKey("coach_client_packages.id", ondelete="SET NULL"), nullable=True)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="RUB", server_default="RUB")
    method: Mapped[str] = mapped_column(String(32), nullable=False, default="CASH", server_default="CASH")
    status: Mapped[str] = mapped_column(String(16), nullable=False, default=CoachPaymentStatus.RECORDED.value, server_default="RECORDED")
    paid_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    comment: Mapped[str | None] = mapped_column(String(1000))
    reversed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_coach_payments_amount_positive"),
        CheckConstraint("status IN ('RECORDED', 'REVERSED')", name="ck_coach_payments_status"),
        CheckConstraint("method IN ('CASH', 'CARD', 'TRANSFER', 'OTHER')", name="ck_coach_payments_method"),
        Index("ix_coach_payments_coach_client_status", "coach_id", "client_id", "status"),
    )


class CoachTask(Base):
    """Coach task with optional client link; completion and deletion are soft."""

    __tablename__ = "coach_tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    coach_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    client_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(String(2000))
    priority: Mapped[str] = mapped_column(String(8), nullable=False, default=CoachTaskPriority.NORMAL.value, server_default="NORMAL")
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    source: Mapped[str] = mapped_column(String(8), nullable=False, default=CoachTaskSource.MANUAL.value, server_default="MANUAL")
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        CheckConstraint("trim(title) <> ''", name="ck_coach_tasks_title_not_blank"),
        CheckConstraint("priority IN ('LOW', 'NORMAL', 'HIGH')", name="ck_coach_tasks_priority"),
        CheckConstraint("source IN ('MANUAL', 'SYSTEM')", name="ck_coach_tasks_source"),
        Index("ix_coach_tasks_coach_completed_due", "coach_id", "completed_at", "due_at"),
        Index("ix_coach_tasks_client", "client_id"),
    )
