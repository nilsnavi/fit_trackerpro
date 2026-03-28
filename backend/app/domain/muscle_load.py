"""
MuscleLoad Model
"""
from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import Integer, String, Date, ForeignKey, Index, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.domain.base import Base

if TYPE_CHECKING:
    from .user import User


class MuscleLoad(Base):
    """
    Daily aggregated load score by muscle group per user.
    """
    __tablename__ = "muscle_load"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    muscle_group: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
        comment="Target muscle group slug"
    )
    date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        index=True,
        comment="Date of muscle load aggregate"
    )
    load_score: Mapped[float] = mapped_column(
        Numeric(14, 2),
        nullable=False,
        default=0,
        comment="Aggregated daily load score for the muscle group"
    )

    user: Mapped["User"] = relationship(
        "User",
        back_populates="muscle_load_entries"
    )

    __table_args__ = (
        Index(
            "ix_muscle_load_user_muscle_date",
            "user_id",
            "muscle_group",
            "date",
            unique=True,
        ),
    )

    def __repr__(self) -> str:
        return (
            f"<MuscleLoad(id={self.id}, user_id={self.user_id}, "
            f"muscle_group={self.muscle_group}, date={self.date})>"
        )
