"""
BodyMeasurement model.
"""
from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Index, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.domain.base import Base

if TYPE_CHECKING:
    from .user import User


class BodyMeasurement(Base):
    """Body circumference measurement in centimeters."""

    __tablename__ = "body_measurements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    measurement_type: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        index=True,
        comment="chest, waist, hips, left_thigh, right_thigh, left_bicep, right_bicep",
    )
    value_cm: Mapped[float] = mapped_column(
        Numeric(5, 2),
        nullable=False,
        comment="Body circumference in centimeters",
    )
    measured_at: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        index=True,
        comment="Measurement date",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    user: Mapped["User"] = relationship(
        "User",
        back_populates="body_measurements",
    )

    __table_args__ = (
        CheckConstraint(
            "measurement_type IN ('chest','waist','hips','left_thigh','right_thigh','left_bicep','right_bicep')",
            name="ck_body_measurements_type_allowed",
        ),
        CheckConstraint(
            "value_cm > 0 AND value_cm <= 400",
            name="ck_body_measurements_value_cm_range",
        ),
        Index("ix_body_measurements_user_measured_at", "user_id", "measured_at"),
        Index(
            "ix_body_measurements_user_type_measured_at",
            "user_id",
            "measurement_type",
            "measured_at",
        ),
    )

    def __repr__(self) -> str:
        return (
            f"<BodyMeasurement(id={self.id}, user_id={self.user_id}, "
            f"type={self.measurement_type}, value_cm={self.value_cm})>"
        )
