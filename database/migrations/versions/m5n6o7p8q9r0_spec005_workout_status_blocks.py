"""SPEC-005: workout session lifecycle status, blocks, exercise status

Revision ID: m5n6o7p8q9r0
Revises: l4m5n6o7p8q9
Create Date: 2026-09-14 00:00:00.000000
"""

from alembic import op


revision = "m5n6o7p8q9r0"
down_revision = "l4m5n6o7p8q9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # SPEC-005 §3: session lifecycle status + start/completion timestamps.
    op.execute(
        """
        ALTER TABLE workout_logs
        ADD COLUMN IF NOT EXISTS status VARCHAR(16) NOT NULL DEFAULT 'active'
        """
    )
    op.execute(
        """
        ALTER TABLE workout_logs
        ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ NULL
        """
    )
    op.execute(
        """
        ALTER TABLE workout_logs
        ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ NULL
        """
    )
    # Backfill: legacy rows with duration are completed sessions.
    op.execute("UPDATE workout_logs SET status = 'completed' WHERE duration IS NOT NULL")
    op.execute(
        """
        UPDATE workout_logs
        SET completed_at = updated_at
        WHERE status = 'completed' AND completed_at IS NULL
        """
    )
    op.execute(
        """
        UPDATE workout_logs
        SET started_at = created_at
        WHERE started_at IS NULL
        """
    )
    op.execute(
        """
        ALTER TABLE workout_logs
        ADD CONSTRAINT ck_workout_logs_status_allowed
        CHECK (status IN ('draft', 'active', 'paused', 'completed', 'cancelled'))
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_workout_logs_status ON workout_logs (status)")
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_workout_logs_user_status
        ON workout_logs (user_id, status)
        """
    )

    # SPEC-005 §24: workout blocks (superset/triset/circuit).
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS workout_blocks (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            workout_session_id INTEGER NOT NULL,
            type VARCHAR(16) NOT NULL DEFAULT 'NORMAL',
            "order" INTEGER NOT NULL DEFAULT 0,
            rounds INTEGER NOT NULL DEFAULT 1,
            rest_seconds INTEGER NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT fk_workout_blocks_user_session
                FOREIGN KEY (user_id, workout_session_id)
                REFERENCES workout_logs(user_id, id) ON DELETE CASCADE,
            CONSTRAINT ck_workout_blocks_type_allowed
                CHECK (type IN ('NORMAL', 'SUPERSET', 'TRISET', 'CIRCUIT')),
            CONSTRAINT ck_workout_blocks_rounds_positive CHECK (rounds >= 1),
            CONSTRAINT ck_workout_blocks_rest_non_negative
                CHECK (rest_seconds IS NULL OR rest_seconds >= 0)
        )
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_workout_blocks_user_id ON workout_blocks (user_id)
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_workout_blocks_session_id
        ON workout_blocks (workout_session_id)
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_workout_blocks_session_order
        ON workout_blocks (workout_session_id, "order")
        """
    )

    # SPEC-005 §24/§26: exercise status (skipped) and block membership.
    op.execute(
        """
        ALTER TABLE workout_session_exercises
        ADD COLUMN IF NOT EXISTS status VARCHAR(16) NULL
        """
    )
    op.execute(
        """
        ALTER TABLE workout_session_exercises
        ADD COLUMN IF NOT EXISTS block_id INTEGER NULL
        """
    )
    op.execute(
        """
        ALTER TABLE workout_session_exercises
        ADD COLUMN IF NOT EXISTS block_order INTEGER NULL
        """
    )
    op.execute(
        """
        ALTER TABLE workout_session_exercises
        ADD CONSTRAINT ck_workout_session_exercises_status_allowed
        CHECK (status IS NULL OR status IN ('skipped'))
        """
    )
    op.execute(
        """
        ALTER TABLE workout_session_exercises
        ADD CONSTRAINT fk_workout_session_exercises_block
        FOREIGN KEY (block_id) REFERENCES workout_blocks(id) ON DELETE SET NULL
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_workout_session_exercises_status
        ON workout_session_exercises (status)
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_workout_session_exercises_block_id
        ON workout_session_exercises (block_id)
        """
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE workout_session_exercises DROP CONSTRAINT IF EXISTS fk_workout_session_exercises_block"
    )
    op.execute(
        "ALTER TABLE workout_session_exercises DROP CONSTRAINT IF EXISTS ck_workout_session_exercises_status_allowed"
    )
    op.execute("DROP INDEX IF EXISTS ix_workout_session_exercises_block_id")
    op.execute("DROP INDEX IF EXISTS ix_workout_session_exercises_status")
    op.execute("ALTER TABLE workout_session_exercises DROP COLUMN IF EXISTS block_order")
    op.execute("ALTER TABLE workout_session_exercises DROP COLUMN IF EXISTS block_id")
    op.execute("ALTER TABLE workout_session_exercises DROP COLUMN IF EXISTS status")
    op.execute("DROP TABLE IF EXISTS workout_blocks")
    op.execute("DROP INDEX IF EXISTS ix_workout_logs_user_status")
    op.execute("DROP INDEX IF EXISTS ix_workout_logs_status")
    op.execute("ALTER TABLE workout_logs DROP CONSTRAINT IF EXISTS ck_workout_logs_status_allowed")
    op.execute("ALTER TABLE workout_logs DROP COLUMN IF EXISTS completed_at")
    op.execute("ALTER TABLE workout_logs DROP COLUMN IF EXISTS started_at")
    op.execute("ALTER TABLE workout_logs DROP COLUMN IF EXISTS status")
