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
from trainer.config import Settings

# Each step is (table, condition). Conditions read the temporary id tables built in
# _collect, so later steps still see what earlier steps removed. Order does not matter
# for integrity: foreign keys are deferred and checked once at commit.
STEPS = (
    ("exercise_attempts", "session_id IN (SELECT id FROM temp.clear_sessions)"),
    (
        "reviews",
        "session_id IN (SELECT id FROM temp.clear_sessions)"
        " OR exercise_id IN (SELECT id FROM temp.clear_exercises)",
    ),
    ("opening_recall_snapshots", "session_id IN (SELECT id FROM temp.clear_sessions)"),
    ("review_sessions", "id IN (SELECT id FROM temp.clear_sessions)"),
    ("exercise_answers", "exercise_id IN (SELECT id FROM temp.clear_exercises)"),
    ("exercise_tags", "exercise_id IN (SELECT id FROM temp.clear_exercises)"),
    ("srs_states", "exercise_id IN (SELECT id FROM temp.clear_exercises)"),
    ("opening_cards", "exercise_id IN (SELECT id FROM temp.clear_exercises)"),
    ("opening_content_changes", "exercise_id IN (SELECT id FROM temp.clear_exercises)"),
    ("opening_study_moves", "exercise_id IN (SELECT id FROM temp.clear_exercises)"),
    ("exercises", "id IN (SELECT id FROM temp.clear_exercises)"),
    ("skill_evidence", "decision_id IN (SELECT id FROM temp.clear_decisions)"),
    (
        "classification_probes",
        "classification_analysis_id IN (SELECT id FROM temp.clear_classifications)",
    ),
    ("classification_analyses", "id IN (SELECT id FROM temp.clear_classifications)"),
    (
        "classification_tasks",
        "decision_id IN (SELECT id FROM temp.clear_decisions)"
        " OR job_id IN (SELECT id FROM temp.clear_jobs)",
    ),
    ("classification_runs", "decision_id IN (SELECT id FROM temp.clear_decisions)"),
    (
        "game_puzzles",
        "game_id IN (SELECT id FROM temp.clear_games)"
        " OR decision_id IN (SELECT id FROM temp.clear_decisions)",
    ),
    ("game_puzzle_searches", "game_id IN (SELECT id FROM temp.clear_games)"),
    ("decisions", "id IN (SELECT id FROM temp.clear_decisions)"),
    ("game_review_moves", "game_id IN (SELECT id FROM temp.clear_games)"),
    (
        "game_reviews",
        "game_id IN (SELECT id FROM temp.clear_games)"
        " OR job_id IN (SELECT id FROM temp.clear_jobs)",
    ),
    ("review_refinements", "game_id IN (SELECT id FROM temp.clear_games)"),
    (
        "import_games",
        "game_id IN (SELECT id FROM temp.clear_games)"
        " OR import_id IN (SELECT id FROM temp.clear_imports)",
    ),
    ("games", "id IN (SELECT id FROM temp.clear_games)"),
    ("chesscom_archives", "job_id IN (SELECT id FROM temp.clear_jobs)"),
    ("chesscom_imports", "job_id IN (SELECT id FROM temp.clear_jobs)"),
    ("analysis_jobs", "id IN (SELECT id FROM temp.clear_jobs)"),
    ("game_imports", "id IN (SELECT id FROM temp.clear_imports)"),
)
# The Maia and engine caches are shared between accounts. After the steps, the
# server's own sweep drops every row nothing left in the database refers to.

# References that outlive the cleared rows: (table, column, condition). They are set to
# NULL rather than deleted, so a game played in Play keeps its moves and reports.
UNLINKED = (("play_games", "saved_game_id", "saved_game_id IN (SELECT id FROM temp.clear_games)"),)


def _load_backup():
    spec = importlib.util.spec_from_file_location("backup", Path(__file__).with_name("backup.py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _collect(db, owner):
    """Snapshot the ids to remove before any delete changes what the joins can see."""
    # executescript would commit the open transaction, so run each statement on its own.
    script = f"""
        CREATE TEMP TABLE clear_games AS SELECT id FROM games WHERE {owner};
        CREATE TEMP TABLE clear_decisions AS SELECT id FROM decisions
            WHERE game_id IN (SELECT id FROM temp.clear_games);
        CREATE TEMP TABLE clear_classifications AS SELECT id FROM classification_analyses
            WHERE decision_id IN (SELECT id FROM temp.clear_decisions);
        CREATE TEMP TABLE clear_exercises AS SELECT id FROM exercises
            WHERE decision_id IN (SELECT id FROM temp.clear_decisions);
        CREATE TEMP TABLE clear_sessions AS SELECT id FROM review_sessions
            WHERE exercise_id IN (SELECT id FROM temp.clear_exercises);
        CREATE TEMP TABLE clear_imports AS SELECT id FROM game_imports WHERE {owner};
        CREATE TEMP TABLE clear_jobs AS SELECT id FROM analysis_jobs WHERE {owner}
        """
    for statement in script.split(";"):
        db.execute(statement)


def clear_games(database: Path, username: str | None = None, apply: bool = False):
    """Return {table: rows removed} (or that would be removed, when apply is False)."""
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
            _collect(db, owner)
            removed = {}
            # A dry run makes the same changes and rolls them back, so the cache
            # counts see exactly what the cleared rows leave behind.
            for table, column, where in UNLINKED:
                sql = f"UPDATE {table} SET {column} = NULL WHERE {where}"
                removed[f"{table} (unlinked)"] = db.execute(sql).rowcount
            for table, where in STEPS:
                removed[table] = db.execute(f"DELETE FROM {table} WHERE {where}").rowcount
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
