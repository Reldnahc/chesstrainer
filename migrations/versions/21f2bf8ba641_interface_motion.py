"""Account-owned piece and interface motion, independent of coach motion."""

import sqlalchemy as sa
from alembic import op

revision = "21f2bf8ba641"
down_revision = "c904b1d63f72"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "user_preferences",
        sa.Column("interface_motion", sa.String(), nullable=False, server_default="system"),
    )


def downgrade():
    with op.batch_alter_table("user_preferences") as batch:
        batch.drop_column("interface_motion")
