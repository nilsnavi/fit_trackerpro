from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING
from uuid import uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, Uuid
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.domain.base import Base

if TYPE_CHECKING:
    from app.domain.user import User


class CoachInvitationStatus(StrEnum):
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    EXPIRED = "EXPIRED"
    REVOKED = "REVOKED"


class CoachInvitation(Base):
    __tablename__ = "coach_invitations"

    id: Mapped[str] = mapped_column(Uuid(as_uuid=False), primary_key=True, default=lambda: str(uuid4()))
    coach_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    client_hint: Mapped[str | None] = mapped_column(String(255), nullable=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    status: Mapped[CoachInvitationStatus] = mapped_column(
        SAEnum(CoachInvitationStatus, native_enum=False, values_callable=lambda enum: [item.value for item in enum], length=16),
        nullable=False,
        default=CoachInvitationStatus.PENDING,
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    accepted_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    coach: Mapped["User"] = relationship("User", foreign_keys=[coach_id], back_populates="coach_invitations")
    accepted_by: Mapped["User | None"] = relationship("User", foreign_keys=[accepted_by_user_id])

    __table_args__ = (
        CheckConstraint("status IN ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED')", name="ck_coach_invitations_status"),
        Index("ix_coach_invitations_coach_status", "coach_id", "status"),
        Index("ix_coach_invitations_expires_at", "expires_at"),
    )
