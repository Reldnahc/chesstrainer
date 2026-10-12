"""Games remember whether they were rated so stats can skip casual games.

Backfill reads the PGN Event header, which Lichess fills in ("Rated ..." or
"Casual ..."). Chess.com PGNs do not say, so those games stay unknown until a
re-import from Chess.com supplies the flag.
"""

import re

import sqlalchemy as sa
from alembic import op

revision = "e2a4c6b8d0f1"
down_revision = "d4e6f8a0b2c4"
branch_labels = None
depends_on = None

EVENT = re.compile(r'^\[Event "([^"]*)"\]', re.MULTILINE)


def rated_of(pgn):
    match = EVENT.search(pgn or "")
    event = match.group(1).strip().casefold() if match else ""
    if event.startswith("rated"):
        return True
    if event.startswith("casual"):
        return False
    return None


def upgrade():
    op.add_column("games", sa.Column("rated", sa.Boolean(), nullable=True))
    games = sa.table("games", sa.column("id", sa.String), sa.column("pgn", sa.Text))
    bind = op.get_bind()
    updates = {True: [], False: []}
    for game_id, pgn in bind.execute(sa.select(games.c.id, games.c.pgn)):
        value = rated_of(pgn)
        if value is not None:
            updates[value].append(game_id)
    target = sa.table("games", sa.column("id", sa.String), sa.column("rated", sa.Boolean))
    for value, ids in updates.items():
        for start in range(0, len(ids), 500):
            bind.execute(
                target.update().where(target.c.id.in_(ids[start : start + 500])).values(rated=value)
            )


def downgrade():
    with op.batch_alter_table("games") as batch:
        batch.drop_column("rated")
