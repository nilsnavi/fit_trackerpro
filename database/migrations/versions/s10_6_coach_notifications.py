"""Add Coach notification outbox (Sprint 10.5 Telegram automation).

Revision ID: s10_6_coach_notifications
Revises: s10_5_coach_business
Create Date: 2026-11-06 19:20:00.000000
"""

import sqlalchemy as sa
from alembic import op

revision = "s10_6_coach_notifications"
down_revision = "s10_5_coach_business"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "coach_notifications",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("event", sa.String(64), nullable=False),
        sa.Column("dedupe_key", sa.String(200), nullable=False),
        sa.Column("recipient_telegram_id", sa.BigInteger(), nullable=True),
        sa.Column("recipient_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("payload", sa.JSON(), nullable=False, server_default=sa.text("'{}'::json")),
        sa.Column("status", sa.String(16), nullable=False, server_default="PENDING"),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("next_retry_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint(
            "status IN ('PENDING', 'SENT', 'FAILED', 'SKIPPED')",
            name="ck_coach_notifications_status",
        ),
        sa.CheckConstraint(
            "event IN ('coach.invitation.created', 'coach.program.assigned', 'coach.workout.missed',"
            " 'coach.package.low', 'coach.package.expired', 'coach.task.due', 'client.workout.reminder')",
            name="ck_coach_notifications_event",
        ),
    )
    op.create_index("uq_coach_notifications_dedupe", "coach_notifications", ["dedupe_key"], unique=True)
    op.create_index("ix_coach_notifications_status_retry", "coach_notifications", ["status", "next_retry_at"])
    op.create_index("ix_coach_notifications_recipient", "coach_notifications", ["recipient_user_id"])
    op.create_foreign_key(
        "fk_coach_notifications_recipient_telegram",
        "coach_notifications",
        "users",
        ["recipient_telegram_id"],
        ["telegram_id"],
        ondelete="SET NULL",
        use_alter=True,
    )


def downgrade() -> None:
    op.drop_constraint("fk_coach_notifications_recipient_telegram", "coach_notifications", type_="foreignkey")
    op.drop_index("ix_coach_notifications_recipient", table_name="coach_notifications")
    op.drop_index("ix_coach_notifications_status_retry", table_name="coach_notifications")
    op.drop_index("uq_coach_notifications_dedupe", table_name="coach_notifications")
    op.drop_table("coach_notifications")
