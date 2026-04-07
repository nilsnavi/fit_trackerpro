"""Add workout_log version and idempotency records

Revision ID: e7d1c2b4a9f0
Revises: c3a9d7e11f2b
Create Date: 2026-04-07 00:00:00.000000
"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "e7d1c2b4a9f0"
down_revision = "c3a9d7e11f2b"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE workout_logs
        ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1
        """
    )
    op.execute(
        """
        ALTER TABLE workout_logs
        ADD CONSTRAINT ck_workout_logs_version_positive CHECK (version >= 1)
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_workout_logs_user_id_id_version
        ON workout_logs (user_id, id, version)
        """
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS idempotency_records (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            operation_type VARCHAR(64) NOT NULL,
            idempotency_key VARCHAR(128) NOT NULL,
            resource_id INTEGER NOT NULL,
            request_hash VARCHAR(64) NOT NULL,
            response_payload JSONB NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            expires_at TIMESTAMPTZ NULL,
            CONSTRAINT uq_idempotency_lookup UNIQUE (user_id, operation_type, idempotency_key)
        )
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_idempotency_expires_at
        ON idempotency_records (expires_at)
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_idempotency_user_operation_resource
        ON idempotency_records (user_id, operation_type, resource_id)
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_idempotency_user_operation_resource")
    op.execute("DROP INDEX IF EXISTS ix_idempotency_expires_at")
    op.execute("DROP TABLE IF EXISTS idempotency_records")

    op.execute("DROP INDEX IF EXISTS ix_workout_logs_user_id_id_version")
    op.execute("ALTER TABLE workout_logs DROP CONSTRAINT IF EXISTS ck_workout_logs_version_positive")
    op.execute("ALTER TABLE workout_logs DROP COLUMN IF EXISTS version")
