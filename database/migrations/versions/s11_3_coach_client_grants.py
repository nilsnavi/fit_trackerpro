"""Add explicit, initially empty Coach–Client grants table.

Revision ID: s11_3_coach_client_grants
Revises: s11_2_email_auth
"""
import sqlalchemy as sa
from alembic import op

revision = "s11_3_coach_client_grants"
down_revision = "s11_2_email_auth"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "coach_client_grants",
        sa.Column("id", sa.Uuid(as_uuid=False), primary_key=True),
        sa.Column("relationship_id", sa.Integer(), sa.ForeignKey("coach_clients.id", ondelete="CASCADE"), nullable=False),
        sa.Column("coach_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("client_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("scope", sa.String(48), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("consent_version", sa.String(32), nullable=False),
        sa.Column("granted_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("relationship_id", "scope", name="uq_coach_grant_relationship_scope"),
        sa.CheckConstraint("coach_id <> client_id", name="ck_coach_grant_not_self"),
        sa.CheckConstraint("scope IN ('training_summary.read', 'workout_history.read')", name="ck_coach_grant_scope"),
        sa.CheckConstraint("status IN ('ACTIVE', 'REVOKED', 'EXPIRED')", name="ck_coach_grant_status"),
        sa.CheckConstraint(
            "(status = 'REVOKED' AND revoked_at IS NOT NULL) OR "
            "(status <> 'REVOKED' AND revoked_at IS NULL)",
            name="ck_coach_grant_revocation_consistency",
        ),
        sa.CheckConstraint("expires_at IS NULL OR expires_at > granted_at", name="ck_coach_grant_expiry_order"),
    )
    op.create_index("ix_coach_grants_coach_client_status", "coach_client_grants", ["coach_id", "client_id", "status"])
    op.create_index("ix_coach_grants_client_status", "coach_client_grants", ["client_id", "status"])


def downgrade() -> None:
    bind = op.get_bind()
    if bind.scalar(sa.text("SELECT COUNT(*) FROM coach_client_grants")):
        raise RuntimeError("Coach grants exist; revoke/export and handle consent records before downgrade")
    op.drop_index("ix_coach_grants_client_status", table_name="coach_client_grants")
    op.drop_index("ix_coach_grants_coach_client_status", table_name="coach_client_grants")
    op.drop_table("coach_client_grants")
