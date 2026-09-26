"""Sort the game library by play time, including already imported games."""

import re
from datetime import datetime, timezone

import sqlalchemy as sa
from alembic import op

revision = "862dcc851f0b"
down_revision = "71ba12c807d9"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("games", sa.Column("played_at", sa.DateTime(timezone=True)))
    db = op.get_bind()
    for row in db.execute(sa.text("SELECT id, pgn, played_on FROM games")).mappings():
        headers = dict(re.findall(r'^\[(\w+) "([^"\n]*)"\]', row["pgn"], re.M))
        value = (
            headers.get("UTCDate", row["played_on"] or "")
            + " "
            + headers.get("UTCTime", "00:00:00")
        )
        try:
            timestamp = datetime.strptime(value, "%Y.%m.%d %H:%M:%S").replace(tzinfo=timezone.utc)
        except ValueError:
            continue
        db.execute(
            sa.text("UPDATE games SET played_at=:value WHERE id=:id"),
            {"value": timestamp, "id": row["id"]},
        )


def downgrade():
    op.drop_column("games", "played_at")
