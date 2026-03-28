"""
GlucoseLog Model
"""
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Integer, String, DateTime, ForeignKey, Index, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.domain.base import Base

if TYPE_CHECKING:
    from .user import User
    from .workout_log import WorkoutLog


class GlucoseLog(Base):
    """
    GlucoseLog model for tracking blood glucose levels
    Important for diabetic users monitoring workout impact
    """
    __tablename__ = "glucose_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    workout_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("workout_logs.id", ondelete="CASCADE"),
        nullable=True,
        index=True
    )
    value: Mapped[float] = mapped_column(
        Numeric(5, 2),
        nullable=False,
        comment="Blood glucose value in mmol/L"
    )
    measurement_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="Type: fasting, pre_workout, post_workout, random, bedtime"
    )
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
        comment="When the measurement was taken"
    )
    notes: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True,
        comment="Additional notes"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="glucose_logs")
    workout: Mapped[Optional["WorkoutLog"]] = relationship(
        "WorkoutLog",
        back_populates="glucose_logs"
    )

    __table_args__ = (
        Index('ix_glucose_logs_user_timestamp', 'user_id', 'timestamp'),
        Index('ix_glucose_logs_measurement_type', 'measurement_type'),
    )

    def __repr__(self) -> str:
        return f"<GlucoseLog(id={self.id}, user_id={self.user_id}, value={self.value})>"
