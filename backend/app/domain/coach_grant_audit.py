"""Append-only audit records for explicit client-owned Coach grants."""
from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.domain.base import Base


class CoachGrantAudit(Base):
    __tablename__ = "coach_grant_audit"

    id: Mapped[str] = mapped_column(Uuid(as_uuid=False), primary_key=True, default=lambda: str(uuid4()))
    grant_id: Mapped[str] = mapped_column(Uuid(as_uuid=False), nullable=False)
    relationship_id: Mapped[int] = mapped_column(Integer, nullable=False)
    coach_id: Mapped[int] = mapped_column(Integer, nullable=False)
    client_id: Mapped[int] = mapped_column(Integer, nullable=False)
    actor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    scope: Mapped[str] = mapped_column(String(48), nullable=False)
    consent_version: Mapped[str] = mapped_column(String(32), nullable=False)
    action: Mapped[str] = mapped_column(String(16), nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        CheckConstraint("action IN ('GRANTED', 'REVOKED')", name="ck_coach_grant_audit_action"),
    )
