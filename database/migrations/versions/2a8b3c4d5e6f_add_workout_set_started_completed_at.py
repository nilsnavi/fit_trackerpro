"""Add started_at and completed_at to workout_sets for TUT tracking.

Revision ID: 2a8b3c4d5e6f
Revises: 1c2e4d6f8a9b
Create Date: 2026-04-12 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "2a8b3c4d5e6f"
down_revision = "1c2e4d6f8a9b"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "workout_sets",
        sa.Column(
            "started_at",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="Client-reported set start time (time under tension)",
        ),
    )
    op.add_column(
        "workout_sets",
        sa.Column(
            "completed_at",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="Client-reported set completion time",
        ),
    )


def downgrade() -> None:
    op.drop_column("workout_sets", "completed_at")
    op.drop_column("workout_sets", "started_at")
