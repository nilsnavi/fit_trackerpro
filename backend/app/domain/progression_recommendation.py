"""ProgressionRecommendationRecord model — SPEC-006 §8–§10/§27/§52.

A recommendation is a *proposal*: it never mutates the program. The
``(source_session_id, scope_key, policy_version)`` unique constraint makes
re-evaluating the same finished session idempotent.
"""
from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.domain.base import Base
from app.domain.progression_policy import POLICY_TYPES

if TYPE_CHECKING:
    from .user import User

STATUSES = "'INCREASE','KEEP','DECREASE','DELOAD','MANUAL','INSUFFICIENT_DATA'"
LIFECYCLES = "'generated','accepted','modified','rejected','expired'"


class ProgressionRecommendationRecord(Base):
    """Persisted, explainable next-target recommendation (SPEC §8)."""

    __tablename__ = "progression_recommendations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    exercise_id: Mapped[int] = mapped_column(
        ForeignKey("exercises.id", ondelete="CASCADE"), nullable=False, index=True
    )
    template_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("workout_templates.id", ondelete="SET NULL"), nullable=True, index=True
    )
    template_exercise_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("template_exercises.id", ondelete="SET NULL"), nullable=True, index=True
    )
    scope_key: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    policy_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("progression_policies.id", ondelete="SET NULL"), nullable=True
    )
    policy_type: Mapped[str] = mapped_column(String(32), nullable=False)
    policy_version: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False, index=True)
    lifecycle_status: Mapped[str] = mapped_column(
        String(16), nullable=False, default="generated", server_default="generated", index=True
    )
    previous_value: Mapped[Optional[float]] = mapped_column(Numeric(8, 2), nullable=True)
    recommended_value: Mapped[Optional[float]] = mapped_column(Numeric(8, 2), nullable=True)
    actual_selected_value: Mapped[Optional[float]] = mapped_column(Numeric(8, 2), nullable=True)
    difference: Mapped[Optional[float]] = mapped_column(Numeric(8, 2), nullable=True)
    previous_reps: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    recommended_reps: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    previous_duration: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    recommended_duration: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    reason_code: Mapped[str] = mapped_column(String(48), nullable=False)
    reason_text: Mapped[str] = mapped_column(String(500), nullable=False)
    confidence: Mapped[str] = mapped_column(String(8), nullable=False, default="low")
    failure_streak: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    # SPEC §54: a missing/deleted source session must not delete the recommendation.
    source_session_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("workout_logs.id", ondelete="SET NULL"), nullable=True, index=True
    )
    decided_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # SPEC-006 §58: set when the user undid this target's automatic prefill. The
    # recommendation stays accepted (it is still the agreed next target); only
    # the silent substitution is switched off until a newer one is accepted.
    prefill_declined_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship("User", overlaps="progression_recommendations")

    __table_args__ = (
        # SPEC §52: idempotency key for re-processing one session.
        UniqueConstraint(
            "source_session_id",
            "scope_key",
            "policy_version",
            name="uq_progression_recommendations_session_scope_version",
        ),
        CheckConstraint(f"status IN ({STATUSES})", name="ck_progression_recommendations_status"),
        CheckConstraint(
            f"lifecycle_status IN ({LIFECYCLES})",
            name="ck_progression_recommendations_lifecycle",
        ),
        CheckConstraint(
            f"policy_type IN ({POLICY_TYPES})",
            name="ck_progression_recommendations_policy_type",
        ),
        CheckConstraint(
            "confidence IN ('low','medium','high')",
            name="ck_progression_recommendations_confidence",
        ),
        CheckConstraint(
            "previous_value IS NULL OR previous_value >= 0",
            name="ck_progression_recommendations_previous_value",
        ),
        CheckConstraint(
            "recommended_value IS NULL OR recommended_value >= 0",
            name="ck_progression_recommendations_recommended_value",
        ),
        CheckConstraint(
            "actual_selected_value IS NULL OR actual_selected_value >= 0",
            name="ck_progression_recommendations_actual_value",
        ),
        CheckConstraint(
            "previous_reps IS NULL OR previous_reps >= 0",
            name="ck_progression_recommendations_previous_reps",
        ),
        CheckConstraint(
            "previous_duration IS NULL OR previous_duration >= 0",
            name="ck_progression_recommendations_previous_duration",
        ),
        Index(
            "ix_progression_recommendations_scope_created",
            "scope_key",
            "created_at",
        ),
        Index(
            "ix_progression_recommendations_user_lifecycle",
            "user_id",
            "lifecycle_status",
        ),
    )

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return (
            f"<ProgressionRecommendationRecord(id={self.id}, scope_key={self.scope_key!r}, "
            f"status={self.status!r}, life={self.lifecycle_status!r})>"
        )
