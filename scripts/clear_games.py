"""Remove imported games and everything derived from them so the library can be reimported.

Takes a backup with scripts/backup.py first, then deletes games, imports and import jobs,
engine findings, reviews, mistakes, game-based review cards and their history, and puzzles
mined from those games. Games played in Play stay, without the link to their removed library
copy. Settings, preferences, coach choice, saved provider usernames, Study lesson progress,
puzzle packs and opening studies are kept. Stop the server first. Without --yes it only reports what would be removed; with it, the file is compacted
afterwards so the freed space returns to the disk.
"""

import argparse
import importlib.util
import sqlite3
import sys
from contextlib import closing
from datetime import datetime
from pathlib import Path

from trainer.cache_maintenance import sweep_shared_caches
from trainer.cascade import cascade, unlinked
from trainer.config import Settings
from trainer.db import database as database_engine
from trainer.db import migrations_pending
from trainer.models import Base

# The removal starts from these rows and takes everything that refers to them,
# by the models' foreign keys (trainer.cascade): decisions, reviews, mistakes,
# game-based cards and their history, mined puzzles, Insights facts, provider
# checkpoints. Play games stay, unlinked from their saved copy. The Maia and
# engine caches are shared between accounts; afterwards the server's own sweep
# drops every row nothing left in the database refers to.
ROOTS = ("games", "game_imports", "analysis_jobs")


def _load_backup():
    spec = importlib.util.spec_from_file_location("backup", Path(__file__).with_name("backup.py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _collect(db, removed):
    """Snapshot every removed row, parents first, before any delete changes what
    the conditions can see."""
    referenced = {}
    for table in Base.metadata.sorted_tables:
        for key in table.foreign_keys:
            referenced.setdefault(key.column.table.name, set()).add(key.column.name)
    for table, where in removed.items():
        columns = "".join(f', "{column}"' for column in sorted(referenced.get(table, ())))
        db.execute(
            f'CREATE TEMP TABLE "clear_{table}" AS SELECT rowid AS _row{columns}'
            f' FROM "{table}" WHERE {where}'
        )


def clear_games(database: Path, username: str | None = None, apply: bool = False):
    """Return {table: rows removed} (or that would be removed, when apply is False)."""
    engine, _ = database_engine(database, pooled=False)
    try:
        if migrations_pending(engine):
            # The cascade is read from this version's models.
            raise ValueError(
                "The database is behind this version; start the server once to upgrade it"
            )
    finally:
        engine.dispose()
    with closing(sqlite3.connect(database, timeout=5, isolation_level=None)) as db:
        db.execute("PRAGMA foreign_keys=ON")
        owner = "1=1"
        if username is not None:
            row = db.execute("SELECT id FROM users WHERE username=?", (username,)).fetchone()
            if row is None:
                raise ValueError(f"No account named {username!r}")
            owner = "user_id = '" + row[0].replace("'", "''") + "'"
        db.execute("BEGIN IMMEDIATE")
        try:
            db.execute("PRAGMA defer_foreign_keys=ON")
            plan = cascade(dict.fromkeys(ROOTS, owner))
            _collect(db, plan)
            removed = {}
            # A dry run makes the same changes and rolls them back, so the cache
            # counts see exactly what the cleared rows leave behind.
            for table, column, where in unlinked(plan):
                sql = f'UPDATE "{table}" SET "{column}" = NULL WHERE {where}'
                removed[f"{table} (unlinked)"] = db.execute(sql).rowcount
            # Foreign keys are deferred and checked once at commit, so order is free.
            for table in plan:
                removed[table] = db.execute(
                    f'DELETE FROM "{table}" WHERE rowid IN (SELECT _row FROM temp."clear_{table}")'
                ).rowcount
            # The server is stopped, so no job holds a cache row: every unused one goes.
            removed |= sweep_shared_caches(db, older_than=None)
            db.execute("COMMIT" if apply else "ROLLBACK")
        except BaseException:
            if db.in_transaction:
                db.execute("ROLLBACK")
            raise
        if apply:
            # SQLite keeps freed pages in the file; the server is stopped, so the
            # file can be rewritten to give the space back, in incremental
            # auto-vacuum mode so the server returns later deletes itself.
            db.execute("PRAGMA auto_vacuum = INCREMENTAL")
            db.execute("VACUUM")
    return removed


def main():
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--database", type=Path, help="SQLite file (default: configured path)")
    parser.add_argument("--user", help="Only clear this account's games (default: every account)")
    parser.add_argument(
        "--backup-dir",
        type=Path,
        default=Path("data/backups"),
        help="Where the pre-clear backup goes (default: data/backups)",
    )
    parser.add_argument(
        "--yes", action="store_true", help="Back up and delete; without it, only report counts"
    )
    args = parser.parse_args()
    settings = Settings()
    if args.database is not None:
        settings.database_path = args.database
    database = settings.database_path.resolve()
    try:
        if not database.exists():
            raise ValueError(f"Database does not exist: {database}")
        if args.yes:
            stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
            archive = args.backup_dir / f"trainer-before-clear-games-{stamp}.zip"
            _load_backup().export_backup(archive, settings)
            print(f"Backup written: {archive.resolve()}")
        removed = clear_games(database, args.user, apply=args.yes)
    except (ValueError, sqlite3.DatabaseError) as exc:
        parser.exit(1, f"Clear error: {exc}\n")
    for table, count in removed.items():
        if count:
            print(f"{table:28} {count}")
    total = sum(count for table, count in removed.items() if "(unlinked)" not in table)
    print(
        f"{'Removed' if args.yes else 'Would remove'} {total} rows."
        + ("" if args.yes else " Run again with --yes to back up and delete.")
    )


if __name__ == "__main__":
    sys.exit(main())
