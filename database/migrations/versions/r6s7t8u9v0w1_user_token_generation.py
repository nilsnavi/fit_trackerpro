"""Add immutable account token generation identity.

Revision ID: r6s7t8u9v0w1
Revises: q0r1s2t3u4v5
Create Date: 2026-09-26 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "r6s7t8u9v0w1"
down_revision = "q0r1s2t3u4v5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("token_generation", sa.Uuid(as_uuid=False), nullable=True))
    op.execute(
        "UPDATE users SET token_generation = "
        "(substr(md5(random()::text || clock_timestamp()::text || id::text), 1, 8) || '-' || "
        "substr(md5(random()::text || clock_timestamp()::text || id::text), 9, 4) || '-4' || "
        "substr(md5(random()::text || clock_timestamp()::text || id::text), 14, 3) || '-a' || "
        "substr(md5(random()::text || clock_timestamp()::text || id::text), 18, 3) || '-' || "
        "substr(md5(random()::text || clock_timestamp()::text || id::text), 21, 12))::uuid "
        "WHERE token_generation IS NULL"
    )
    op.alter_column("users", "token_generation", nullable=False)
    op.create_unique_constraint("uq_users_token_generation", "users", ["token_generation"])


def downgrade() -> None:
    op.drop_constraint("uq_users_token_generation", "users", type_="unique")
    op.drop_column("users", "token_generation")
