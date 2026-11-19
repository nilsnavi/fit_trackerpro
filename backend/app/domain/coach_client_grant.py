"""Explicit client-owned Coach data grants. No permission is implied by a relationship."""
from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from uuid import uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, String, Uuid, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.domain.base import Base


class CoachGrantStatus(StrEnum):
    ACTIVE = "ACTIVE"
    REVOKED = "REVOKED"
    EXPIRED = "EXPIRED"


# Health metrics are intentionally NOT grantable until a separate security review.
TRAINING_SUMMARY_READ = "training_summary.read"
WORKOUT_HISTORY_READ = "workout_history.read"
SUPPORTED_COACH_GRANT_SCOPES = frozenset({TRAINING_SUMMARY_READ, WORKOUT_HISTORY_READ})
COACH_GRANT_CONSENT_VERSION = "v2-03c-1"


class CoachClientGrant(Base):
    __tablename__ = "coach_client_grants"

    id: Mapped[str] = mapped_column(Uuid(as_uuid=False), primary_key=True, default=lambda: str(uuid4()))
    relationship_id: Mapped[int] = mapped_column(
        ForeignKey("coach_clients.id", ondelete="CASCADE"), nullable=False
    )
    coach_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    client_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    scope: Mapped[str] = mapped_column(String(48), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False)
    consent_version: Mapped[str] = mapped_column(String(32), nullable=False)
    granted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("relationship_id", "scope", name="uq_coach_grant_relationship_scope"),
        CheckConstraint("coach_id <> client_id", name="ck_coach_grant_not_self"),
        CheckConstraint(
            "scope IN ('training_summary.read', 'workout_history.read')",
            name="ck_coach_grant_scope",
        ),
        CheckConstraint(
            "status IN ('ACTIVE', 'REVOKED', 'EXPIRED')",
            name="ck_coach_grant_status",
        ),
        CheckConstraint(
            "(status = 'REVOKED' AND revoked_at IS NOT NULL) OR "
            "(status <> 'REVOKED' AND revoked_at IS NULL)",
            name="ck_coach_grant_revocation_consistency",
        ),
        CheckConstraint(
            "expires_at IS NULL OR expires_at > granted_at",
            name="ck_coach_grant_expiry_order",
        ),
        Index("ix_coach_grants_coach_client_status", "coach_id", "client_id", "status"),
        Index("ix_coach_grants_client_status", "client_id", "status"),
    )
