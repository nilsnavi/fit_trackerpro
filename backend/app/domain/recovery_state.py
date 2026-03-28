"""
RecoveryState Model
"""
from typing import TYPE_CHECKING

from sqlalchemy import Integer, ForeignKey, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.domain.base import Base

if TYPE_CHECKING:
    from .user import User


class RecoveryState(Base):
    """
    Current recovery state snapshot per user.
    """
    __tablename__ = "recovery_state"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True
    )
    fatigue_level: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        comment="Current fatigue level (0-100)"
    )
    readiness_score: Mapped[float] = mapped_column(
        Numeric(5, 2),
        nullable=False,
        default=0,
        comment="Current readiness score (0-100)"
    )

    user: Mapped["User"] = relationship(
        "User",
        back_populates="recovery_state",
    )

    def __repr__(self) -> str:
        return (
            f"<RecoveryState(id={self.id}, user_id={self.user_id}, "
            f"fatigue_level={self.fatigue_level}, readiness_score={self.readiness_score})>"
        )
