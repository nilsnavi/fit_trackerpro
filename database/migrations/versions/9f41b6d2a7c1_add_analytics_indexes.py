"""Add indexes for analytics-heavy queries

Revision ID: 9f41b6d2a7c1
Revises: cd723942379e
Create Date: 2026-03-24 10:15:00.000000
"""
from alembic import op


# revision identifiers, used by Alembic.
revision = "9f41b6d2a7c1"
down_revision = "cd723942379e"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Optimizes monthly/day aggregations for analytics endpoints.
    op.create_index(
        "ix_workout_logs_user_date_id",
        "workout_logs",
        ["user_id", "date", "id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_workout_logs_user_date_id", table_name="workout_logs")
