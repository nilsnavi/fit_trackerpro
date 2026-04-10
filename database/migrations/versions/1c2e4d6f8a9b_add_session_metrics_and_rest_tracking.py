"""Add optional session metrics and set-level rest tracking.

Revision ID: 1c2e4d6f8a9b
Revises: d4f8c7a1b2e3
Create Date: 2026-04-10 00:00:01.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "1c2e4d6f8a9b"
down_revision = "d4f8c7a1b2e3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "workout_logs",
        sa.Column(
            "session_metrics",
            sa.JSON(),
            nullable=True,
            comment="Optional derived session metrics for richer summaries and analytics",
        ),
    )
    op.add_column(
        "workout_sets",
        sa.Column("planned_rest_seconds", sa.Integer(), nullable=True),
    )
    op.add_column(
        "workout_sets",
        sa.Column("actual_rest_seconds", sa.Integer(), nullable=True),
    )
    op.create_check_constraint(
        "ck_workout_sets_planned_rest_non_negative",
        "workout_sets",
        "planned_rest_seconds IS NULL OR planned_rest_seconds >= 0",
    )
    op.create_check_constraint(
        "ck_workout_sets_actual_rest_non_negative",
        "workout_sets",
        "actual_rest_seconds IS NULL OR actual_rest_seconds >= 0",
    )


def downgrade() -> None:
    op.drop_constraint("ck_workout_sets_actual_rest_non_negative", "workout_sets", type_="check")
    op.drop_constraint("ck_workout_sets_planned_rest_non_negative", "workout_sets", type_="check")
    op.drop_column("workout_sets", "actual_rest_seconds")
    op.drop_column("workout_sets", "planned_rest_seconds")
    op.drop_column("workout_logs", "session_metrics")