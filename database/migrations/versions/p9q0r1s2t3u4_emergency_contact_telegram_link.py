"""WS1-13: emergency contact Telegram linking (real delivery channel)

Emergency notifications used to report success without sending anything.
A contact is only reachable through a bot if they have contacted the bot, so
delivery needs an explicit chat id. This adds the delivery channel plus the
one-time code used to bind a contact's Telegram account.

Revision ID: p9q0r1s2t3u4
Revises: o8p9q0r1s2t3
Create Date: 2026-09-23 00:00:00.000000
"""

import sqlalchemy as sa

from alembic import op

revision = "p9q0r1s2t3u4"
down_revision = "o8p9q0r1s2t3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "emergency_contacts",
        sa.Column(
            "telegram_chat_id",
            sa.BigInteger(),
            nullable=True,
            comment="Telegram chat id of the linked contact (delivery channel)",
        ),
    )
    op.add_column(
        "emergency_contacts",
        sa.Column(
            "link_code",
            sa.String(length=16),
            nullable=True,
            comment="One-time code the contact sends to the bot to get linked",
        ),
    )
    op.add_column(
        "emergency_contacts",
        sa.Column(
            "linked_at",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="When the contact linked their Telegram account",
        ),
    )
    op.create_index(
        "ix_emergency_contacts_telegram_chat_id",
        "emergency_contacts",
        ["telegram_chat_id"],
    )
    op.create_unique_constraint(
        "uq_emergency_contacts_link_code",
        "emergency_contacts",
        ["link_code"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_emergency_contacts_link_code",
        "emergency_contacts",
        type_="unique",
    )
    op.drop_index("ix_emergency_contacts_telegram_chat_id", table_name="emergency_contacts")
    op.drop_column("emergency_contacts", "linked_at")
    op.drop_column("emergency_contacts", "link_code")
    op.drop_column("emergency_contacts", "telegram_chat_id")
