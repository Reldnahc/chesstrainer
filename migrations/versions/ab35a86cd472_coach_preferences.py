"""Account-owned coach preferences; absent rows use the default coach."""

import sqlalchemy as sa
from alembic import op

revision = "ab35a86cd472"
down_revision = "862dcc851f0b"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "user_preferences",
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id"), primary_key=True),
        sa.Column("coach_id", sa.String(), nullable=False, server_default="classic"),
        sa.Column("coach_motion", sa.String(), nullable=False, server_default="natural"),
    )


def downgrade():
    op.drop_table("user_preferences")
