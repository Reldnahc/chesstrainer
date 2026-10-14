"""Backfill the values request handlers used to fill in on first read.

games.move_count was saved at import from some point on; the library page
counted older games' moves and wrote them back during a GET. review_sessions
.response_ms was filled the same way from a session's fastest saved attempt
on its next move. Both are filled here once, and move_count becomes required.
"""

import io

import chess.pgn
import sqlalchemy as sa
from alembic import op

revision = "a3e7c1f5b9d2"
down_revision = "f6c0e2a4b8d7"
branch_labels = None
depends_on = None


def mainline_plies(pgn):
    game = chess.pgn.read_game(io.StringIO(pgn or ""))
    return 0 if game is None else sum(1 for _ in game.mainline_moves())


def upgrade():
    bind = op.get_bind()
    games = sa.table(
        "games",
        sa.column("id", sa.String),
        sa.column("pgn", sa.Text),
        sa.column("move_count", sa.Integer),
    )
    missing = bind.execute(sa.select(games.c.id, games.c.pgn).where(games.c.move_count.is_(None)))
    for game_id, pgn in missing.all():
        bind.execute(
            games.update().where(games.c.id == game_id).values(move_count=mainline_plies(pgn))
        )
    with op.batch_alter_table("games") as batch:
        batch.alter_column("move_count", existing_type=sa.Integer(), nullable=False)
    bind.exec_driver_sql(
        "UPDATE review_sessions SET response_ms = ("
        "SELECT min(elapsed_ms) FROM exercise_attempts "
        "WHERE exercise_attempts.session_id = review_sessions.id"
        ") WHERE response_ms IS NULL"
    )


def downgrade():
    with op.batch_alter_table("games") as batch:
        batch.alter_column("move_count", existing_type=sa.Integer(), nullable=True)
