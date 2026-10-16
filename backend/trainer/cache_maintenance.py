"""Keep the shared engine and Maia caches, and the file that holds them, from only growing.

``engine_analyses`` and ``human_analyses`` have no owner: every account's reviews,
decisions, puzzles and Play reports point at the same rows, by foreign key or by an
id inside a JSON payload. Deleting an account or a game leaves the rows it used, so
the sweep removes rows that nothing in the database mentions any more.

A row is kept when its id appears anywhere outside the two caches: as the value of a
string column, or as a string or object key anywhere inside JSON. Matching every value rather than a
list of known columns means a payload that starts carrying an analysis id keeps its
rows without this module changing, and a stray match only keeps a row.

The server sweeps at startup, before job workers and requests run. That is the one
moment no job holds a cache id it has read but not yet saved a reference to, so a
row in use can never be deleted under it. Rows created within ``UNUSED_FOR`` stay
too: a review's Maia prefetch or a position looked at on the review page is a
cache hit worth keeping for a while even though nothing references it.
"""

import logging
import re
import sqlite3
from datetime import timedelta

from sqlalchemy.exc import DBAPIError

from trainer import timeutil
from trainer.db import immediate_transaction

log = logging.getLogger(__name__)

SHARED_CACHES = ("engine_analyses", "human_analyses")
UNUSED_FOR = timedelta(days=30)
# Freed pages are given back to the disk once they reach this share of the file.
RECLAIM_SHARE = 0.25
# SQLite's auto_vacuum values.
NONE, INCREMENTAL = 0, 2


def _quote(name):
    return '"' + name.replace('"', '""') + '"'


# Cache rows take their ids from ``models.uid``, 32 lowercase hex digits, and JSON
# writes each one quoted, as a string value or an object key.
QUOTED_ID = re.compile(rb'"([0-9a-f]{32})"')


def _text_columns(db):
    """(table, column, is_long) for every column that can hold an id, caches excluded.

    Long columns (JSON and other text) can mention an id anywhere inside JSON;
    short string columns hold one as their whole value.
    """
    tables = [
        name
        for (name,) in db.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
        )
        if name not in SHARED_CACHES
    ]
    for table in tables:
        for _, column, declared, *_ in db.execute(f"PRAGMA table_info({_quote(table)})"):
            kind = declared.upper()
            if "JSON" in kind or "TEXT" in kind or "CLOB" in kind:
                yield table, column, True
            elif "CHAR" in kind or not kind:
                yield table, column, False


def sweep_shared_caches(db, *, older_than=UNUSED_FOR):
    """Delete shared cache rows nothing references; returns {table: rows removed}.

    ``db`` is a sqlite3 connection already inside a write transaction (``BEGIN
    IMMEDIATE``), so no reference can be added between the scan and the delete.
    ``older_than=None`` considers every row, for offline tools that run with the
    server stopped.
    """
    db.execute("DROP TABLE IF EXISTS temp.cache_sweep")
    db.execute("CREATE TEMP TABLE cache_sweep (id TEXT PRIMARY KEY) WITHOUT ROWID")
    try:
        age, cutoff = "", ()
        if older_than is not None:
            # Compared as the text UTCDateTime stores, which sorts by time.
            stamp = timeutil.stored_text(timeutil.now() - older_than)
            age, cutoff = " WHERE created_at IS NULL OR created_at < ?", (stamp,)
        for cache in SHARED_CACHES:
            db.execute(
                f"INSERT OR IGNORE INTO temp.cache_sweep SELECT id FROM {cache}{age}", cutoff
            )
        unused = {id_ for (id_,) in db.execute("SELECT id FROM temp.cache_sweep")}
        if not unused:
            return dict.fromkeys(SHARED_CACHES, 0)
        mentioned = set()
        for table, column, is_long in _text_columns(db):
            table, column = _quote(table), _quote(column)
            if is_long:
                # Matching the raw bytes is several times faster than walking
                # every JSON value with json_tree, and malformed text cannot fail.
                for (text,) in db.execute(
                    f"SELECT CAST({column} AS BLOB) FROM {table} WHERE typeof({column}) = 'text'"
                ):
                    mentioned.update(QUOTED_ID.findall(text))
            else:
                db.execute(
                    f"DELETE FROM temp.cache_sweep WHERE id IN (SELECT {column} FROM {table})"
                )
        mentioned = {id_.decode() for id_ in mentioned} & unused
        db.executemany("DELETE FROM temp.cache_sweep WHERE id = ?", ((id_,) for id_ in mentioned))
        return {
            cache: db.execute(
                f"DELETE FROM {cache} WHERE id IN (SELECT id FROM temp.cache_sweep)"
            ).rowcount
            for cache in SHARED_CACHES
        }
    finally:
        db.execute("DROP TABLE IF EXISTS temp.cache_sweep")


def reclaim_space(db):
    """Give pages freed by deletes back to the disk; returns pages released.

    ``db`` is a sqlite3 connection outside any transaction. A database in
    incremental auto-vacuum mode releases its free pages in place. Older files
    were created without it: once a quarter of one is free it is rebuilt with a
    VACUUM, in incremental mode, so later deletes are cheap to return. Both write
    the moved pages through the WAL, which is then checkpointed and truncated, or
    the space would only move into the ``-wal`` file until the server stops.
    """
    pages = db.execute("PRAGMA page_count").fetchone()[0]
    free = db.execute("PRAGMA freelist_count").fetchone()[0]
    if not free:
        return 0
    mode = db.execute("PRAGMA auto_vacuum").fetchone()[0]
    if mode == INCREMENTAL:
        # Each step of the pragma frees one page, so it runs until it returns nothing.
        db.execute("PRAGMA incremental_vacuum").fetchall()
    elif mode == NONE and free >= pages * RECLAIM_SHARE:
        db.execute("PRAGMA auto_vacuum = INCREMENTAL")
        db.execute("VACUUM")
    else:
        return 0
    db.execute("PRAGMA wal_checkpoint(TRUNCATE)").fetchall()
    return free - db.execute("PRAGMA freelist_count").fetchone()[0]


def maintain_shared_caches(engine):
    """The startup sweep and space reclaim; call it before any job or request runs.

    A failure, such as a full disk during the one-time VACUUM, is logged and the
    server starts anyway: the maintenance runs again at the next start.
    """
    removed, released = dict.fromkeys(SHARED_CACHES, 0), 0
    try:
        with immediate_transaction(engine) as connection:
            removed = sweep_shared_caches(connection.connection.driver_connection)
        with engine.connect() as connection:
            released = reclaim_space(connection.connection.driver_connection)
    except (sqlite3.Error, DBAPIError):
        log.warning(
            "Shared cache maintenance failed; it runs again at the next start", exc_info=True
        )
    if any(removed.values()) or released:
        log.info(
            "Swept unused shared cache rows",
            extra={"removed": removed, "pages_released": released},
        )
    return removed, released
