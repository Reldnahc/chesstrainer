"""Account-owned playback policy for bundled coach recordings."""

import sqlalchemy as sa
from alembic import op

revision = "93a425f18cb6"
down_revision = "342fd86bc105"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "user_preferences",
        sa.Column("audio_voice", sa.String(), nullable=False, server_default="automatic"),
    )


def downgrade():
    with op.batch_alter_table("user_preferences") as batch:
        batch.drop_column("audio_voice")
