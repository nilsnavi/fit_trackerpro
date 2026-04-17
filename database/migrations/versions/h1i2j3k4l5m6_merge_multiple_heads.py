"""Merge multiple heads

Revision ID: h1i2j3k4l5m6
Revises: a1b2c3d4e5f6, g5h6i7j8k9l0
Create Date: 2026-04-16 18:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'h1i2j3k4l5m6'
down_revision = ('a1b2c3d4e5f6', 'g5h6i7j8k9l0')
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Merge migration - no schema changes needed."""
    pass


def downgrade() -> None:
    """Merge migration - no schema changes needed."""
    pass
