from contextlib import contextmanager
from pathlib import Path

from alembic import command
from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, event
from sqlalchemy.pool import NullPool, QueuePool

from trainer.ownership import account_sessions


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
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute(f"PRAGMA busy_timeout={int(timeout * 1000)}")
        cursor.close()

    # Single-user mode and offline tools work in the reserved local account.
    return engine, account_sessions(engine, "local")


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
