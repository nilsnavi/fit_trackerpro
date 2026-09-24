"""ProgressionPolicyRecord model — SPEC-006 §6/§7.

Progression is *not* keyed only by ``user_id + exercise_id``: the same exercise
performed in two different program slots keeps two independent sequences, so the
scope is ``user + template + exercise + template slot`` (materialized in
``scope_key`` for a single unique constraint).
"""
from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import (
    Boolean,
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

if TYPE_CHECKING:
    from .user import User

POLICY_TYPES = (
    "'MANUAL','LINEAR','DOUBLE_PROGRESSION','RPE_BASED','RIR_BASED',"
    "'PERCENT_1RM','TIME_PROGRESSION'"
)


class ProgressionPolicyRecord(Base):
    """User-configured progression policy bound to one progression scope."""

    __tablename__ = "progression_policies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    exercise_id: Mapped[int] = mapped_column(
        ForeignKey("exercises.id", ondelete="CASCADE"), nullable=False, index=True
    )
    template_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("workout_templates.id", ondelete="CASCADE"), nullable=True, index=True
    )
    template_exercise_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("template_exercises.id", ondelete="SET NULL"), nullable=True, index=True
    )
    # Deterministic scope hash: u<user>:t<template>:te<slot>:e<exercise> (SPEC §7).
    scope_key: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    policy_type: Mapped[str] = mapped_column(String(32), nullable=False, default="MANUAL")
    policy_version: Mapped[str] = mapped_column(String(32), nullable=False, default="MANUAL_V1")
    increment: Mapped[Optional[float]] = mapped_column(Numeric(6, 2), nullable=True)
    min_value: Mapped[Optional[float]] = mapped_column(Numeric(8, 2), nullable=True)
    max_value: Mapped[Optional[float]] = mapped_column(Numeric(8, 2), nullable=True)
    reps_min: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    reps_max: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    sets_target: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    target_rpe: Mapped[Optional[float]] = mapped_column(Numeric(3, 1), nullable=True)
    target_rir: Mapped[Optional[float]] = mapped_column(Numeric(3, 1), nullable=True)
    percent_1rm: Mapped[Optional[float]] = mapped_column(Numeric(5, 2), nullable=True)
    time_increment_seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    time_target_seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    time_priority: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    failure_threshold: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    deload_percent: Mapped[Optional[float]] = mapped_column(Numeric(5, 2), nullable=True)
    # Minimum equipment step; NULL = derive from exercise equipment (SPEC §21).
    equipment_increment: Mapped[Optional[float]] = mapped_column(Numeric(6, 2), nullable=True)
    enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship("User", overlaps="progression_policies")

    __table_args__ = (
        UniqueConstraint("user_id", "scope_key", name="uq_progression_policies_user_scope"),
        CheckConstraint(
            f"policy_type IN ({POLICY_TYPES})",
            name="ck_progression_policies_type_allowed",
        ),
        CheckConstraint(
            "time_priority IS NULL OR time_priority IN ('TIME_FIRST','WEIGHT_FIRST')",
            name="ck_progression_policies_time_priority_allowed",
        ),
        CheckConstraint(
            "reps_min IS NULL OR reps_min >= 0", name="ck_progression_policies_reps_min"
        ),
        CheckConstraint(
            "reps_max IS NULL OR reps_max >= 0", name="ck_progression_policies_reps_max"
        ),
        CheckConstraint(
            "sets_target IS NULL OR (sets_target >= 1 AND sets_target <= 50)",
            name="ck_progression_policies_sets_target_range",
        ),
        CheckConstraint(
            "target_rpe IS NULL OR (target_rpe >= 1 AND target_rpe <= 10)",
            name="ck_progression_policies_target_rpe_range",
        ),
        CheckConstraint(
            "target_rir IS NULL OR (target_rir >= 0 AND target_rir <= 10)",
            name="ck_progression_policies_target_rir_range",
        ),
        CheckConstraint(
            "percent_1rm IS NULL OR (percent_1rm > 0 AND percent_1rm <= 200)",
            name="ck_progression_policies_percent_1rm_range",
        ),
        CheckConstraint(
            "failure_threshold IS NULL OR (failure_threshold >= 1 AND failure_threshold <= 20)",
            name="ck_progression_policies_failure_threshold_range",
        ),
        CheckConstraint(
            "deload_percent IS NULL OR (deload_percent > 0 AND deload_percent <= 90)",
            name="ck_progression_policies_deload_percent_range",
        ),
        CheckConstraint(
            "min_value IS NULL OR min_value >= 0", name="ck_progression_policies_min_value"
        ),
        CheckConstraint(
            "max_value IS NULL OR max_value >= 0", name="ck_progression_policies_max_value"
        ),
        Index("ix_progression_policies_user_exercise", "user_id", "exercise_id"),
    )

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return (
            f"<ProgressionPolicyRecord(id={self.id}, scope_key={self.scope_key!r}, "
            f"policy_type={self.policy_type!r})>"
        )
