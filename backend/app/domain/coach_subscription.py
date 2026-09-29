from __future__ import annotations

from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.domain.base import Base


class CoachSubscription(Base):
    __tablename__ = "coach_subscriptions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    coach_id: Mapped[int] = mapped_column(ForeignKey("coach_profiles.user_id", ondelete="CASCADE"), nullable=False)
    plan: Mapped[str] = mapped_column(String(24), nullable=False, server_default="FREE")
    status: Mapped[str] = mapped_column(String(16), nullable=False, server_default="ACTIVE")
    trial_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    trial_ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    current_period_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    grace_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    grace_ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    current_period_ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancel_at_period_end: Mapped[bool] = mapped_column(nullable=False, server_default="false")
    activated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    expired_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("coach_id", name="uq_coach_subscriptions_coach_id"),
        CheckConstraint("plan IN ('FREE', 'TRAINER_PRO')", name="ck_coach_subscriptions_plan"),
        CheckConstraint("status IN ('TRIAL', 'ACTIVE', 'GRACE', 'CANCELLED', 'EXPIRED')", name="ck_coach_subscriptions_status"),
    )
