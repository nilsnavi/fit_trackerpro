"""Add immutable-version Coach programs, days, assignments and workout metadata."""

import sqlalchemy as sa
from alembic import op

revision = "s10_2_coach_programs"
down_revision = "s10_1_coach_identity"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "coach_programs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("coach_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.String(2000), nullable=True),
        sa.Column("status", sa.String(16), nullable=False, server_default="DRAFT"),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("activated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("trim(name) <> ''", name="ck_coach_programs_name_not_blank"),
        sa.CheckConstraint("status IN ('DRAFT', 'ACTIVE', 'ARCHIVED')", name="ck_coach_programs_status"),
        sa.CheckConstraint("version >= 1", name="ck_coach_programs_version_positive"),
        sa.UniqueConstraint("coach_id", "id", name="uq_coach_programs_coach_id_id"),
    )
    op.create_index("ix_coach_programs_coach_status", "coach_programs", ["coach_id", "status"])
    op.create_table(
        "coach_program_days",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("program_id", sa.Integer(), sa.ForeignKey("coach_programs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("day_number", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("workout_template_id", sa.Integer(), sa.ForeignKey("workout_templates.id", ondelete="SET NULL"), nullable=True),
        sa.Column("workout_template_name", sa.String(255), nullable=False),
        sa.Column("template_version", sa.Integer(), nullable=False),
        sa.Column("notes", sa.String(1000), nullable=True),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("day_number >= 1", name="ck_coach_program_days_day_number_positive"),
        sa.CheckConstraint("trim(name) <> ''", name="ck_coach_program_days_name_not_blank"),
        sa.CheckConstraint("template_version >= 1", name="ck_coach_program_days_template_version_positive"),
        sa.CheckConstraint("position >= 0", name="ck_coach_program_days_position_non_negative"),
        sa.UniqueConstraint("program_id", "day_number", name="uq_coach_program_days_program_day"),
    )
    op.create_index("ix_coach_program_days_program_id", "coach_program_days", ["program_id"])
    op.create_table(
        "coach_program_assignments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("coach_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("client_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("relationship_id", sa.Integer(), sa.ForeignKey("coach_clients.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("program_id", sa.Integer(), sa.ForeignKey("coach_programs.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("program_version", sa.Integer(), nullable=False),
        sa.Column("program_snapshot", sa.JSON(), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("coach_message", sa.String(2000), nullable=True),
        sa.Column("client_message", sa.String(2000), nullable=True),
        sa.Column("status", sa.String(16), nullable=False, server_default="ACTIVE"),
        sa.Column("paused_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("status IN ('ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED')", name="ck_coach_program_assignments_status"),
        sa.CheckConstraint("program_version >= 1", name="ck_coach_program_assignments_version_positive"),
    )
    op.create_index("ix_coach_program_assignments_coach_client", "coach_program_assignments", ["coach_id", "client_id"])
    op.create_index("ix_coach_program_assignments_client_status", "coach_program_assignments", ["client_id", "status"])
    op.create_index(
        "uq_coach_program_assignments_current", "coach_program_assignments",
        ["client_id", "program_id"], unique=True,
        postgresql_where=sa.text("status IN ('ACTIVE', 'PAUSED')"),
        sqlite_where=sa.text("status IN ('ACTIVE', 'PAUSED')"),
    )
    op.add_column("workout_logs", sa.Column("source_metadata", sa.JSON(), nullable=True))
    op.add_column("workout_logs", sa.Column("idempotency_key", sa.String(256), nullable=True))
    op.add_column("workout_logs", sa.Column("idempotency_request_hash", sa.String(64), nullable=True))
    op.create_unique_constraint(
        "uq_workout_logs_source_idempotency", "workout_logs",
        ["user_id", "source_type", "source_id", "idempotency_key"],
    )
    op.drop_constraint("ck_workout_logs_source_type_allowed", "workout_logs", type_="check")
    op.create_check_constraint(
        "ck_workout_logs_source_type_allowed",
        "workout_logs",
        "source_type IS NULL OR source_type IN ('quick_start','personal_template','system_template','community_template','program_day','previous_session','coach_program')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_workout_logs_source_type_allowed", "workout_logs", type_="check")
    op.create_check_constraint(
        "ck_workout_logs_source_type_allowed", "workout_logs",
        "source_type IS NULL OR source_type IN ('quick_start','personal_template','system_template','community_template','program_day','previous_session')",
    )
    op.drop_column("workout_logs", "source_metadata")
    op.drop_constraint("uq_workout_logs_source_idempotency", "workout_logs", type_="unique")
    op.drop_column("workout_logs", "idempotency_request_hash")
    op.drop_column("workout_logs", "idempotency_key")
    op.drop_index("ix_coach_program_assignments_client_status", table_name="coach_program_assignments")
    op.drop_index("uq_coach_program_assignments_current", table_name="coach_program_assignments")
    op.drop_index("ix_coach_program_assignments_coach_client", table_name="coach_program_assignments")
    op.drop_table("coach_program_assignments")
    op.drop_index("ix_coach_program_days_program_id", table_name="coach_program_days")
    op.drop_table("coach_program_days")
    op.drop_index("ix_coach_programs_coach_status", table_name="coach_programs")
    op.drop_table("coach_programs")
