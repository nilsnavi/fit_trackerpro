from __future__ import annotations

from datetime import datetime
from enum import StrEnum

from sqlalchemy import (
    JSON,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.domain.base import Base


class CoachNotificationStatus(StrEnum):
    PENDING = "PENDING"
    SENT = "SENT"
    FAILED = "FAILED"
    SKIPPED = "SKIPPED"


class CoachNotificationEvent(StrEnum):
    INVITATION_CREATED = "coach.invitation.created"
    PROGRAM_ASSIGNED = "coach.program.assigned"
    WORKOUT_MISSED = "coach.workout.missed"
    PACKAGE_LOW = "coach.package.low"
    PACKAGE_EXPIRED = "coach.package.expired"
    TASK_DUE = "coach.task.due"
    CLIENT_WORKOUT_REMINDER = "client.workout.reminder"


class CoachNotification(Base):
    """Durable outbox row: business commits enqueue, a worker delivers asynchronously."""

    __tablename__ = "coach_notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    event: Mapped[str] = mapped_column(String(64), nullable=False)
    dedupe_key: Mapped[str] = mapped_column(String(200), nullable=False)
    recipient_telegram_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.telegram_id", ondelete="SET NULL", use_alter=True), nullable=True,
    )
    recipient_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default=CoachNotificationStatus.PENDING.value, server_default="PENDING")
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    next_retry_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        CheckConstraint(
            "status IN ('PENDING', 'SENT', 'FAILED', 'SKIPPED')",
            name="ck_coach_notifications_status",
        ),
        CheckConstraint(
            "event IN ('coach.invitation.created', 'coach.program.assigned', 'coach.workout.missed',"
            " 'coach.package.low', 'coach.package.expired', 'coach.task.due', 'client.workout.reminder')",
            name="ck_coach_notifications_event",
        ),
        # Dedupe: one pending/sent notification per logical event.
        Index("uq_coach_notifications_dedupe", "dedupe_key", unique=True),
        Index("ix_coach_notifications_status_retry", "status", "next_retry_at"),
        Index("ix_coach_notifications_recipient", "recipient_user_id"),
    )
