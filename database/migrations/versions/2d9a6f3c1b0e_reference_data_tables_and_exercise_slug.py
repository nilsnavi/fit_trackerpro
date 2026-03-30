"""Reference data tables + exercise slug/source

Revision ID: 2d9a6f3c1b0e
Revises: 7b2c1c9a4e10
Create Date: 2026-03-30 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "2d9a6f3c1b0e"
down_revision = "7b2c1c9a4e10"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ---------------------------------------------------------------------
    # Reference data (exercise filters)
    # ---------------------------------------------------------------------
    op.create_table(
        "ref_exercise_category",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("label", sa.String(length=120), nullable=False),
        sa.Column("icon", sa.String(length=80), nullable=True),
        sa.Column("sort_order", sa.Integer(), server_default="0", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.UniqueConstraint("code", name="uq_ref_exercise_category_code"),
    )
    op.create_index("ix_ref_exercise_category_code", "ref_exercise_category", ["code"], unique=False)
    op.create_index("ix_ref_exercise_category_is_active", "ref_exercise_category", ["is_active"], unique=False)

    op.create_table(
        "ref_muscle_group",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("code", sa.String(length=64), nullable=False),
        sa.Column("label", sa.String(length=120), nullable=False),
        sa.Column("sort_order", sa.Integer(), server_default="0", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.UniqueConstraint("code", name="uq_ref_muscle_group_code"),
    )
    op.create_index("ix_ref_muscle_group_code", "ref_muscle_group", ["code"], unique=False)
    op.create_index("ix_ref_muscle_group_is_active", "ref_muscle_group", ["is_active"], unique=False)

    op.create_table(
        "ref_equipment",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("code", sa.String(length=64), nullable=False),
        sa.Column("label", sa.String(length=120), nullable=False),
        sa.Column("sort_order", sa.Integer(), server_default="0", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.UniqueConstraint("code", name="uq_ref_equipment_code"),
    )
    op.create_index("ix_ref_equipment_code", "ref_equipment", ["code"], unique=False)
    op.create_index("ix_ref_equipment_is_active", "ref_equipment", ["is_active"], unique=False)

    op.create_table(
        "ref_exercise_status",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("code", sa.String(length=20), nullable=False),
        sa.Column("label", sa.String(length=80), nullable=False),
        sa.Column("sort_order", sa.Integer(), server_default="0", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.UniqueConstraint("code", name="uq_ref_exercise_status_code"),
    )
    op.create_index("ix_ref_exercise_status_code", "ref_exercise_status", ["code"], unique=False)
    op.create_index("ix_ref_exercise_status_is_active", "ref_exercise_status", ["is_active"], unique=False)

    # ---------------------------------------------------------------------
    # Applied datasets log
    # ---------------------------------------------------------------------
    op.create_table(
        "reference_data_applied",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("dataset_name", sa.String(length=80), nullable=False),
        sa.Column("dataset_version", sa.String(length=40), nullable=False),
        sa.Column("checksum", sa.String(length=128), nullable=False),
        sa.Column("app_version", sa.String(length=80), nullable=True),
        sa.Column("dry_run", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("applied_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.UniqueConstraint("dataset_name", "dataset_version", "checksum", name="uq_reference_data_applied_dataset"),
    )
    op.create_index("ix_reference_data_applied_dataset_name", "reference_data_applied", ["dataset_name"], unique=False)
    op.create_index("ix_reference_data_applied_applied_at", "reference_data_applied", ["applied_at"], unique=False)

    # ---------------------------------------------------------------------
    # Exercises: stable slug + source
    # ---------------------------------------------------------------------
    op.add_column("exercises", sa.Column("slug", sa.String(length=180), nullable=True))
    op.add_column("exercises", sa.Column("source", sa.String(length=16), server_default="system", nullable=False))

    # Backfill source for existing user-created exercises.
    op.execute(
        """
        UPDATE exercises
        SET source = CASE WHEN author_user_id IS NULL THEN 'system' ELSE 'user' END
        WHERE source IS NULL OR source = 'system'
        """
    )

    op.create_index("ix_exercises_slug", "exercises", ["slug"], unique=False)
    op.create_index("ix_exercises_source", "exercises", ["source"], unique=False)

    # Enforce unique slug for system exercises only (when slug is set).
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_exercises_system_slug
        ON exercises (slug)
        WHERE source = 'system' AND slug IS NOT NULL
        """
    )

    # Keep triggers consistent with initial schema pattern (updated_at on update).
    # Initial schema already creates update_exercises_updated_at trigger; no changes needed.


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_exercises_system_slug")
    op.drop_index("ix_exercises_source", table_name="exercises")
    op.drop_index("ix_exercises_slug", table_name="exercises")
    op.drop_column("exercises", "source")
    op.drop_column("exercises", "slug")

    op.drop_index("ix_reference_data_applied_applied_at", table_name="reference_data_applied")
    op.drop_index("ix_reference_data_applied_dataset_name", table_name="reference_data_applied")
    op.drop_table("reference_data_applied")

    op.drop_index("ix_ref_exercise_status_is_active", table_name="ref_exercise_status")
    op.drop_index("ix_ref_exercise_status_code", table_name="ref_exercise_status")
    op.drop_table("ref_exercise_status")

    op.drop_index("ix_ref_equipment_is_active", table_name="ref_equipment")
    op.drop_index("ix_ref_equipment_code", table_name="ref_equipment")
    op.drop_table("ref_equipment")

    op.drop_index("ix_ref_muscle_group_is_active", table_name="ref_muscle_group")
    op.drop_index("ix_ref_muscle_group_code", table_name="ref_muscle_group")
    op.drop_table("ref_muscle_group")

    op.drop_index("ix_ref_exercise_category_is_active", table_name="ref_exercise_category")
    op.drop_index("ix_ref_exercise_category_code", table_name="ref_exercise_category")
    op.drop_table("ref_exercise_category")

