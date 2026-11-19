"""Append-only transactional audit for Coach–Client grant changes.

Revision ID: s11_4_coach_grant_audit
Revises: s11_3_coach_client_grants
"""
import sqlalchemy as sa
from alembic import op

revision = "s11_4_coach_grant_audit"
down_revision = "s11_3_coach_client_grants"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "coach_grant_audit",
        sa.Column("id", sa.Uuid(as_uuid=False), primary_key=True),
        sa.Column("grant_id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("relationship_id", sa.Integer(), nullable=False),
        sa.Column("coach_id", sa.Integer(), nullable=False),
        sa.Column("client_id", sa.Integer(), nullable=False),
        sa.Column("actor_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("scope", sa.String(48), nullable=False),
        sa.Column("consent_version", sa.String(32), nullable=False),
        sa.Column("action", sa.String(16), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("action IN ('GRANTED', 'REVOKED')", name="ck_coach_grant_audit_action"),
    )
    op.create_index("ix_coach_grant_audit_client_time", "coach_grant_audit", ["client_id", "occurred_at"])


def downgrade() -> None:
    if op.get_bind().scalar(sa.text("SELECT COUNT(*) FROM coach_grant_audit")):
        raise RuntimeError("Refusing to destroy consent audit records")
    op.drop_index("ix_coach_grant_audit_client_time", table_name="coach_grant_audit")
    op.drop_table("coach_grant_audit")
