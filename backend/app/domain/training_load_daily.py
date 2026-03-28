"""
TrainingLoadDaily Model
"""
from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import Integer, Date, ForeignKey, Index, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.domain.base import Base

if TYPE_CHECKING:
    from .user import User


class TrainingLoadDaily(Base):
    """
    Daily aggregated training load metrics per user.
    """
    __tablename__ = "training_load_daily"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        index=True,
        comment="Date of aggregated training load"
    )
    volume: Mapped[float] = mapped_column(
        Numeric(14, 2),
        nullable=False,
        default=0,
        comment="Daily total volume (sum of reps * weight)"
    )
    fatigue_score: Mapped[float] = mapped_column(
        Numeric(10, 2),
        nullable=False,
        default=0,
        comment="Daily fatigue score (total duration * avg RPE)"
    )
    avg_rpe: Mapped[float | None] = mapped_column(
        Numeric(3, 1),
        nullable=True,
        comment="Average RPE across all completed sets for the day"
    )

    user: Mapped["User"] = relationship(
        "User",
        back_populates="training_load_daily_entries"
    )

    __table_args__ = (
        Index(
            "ix_training_load_daily_user_date",
            "user_id",
            "date",
            unique=True,
        ),
    )

    def __repr__(self) -> str:
        return (
            f"<TrainingLoadDaily(id={self.id}, user_id={self.user_id}, "
            f"date={self.date})>"
        )
