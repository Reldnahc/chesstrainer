"""Remove rating sounds while preserving other account sound preferences."""

import sqlalchemy as sa
from alembic import op

revision = "342fd86bc105"
down_revision = "0d6a3c81f294"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("user_preferences") as batch:
        batch.drop_column("audio_review")


def downgrade():
    op.add_column(
        "user_preferences",
        sa.Column("audio_review", sa.Boolean(), nullable=False, server_default="0"),
    )
