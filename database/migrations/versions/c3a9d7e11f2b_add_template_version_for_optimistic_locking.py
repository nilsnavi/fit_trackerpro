"""Add template version for optimistic locking

Revision ID: c3a9d7e11f2b
Revises: b8e41f3a9c2d
Create Date: 2026-04-06 00:00:00.000000
"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "c3a9d7e11f2b"
down_revision = "b8e41f3a9c2d"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE workout_templates
        ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1
        """
    )
    op.execute(
        """
        ALTER TABLE workout_templates
        ADD CONSTRAINT ck_workout_templates_version_positive CHECK (version >= 1)
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_workout_templates_version
        ON workout_templates (version)
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_workout_templates_version")
    op.execute("ALTER TABLE workout_templates DROP CONSTRAINT IF EXISTS ck_workout_templates_version_positive")
    op.execute("ALTER TABLE workout_templates DROP COLUMN IF EXISTS version")
