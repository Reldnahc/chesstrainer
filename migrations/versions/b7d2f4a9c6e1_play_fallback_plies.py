"""Remember which of the bot's moves the engine played in the human model's place.

When the human move model is unavailable, a Human-like bot still answers, with
Stockfish at its weakest limited setting. The plies it played are kept so the
game shows it and the saved PGN records the engine setting that really played.
"""

import sqlalchemy as sa
from alembic import op

revision = "b7d2f4a9c6e1"
down_revision = "4ca1e88adf37"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("play_games") as batch:
        batch.add_column(sa.Column("fallback_plies", sa.JSON(), nullable=True))


def downgrade():
    with op.batch_alter_table("play_games") as batch:
        batch.drop_column("fallback_plies")
