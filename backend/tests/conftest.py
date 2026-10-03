import os
import shutil
from pathlib import Path

import pytest
from trainer import presence
from trainer.config import Settings
from trainer.db import database, migrate


@pytest.fixture(autouse=True)
def fresh_presence():
    # Each test database must record its own first request.
    presence.forget()


@pytest.fixture
def settings(tmp_path):
    return Settings(
        _env_file=None,
        database_path=tmp_path / "test.sqlite3",
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
