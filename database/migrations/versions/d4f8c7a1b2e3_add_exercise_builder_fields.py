"""Add exercise builder fields for primary muscle group and aliases

Revision ID: d4f8c7a1b2e3
Revises: a91c6de4b22f
Create Date: 2026-04-08 00:00:00.000000
"""

from alembic import op


revision = "d4f8c7a1b2e3"
down_revision = "a91c6de4b22f"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE exercises
        ADD COLUMN IF NOT EXISTS muscle_group VARCHAR(64)
        """
    )
    op.execute(
        """
        ALTER TABLE exercises
        ADD COLUMN IF NOT EXISTS aliases JSONB NOT NULL DEFAULT '[]'::jsonb
        """
    )
    op.execute(
        """
        UPDATE exercises
        SET
            muscle_group = COALESCE(
                NULLIF(muscle_group, ''),
                CASE
                    WHEN muscle_groups IS NOT NULL AND json_array_length(muscle_groups::json) > 0
                        THEN muscle_groups::json ->> 0
                    ELSE NULL
                END
            ),
            aliases = COALESCE(aliases, '[]'::jsonb)
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_exercises_muscle_group
        ON exercises (muscle_group)
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_exercises_aliases
        ON exercises USING gin (aliases)
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_exercises_aliases")
    op.execute("DROP INDEX IF EXISTS ix_exercises_muscle_group")
    op.execute("ALTER TABLE exercises DROP COLUMN IF EXISTS aliases")
    op.execute("ALTER TABLE exercises DROP COLUMN IF EXISTS muscle_group")