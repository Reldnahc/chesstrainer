import threading
from contextlib import contextmanager
from pathlib import Path

from alembic import command
from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session
from sqlalchemy.pool import NullPool, Pool, QueuePool

from trainer.ownership import LOCAL_USER_ID, account_sessions


def database(path: Path, timeout=30, *, pooled=True):
    """``timeout`` is how many seconds a statement waits for another writer.

    A few connections stay open for reuse (opening one costs about a millisecond
    and a half on Windows), and any number more open on demand and close when
    returned: job coordinators, classification workers, engine caches and requests
    share this engine, and a fixed pool could run dry and fail work after its
    checkout timeout. ``pooled=False`` closes every connection when it is returned,
    for short-lived tools.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    engine = create_engine(
        f"sqlite:///{path.resolve().as_posix()}",
        connect_args={"check_same_thread": False, "timeout": timeout},
        **(
            {"poolclass": QueuePool, "pool_size": 8, "max_overflow": -1}
            if pooled
            else {"poolclass": NullPool}
        ),
    )

    @event.listens_for(engine, "connect")
    def configure_sqlite(connection, _):
        cursor = connection.cursor()
        # A new, empty file starts in incremental auto-vacuum mode, so space freed
        # by deletes can be given back without rewriting the whole database. Only
        # then: on a file already in that mode the pragma waits for the write lock,
        # so every new connection would queue behind any writer.
        if not cursor.execute("PRAGMA page_count").fetchone()[0]:
            cursor.execute("PRAGMA auto_vacuum=INCREMENTAL")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute(f"PRAGMA busy_timeout={int(timeout * 1000)}")
        cursor.close()

    # Single-user mode and offline tools work in the reserved local account.
    return engine, account_sessions(engine, LOCAL_USER_ID)


def _config():
    root = Path(__file__).resolve().parents[2]
    config = Config(str(root / "alembic.ini"))
    config.set_main_option("script_location", str(root / "migrations"))
    return config


def migrations_pending(engine):
    """Whether the database is behind the code; a read, so a busy writer never blocks it."""
    head = ScriptDirectory.from_config(_config()).get_current_head()
    with engine.connect() as connection:
        return MigrationContext.configure(connection).get_current_revision() != head


@contextmanager
def immediate_transaction(engine, *, foreign_keys=True, defer_foreign_keys=False):
    """A connection in one ``BEGIN IMMEDIATE`` transaction that SQLite, not pysqlite, runs.

    The write lock is taken at once, and every statement, DDL included, commits or
    rolls back together. ``foreign_keys=False`` turns enforcement off on this
    connection while it is open; ``defer_foreign_keys`` checks them at commit.
    """
    with engine.connect() as connection:
        if not foreign_keys:
            # SQLite ignores this pragma inside a transaction.
            connection.exec_driver_sql("PRAGMA foreign_keys=OFF")
            connection.commit()
        driver = connection.connection.driver_connection
        legacy = driver.isolation_level
        driver.isolation_level = None
        try:
            with connection.begin():
                connection.exec_driver_sql("BEGIN IMMEDIATE")
                if defer_foreign_keys:
                    connection.exec_driver_sql("PRAGMA defer_foreign_keys=ON")
                yield connection
        finally:
            driver.isolation_level = legacy
            if not foreign_keys:
                connection.exec_driver_sql("PRAGMA foreign_keys=ON")
                connection.commit()


def _begin_read(session, transaction, connection):
    connection.exec_driver_sql("PRAGMA query_only=ON")
    connection.connection.info["query_only"] = True
    connection.exec_driver_sql("BEGIN")


@event.listens_for(Pool, "checkin")
def _writable_again(dbapi_connection, record):
    # However a read unit ended, the next user of its pooled connection can write.
    if record is not None and record.info.pop("query_only", False):
        dbapi_connection.execute("PRAGMA query_only=OFF")


def _begin_write(session, transaction, connection):
    connection.exec_driver_sql("BEGIN IMMEDIATE")


@contextmanager
def read_unit(sessions):
    """A session that reads one consistent snapshot and cannot write.

    pysqlite runs each SELECT in its own implicit transaction, so a handler that
    reads several queries could mix states while a job commits between them. The
    session's transaction starts with ``BEGIN``, which SQLite holds as one
    snapshot until the session closes, and ``query_only`` turns any write, a
    stray autoflush included, into an error instead of a write taken without the
    account lock. Loaded rows stay usable after the block, as they always have.
    """
    with sessions() as db:
        event.listen(db, "after_begin", _begin_read)
        yield db


@contextmanager
def write_unit(lock, sessions):
    """The one way to change account rows: the lock, then one transaction, then commit.

    The account's Python lock is always taken before SQLite's write lock. A
    request or job that took SQLite's lock first (with a write, or an autoflush
    before a query) and then waited on the Python lock could stall against a
    holder of the Python lock waiting on SQLite. Here the lock comes first and
    the session's first statement, a read included, starts its transaction with
    ``BEGIN IMMEDIATE``, so a later write or autoflush never has to upgrade a
    read and autoflush is harmless.
    The block's changes commit when it ends normally; an exception, an
    ``HTTPException`` included, discards them. Helpers only flush.
    """
    if getattr(_writing, "session", None) is not None:
        raise RuntimeError("A write unit is already open in this thread; finish it first")
    with lock, sessions() as db:
        event.listen(db, "after_begin", _begin_write)
        _writing.session = db
        try:
            yield db
            db.commit()
        finally:
            _writing.session = None


# The write unit open in each thread. SQLite has one writer, so a second session
# writing while it is open (a nested unit, or an engine cache insert from inside
# one) would wait on the unit's own lock until the busy timeout ran out.
_writing = threading.local()


def _one_writer(session):
    open_unit = getattr(_writing, "session", None)
    if open_unit is not None and open_unit is not session:
        raise RuntimeError(
            "Another session wrote while this thread's write unit was open; "
            "search or write before or after the unit, not inside it"
        )


@event.listens_for(Session, "do_orm_execute")
def _one_writer_statement(state):
    if state.is_insert or state.is_update or state.is_delete:
        _one_writer(state.session)


@event.listens_for(Session, "before_flush")
def _one_writer_flush(session, context, instances):
    if session.new or session.dirty or session.deleted:
        _one_writer(session)


class Units:
    """``read()`` and ``write()`` units for one account's sessions and lock."""

    def __init__(self, sessions, lock):
        self.sessions, self.lock = sessions, lock

    def read(self):
        return read_unit(self.sessions)

    def write(self):
        return write_unit(self.lock, self.sessions)


