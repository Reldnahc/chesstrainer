"""One representation per concept, and every constraint named by the convention.

- Sides: ``exercises.orientation``, ``opening_studies.color`` and
  ``opening_recall_snapshots.orientation`` held "white"/"black". They become
  ``learner_color`` booleans (True for White), like games, decisions and Play.
- Times: ``users.created`` and ``auth_sessions.expires`` were float epochs. They
  become UTC datetimes, ``created_at`` and ``expires_at``. ``games.played_on``
  repeated the PGN's own Date header next to ``played_at``; it is dropped and
  read from the PGN.
- Job kinds and statuses get CHECK constraints. Older fetch kinds take their
  current names (``chesscom`` was a Chess.com fetch, ``provider_import`` a
  provider fetch) so they run in the fetch lane; any other unknown kind belongs
  to a removed feature and becomes ``retired``, settled if it was still queued.
- Legacy names: ``chesscom_imports`` and ``chesscom_archives`` become
  ``provider_imports`` and ``provider_checkpoints``, and the unused
  ``users.chesscom_username`` (superseded by ``provider_connections``) goes.
- Every table is rebuilt once with each primary key, foreign key and unique
  constraint named by ``models.NAMING_CONVENTION``, whatever older revisions
  called it or whether they named it at all. Indexes already had their names.

The whole revision runs in one transaction with foreign keys checked at the end,
so a failure leaves the database as it was. The rebuild copies every table, the
engine cache included, so the upgrade needs free disk about the size of the
database, once.
"""

import re
from datetime import datetime, timedelta, timezone

import sqlalchemy as sa
from alembic import op

revision = "eb978e634f57"
down_revision = "9d2f6b1e4c83"
branch_labels = None
depends_on = None

# trainer.job_kinds as of this revision.
KINDS = (
    "game_review",
    "classification",
    "enrichment",
    "puzzle_generation",
    "sync",
    "chesscom_fetch",
    "provider_fetch",
    "level_fit",
    "analysis",
    "retired",
)
STATUSES = ("queued", "running", "completed", "failed", "cancelled")
RENAMED_KINDS = {"chesscom": "chesscom_fetch", "provider_import": "provider_fetch"}
TABLES = {"chesscom_imports": "provider_imports", "chesscom_archives": "provider_checkpoints"}
# (table, old column): "white"/"black" text that becomes a learner_color boolean.
SIDES = (
    ("exercises", "orientation"),
    ("opening_studies", "color"),
    ("opening_recall_snapshots", "orientation"),
)
# (table, old float epoch column, new UTC datetime column).
EPOCHS = (("users", "created", "created_at"), ("auth_sessions", "expires", "expires_at"))
STAMP = "%Y-%m-%d %H:%M:%S.%f"  # How UTCDateTime's DateTime stores a naive UTC time.
DATE_HEADER = re.compile(r'^\[Date "([^"]*)"\]', re.MULTILINE)


def _in(column, values):
    return f"{column} IN ({', '.join(repr(value) for value in values)})"


def conventional(table, constraint):
    """The name ``models.NAMING_CONVENTION`` gives this constraint."""
    columns = [column.name for column in constraint.columns]
    if isinstance(constraint, sa.PrimaryKeyConstraint):
        return f"pk_{table}"
    if isinstance(constraint, sa.ForeignKeyConstraint):
        return f"fk_{table}_{columns[0]}_{constraint.referred_table.name}"
    if isinstance(constraint, sa.UniqueConstraint):
        return f"uq_{table}_{'_'.join(columns)}"
    return constraint.name


def legacy(table, constraint):
    """The names older revisions' downgrades drop constraints by."""
    columns = [column.name for column in constraint.columns]
    if isinstance(constraint, sa.ForeignKeyConstraint) and columns == ["user_id"]:
        return f"fk_{table}_user"
    if isinstance(constraint, sa.ForeignKeyConstraint) and (table, columns) == (
        "review_sessions",
        ["focus_skill_id"],
    ):
        return "fk_review_sessions_focus_skill_id"
    if (
        isinstance(constraint, sa.UniqueConstraint)
        and len(columns) == 2
        and columns[0] == "user_id"
    ):
        return f"uq_{table}_user_{columns[1]}"
    return conventional(table, constraint)


def rebuild(name, rename, *, drop=(), required=(), unique=None, check=None, renamed=None):
    """Copy ``name`` into a new table with its constraints renamed by ``rename``.

    ``drop`` removes columns (and any unique constraint over them), ``required``
    makes columns NOT NULL, ``unique`` adds a unique constraint over those
    columns and ``check`` adds CHECK constraints as {key: sql}. ``renamed`` is
    the table's previous name, whose indexes take the new one.
    """
    table = sa.Table(name, sa.MetaData(), autoload_with=op.get_bind())
    for constraint in list(table.constraints):
        if isinstance(constraint, sa.CheckConstraint):
            continue
        covered = {column.name for column in constraint.columns}
        if isinstance(constraint, sa.UniqueConstraint) and covered & set(drop):
            table.constraints.discard(constraint)
            continue
        constraint.name = rename(name, constraint)
    for index in table.indexes:
        if renamed and index.name.startswith(f"ix_{renamed}_"):
            index.name = f"ix_{name}_" + index.name[len(f"ix_{renamed}_") :]
    with op.batch_alter_table(name, copy_from=table, recreate="always") as batch:
        for column in drop:
            batch.drop_column(column)
        for column in required:
            batch.alter_column(column, nullable=False)
        if unique:
            batch.create_unique_constraint(f"uq_{name}_{'_'.join(unique)}", unique)
        for key, sql in (check or {}).items():
            batch.create_check_constraint(op.f(f"ck_{name}_{key}"), sql)


