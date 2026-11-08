"""Add Coach commercial plans, trials, and entitlement state."""

from datetime import timedelta

import sqlalchemy as sa
from alembic import op

revision = "s10_4_coach_entitlements"
down_revision = "s10_2_coach_programs"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "coach_subscriptions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("coach_id", sa.Integer(), sa.ForeignKey("coach_profiles.user_id", ondelete="CASCADE"), nullable=False),
        sa.Column("plan", sa.String(24), nullable=False, server_default="FREE"),
        sa.Column("status", sa.String(16), nullable=False, server_default="ACTIVE"),
        sa.Column("trial_started_at", sa.DateTime(timezone=True)),
        sa.Column("trial_ends_at", sa.DateTime(timezone=True)),
        sa.Column("current_period_started_at", sa.DateTime(timezone=True)),
        sa.Column("grace_started_at", sa.DateTime(timezone=True)),
        sa.Column("grace_ends_at", sa.DateTime(timezone=True)),
        sa.Column("current_period_ends_at", sa.DateTime(timezone=True)),
        sa.Column("cancel_at_period_end", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("activated_at", sa.DateTime(timezone=True)),
        sa.Column("cancelled_at", sa.DateTime(timezone=True)),
        sa.Column("expired_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("coach_id", name="uq_coach_subscriptions_coach_id"),
        sa.CheckConstraint("plan IN ('FREE', 'TRAINER_PRO')", name="ck_coach_subscriptions_plan"),
        sa.CheckConstraint("status IN ('TRIAL', 'ACTIVE', 'GRACE', 'CANCELLED', 'EXPIRED')", name="ck_coach_subscriptions_status"),
    )
    op.execute(
        sa.text(
            "INSERT INTO coach_subscriptions (coach_id, plan, status) "
            "SELECT user_id, 'FREE', 'ACTIVE' FROM coach_profiles"
        )
    )


def downgrade() -> None:
    op.drop_table("coach_subscriptions")
