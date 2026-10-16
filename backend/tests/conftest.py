import os
import shutil
import sqlite3
from contextlib import closing
from pathlib import Path

import pytest
from trainer import presence
from trainer.accounts import Accounts
from trainer.config import Settings
from trainer.db import database, migrate
from trainer.ownership import LOCAL_USER_ID, account_sessions


@pytest.fixture(autouse=True)
def fresh_presence():
    # Each test database must record its own first request.
    presence.forget()


@pytest.fixture(autouse=True)
def open_signups(monkeypatch):
    # Most account tests create members by signing up, as visitors do once an
    # administrator opens sign-ups; test_accounts covers the closed default.
    monkeypatch.setattr(Accounts, "signups_open", lambda self: True)


@pytest.fixture(scope="session")
def migrated_database(tmp_path_factory):
    """A database migrated to head once per test run, for each test to copy.

    Running every revision costs a second or two, and almost every test starts
    from an empty current database. Copying this file gives each test the same
    schema at a fraction of that. Tests marked ``pristine_database`` (old-revision
    upgrades, migration paths) start from no file instead, as do the migration
    tests in test_migrations, which build their own databases.
    """
    path = tmp_path_factory.mktemp("template") / "migrated.sqlite3"
    engine, _ = database(path)
    migrate(engine)
    engine.dispose()
    return path


def copy_database(source, destination):
    """A page-for-page copy through SQLite's backup API, WAL contents included."""
    with (
        closing(sqlite3.connect(source)) as original,
        closing(sqlite3.connect(destination)) as copy,
    ):
        original.backup(copy)


@pytest.fixture
def settings(tmp_path, request, migrated_database):
    path = tmp_path / "test.sqlite3"
    if request.node.get_closest_marker("pristine_database") is None:
        copy_database(migrated_database, path)
    return Settings(
        _env_file=None,
        database_path=path,
        # Fallback tests must not discover a developer's installed model. Native tests opt in.
        human_model_path=tmp_path / "unconfigured-maia.pt",
        triage_depth=8,
        triage_time=0.05,
        deep_depth=12,
        deep_time=0.2,
        classification_workers=1,
        review_refinement_positions=0,  # Baseline fixtures opt in only when testing refinement.
        sync_interval_seconds=0,  # Polling tests call trainer.game_sync.poll directly.
    )


@pytest.fixture
def sql_engine(settings):
    engine, _ = database(settings.database_path)
    migrate(engine)
    yield engine
    engine.dispose()


@pytest.fixture
def sessions(sql_engine):
    return account_sessions(sql_engine, LOCAL_USER_ID)


@pytest.fixture
def stockfish_path():
    path = os.environ.get("STOCKFISH_PATH") or shutil.which("stockfish")
    local = Path(".tools/stockfish/stockfish-windows-x86-64-avx2.exe")
    if not path and local.exists():
        path = str(local.resolve())
    if not path:
        pytest.skip("Native Stockfish absent; set STOCKFISH_PATH to enable integration tests")
    return path
