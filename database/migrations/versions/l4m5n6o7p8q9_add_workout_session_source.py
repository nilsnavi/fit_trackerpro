"""Add workout session source metadata

Revision ID: l4m5n6o7p8q9
Revises: k2l3m4n5o6p7
Create Date: 2026-05-18 00:00:00.000000
"""

from alembic import op


revision = "l4m5n6o7p8q9"
down_revision = "k2l3m4n5o6p7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE workout_logs
        ADD COLUMN IF NOT EXISTS source_type VARCHAR(32) NULL
        """
    )
    op.execute(
        """
        ALTER TABLE workout_logs
        ADD COLUMN IF NOT EXISTS source_id INTEGER NULL
        """
    )
    op.execute(
        """
        ALTER TABLE workout_logs
        ADD CONSTRAINT ck_workout_logs_source_type_allowed
        CHECK (
            source_type IS NULL
            OR source_type IN (
                'quick_start',
                'personal_template',
                'system_template',
                'community_template',
                'program_day',
                'previous_session'
            )
        )
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_workout_logs_source_type ON workout_logs (source_type)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_workout_logs_source_id ON workout_logs (source_id)")
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_workout_logs_user_source
        ON workout_logs (user_id, source_type, source_id)
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_workout_logs_user_source")
    op.execute("DROP INDEX IF EXISTS ix_workout_logs_source_id")
    op.execute("DROP INDEX IF EXISTS ix_workout_logs_source_type")
    op.execute("ALTER TABLE workout_logs DROP CONSTRAINT IF EXISTS ck_workout_logs_source_type_allowed")
    op.execute("ALTER TABLE workout_logs DROP COLUMN IF EXISTS source_id")
    op.execute("ALTER TABLE workout_logs DROP COLUMN IF EXISTS source_type")
