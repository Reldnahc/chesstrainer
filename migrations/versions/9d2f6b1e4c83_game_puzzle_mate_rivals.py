"""Apply the current mate rival rule to own-game puzzles mined before it.

games-v2 puzzles mined before the rule changed treated a mating step as unique
whenever no rival also mated, so a step whose rival stays at least +2.00 ahead
was kept, and a solver playing that winning rival was marked wrong. Each ready
row's saved step evidence (the solution's and the rival's scores, as the
generator recorded them) is judged again under the current rule, with no engine:

- A line whose first or second step is now ambiguous could never have been
  mined: it becomes an abstention with the generator's own reason, keeping its
  definition and evidence, and its game's search count drops by one.
- A later ambiguous step is where the generator now stops the line, which needs a
  fresh payoff search: the row is removed and its game's search record with it,
  so the next puzzle search mines that ply again under the same puzzle key.

Puzzle sessions keep their snapshots and history is keyed by puzzle key, so no
progress is lost.
"""

import sqlalchemy as sa
from alembic import op

revision = "9d2f6b1e4c83"
down_revision = "5e81c0d4a7b9"
branch_labels = None
depends_on = None

VERSION = "games-v2"
MATE_SCORE = 100_000
MARGIN_CP = 100
RIVAL_WINNING_CP = 200


def _score(text):
    """The integer ``puzzles.verification.describe`` wrote, read back."""
    if text.startswith("#-"):
        return -MATE_SCORE + int(text[2:])
    if text.startswith("#"):
        return MATE_SCORE - int(text[1:])
    return int(text)


def _is_mate(score):
    return abs(score) >= MATE_SCORE - 1000


def _unique(solution, rival):
    # puzzles.verification.rival_verdict as of this revision.
    if _is_mate(rival) and rival > 0:
        return False
    if solution - rival < MARGIN_CP:
        return False
    return rival < RIVAL_WINNING_CP


def first_ambiguous(decisions):
    """The index of the first saved step the current rule calls ambiguous, or None."""
    for index, step in enumerate(decisions or []):
        if step.get("rival") is None:
            continue
        if not _unique(_score(step["score"]), _score(step["rival"])):
            return index, step
    return None


def upgrade():
    db = op.get_bind()
    puzzles = sa.table(
        "game_puzzles",
        sa.column("id", sa.String()),
        sa.column("user_id", sa.String()),
        sa.column("game_id", sa.String()),
        sa.column("generator_version", sa.String()),
        sa.column("status", sa.String()),
        sa.column("reason", sa.String()),
        sa.column("evidence", sa.JSON()),
    )
    searches = sa.table(
        "game_puzzle_searches",
        sa.column("user_id", sa.String()),
        sa.column("game_id", sa.String()),
        sa.column("generator_version", sa.String()),
        sa.column("kept", sa.Integer()),
    )
    rows = db.execute(
        sa.select(puzzles.c.id, puzzles.c.user_id, puzzles.c.game_id, puzzles.c.evidence).where(
            puzzles.c.status == "ready", puzzles.c.generator_version == VERSION
        )
    ).all()
    for row_id, user_id, game_id, evidence in rows:
        found = first_ambiguous((evidence or {}).get("decisions"))
        if found is None:
            continue
        index, step = found
        search = (
            (searches.c.user_id == user_id)
            & (searches.c.game_id == game_id)
            & (searches.c.generator_version == VERSION)
        )
        if index < 2:
            db.execute(
                puzzles.update()
                .where(puzzles.c.id == row_id)
                .values(status="abstained", reason=f"ambiguous {step['score']} vs {step['rival']}")
            )
            db.execute(searches.update().where(search).values(kept=searches.c.kept - 1))
        else:
            db.execute(puzzles.delete().where(puzzles.c.id == row_id))
            db.execute(searches.delete().where(search))


def downgrade():
    pass
