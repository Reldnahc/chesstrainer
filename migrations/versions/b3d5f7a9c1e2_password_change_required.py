"""Accounts whose password an administrator reset must choose a new one."""

import sqlalchemy as sa
from alembic import op

revision = "b3d5f7a9c1e2"
down_revision = "e2a4c6b8d0f1"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "users",
        sa.Column("password_change_required", sa.Boolean(), nullable=False, server_default="0"),
    )


def downgrade():
    with op.batch_alter_table("users") as batch:
        batch.drop_column("password_change_required")
