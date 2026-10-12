"""Server-wide settings administrators change in the app, one row per setting.

Sign-ups are the first: they start closed, including on servers that already
have accounts, and administrators add members from Settings or open sign-ups
there. A missing row means the setting's default.
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
        sa.Column("key", sa.String(), primary_key=True),
        sa.Column("value", sa.JSON(), nullable=False),
    )


def downgrade():
    op.drop_table("site_settings")
