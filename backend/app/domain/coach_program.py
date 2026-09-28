from __future__ import annotations

from datetime import date, datetime
from enum import StrEnum

from sqlalchemy import (
    JSON,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.domain.base import Base


class CoachProgramStatus(StrEnum):
    DRAFT = "DRAFT"
    ACTIVE = "ACTIVE"
    ARCHIVED = "ARCHIVED"


class CoachProgramAssignmentStatus(StrEnum):
    ACTIVE = "ACTIVE"
    PAUSED = "PAUSED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class CoachProgram(Base):
    __tablename__ = "coach_programs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    coach_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(String(2000))
    status: Mapped[str] = mapped_column(String(16), nullable=False, default=CoachProgramStatus.DRAFT.value, server_default="DRAFT")
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")
    activated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        CheckConstraint("trim(name) <> ''", name="ck_coach_programs_name_not_blank"),
        CheckConstraint("status IN ('DRAFT', 'ACTIVE', 'ARCHIVED')", name="ck_coach_programs_status"),
        CheckConstraint("version >= 1", name="ck_coach_programs_version_positive"),
        UniqueConstraint("coach_id", "id", name="uq_coach_programs_coach_id_id"),
        Index("ix_coach_programs_coach_status", "coach_id", "status"),
    )


class CoachProgramDay(Base):
    __tablename__ = "coach_program_days"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    program_id: Mapped[int] = mapped_column(ForeignKey("coach_programs.id", ondelete="CASCADE"), nullable=False)
    day_number: Mapped[int] = mapped_column(Integer, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    workout_template_id: Mapped[int] = mapped_column(ForeignKey("workout_templates.id", ondelete="RESTRICT"), nullable=False)
    workout_template_name: Mapped[str] = mapped_column(String(255), nullable=False)
    template_version: Mapped[int] = mapped_column(Integer, nullable=False)
    notes: Mapped[str | None] = mapped_column(String(1000))
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        CheckConstraint("day_number >= 1", name="ck_coach_program_days_day_number_positive"),
        CheckConstraint("trim(name) <> ''", name="ck_coach_program_days_name_not_blank"),
        CheckConstraint("template_version >= 1", name="ck_coach_program_days_template_version_positive"),
        CheckConstraint("position >= 0", name="ck_coach_program_days_position_non_negative"),
        UniqueConstraint("program_id", "day_number", name="uq_coach_program_days_program_day"),
        Index("ix_coach_program_days_program_id", "program_id"),
    )


class CoachProgramAssignment(Base):
    __tablename__ = "coach_program_assignments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    coach_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    client_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    relationship_id: Mapped[int] = mapped_column(ForeignKey("coach_clients.id", ondelete="RESTRICT"), nullable=False)
    program_id: Mapped[int] = mapped_column(ForeignKey("coach_programs.id", ondelete="RESTRICT"), nullable=False)
    program_version: Mapped[int] = mapped_column(Integer, nullable=False)
    program_snapshot: Mapped[dict] = mapped_column(JSON, nullable=False)
    start_date: Mapped[date | None] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)
    coach_message: Mapped[str | None] = mapped_column(String(2000))
    client_message: Mapped[str | None] = mapped_column(String(2000))
    status: Mapped[str] = mapped_column(String(16), nullable=False, default=CoachProgramAssignmentStatus.ACTIVE.value, server_default="ACTIVE")
    paused_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        CheckConstraint("status IN ('ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED')", name="ck_coach_program_assignments_status"),
        CheckConstraint("program_version >= 1", name="ck_coach_program_assignments_version_positive"),
        Index("ix_coach_program_assignments_coach_client", "coach_id", "client_id"),
        Index("ix_coach_program_assignments_client_status", "client_id", "status"),
        Index(
            "uq_coach_program_assignments_current", "client_id", "program_id", unique=True,
            postgresql_where=text("status IN ('ACTIVE', 'PAUSED')"),
            sqlite_where=text("status IN ('ACTIVE', 'PAUSED')"),
        ),
    )
