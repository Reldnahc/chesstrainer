"""Store every timestamp in the one format the ORM writes.

Timestamp columns hold UTC wall time without an offset. Migration 862dcc851f0b
backfilled games.played_at through an untyped bind, which wrote values such as
2024-01-01 12:00:00+00:00; any other value carrying an offset or a T separator
is rewritten the same way, converted to UTC first.
"""

from datetime import datetime, timezone

import sqlalchemy as sa
from alembic import op

revision = "244574c5d59e"
down_revision = "3613644faa1d"
branch_labels = None
depends_on = None

STORED = "%Y-%m-%d %H:%M:%S.%f"


def timestamp_columns(bind):
    inspector = sa.inspect(bind)
    for table in inspector.get_table_names():
        for column in inspector.get_columns(table):
            if isinstance(column["type"], sa.DateTime):
                yield table, column["name"]


def upgrade():
    bind = op.get_bind()
    for table, column in timestamp_columns(bind):
        rows = bind.exec_driver_sql(
            f'SELECT rowid, "{column}" FROM "{table}" '
            f"WHERE typeof(\"{column}\") = 'text' AND "
            f"(\"{column}\" GLOB '*T*' OR \"{column}\" GLOB '*[+-][0-9][0-9]:[0-9][0-9]' "
            f"OR \"{column}\" GLOB '*Z')"
        ).fetchall()
        for rowid, value in rows:
            moment = datetime.fromisoformat(value)
            if moment.tzinfo is not None:
                moment = moment.astimezone(timezone.utc).replace(tzinfo=None)
            bind.exec_driver_sql(
                f'UPDATE "{table}" SET "{column}" = ? WHERE rowid = ?',
                (moment.strftime(STORED), rowid),
            )


def downgrade():
    # The rewritten values are the same instants in the ORM's own format.
    pass
