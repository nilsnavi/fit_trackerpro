"""SPEC-006 §58: remember a declined automatic prefill

Additive and nullable: one column on ``progression_recommendations`` records when
the user undid a target's automatic substitution in a session. The recommendation
itself stays accepted — only the silent prefill is switched off until a newer
target is accepted, which keeps running clients unaffected.

Revision ID: o8p9q0r1s2t3
Revises: n7o8p9q0r1s2
Create Date: 2026-09-17 00:00:00.000000
"""

from alembic import op

revision = "o8p9q0r1s2t3"
down_revision = "n7o8p9q0r1s2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE progression_recommendations "
        "ADD COLUMN IF NOT EXISTS prefill_declined_at TIMESTAMPTZ NULL"
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE progression_recommendations DROP COLUMN IF EXISTS prefill_declined_at"
    )
