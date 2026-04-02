"""Add workout template archive flag

Revision ID: b8e41f3a9c2d
Revises: 2d9a6f3c1b0e
Create Date: 2026-04-02 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "b8e41f3a9c2d"
down_revision = "2d9a6f3c1b0e"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE workout_templates
        ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_workout_templates_is_archived
        ON workout_templates (is_archived)
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_workout_templates_is_archived")
    op.execute("ALTER TABLE workout_templates DROP COLUMN IF EXISTS is_archived")
