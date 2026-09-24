"""add_treadmill_speed_incline_to_workout_set

Revision ID: f3a9d8e22a4c
Revises: 005108a1f1fa
Create Date: 2026-04-13

"""
from alembic import op
import sqlalchemy as sa

revision = "f3a9d8e22a4c"
down_revision = "005108a1f1fa"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("workout_sets", sa.Column("speed_kmh", sa.Numeric(8, 2), nullable=True))
    op.add_column("workout_sets", sa.Column("incline_pct", sa.Numeric(8, 2), nullable=True))
    op.create_check_constraint(
        "ck_workout_sets_speed_kmh_range",
        "workout_sets",
        "speed_kmh IS NULL OR (speed_kmh >= 0 AND speed_kmh <= 150)",
    )
    op.create_check_constraint(
        "ck_workout_sets_incline_pct_range",
        "workout_sets",
        "incline_pct IS NULL OR (incline_pct >= 0 AND incline_pct <= 100)",
    )


def downgrade() -> None:
    op.drop_constraint("ck_workout_sets_incline_pct_range", "workout_sets", type_="check")
    op.drop_constraint("ck_workout_sets_speed_kmh_range", "workout_sets", type_="check")
    op.drop_column("workout_sets", "incline_pct")
    op.drop_column("workout_sets", "speed_kmh")
