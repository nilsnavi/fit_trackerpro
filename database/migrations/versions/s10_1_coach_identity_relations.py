"""Add Coach identity, invitations, and client relationships.

Revision ID: s10_1_coach_identity
Revises: r6s7t8u9v0w1
Create Date: 2026-09-27 18:05:10.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "s10_1_coach_identity"
down_revision = "r6s7t8u9v0w1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_roles",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_id", "role", name="uq_user_roles_user_role"),
        sa.CheckConstraint("role IN ('COACH', 'SUPER_ADMIN', 'GYM_ADMIN')", name="ck_user_roles_allowed_role"),
    )
    op.create_index("ix_user_roles_user_id", "user_roles", ["user_id"])

    op.create_table(
        "coach_profiles",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("display_name", sa.String(length=255), nullable=False),
        sa.Column("bio", sa.String(length=2000), nullable=True),
        sa.Column("specializations", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
        sa.Column("avatar_url", sa.String(length=2048), nullable=True),
        sa.Column("timezone", sa.String(length=64), nullable=False, server_default="UTC"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("public_slug", sa.String(length=128), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_id", name="uq_coach_profiles_user_id"),
        sa.UniqueConstraint("public_slug", name="uq_coach_profiles_public_slug"),
        sa.CheckConstraint("trim(display_name) <> ''", name="ck_coach_profiles_display_name_not_blank"),
    )

    op.create_table(
        "coach_clients",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("coach_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("client_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="ACTIVE"),
        sa.Column("permissions", sa.JSON(), nullable=False, server_default=sa.text("'{}'::json")),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("coach_id <> client_id", name="ck_coach_clients_not_self"),
        sa.CheckConstraint("status IN ('ACTIVE', 'PAUSED', 'ARCHIVED', 'REVOKED')", name="ck_coach_clients_status"),
    )
    op.create_index("ix_coach_clients_coach_status", "coach_clients", ["coach_id", "status"])
    op.create_index("ix_coach_clients_client_status", "coach_clients", ["client_id", "status"])
    op.create_index(
        "uq_coach_clients_active_pair",
        "coach_clients",
        ["coach_id", "client_id"],
        unique=True,
        postgresql_where=sa.text("status = 'ACTIVE'"),
    )

    op.create_table(
        "coach_invitations",
        sa.Column("id", sa.Uuid(as_uuid=False), primary_key=True),
        sa.Column("coach_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("client_hint", sa.String(length=255), nullable=True),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="PENDING"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("accepted_by_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("token_hash", name="uq_coach_invitations_token_hash"),
        sa.CheckConstraint("status IN ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED')", name="ck_coach_invitations_status"),
    )
    op.create_index("ix_coach_invitations_coach_status", "coach_invitations", ["coach_id", "status"])
    op.create_index("ix_coach_invitations_expires_at", "coach_invitations", ["expires_at"])

    op.execute(
        "INSERT INTO feature_flags (key, enabled, description) VALUES "
        "('coach', false, 'Enable FitTrack Coach identity and invitations') "
        "ON CONFLICT (key) DO NOTHING"
    )


def downgrade() -> None:
    # The flag row may be operator-managed or may predate this revision. Keep it.
    op.drop_index("ix_coach_invitations_expires_at", table_name="coach_invitations")
    op.drop_index("ix_coach_invitations_coach_status", table_name="coach_invitations")
    op.drop_table("coach_invitations")
    op.drop_index("uq_coach_clients_active_pair", table_name="coach_clients")
    op.drop_index("ix_coach_clients_client_status", table_name="coach_clients")
    op.drop_index("ix_coach_clients_coach_status", table_name="coach_clients")
    op.drop_table("coach_clients")
    op.drop_table("coach_profiles")
    op.drop_index("ix_user_roles_user_id", table_name="user_roles")
    op.drop_table("user_roles")
