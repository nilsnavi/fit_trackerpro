"""Add body measurements table

Revision ID: j1k2l3m4n5o6
Revises: i2j3k4l5m6n7
Create Date: 2026-05-02 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect as sa_inspect

# revision identifiers, used by Alembic.
revision = "j1k2l3m4n5o6"
down_revision = "i2j3k4l5m6n7"
branch_labels = None
depends_on = None


def _table_exists(bind, name: str) -> bool:
    return sa_inspect(bind).has_table(name)


def upgrade() -> None:
    bind = op.get_bind()
    if _table_exists(bind, "body_measurements"):
        return

    op.create_table(
        "body_measurements",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column(
            "measurement_type",
            sa.String(length=32),
            nullable=False,
            comment="chest, waist, hips, left_thigh, right_thigh, left_bicep, right_bicep",
        ),
        sa.Column(
            "value_cm",
            sa.Numeric(5, 2),
            nullable=False,
            comment="Body circumference in centimeters",
        ),
        sa.Column(
            "measured_at",
            sa.Date(),
            nullable=False,
            comment="Measurement date",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint(
            "measurement_type IN ('chest','waist','hips','left_thigh','right_thigh','left_bicep','right_bicep')",
            name="ck_body_measurements_type_allowed",
        ),
        sa.CheckConstraint(
            "value_cm > 0 AND value_cm <= 400",
            name="ck_body_measurements_value_cm_range",
        ),
    )
    op.create_index("ix_body_measurements_id", "body_measurements", ["id"], unique=False)
    op.create_index(
        "ix_body_measurements_user_id",
        "body_measurements",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        "ix_body_measurements_measurement_type",
        "body_measurements",
        ["measurement_type"],
        unique=False,
    )
    op.create_index(
        "ix_body_measurements_measured_at",
        "body_measurements",
        ["measured_at"],
        unique=False,
    )
    op.create_index(
        "ix_body_measurements_user_measured_at",
        "body_measurements",
        ["user_id", "measured_at"],
        unique=False,
    )
    op.create_index(
        "ix_body_measurements_user_type_measured_at",
        "body_measurements",
        ["user_id", "measurement_type", "measured_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_body_measurements_user_type_measured_at", table_name="body_measurements")
    op.drop_index("ix_body_measurements_user_measured_at", table_name="body_measurements")
    op.drop_index("ix_body_measurements_measured_at", table_name="body_measurements")
    op.drop_index("ix_body_measurements_measurement_type", table_name="body_measurements")
    op.drop_index("ix_body_measurements_user_id", table_name="body_measurements")
    op.drop_index("ix_body_measurements_id", table_name="body_measurements")
    op.drop_table("body_measurements")
