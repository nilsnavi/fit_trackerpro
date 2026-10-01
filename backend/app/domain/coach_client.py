from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy import JSON, CheckConstraint, DateTime, ForeignKey, Index, Integer, text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.domain.base import Base

if TYPE_CHECKING:
    from app.domain.user import User


class CoachClientStatus(StrEnum):
    ACTIVE = "ACTIVE"
    PAUSED = "PAUSED"
    ARCHIVED = "ARCHIVED"
    REVOKED = "REVOKED"


DEFAULT_COACH_CLIENT_PERMISSIONS: dict[str, bool] = {}


class CoachClient(Base):
    __tablename__ = "coach_clients"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    coach_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    client_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status: Mapped[CoachClientStatus] = mapped_column(
        SAEnum(CoachClientStatus, native_enum=False, values_callable=lambda enum: [item.value for item in enum], length=16),
        nullable=False,
        default=CoachClientStatus.ACTIVE,
    )
    permissions: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    coach: Mapped["User"] = relationship("User", foreign_keys=[coach_id], back_populates="coached_clients")
    client: Mapped["User"] = relationship("User", foreign_keys=[client_id], back_populates="client_relationships")

    __table_args__ = (
        CheckConstraint("coach_id <> client_id", name="ck_coach_clients_not_self"),
        CheckConstraint("status IN ('ACTIVE', 'PAUSED', 'ARCHIVED', 'REVOKED')", name="ck_coach_clients_status"),
        Index("ix_coach_clients_coach_status", "coach_id", "status"),
        Index("ix_coach_clients_client_status", "client_id", "status"),
        Index(
            "uq_coach_clients_active_pair",
            "coach_id",
            "client_id",
            unique=True,
            postgresql_where=text("status = 'ACTIVE'"),
            sqlite_where=text("status = 'ACTIVE'"),
        ),
    )
