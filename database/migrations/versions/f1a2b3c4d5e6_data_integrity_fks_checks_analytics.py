"""Data integrity: composite FKs, CHECK constraints, analytics tables

Revision ID: f1a2b3c4d5e6
Revises: 9f41b6d2a7c1
Create Date: 2026-03-29 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect as sa_inspect
# revision identifiers, used by Alembic.
revision = "f1a2b3c4d5e6"
down_revision = "9f41b6d2a7c1"
branch_labels = None
depends_on = None


def _table_exists(bind, name: str) -> bool:
    return sa_inspect(bind).has_table(name)


def upgrade() -> None:
    bind = op.get_bind()

    # --- Analytics aggregates (ORM tables; previously missing from Alembic) ---
    if not _table_exists(bind, "training_load_daily"):
        op.create_table(
            "training_load_daily",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("date", sa.Date(), nullable=False),
            sa.Column(
                "volume",
                sa.Numeric(precision=14, scale=2),
                server_default="0",
                nullable=False,
            ),
            sa.Column(
                "fatigue_score",
                sa.Numeric(precision=10, scale=2),
                server_default="0",
                nullable=False,
            ),
            sa.Column("avg_rpe", sa.Numeric(precision=3, scale=1), nullable=True),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.CheckConstraint("volume >= 0", name="ck_training_load_daily_volume"),
            sa.CheckConstraint(
                "fatigue_score >= 0", name="ck_training_load_daily_fatigue"
            ),
        )
        op.create_index(
            "ix_training_load_daily_user_date",
            "training_load_daily",
            ["user_id", "date"],
            unique=True,
        )
        op.create_index(
            "ix_training_load_daily_user_id",
            "training_load_daily",
            ["user_id"],
            unique=False,
        )
        op.create_index(
            "ix_training_load_daily_date",
            "training_load_daily",
            ["date"],
            unique=False,
        )

    if not _table_exists(bind, "muscle_load"):
        op.create_table(
            "muscle_load",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("muscle_group", sa.String(length=50), nullable=False),
            sa.Column("date", sa.Date(), nullable=False),
            sa.Column(
                "load_score",
                sa.Numeric(precision=14, scale=2),
                server_default="0",
                nullable=False,
            ),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.CheckConstraint("load_score >= 0", name="ck_muscle_load_score"),
        )
        op.create_index(
            "ix_muscle_load_user_muscle_date",
            "muscle_load",
            ["user_id", "muscle_group", "date"],
            unique=True,
        )
        op.create_index(
            "ix_muscle_load_user_id",
            "muscle_load",
            ["user_id"],
            unique=False,
        )
        op.create_index(
            "ix_muscle_load_muscle_group",
            "muscle_load",
            ["muscle_group"],
            unique=False,
        )
        op.create_index(
            "ix_muscle_load_date",
            "muscle_load",
            ["date"],
            unique=False,
        )

    if not _table_exists(bind, "recovery_state"):
        op.create_table(
            "recovery_state",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column(
                "fatigue_level",
                sa.Integer(),
                server_default="0",
                nullable=False,
            ),
            sa.Column(
                "readiness_score",
                sa.Numeric(precision=5, scale=2),
                server_default="0",
                nullable=False,
            ),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.CheckConstraint(
                "fatigue_level >= 0 AND fatigue_level <= 100",
                name="ck_recovery_state_fatigue",
            ),
            sa.CheckConstraint(
                "readiness_score >= 0 AND readiness_score <= 100",
                name="ck_recovery_state_readiness",
            ),
        )
        op.create_index(
            "ix_recovery_state_user_id",
            "recovery_state",
            ["user_id"],
            unique=True,
        )

    # --- Redundant non-unique index: UNIQUE(telegram_id) already enforces lookup ---
    op.drop_index("ix_users_telegram_id", table_name="users")

    # --- Composite keys for cross-table user consistency ---
    op.create_unique_constraint(
        "uq_workout_templates_user_id",
        "workout_templates",
        ["user_id", "id"],
    )
    op.create_unique_constraint(
        "uq_workout_logs_user_id",
        "workout_logs",
        ["user_id", "id"],
    )

    # Orphan links would violate composite FKs
    op.execute(
        """
        UPDATE workout_logs wl
        SET template_id = NULL
        FROM workout_templates wt
        WHERE wl.template_id = wt.id AND wl.user_id != wt.user_id
        """
    )
    op.execute(
        """
        UPDATE glucose_logs gl
        SET workout_id = NULL
        FROM workout_logs wl
        WHERE gl.workout_id = wl.id AND gl.user_id != wl.user_id
        """
    )

    op.drop_constraint(
        "workout_logs_template_id_fkey", "workout_logs", type_="foreignkey"
    )
    op.drop_constraint(
        "glucose_logs_workout_id_fkey", "glucose_logs", type_="foreignkey"
    )

    op.create_foreign_key(
        "fk_workout_logs_user_template",
        "workout_logs",
        "workout_templates",
        ["user_id", "template_id"],
        ["user_id", "id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_glucose_logs_user_workout",
        "glucose_logs",
        "workout_logs",
        ["user_id", "workout_id"],
        ["user_id", "id"],
        ondelete="CASCADE",
    )

    # --- CHECK constraints (align with schema_v2 / domain) ---
    op.execute(
        "UPDATE challenges SET end_date = start_date WHERE end_date < start_date"
    )
    op.execute(
        "UPDATE challenges SET max_participants = 0 WHERE max_participants < 0"
    )
    op.create_check_constraint(
        "ck_challenges_date_range",
        "challenges",
        "end_date >= start_date",
    )
    op.create_check_constraint(
        "ck_challenges_max_participants",
        "challenges",
        "max_participants >= 0",
    )

    op.execute(
        """
        UPDATE daily_wellness SET sleep_score = LEAST(100, GREATEST(0, sleep_score))
        """
    )
    op.execute(
        """
        UPDATE daily_wellness SET energy_score = LEAST(100, GREATEST(0, energy_score))
        """
    )
    op.execute(
        """
        UPDATE daily_wellness SET stress_level = LEAST(10, GREATEST(0, stress_level))
        WHERE stress_level IS NOT NULL
        """
    )
    op.execute(
        """
        UPDATE daily_wellness SET mood_score = LEAST(100, GREATEST(0, mood_score))
        WHERE mood_score IS NOT NULL
        """
    )
    op.create_check_constraint(
        "ck_daily_wellness_sleep_score",
        "daily_wellness",
        "sleep_score >= 0 AND sleep_score <= 100",
    )
    op.create_check_constraint(
        "ck_daily_wellness_energy_score",
        "daily_wellness",
        "energy_score >= 0 AND energy_score <= 100",
    )
    op.create_check_constraint(
        "ck_daily_wellness_stress_level",
        "daily_wellness",
        "stress_level IS NULL OR (stress_level >= 0 AND stress_level <= 10)",
    )
    op.create_check_constraint(
        "ck_daily_wellness_mood_score",
        "daily_wellness",
        "mood_score IS NULL OR (mood_score >= 0 AND mood_score <= 100)",
    )


def downgrade() -> None:
    op.drop_constraint("ck_daily_wellness_mood_score", "daily_wellness", type_="check")
    op.drop_constraint(
        "ck_daily_wellness_stress_level", "daily_wellness", type_="check"
    )
    op.drop_constraint(
        "ck_daily_wellness_energy_score", "daily_wellness", type_="check"
    )
    op.drop_constraint(
        "ck_daily_wellness_sleep_score", "daily_wellness", type_="check"
    )

    op.drop_constraint(
        "ck_challenges_max_participants", "challenges", type_="check"
    )
    op.drop_constraint("ck_challenges_date_range", "challenges", type_="check")

    op.drop_constraint(
        "fk_glucose_logs_user_workout", "glucose_logs", type_="foreignkey"
    )
    op.drop_constraint(
        "fk_workout_logs_user_template", "workout_logs", type_="foreignkey"
    )

    op.create_foreign_key(
        "workout_logs_template_id_fkey",
        "workout_logs",
        "workout_templates",
        ["template_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "glucose_logs_workout_id_fkey",
        "glucose_logs",
        "workout_logs",
        ["workout_id"],
        ["id"],
        ondelete="CASCADE",
    )

    op.drop_constraint("uq_workout_logs_user_id", "workout_logs", type_="unique")
    op.drop_constraint(
        "uq_workout_templates_user_id", "workout_templates", type_="unique"
    )

    op.create_index(
        "ix_users_telegram_id", "users", ["telegram_id"], unique=False
    )

    bind = op.get_bind()
    if _table_exists(bind, "recovery_state"):
        op.drop_table("recovery_state")
    if _table_exists(bind, "muscle_load"):
        op.drop_table("muscle_load")
    if _table_exists(bind, "training_load_daily"):
        op.drop_table("training_load_daily")