@contextmanager
def migration_connection(engine):
    """One all-or-nothing transaction for schema changes, foreign keys checked at the end.

    pysqlite opens a transaction only before INSERT/UPDATE/DELETE, so DDL that runs
    first would commit on its own and survive a failed revision, leaving the schema
    half-applied for the next start to trip over. This connection hands transaction
    control to SQLite (``BEGIN IMMEDIATE`` ... ``COMMIT``), so a failure anywhere,
    including the final foreign-key check, rolls every statement back.

    SQLite batch migrations rebuild referenced tables, so foreign keys are off on
    this connection (SQLite ignores that pragma inside a transaction) and the
    complete graph is validated before committing. Both the application and the
    ``alembic`` command line migrate through here.
    """
    with immediate_transaction(engine, foreign_keys=False) as connection:
        yield connection
        if connection.exec_driver_sql("PRAGMA foreign_key_check").first():
            raise ValueError("Migration produced an invalid foreign-key reference")


def optimize(engine, *, opening=False):
    """Refresh the query planner's statistics, as SQLite recommends.

    At startup every table is checked (``0x10002``), within an analysis limit so a
    large library costs milliseconds; at shutdown only tables this process
    queried are. Without statistics SQLite tends to pick each account table's
    user_id index and sort or scan the rest.
    """
    with engine.connect() as connection:
        connection.exec_driver_sql("PRAGMA analysis_limit = 400")
        connection.exec_driver_sql("PRAGMA optimize = 0x10002" if opening else "PRAGMA optimize")


def migrate(engine):
    """Bring the schema to head; returns whether anything was applied.

    A database that is already current is left untouched, so starting the server
    or running a tool costs one version read rather than an upgrade and a full
    foreign-key scan.
    """
    if not migrations_pending(engine):
        return False
    config = _config()
    with migration_connection(engine) as connection:
        config.attributes["connection"] = connection
        command.upgrade(config, "head")
    return True
