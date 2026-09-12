import os
import shutil
from pathlib import Path

import pytest
from trainer.config import Settings
from trainer.db import database, migrate


@pytest.fixture
def settings(tmp_path):
    return Settings(
        _env_file=None,
        database_path=tmp_path / "test.sqlite3",
        triage_depth=8,
        triage_time=0.05,
        deep_depth=12,
        deep_time=0.2,
        llm_enabled=False,
        llm_workers=1,
    )


@pytest.fixture
def sessions(settings):
    engine, factory = database(settings.database_path)
    migrate(engine)
    yield factory
    engine.dispose()


@pytest.fixture
def stockfish_path():
    path = os.environ.get("STOCKFISH_PATH") or shutil.which("stockfish")
    local = Path(".tools/stockfish/stockfish-windows-x86-64-avx2.exe")
    if not path and local.exists():
        path = str(local.resolve())
    if not path:
        pytest.skip("Native Stockfish absent; set STOCKFISH_PATH to enable integration tests")
    return path
