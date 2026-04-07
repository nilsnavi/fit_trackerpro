"""Normalize workout templates/sessions into exercises and sets tables.

Revision ID: a91c6de4b22f
Revises: e7d1c2b4a9f0
Create Date: 2026-04-07 00:00:01.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "a91c6de4b22f"
down_revision = "e7d1c2b4a9f0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "template_exercises",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("template_id", sa.Integer(), nullable=False),
        sa.Column("exercise_id", sa.Integer(), nullable=False),
        sa.Column("order_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("sets", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("reps", sa.Integer(), nullable=True),
        sa.Column("duration", sa.Integer(), nullable=True),
        sa.Column("rest_seconds", sa.Integer(), nullable=False, server_default="60"),
        sa.Column("weight", sa.Numeric(precision=8, scale=2), nullable=True),
        sa.Column("notes", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["exercise_id"], ["exercises.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(
            ["user_id", "template_id"],
            ["workout_templates.user_id", "workout_templates.id"],
            ondelete="CASCADE",
            name="fk_template_exercises_user_template",
        ),
        sa.CheckConstraint("order_index >= 0", name="ck_template_exercises_order_index_non_negative"),
        sa.CheckConstraint("sets >= 1 AND sets <= 20", name="ck_template_exercises_sets_range"),
        sa.CheckConstraint("reps IS NULL OR reps >= 0", name="ck_template_exercises_reps_non_negative"),
        sa.CheckConstraint("duration IS NULL OR duration >= 0", name="ck_template_exercises_duration_non_negative"),
        sa.CheckConstraint("rest_seconds >= 0 AND rest_seconds <= 600", name="ck_template_exercises_rest_seconds_range"),
        sa.CheckConstraint("weight IS NULL OR weight >= 0", name="ck_template_exercises_weight_non_negative"),
    )
    op.create_index("ix_template_exercises_user_id", "template_exercises", ["user_id"], unique=False)
    op.create_index("ix_template_exercises_template_id", "template_exercises", ["template_id"], unique=False)
    op.create_index("ix_template_exercises_exercise_id", "template_exercises", ["exercise_id"], unique=False)
    op.create_index("ix_template_exercises_template_order", "template_exercises", ["template_id", "order_index"], unique=False)

    op.create_table(
        "workout_session_exercises",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("workout_session_id", sa.Integer(), nullable=False),
        sa.Column("source_template_exercise_id", sa.Integer(), nullable=True),
        sa.Column("exercise_id", sa.Integer(), nullable=False),
        sa.Column("order_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("notes", sa.String(length=1000), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["source_template_exercise_id"], ["template_exercises.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(
            ["user_id", "workout_session_id"],
            ["workout_logs.user_id", "workout_logs.id"],
            ondelete="CASCADE",
            name="fk_session_exercises_user_session",
        ),
        sa.CheckConstraint("order_index >= 0", name="ck_workout_session_exercises_order_index_non_negative"),
        sa.CheckConstraint("exercise_id >= 1", name="ck_workout_session_exercises_exercise_positive"),
    )
    op.create_index("ix_workout_session_exercises_user_id", "workout_session_exercises", ["user_id"], unique=False)
    op.create_index("ix_workout_session_exercises_workout_session_id", "workout_session_exercises", ["workout_session_id"], unique=False)
    op.create_index(
        "ix_workout_session_exercises_session_order",
        "workout_session_exercises",
        ["workout_session_id", "order_index"],
        unique=False,
    )

    op.create_table(
        "workout_sets",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("workout_session_id", sa.Integer(), nullable=False),
        sa.Column("workout_session_exercise_id", sa.Integer(), nullable=False),
        sa.Column("set_number", sa.Integer(), nullable=False),
        sa.Column("set_type", sa.String(length=16), nullable=False, server_default="working"),
        sa.Column("reps", sa.Integer(), nullable=True),
        sa.Column("weight", sa.Numeric(precision=8, scale=2), nullable=True),
        sa.Column("rpe", sa.Numeric(precision=3, scale=1), nullable=True),
        sa.Column("rir", sa.Numeric(precision=3, scale=1), nullable=True),
        sa.Column("duration", sa.Integer(), nullable=True),
        sa.Column("completed", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["workout_session_exercise_id"], ["workout_session_exercises.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["user_id", "workout_session_id"],
            ["workout_logs.user_id", "workout_logs.id"],
            ondelete="CASCADE",
            name="fk_workout_sets_user_session",
        ),
        sa.CheckConstraint("set_number >= 1", name="ck_workout_sets_set_number_positive"),
        sa.CheckConstraint("set_type IN ('warmup','working','dropset','failure')", name="ck_workout_sets_set_type_allowed"),
        sa.CheckConstraint("reps IS NULL OR reps >= 0", name="ck_workout_sets_reps_non_negative"),
        sa.CheckConstraint("weight IS NULL OR weight >= 0", name="ck_workout_sets_weight_non_negative"),
        sa.CheckConstraint("rpe IS NULL OR (rpe >= 0 AND rpe <= 10)", name="ck_workout_sets_rpe_range"),
        sa.CheckConstraint("rir IS NULL OR (rir >= 0 AND rir <= 10)", name="ck_workout_sets_rir_range"),
        sa.CheckConstraint("duration IS NULL OR duration >= 0", name="ck_workout_sets_duration_non_negative"),
    )
    op.create_index("ix_workout_sets_user_id", "workout_sets", ["user_id"], unique=False)
    op.create_index("ix_workout_sets_workout_session_id", "workout_sets", ["workout_session_id"], unique=False)
    op.create_index(
        "ix_workout_sets_session_exercise_number",
        "workout_sets",
        ["workout_session_exercise_id", "set_number"],
        unique=False,
    )
    op.create_index("ix_workout_sets_user_session", "workout_sets", ["user_id", "workout_session_id"], unique=False)

    op.execute(
        """
        INSERT INTO template_exercises (
            user_id,
            template_id,
            exercise_id,
            order_index,
            name,
            sets,
            reps,
            duration,
            rest_seconds,
            weight,
            notes,
            created_at,
            updated_at
        )
        SELECT
            wt.user_id,
            wt.id,
            COALESCE(NULLIF((je.value->>'exercise_id')::INT, 0), je.ord::INT),
            (je.ord - 1)::INT,
            COALESCE(NULLIF(je.value->>'name', ''), CONCAT('Exercise #', je.ord::TEXT)),
            COALESCE(NULLIF((je.value->>'sets')::INT, 0), 1),
            NULLIF(je.value->>'reps', '')::INT,
            NULLIF(je.value->>'duration', '')::INT,
            COALESCE(NULLIF(je.value->>'rest_seconds', '')::INT, 60),
            NULLIF(je.value->>'weight', '')::NUMERIC(8,2),
            je.value->>'notes',
            wt.created_at,
            wt.updated_at
        FROM workout_templates wt
        CROSS JOIN LATERAL jsonb_array_elements(COALESCE(wt.exercises::jsonb, '[]'::jsonb)) WITH ORDINALITY AS je(value, ord)
        """
    )

    op.execute(
        """
        INSERT INTO workout_session_exercises (
            user_id,
            workout_session_id,
            exercise_id,
            order_index,
            name,
            notes,
            created_at,
            updated_at
        )
        SELECT
            wl.user_id,
            wl.id,
            COALESCE(NULLIF((je.value->>'exercise_id')::INT, 0), je.ord::INT),
            (je.ord - 1)::INT,
            COALESCE(NULLIF(je.value->>'name', ''), CONCAT('Exercise #', je.ord::TEXT)),
            je.value->>'notes',
            wl.created_at,
            wl.updated_at
        FROM workout_logs wl
        CROSS JOIN LATERAL jsonb_array_elements(COALESCE(wl.exercises::jsonb, '[]'::jsonb)) WITH ORDINALITY AS je(value, ord)
        """
    )

    op.execute(
        """
        INSERT INTO workout_sets (
            user_id,
            workout_session_id,
            workout_session_exercise_id,
            set_number,
            set_type,
            reps,
            weight,
            rpe,
            rir,
            duration,
            completed,
            created_at
        )
        SELECT
            se.user_id,
            se.workout_session_id,
            se.id,
            COALESCE(NULLIF((js.value->>'set_number')::INT, 0), js.ord::INT),
            CASE
                WHEN LOWER(COALESCE(js.value->>'set_type', 'working')) IN ('warmup','working','dropset','failure')
                    THEN LOWER(COALESCE(js.value->>'set_type', 'working'))
                ELSE 'working'
            END,
            NULLIF(js.value->>'reps', '')::INT,
            NULLIF(js.value->>'weight', '')::NUMERIC(8,2),
            NULLIF(js.value->>'rpe', '')::NUMERIC(3,1),
            NULLIF(js.value->>'rir', '')::NUMERIC(3,1),
            NULLIF(js.value->>'duration', '')::INT,
            COALESCE(NULLIF(js.value->>'completed', '')::BOOLEAN, TRUE),
            wl.created_at
        FROM workout_session_exercises se
        JOIN workout_logs wl ON wl.id = se.workout_session_id AND wl.user_id = se.user_id
        JOIN LATERAL (
            SELECT ex.value
            FROM jsonb_array_elements(COALESCE(wl.exercises::jsonb, '[]'::jsonb)) WITH ORDINALITY ex(value, ord)
            WHERE (ex.ord - 1) = se.order_index
        ) src ON TRUE
        CROSS JOIN LATERAL jsonb_array_elements(COALESCE(src.value->'sets_completed', '[]'::jsonb)) WITH ORDINALITY js(value, ord)
        """
    )


def downgrade() -> None:
    op.drop_index("ix_workout_sets_user_session", table_name="workout_sets")
    op.drop_index("ix_workout_sets_session_exercise_number", table_name="workout_sets")
    op.drop_index("ix_workout_sets_workout_session_id", table_name="workout_sets")
    op.drop_index("ix_workout_sets_user_id", table_name="workout_sets")
    op.drop_table("workout_sets")

    op.drop_index("ix_workout_session_exercises_session_order", table_name="workout_session_exercises")
    op.drop_index("ix_workout_session_exercises_workout_session_id", table_name="workout_session_exercises")
    op.drop_index("ix_workout_session_exercises_user_id", table_name="workout_session_exercises")
    op.drop_table("workout_session_exercises")

    op.drop_index("ix_template_exercises_template_order", table_name="template_exercises")
    op.drop_index("ix_template_exercises_exercise_id", table_name="template_exercises")
    op.drop_index("ix_template_exercises_template_id", table_name="template_exercises")
    op.drop_index("ix_template_exercises_user_id", table_name="template_exercises")
    op.drop_table("template_exercises")
