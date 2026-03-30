"""Add hot-path indexes (users/workouts/history/analytics)

Revision ID: 7b2c1c9a4e10
Revises: 6f4f8b5778dd
Create Date: 2026-03-30 00:00:00.000000
"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "7b2c1c9a4e10"
down_revision = "6f4f8b5778dd"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # workout_templates hot path:
    #   WHERE user_id = ? [AND type = ?]
    #   ORDER BY created_at DESC
    #
    # Existing single-column indexes (user_id, type, created_at) are not as good
    # for "user scope + recent-first" pagination; composite avoids extra sort and
    # reduces scanned rows.
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_workout_templates_user_created_at_desc
        ON workout_templates (user_id, created_at DESC)
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_workout_templates_user_type_created_at_desc
        ON workout_templates (user_id, type, created_at DESC)
        """
    )

    # muscle_load hot path:
    #   WHERE user_id = ? AND date BETWEEN ? AND ?
    #   [AND muscle_group = ?]
    #   ORDER BY date DESC, muscle_group ASC
    #
    # Existing UNIQUE(user_id, muscle_group, date) is optimal only when
    # muscle_group is provided (second key). For table views without muscle_group,
    # add an index that starts with (user_id, date).
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_muscle_load_user_date_desc_muscle_group
        ON muscle_load (user_id, date DESC, muscle_group)
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_muscle_load_user_date_desc_muscle_group")
    op.execute("DROP INDEX IF EXISTS ix_workout_templates_user_type_created_at_desc")
    op.execute("DROP INDEX IF EXISTS ix_workout_templates_user_created_at_desc")

