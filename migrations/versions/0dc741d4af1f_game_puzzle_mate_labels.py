"""Stop labeling own-game puzzles as mate when their line stops short of checkmate.

games-v1 tagged any line with a mate-scored payoff as ``mate``, including lines
cut by the length cap or an ambiguous move. Those are crushing wins; ready rows
and the sessions that snapshot them are relabeled in place, so nothing is mined
again.
"""

import chess
import sqlalchemy as sa
from alembic import op

revision = "0dc741d4af1f"
down_revision = "a1c3e5f7b9d1"
branch_labels = None
depends_on = None


def _relabeled(definition):
    themes = definition.get("themes") or []
    if "mate" not in themes:
        return None
    board = chess.Board(definition["initial_fen"])
    for uci in definition["solution"]:
        board.push_uci(uci)
    if board.is_checkmate():
        return None
    kept = [theme for theme in themes if theme != "mate" and not theme.startswith("mateIn")]
    return {**definition, "themes": sorted({*kept, "crushing"})}


def _relabel(table, column, condition):
    db = op.get_bind()
    rows = sa.table(table, sa.column("id", sa.String()), sa.column(column, sa.JSON()))
    for row_id, definition in db.execute(
        sa.select(rows.c.id, rows.c[column]).where(sa.text(condition))
    ):
        relabeled = None if definition is None else _relabeled(definition)
        if relabeled is not None:
            db.execute(rows.update().where(rows.c.id == row_id).values({column: relabeled}))


def upgrade():
    _relabel("game_puzzles", "definition", "status = 'ready' AND generator_version = 'games-v1'")
    _relabel("puzzle_sessions", "snapshot", "puzzle_source = 'games'")


def downgrade():
    pass
