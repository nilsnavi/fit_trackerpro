"""SPEC-006 §58: remember which bulk switch-off a declined prefill came from

Additive and nullable: one column on ``progression_recommendations`` stamps the
sweep (a generated id shared by every target one bulk action switched off). It
lets the undo be resolved server-side — the newest sweep that still has targets
switched off — so the way back survives a reload and is the same on every device,
instead of living in one browser's storage. A manual per-target flip leaves the
column NULL: only a bulk action is a sweep.

Revision ID: p9q0r1s2t3u4
Revises: o8p9q0r1s2t3
Create Date: 2026-09-19 00:00:00.000000
"""

from alembic import op

revision = "p9q0r1s2t3u4"
down_revision = "o8p9q0r1s2t3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE progression_recommendations "
        "ADD COLUMN IF NOT EXISTS prefill_sweep_id VARCHAR(36) NULL"
    )
    # Resolving the last sweep is a user-scoped lookup on a narrowed column.
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_progression_recommendations_user_prefill_sweep "
        "ON progression_recommendations (user_id, prefill_sweep_id)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_progression_recommendations_user_prefill_sweep")
    op.execute(
        "ALTER TABLE progression_recommendations DROP COLUMN IF EXISTS prefill_sweep_id"
    )
