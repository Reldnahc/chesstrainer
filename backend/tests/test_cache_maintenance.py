import json
import sqlite3
from contextlib import closing
from datetime import datetime, timezone

from fastapi.testclient import TestClient
from sqlalchemy import select
from test_migrations import fill
from trainer.api import create_app
from trainer.cache_maintenance import (
    INCREMENTAL,
    NONE,
    maintain_shared_caches,
    reclaim_space,
    sweep_shared_caches,
)
from trainer.imports import import_games
from trainer.models import Game, uid

PGN = '[White "Learner"]\n[Black "Opponent"]\n\n1. f3 e5 2. g4 Qh4# 0-1'
OLD = "2024-01-01 00:00:00.000000"
NAMES = (
    "e-fk",
    "e-value",
    "e-key",
    "e-play",
    "e-old",
    "e-new",
    "h-fk",
    "h-value",
    "h-old",
    "h-new",
)
ID = {name: uid() for name in NAMES}
NAME = {id_: name for name, id_ in ID.items()}


def _recent():
    return datetime.now(timezone.utc).replace(tzinfo=None).isoformat(" ")


def _cache_rows(db, engine_ids, human_ids, created_at=OLD, payload=""):
    for id_ in engine_ids:
        fill(
            db, "engine_analyses", id=id_, cache_key=id_, created_at=created_at, candidates=payload
        )
    for id_ in human_ids:
        fill(db, "human_analyses", id=id_, cache_key=id_, created_at=created_at, policy=payload)


def _named(names):
    return [ID[name] for name in names]


def _remaining(db, table):
    return {NAME.get(id_, id_) for (id_,) in db.execute(f"SELECT id FROM {table}")}


def _sweep(path, **options):
    with closing(sqlite3.connect(path, isolation_level=None)) as db:
        db.execute("PRAGMA foreign_keys=ON")
        db.execute("BEGIN IMMEDIATE")
        removed = sweep_shared_caches(db, **options)
        db.execute("COMMIT")
        assert db.execute("PRAGMA foreign_key_check").fetchone() is None
        return removed, _remaining(db, "engine_analyses"), _remaining(db, "human_analyses")


def _referenced_fixture(settings, sessions):
    with sessions() as db:
        import_games(db, "fixture.pgn", PGN, ["Learner"], None)
        game_id = db.scalar(select(Game.id))
    with closing(sqlite3.connect(settings.database_path)) as db:
        db.execute("PRAGMA foreign_keys=ON")
        _cache_rows(
            db,
            _named(["e-fk", "e-value", "e-key", "e-play", "e-old"]),
            _named(["h-fk", "h-value", "h-old"]),
        )
        _cache_rows(db, _named(["e-new"]), _named(["h-new"]), created_at=_recent())
        # A foreign key, a JSON string, a JSON object key and another table's JSON list.
        fill(
            db,
            "decisions",
            user_id="local",
            game_id=game_id,
            before_analysis_id=ID["e-fk"],
            played_analysis_id=ID["e-fk"],
        )
        report = {"before_analysis_id": ID["e-value"], "human": {"evidence_id": ID["h-value"]}}
        fill(
            db,
            "game_review_moves",
            user_id="local",
            game_id=game_id,
            ply=1,
            report=json.dumps(report),
            human_analysis_id=ID["h-fk"],
        )
        fill(
            db,
            "game_review_moves",
            user_id="local",
            game_id=game_id,
            ply=2,
            report=json.dumps({"probes": {ID["e-key"]: {"depth": 12}}}),
        )
        fill(
            db,
            "play_games",
            id="played",
            user_id="local",
            reports=json.dumps({"3": {"played_analysis_id": ID["e-play"]}}),
        )
        # Text that is not JSON is read past, not an error, and an unquoted id is not JSON.
        fill(db, "site_settings", key="note", value="{not json " + ID["e-old"])
        db.commit()


def test_sweep_removes_old_rows_nothing_mentions_and_keeps_the_rest(settings, sessions):
    _referenced_fixture(settings, sessions)

    removed, engine, human = _sweep(settings.database_path)

    assert removed == {"engine_analyses": 1, "human_analyses": 1}
    assert engine == {"e-fk", "e-value", "e-key", "e-play", "e-new"}
    assert human == {"h-fk", "h-value", "h-new"}


