"""Add water tracking tables

Revision ID: a1b2c3d4e5f6
Revises: f1a2b3c4d5e6
Create Date: 2026-04-15 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect as sa_inspect

# revision identifiers, used by Alembic.
revision = "a1b2c3d4e5f6"
down_revision = "f3a9d8e22a4c"
branch_labels = None
depends_on = None


def _table_exists(bind, name: str) -> bool:
    return sa_inspect(bind).has_table(name)


def upgrade() -> None:
    bind = op.get_bind()

    # --- Water entries table ---
    if not _table_exists(bind, "water_entries"):
        op.create_table(
            "water_entries",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("amount", sa.Integer(), nullable=False,
                      comment="Water amount in milliliters"),
            sa.Column(
                "recorded_at",
                sa.DateTime(timezone=True),
                nullable=False,
                comment="When the water was consumed",
            ),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
            sa.ForeignKeyConstraint(
                ["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.CheckConstraint(
                "amount >= 0 AND amount <= 10000",
                name="ck_water_entries_amount_range",
            ),
        )
        op.create_index("ix_water_entries_id",
                        "water_entries", ["id"], unique=False)
        op.create_index("ix_water_entries_user_id",
                        "water_entries", ["user_id"], unique=False)
        op.create_index("ix_water_entries_recorded_at",
                        "water_entries", ["recorded_at"], unique=False)
        op.create_index("ix_water_entries_user_recorded_at", "water_entries", [
                        "user_id", "recorded_at"], unique=False)

    # --- Water goals table ---
    if not _table_exists(bind, "water_goals"):
        op.create_table(
            "water_goals",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column(
                "daily_goal",
                sa.Integer(),
                nullable=False,
                server_default="2000",
                comment="Daily water goal in milliliters",
            ),
            sa.Column(
                "workout_increase",
                sa.Integer(),
                nullable=False,
                server_default="500",
                comment="Extra water on workout days in milliliters",
            ),
            sa.Column(
                "is_workout_day",
                sa.Boolean(),
                nullable=False,
                server_default="false",
                comment="Whether today is a workout day",
            ),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
            sa.ForeignKeyConstraint(
                ["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.CheckConstraint(
                "daily_goal >= 500 AND daily_goal <= 10000",
                name="ck_water_goals_daily_goal_range",
            ),
            sa.CheckConstraint(
                "workout_increase >= 0 AND workout_increase <= 3000",
                name="ck_water_goals_workout_increase_range",
            ),
        )
        op.create_index("ix_water_goals_id", "water_goals",
                        ["id"], unique=False)
        op.create_index("ix_water_goals_user_id",
                        "water_goals", ["user_id"], unique=True)

    # --- Water reminders table ---
    if not _table_exists(bind, "water_reminders"):
        op.create_table(
            "water_reminders",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column(
                "enabled",
                sa.Boolean(),
                nullable=False,
                server_default="true",
                comment="Whether reminders are enabled",
            ),
            sa.Column(
                "interval_hours",
                sa.Integer(),
                nullable=False,
                server_default="2",
                comment="Hours between reminders",
            ),
            sa.Column(
                "start_time",
                sa.Time(),
                nullable=False,
                comment="Reminder start time",
            ),
            sa.Column(
                "end_time",
                sa.Time(),
                nullable=False,
                comment="Reminder end time",
            ),
            sa.Column(
                "quiet_hours_start",
                sa.Time(),
                nullable=True,
                comment="Quiet hours start time",
            ),
            sa.Column(
                "quiet_hours_end",
                sa.Time(),
                nullable=True,
                comment="Quiet hours end time",
            ),
            sa.Column(
                "telegram_notifications",
                sa.Boolean(),
                nullable=False,
                server_default="true",
                comment="Send reminders via Telegram",
            ),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
            sa.ForeignKeyConstraint(
                ["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.CheckConstraint(
                "interval_hours >= 1 AND interval_hours <= 12",
                name="ck_water_reminders_interval_range",
            ),
        )
        op.create_index("ix_water_reminders_id",
                        "water_reminders", ["id"], unique=False)
        op.create_index("ix_water_reminders_user_id",
                        "water_reminders", ["user_id"], unique=True)


def downgrade() -> None:
    # Drop water_reminders table
    op.drop_index("ix_water_reminders_user_id", table_name="water_reminders")
    op.drop_index("ix_water_reminders_id", table_name="water_reminders")
    op.drop_table("water_reminders")

    # Drop water_goals table
    op.drop_index("ix_water_goals_user_id", table_name="water_goals")
    op.drop_index("ix_water_goals_id", table_name="water_goals")
    op.drop_table("water_goals")

    # Drop water_entries table
    op.drop_index("ix_water_entries_user_recorded_at",
                  table_name="water_entries")
    op.drop_index("ix_water_entries_recorded_at", table_name="water_entries")
    op.drop_index("ix_water_entries_user_id", table_name="water_entries")
    op.drop_index("ix_water_entries_id", table_name="water_entries")
    op.drop_table("water_entries")
