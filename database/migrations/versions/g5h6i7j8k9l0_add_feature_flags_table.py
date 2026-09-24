"""Add feature_flags table for feature toggle management

Revision ID: g5h6i7j8k9l0
Revises: f3a9d8e22a4c
Create Date: 2026-04-16 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'g5h6i7j8k9l0'
down_revision = 'f3a9d8e22a4c'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create feature_flags table with initial seed data."""
    op.create_table(
        'feature_flags',
        sa.Column('key', sa.String(100), primary_key=True, nullable=False),
        sa.Column('enabled', sa.Boolean(),
                  nullable=False, server_default='false'),
        sa.Column('description', sa.String(500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True),
                  server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True),
                  server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.PrimaryKeyConstraint('key'),
    )

    # Create index for faster lookups
    op.create_index('ix_feature_flags_key',
                    'feature_flags', ['key'], unique=True)

    # Seed initial feature flags
    op.execute("""
        INSERT INTO feature_flags (key, enabled, description) VALUES
        ('muscle_imbalance_signals', true, 'Enable muscle imbalance signals analytics endpoint'),
        ('water_tracking', true, 'Enable water tracking feature'),
        ('glucose_tracking', true, 'Enable glucose tracking feature')
        ON CONFLICT (key) DO NOTHING
    """)


def downgrade() -> None:
    """Remove feature_flags table."""
    op.drop_index('ix_feature_flags_key', table_name='feature_flags')
    op.drop_table('feature_flags')
