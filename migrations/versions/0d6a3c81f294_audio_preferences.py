"""Account-owned sound preferences alongside independent coach and motion choices."""

import sqlalchemy as sa
from alembic import op

revision = "0d6a3c81f294"
down_revision = "7c249ef302d6"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "user_preferences",
        sa.Column("audio_enabled", sa.Boolean(), nullable=False, server_default="1"),
    )
    op.add_column(
        "user_preferences",
        sa.Column("audio_volume", sa.Float(), nullable=False, server_default="0.35"),
    )
    op.add_column(
        "user_preferences",
        sa.Column("audio_board", sa.Boolean(), nullable=False, server_default="1"),
    )
    op.add_column(
        "user_preferences",
        sa.Column("audio_practice", sa.Boolean(), nullable=False, server_default="1"),
    )
    op.add_column(
        "user_preferences",
        sa.Column("audio_review", sa.Boolean(), nullable=False, server_default="0"),
    )


def downgrade():
    with op.batch_alter_table("user_preferences") as batch:
        for name in (
            "audio_review",
            "audio_practice",
            "audio_board",
            "audio_volume",
            "audio_enabled",
        ):
            batch.drop_column(name)