def test_an_offline_sweep_also_removes_recent_unused_rows(settings, sessions):
    _referenced_fixture(settings, sessions)

    removed, engine, human = _sweep(settings.database_path, older_than=None)

    assert removed == {"engine_analyses": 2, "human_analyses": 2}
    assert "e-new" not in engine and "h-new" not in human


def _on_disk(path):
    wal = path.with_name(path.name + "-wal")
    return path.stat().st_size + (wal.stat().st_size if wal.exists() else 0)


def test_startup_sweeps_and_gives_the_space_back(settings, sql_engine):
    with closing(sqlite3.connect(settings.database_path)) as db:
        assert db.execute("PRAGMA auto_vacuum").fetchone() == (INCREMENTAL,)
        _cache_rows(db, [uid() for _ in range(200)], [], payload=json.dumps(["x" * 4000]))
        db.commit()
        db.execute("PRAGMA wal_checkpoint(TRUNCATE)")
    before = _on_disk(settings.database_path)

    removed, released = maintain_shared_caches(sql_engine)

    assert removed == {"engine_analyses": 200, "human_analyses": 0}
    assert released > 0
    # The server's pooled connections are still open, so the WAL file stays; the
    # freed space must leave it too, not wait for shutdown.
    assert _on_disk(settings.database_path) < before - 150 * 4096
    with closing(sqlite3.connect(settings.database_path)) as db:
        assert db.execute("PRAGMA freelist_count").fetchone() == (0,)


def test_a_failed_maintenance_does_not_stop_the_server(settings, sql_engine, monkeypatch, caplog):
    def full(db):
        raise sqlite3.OperationalError("database or disk is full")

    monkeypatch.setattr("trainer.cache_maintenance.reclaim_space", full)
    settings.stockfish_path = "missing-stockfish-test"

    with TestClient(create_app(settings, workers=False)) as client:
        assert client.get("/api/health").status_code == 200
    assert "Shared cache maintenance failed" in caplog.text


def test_the_server_sweeps_before_it_serves(settings, sql_engine):
    with closing(sqlite3.connect(settings.database_path)) as db:
        _cache_rows(db, [uid()], [uid()])
        db.commit()
    settings.stockfish_path = "missing-stockfish-test"

    with TestClient(create_app(settings, workers=False)):
        pass

    with closing(sqlite3.connect(settings.database_path)) as db:
        assert _remaining(db, "engine_analyses") == _remaining(db, "human_analyses") == set()


def _legacy_file(path, keep):
    with closing(sqlite3.connect(path)) as db:
        db.execute("PRAGMA journal_mode=WAL")
        db.execute("CREATE TABLE cache (body TEXT)")
        db.executemany("INSERT INTO cache VALUES (?)", [("x" * 4000,)] * 100)
        db.execute("DELETE FROM cache WHERE rowid > ?", (keep,))
        db.commit()
        assert db.execute("PRAGMA auto_vacuum").fetchone() == (NONE,)


def test_an_older_file_is_rebuilt_in_incremental_mode_once_a_quarter_is_free(tmp_path):
    _legacy_file(tmp_path / "legacy.sqlite3", keep=50)
    with closing(sqlite3.connect(tmp_path / "legacy.sqlite3", isolation_level=None)) as db:
        free = db.execute("PRAGMA freelist_count").fetchone()[0]

        assert reclaim_space(db) == free
        assert db.execute("PRAGMA auto_vacuum").fetchone() == (INCREMENTAL,)
        assert db.execute("PRAGMA freelist_count").fetchone() == (0,)
        assert db.execute("SELECT COUNT(*) FROM cache").fetchone() == (50,)


def test_an_older_file_with_little_free_space_is_left_alone(tmp_path):
    _legacy_file(tmp_path / "legacy.sqlite3", keep=90)
    with closing(sqlite3.connect(tmp_path / "legacy.sqlite3", isolation_level=None)) as db:
        free = db.execute("PRAGMA freelist_count").fetchone()[0]

        assert free and reclaim_space(db) == 0
        assert db.execute("PRAGMA auto_vacuum").fetchone() == (NONE,)
        assert db.execute("PRAGMA freelist_count").fetchone() == (free,)
