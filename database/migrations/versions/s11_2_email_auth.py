"""Add email identities and one-time authentication challenges."""
import sqlalchemy as sa
from alembic import op

revision = "s11_2_email_auth"
down_revision = "s11_1_refresh_sessions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("users", "telegram_id", existing_type=sa.BigInteger(), nullable=True)
    op.add_column("users", sa.Column("email", sa.String(254), nullable=True))
    op.create_unique_constraint("uq_users_email", "users", ["email"])
    op.create_table(
        "email_auth_challenges",
        sa.Column("email", sa.String(254), primary_key=True),
        sa.Column("challenge_id", sa.String(32), nullable=False, unique=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE")),
        sa.Column("code_hash", sa.String(64), nullable=False),
        sa.Column("attempts_left", sa.Integer(), nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_email_auth_challenges_expires_at", "email_auth_challenges", ["expires_at"])


def downgrade() -> None:
    connection = op.get_bind()
    if connection.scalar(sa.text("SELECT EXISTS (SELECT 1 FROM users WHERE email IS NOT NULL)")):
        raise RuntimeError("Email identities exist; disable email delivery and retain the migration.")
    op.drop_table("email_auth_challenges")
    op.drop_constraint("uq_users_email", "users", type_="unique")
    op.drop_column("users", "email")
    op.alter_column("users", "telegram_id", existing_type=sa.BigInteger(), nullable=False)
