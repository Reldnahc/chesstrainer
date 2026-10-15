"""Remember the bot's last reply, with its source, on the Play game.

A repeated reply request returns the same move; before this it always said the
move came from the human model, even when the book or the engine had chosen it,
and the client decides from that source whether to show the reply at once.
"""

import sqlalchemy as sa
from alembic import op

revision = "747b84117a4e"
down_revision = "40983c9dbb47"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("play_games") as batch:
        batch.add_column(sa.Column("last_reply", sa.JSON(), nullable=True))


def downgrade():
    with op.batch_alter_table("play_games") as batch:
        batch.drop_column("last_reply")
