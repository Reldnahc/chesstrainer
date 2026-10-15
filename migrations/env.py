from alembic import context
from trainer.config import Settings
from trainer.db import database, migration_connection
from trainer.models import Base

config = context.config


def run(connection):
    context.configure(connection=connection, target_metadata=Base.metadata, render_as_batch=True)
    with context.begin_transaction():
        context.run_migrations()


if context.is_offline_mode():
    context.configure(
        url=f"sqlite:///{Settings().database_path.resolve().as_posix()}",
        target_metadata=Base.metadata,
        literal_binds=True,
        render_as_batch=True,
    )
    with context.begin_transaction():
        context.run_migrations()
elif config.attributes.get("connection") is not None:
    run(config.attributes["connection"])
else:
    # The command line takes exactly the application's path: foreign keys off on
    # the migration connection, one transaction, the whole graph checked at the end.
    engine, _ = database(Settings().database_path)
    try:
        with migration_connection(engine) as connection:
            run(connection)
    finally:
        engine.dispose()
