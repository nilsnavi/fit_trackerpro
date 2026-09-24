"""
WaterReminder Model
User's water reminder settings
"""
from datetime import datetime, time
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    Time,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.domain.base import Base

if TYPE_CHECKING:
    from .user import User


class WaterReminder(Base):
    """
    WaterReminder model for user's water intake reminders
    """
    __tablename__ = "water_reminders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    enabled: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        comment="Whether reminders are enabled"
    )
    interval_hours: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=2,
        comment="Hours between reminders"
    )
    start_time: Mapped[time] = mapped_column(
        Time,
        nullable=False,
        default=lambda: time(8, 0),
        comment="Reminder start time"
    )
    end_time: Mapped[time] = mapped_column(
        Time,
        nullable=False,
        default=lambda: time(22, 0),
        comment="Reminder end time"
    )
    quiet_hours_start: Mapped[time] = mapped_column(
        Time,
        nullable=True,
        comment="Quiet hours start time"
    )
    quiet_hours_end: Mapped[time] = mapped_column(
        Time,
        nullable=True,
        comment="Quiet hours end time"
    )
    telegram_notifications: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        comment="Send reminders via Telegram"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False
    )

    # Relationships
    user: Mapped["User"] = relationship(
        "User",
        back_populates="water_reminder",
    )

    __table_args__ = (
        CheckConstraint(
            "interval_hours >= 1 AND interval_hours <= 12",
            name="ck_water_reminders_interval_range",
        ),
    )

    def __repr__(self) -> str:
        return f"<WaterReminder(id={self.id}, user_id={self.user_id}, enabled={self.enabled})>"
