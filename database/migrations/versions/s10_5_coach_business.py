"""Add Coach business: package templates, client packages, usage ledger, payments, tasks.

Revision ID: s10_5_coach_business
Revises: s10_4_coach_entitlements
Create Date: 2026-11-06 12:40:00.000000
"""

import sqlalchemy as sa
from alembic import op

revision = "s10_5_coach_business"
down_revision = "s10_4_coach_entitlements"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "coach_packages",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("coach_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.String(2000), nullable=True),
        sa.Column("sessions_total", sa.Integer(), nullable=False),
        sa.Column("validity_days", sa.Integer(), nullable=True),
        sa.Column("price_amount", sa.Numeric(12, 2), nullable=True),
        sa.Column("currency", sa.String(3), nullable=False, server_default="RUB"),
        sa.Column("status", sa.String(16), nullable=False, server_default="ACTIVE"),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("trim(name) <> ''", name="ck_coach_packages_name_not_blank"),
        sa.CheckConstraint("sessions_total >= 1", name="ck_coach_packages_sessions_total_positive"),
        sa.CheckConstraint("validity_days IS NULL OR validity_days >= 1", name="ck_coach_packages_validity_days_positive"),
        sa.CheckConstraint("price_amount IS NULL OR price_amount >= 0", name="ck_coach_packages_price_non_negative"),
        sa.CheckConstraint("status IN ('ACTIVE', 'ARCHIVED')", name="ck_coach_packages_status"),
    )
    op.create_index("ix_coach_packages_coach_status", "coach_packages", ["coach_id", "status"])

    op.create_table(
        "coach_client_packages",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("coach_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("client_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("relationship_id", sa.Integer(), sa.ForeignKey("coach_clients.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("package_id", sa.Integer(), sa.ForeignKey("coach_packages.id", ondelete="SET NULL"), nullable=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("sessions_total", sa.Integer(), nullable=False),
        sa.Column("sessions_used", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("price_amount", sa.Numeric(12, 2), nullable=True),
        sa.Column("currency", sa.String(3), nullable=False, server_default="RUB"),
        sa.Column("purchased_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("expires_at", sa.Date(), nullable=True),
        sa.Column("auto_consume", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("status", sa.String(16), nullable=False, server_default="ACTIVE"),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("sessions_total >= 1", name="ck_coach_client_packages_sessions_total_positive"),
        sa.CheckConstraint("sessions_used >= 0", name="ck_coach_client_packages_sessions_used_non_negative"),
        sa.CheckConstraint("sessions_used <= sessions_total", name="ck_coach_client_packages_sessions_used_within_total"),
        sa.CheckConstraint("status IN ('ACTIVE', 'EXHAUSTED', 'EXPIRED', 'CANCELLED')", name="ck_coach_client_packages_status"),
    )
    op.create_index("ix_coach_client_packages_coach_client_status", "coach_client_packages", ["coach_id", "client_id", "status"])

    op.create_table(
        "coach_package_usage",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("client_package_id", sa.Integer(), sa.ForeignKey("coach_client_packages.id", ondelete="CASCADE"), nullable=False),
        sa.Column("delta", sa.Integer(), nullable=False),
        sa.Column("reason", sa.String(16), nullable=False),
        sa.Column("workout_id", sa.Integer(), sa.ForeignKey("workout_logs.id", ondelete="SET NULL"), nullable=True),
        sa.Column("actor_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("idempotency_key", sa.String(128), nullable=True),
        sa.Column("reversal_of_usage_id", sa.Integer(), sa.ForeignKey("coach_package_usage.id", ondelete="SET NULL"), nullable=True),
        sa.Column("note", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("delta IN (-1, 1)", name="ck_coach_package_usage_delta_unit"),
        sa.CheckConstraint("reason IN ('CONSUME', 'REVERSE', 'AUTO_CONSUME')", name="ck_coach_package_usage_reason"),
        sa.UniqueConstraint("client_package_id", "idempotency_key", name="uq_coach_package_usage_idempotency"),
    )
    op.create_index("ix_coach_package_usage_package_created", "coach_package_usage", ["client_package_id", "created_at"])
    op.create_index("ix_coach_package_usage_workout", "coach_package_usage", ["workout_id"])
    op.create_index("uq_coach_package_usage_reversal_target", "coach_package_usage", ["reversal_of_usage_id"], unique=True)

    op.create_table(
        "coach_payments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("coach_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("client_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("relationship_id", sa.Integer(), sa.ForeignKey("coach_clients.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("client_package_id", sa.Integer(), sa.ForeignKey("coach_client_packages.id", ondelete="SET NULL"), nullable=True),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False, server_default="RUB"),
        sa.Column("method", sa.String(32), nullable=False, server_default="CASH"),
        sa.Column("status", sa.String(16), nullable=False, server_default="RECORDED"),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("comment", sa.String(1000), nullable=True),
        sa.Column("reversed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("amount > 0", name="ck_coach_payments_amount_positive"),
        sa.CheckConstraint("status IN ('RECORDED', 'REVERSED')", name="ck_coach_payments_status"),
        sa.CheckConstraint("method IN ('CASH', 'CARD', 'TRANSFER', 'OTHER')", name="ck_coach_payments_method"),
    )
    op.create_index("ix_coach_payments_coach_client_status", "coach_payments", ["coach_id", "client_id", "status"])

    op.create_table(
        "coach_tasks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("coach_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("client_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.String(2000), nullable=True),
        sa.Column("priority", sa.String(8), nullable=False, server_default="NORMAL"),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("source", sa.String(8), nullable=False, server_default="MANUAL"),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("trim(title) <> ''", name="ck_coach_tasks_title_not_blank"),
        sa.CheckConstraint("priority IN ('LOW', 'NORMAL', 'HIGH')", name="ck_coach_tasks_priority"),
        sa.CheckConstraint("source IN ('MANUAL', 'SYSTEM')", name="ck_coach_tasks_source"),
    )
    op.create_index("ix_coach_tasks_coach_completed_due", "coach_tasks", ["coach_id", "completed_at", "due_at"])
    op.create_index("ix_coach_tasks_client", "coach_tasks", ["client_id"])


def downgrade() -> None:
    op.drop_index("ix_coach_tasks_client", table_name="coach_tasks")
    op.drop_index("ix_coach_tasks_coach_completed_due", table_name="coach_tasks")
    op.drop_table("coach_tasks")
    op.drop_index("ix_coach_payments_coach_client_status", table_name="coach_payments")
    op.drop_table("coach_payments")
    op.drop_index("uq_coach_package_usage_reversal_target", table_name="coach_package_usage")
    op.drop_index("ix_coach_package_usage_workout", table_name="coach_package_usage")
    op.drop_index("ix_coach_package_usage_package_created", table_name="coach_package_usage")
    op.drop_table("coach_package_usage")
    op.drop_index("ix_coach_client_packages_coach_client_status", table_name="coach_client_packages")
    op.drop_table("coach_client_packages")
    op.drop_index("ix_coach_packages_coach_status", table_name="coach_packages")
    op.drop_table("coach_packages")
