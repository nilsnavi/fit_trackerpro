"""add_notes_to_workout_sets

Revision ID: i2j3k4l5m6n7
Revises: h1i2j3k4l5m6
Create Date: 2026-04-17

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'i2j3k4l5m6n7'
down_revision = 'h1i2j3k4l5m6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add notes column to workout_sets for set-level comments."""
    op.add_column(
        "workout_sets",
        sa.Column("notes", sa.String(1000), nullable=True)
    )


def downgrade() -> None:
    """Remove notes column from workout_sets."""
    op.drop_column("workout_sets", "notes")
