"""Server-wide settings, starting with whether visitors may create accounts.

Sign-ups start closed, including on servers that already have accounts:
administrators add members from Settings, or open sign-ups there.
"""

import sqlalchemy as sa
from alembic import op

revision = "c8e1f4a7b2d9"
down_revision = "b3d5f7a9c1e2"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "site_settings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("signups_open", sa.Boolean(), nullable=False, server_default="0"),
    )
    op.execute("INSERT INTO site_settings (id, signups_open) VALUES (1, 0)")


def downgrade():
    op.drop_table("site_settings")
