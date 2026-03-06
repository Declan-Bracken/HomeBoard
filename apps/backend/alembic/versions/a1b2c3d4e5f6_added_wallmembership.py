"""add privacy and wallmembers

Revision ID: a1b2c3d4e5f6
Revises: 5acc82f538e5
Create Date: 2026-03-06
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ENUM

revision = 'a1b2c3d4e5f6'
down_revision = '5acc82f538e5'
branch_labels = None
depends_on = None


def upgrade():
    privacy_enum = ENUM('Private', 'Public', name='privacyenum', create_type=False)
    role_enum = ENUM('owner', 'member', name='roleenum', create_type=False)

    op.execute("CREATE TYPE privacyenum AS ENUM ('Private', 'Public')")
    op.execute("CREATE TYPE roleenum AS ENUM ('owner', 'member')")

    op.add_column('walls', sa.Column('privacy', privacy_enum, nullable=True))
    op.execute("UPDATE walls SET privacy = 'Private' WHERE privacy IS NULL")
    op.alter_column('walls', 'privacy', nullable=False)

    op.create_table(
        'wallmembers',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('wall_id', sa.Integer, sa.ForeignKey('walls.id'), nullable=False),
        sa.Column('user_id', sa.Integer, sa.ForeignKey('users.id'), nullable=False),
        sa.Column('role', role_enum, nullable=False),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('wall_id', 'user_id', name='uq_wall_user'),
    )

    op.execute("""
        INSERT INTO wallmembers (wall_id, user_id, role, created_at)
        SELECT w.id, u.id, 'owner', NOW()
        FROM walls w
        JOIN users u ON u.username = w.created_by
    """)


def downgrade():
    op.drop_table('wallmembers')
    op.drop_column('walls', 'privacy')
    op.execute("DROP TYPE IF EXISTS roleenum")
    op.execute("DROP TYPE IF EXISTS privacyenum")
