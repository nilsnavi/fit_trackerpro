"""add_rest_rpe_to_workout_set

Revision ID: 005108a1f1fa
Revises: 2a8b3c4d5e6f
Create Date: 2026-04-13 09:10:51.352718

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '005108a1f1fa'
down_revision = '2a8b3c4d5e6f'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("workout_sets", sa.Column("rest_seconds", sa.Integer(), nullable=True))
    op.create_check_constraint(
        "ck_workout_sets_rest_non_negative",
        "workout_sets",
        "rest_seconds IS NULL OR rest_seconds >= 0",
    )

    # rpe: numeric(3,1) -> smallint (1-10)
    op.drop_constraint("ck_workout_sets_rpe_range", "workout_sets", type_="check")
    op.alter_column(
        "workout_sets",
        "rpe",
        existing_type=sa.NUMERIC(precision=3, scale=1),
        type_=sa.SmallInteger(),
        existing_nullable=True,
        postgresql_using="ROUND(rpe)::smallint",
    )
    op.create_check_constraint(
        "ck_workout_sets_rpe_range",
        "workout_sets",
        "rpe IS NULL OR (rpe >= 1 AND rpe <= 10)",
    )


def downgrade() -> None:
    op.drop_constraint("ck_workout_sets_rpe_range", "workout_sets", type_="check")
    op.alter_column(
        "workout_sets",
        "rpe",
        existing_type=sa.SmallInteger(),
        type_=sa.NUMERIC(precision=3, scale=1),
        existing_nullable=True,
        postgresql_using="rpe::numeric(3,1)",
    )
    op.create_check_constraint(
        "ck_workout_sets_rpe_range",
        "workout_sets",
        "rpe IS NULL OR (rpe >= 0 AND rpe <= 10)",
    )

    op.drop_constraint("ck_workout_sets_rest_non_negative", "workout_sets", type_="check")
    op.drop_column("workout_sets", "rest_seconds")
