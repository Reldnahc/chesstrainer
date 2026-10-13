from pathlib import Path

from alembic import command
from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, event


def database(path: Path, timeout=30):
    """``timeout`` is how many seconds a statement waits for another writer."""
    path.parent.mkdir(parents=True, exist_ok=True)
    engine = create_engine(
        f"sqlite:///{path.resolve().as_posix()}",
        connect_args={"check_same_thread": False, "timeout": timeout},
    )

    @event.listens_for(engine, "connect")
    def configure_sqlite(connection, _):
        cursor = connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute(f"PRAGMA busy_timeout={int(timeout * 1000)}")
        cursor.close()

    from trainer.ownership import account_sessions

    return engine, account_sessions(engine)


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


def migrate(engine):
    config = _config()
    with engine.connect() as connection:
        # SQLite batch migrations rebuild referenced tables. Disable FK checks only
        # on this migration connection, then validate the resulting complete graph.
        connection.exec_driver_sql("PRAGMA foreign_keys=OFF")
        connection.commit()
        try:
            with connection.begin():
                config.attributes["connection"] = connection
                command.upgrade(config, "head")
                if connection.exec_driver_sql("PRAGMA foreign_key_check").first():
                    raise ValueError("Migration produced an invalid foreign-key reference")
        finally:
            connection.exec_driver_sql("PRAGMA foreign_keys=ON")
            connection.commit()