def _tables():
    return [
        name
        for name in sa.inspect(op.get_bind()).get_table_names()
        if name != "alembic_version" and not name.startswith("sqlite_")
    ]


def upgrade():
    db = op.get_bind()
    for old, new in RENAMED_KINDS.items():
        db.execute(
            sa.text("UPDATE analysis_jobs SET kind = :new WHERE kind = :old"),
            dict(new=new, old=old),
        )
    # A job of a removed feature never runs again; settle any still waiting.
    unknown = f"NOT ({_in('kind', KINDS)})"
    db.execute(
        sa.text(
            f"UPDATE analysis_jobs SET status = 'cancelled'"
            f" WHERE {unknown} AND status IN ('queued', 'running')"
        )
    )
    db.execute(sa.text(f"UPDATE analysis_jobs SET kind = 'retired' WHERE {unknown}"))
    db.execute(
        sa.text(f"UPDATE analysis_jobs SET status = 'failed' WHERE NOT ({_in('status', STATUSES)})")
    )

    for old, new in TABLES.items():
        op.rename_table(old, new)

    for table, column in SIDES:
        op.add_column(table, sa.Column("learner_color", sa.Boolean()))
        db.execute(sa.text(f"UPDATE {table} SET learner_color = ({column} = 'white')"))
    for table, column, stamp in EPOCHS:
        op.add_column(table, sa.Column(stamp, sa.DateTime(timezone=True)))
        for rowid, epoch in db.execute(sa.text(f"SELECT rowid, {column} FROM {table}")).all():
            value = datetime(1970, 1, 1) + timedelta(seconds=epoch or 0)
            db.execute(
                sa.text(f"UPDATE {table} SET {stamp} = :value WHERE rowid = :rowid"),
                dict(value=value.strftime(STAMP), rowid=rowid),
            )

    changes = {
        "exercises": dict(drop=["orientation"], required=["learner_color"]),
        "opening_studies": dict(
            drop=["color"],
            required=["learner_color"],
            unique=["user_id", "source", "source_key", "source_version", "learner_color"],
        ),
        "opening_recall_snapshots": dict(drop=["orientation"], required=["learner_color"]),
        "users": dict(drop=["created", "chesscom_username"], required=["created_at"]),
        "auth_sessions": dict(drop=["expires"], required=["expires_at"]),
        "games": dict(drop=["played_on"]),
        "analysis_jobs": dict(
            check={"kind": _in("kind", KINDS), "status": _in("status", STATUSES)}
        ),
    }
    previous = {new: old for old, new in TABLES.items()}
    for name in _tables():
        rebuild(name, conventional, renamed=previous.get(name), **changes.get(name, {}))


def downgrade():
    db = op.get_bind()
    for table, column in SIDES:
        op.add_column(table, sa.Column(column, sa.String()))
        db.execute(
            sa.text(
                f"UPDATE {table} SET {column} ="
                " CASE WHEN learner_color THEN 'white' ELSE 'black' END"
            )
        )
    for table, column, stamp in EPOCHS:
        op.add_column(table, sa.Column(column, sa.Float()))
        for rowid, value in db.execute(sa.text(f"SELECT rowid, {stamp} FROM {table}")).all():
            moment = datetime.strptime(str(value)[:26], STAMP).replace(tzinfo=timezone.utc)
            db.execute(
                sa.text(f"UPDATE {table} SET {column} = :epoch WHERE rowid = :rowid"),
                dict(epoch=moment.timestamp(), rowid=rowid),
            )
    op.add_column("users", sa.Column("chesscom_username", sa.String(), server_default=""))
    op.add_column("games", sa.Column("played_on", sa.String()))
    for rowid, pgn in db.execute(sa.text("SELECT rowid, pgn FROM games")).all():
        found = DATE_HEADER.search(pgn or "")
        db.execute(
            sa.text("UPDATE games SET played_on = :date WHERE rowid = :rowid"),
            dict(date=found.group(1) if found else None, rowid=rowid),
        )
    reverse = {
        "exercises": dict(drop=["learner_color"], required=["orientation"]),
        "opening_studies": dict(
            drop=["learner_color"],
            required=["color"],
            unique=["user_id", "source", "source_key", "source_version", "color"],
        ),
        "opening_recall_snapshots": dict(drop=["learner_color"], required=["orientation"]),
        "users": dict(drop=["created_at"], required=["created", "chesscom_username"]),
        "auth_sessions": dict(drop=["expires_at"], required=["expires"]),
    }
    with op.batch_alter_table("analysis_jobs") as batch:
        batch.drop_constraint(op.f("ck_analysis_jobs_kind"), type_="check")
        batch.drop_constraint(op.f("ck_analysis_jobs_status"), type_="check")
    for old, new in TABLES.items():
        op.rename_table(new, old)
    # Older revisions' downgrades drop the constraints they made by those names.
    for name in _tables():
        rebuild(name, legacy, renamed=TABLES.get(name), **reverse.get(name, {}))
