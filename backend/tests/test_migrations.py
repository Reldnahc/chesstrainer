"""The migration path: all-or-nothing upgrades, one path for the app and the command line."""

import pytest
from alembic import command
from sqlalchemy import inspect
from trainer import db as db_module
from trainer.db import _config, database, migrate, migration_connection, migrations_pending

BEFORE_SHARED_MAIA = "e2a4c6b8d0f1"


def upgrade_to(engine, revision):
    config = _config()
    with migration_connection(engine) as connection:
        config.attributes["connection"] = connection
        command.upgrade(config, revision)


def version(engine):
    with engine.connect() as connection:
        return connection.exec_driver_sql("SELECT version_num FROM alembic_version").scalar()


def tables(engine):
    return set(inspect(engine).get_table_names())


def fill(connection, table, **values):
    """Insert one row, giving every required column without a default a placeholder.

    ``connection`` is a SQLAlchemy connection or a plain sqlite3 one.
    """
    execute = getattr(connection, "exec_driver_sql", None) or connection.execute
    for _, name, kind, notnull, default, primary in execute(f'PRAGMA table_info("{table}")'):
        if name in values or not (notnull or primary) or default is not None:
            continue
        kind = kind.upper()
        values[name] = (
            0
            if any(word in kind for word in ("INT", "BOOL", "FLOAT", "REAL", "NUMERIC"))
            else "2024-01-01 00:00:00.000000"
            if "DATE" in kind
            else "{}"
            if "JSON" in kind
            else f"{table}-{name}"
        )
    columns = ", ".join(f'"{name}"' for name in values)
    marks = ", ".join("?" for _ in values)
    execute(f'INSERT INTO "{table}" ({columns}) VALUES ({marks})', tuple(values.values()))


def test_a_failed_revision_leaves_the_schema_and_version_untouched(tmp_path, monkeypatch):
    engine, _ = database(tmp_path / "failed.sqlite3")
    upgrade_to(engine, BEFORE_SHARED_MAIA)
    before = tables(engine)
    real_upgrade = command.upgrade

    def upgrade_then_fail(config, revision):
        real_upgrade(config, revision)
        raise RuntimeError("disk full")

    monkeypatch.setattr(db_module.command, "upgrade", upgrade_then_fail)
    with pytest.raises(RuntimeError, match="disk full"):
        migrate(engine)
    # The later revisions created and dropped tables; none of it survives the failure.
    assert version(engine) == BEFORE_SHARED_MAIA
    assert tables(engine) == before
    monkeypatch.setattr(db_module.command, "upgrade", real_upgrade)
    assert migrate(engine) is True
    assert migrations_pending(engine) is False
    engine.dispose()


def test_ddl_before_any_write_rolls_back(tmp_path):
    engine, _ = database(tmp_path / "ddl.sqlite3")
    with pytest.raises(RuntimeError):
        with migration_connection(engine) as connection:
            connection.exec_driver_sql("CREATE TABLE stray (id INTEGER PRIMARY KEY)")
            raise RuntimeError("later step failed")
    assert "stray" not in tables(engine)
    with engine.connect() as connection:
        assert connection.exec_driver_sql("PRAGMA foreign_keys").scalar() == 1
    engine.dispose()


def test_a_broken_reference_rolls_the_whole_migration_back(tmp_path):
    engine, _ = database(tmp_path / "broken.sqlite3")
    with pytest.raises(ValueError, match="foreign-key"):
        with migration_connection(engine) as connection:
            connection.exec_driver_sql("CREATE TABLE parent (id INTEGER PRIMARY KEY)")
            connection.exec_driver_sql(
                "CREATE TABLE child (id INTEGER PRIMARY KEY, parent_id REFERENCES parent(id))"
            )
            connection.exec_driver_sql("INSERT INTO child VALUES (1, 99)")
    assert not {"parent", "child"} & tables(engine)
    engine.dispose()


def test_a_current_database_is_not_migrated_again(tmp_path, monkeypatch):
    engine, _ = database(tmp_path / "current.sqlite3")
    assert migrate(engine) is True
    monkeypatch.setattr(
        db_module.command, "upgrade", lambda *_: pytest.fail("upgraded a current database")
    )
    assert migrate(engine) is False
    engine.dispose()


def test_the_command_line_upgrades_real_data_like_the_app(tmp_path, monkeypatch):
    # A review move pointing at saved Maia evidence: the shared-cache revision rebuilds
    # that table, which only works with foreign keys off on the migration connection.
    path = tmp_path / "cli.sqlite3"
    engine, _ = database(path)
    upgrade_to(engine, BEFORE_SHARED_MAIA)
    with engine.begin() as connection:
        fill(connection, "games", id="game", user_id="local")
        fill(connection, "human_analyses", id="maia", user_id="local")
        fill(
            connection,
            "game_review_moves",
            user_id="local",
            game_id="game",
            human_analysis_id="maia",
        )
    engine.dispose()
    monkeypatch.setenv("DATABASE_PATH", str(path))
    command.upgrade(_config(), "head")
    engine, _ = database(path)
    assert migrations_pending(engine) is False
    assert "human_analysis_merge" not in tables(engine)
    with engine.connect() as connection:
        assert (
            connection.exec_driver_sql("SELECT human_analysis_id FROM game_review_moves").scalar()
            == "maia"
        )
    engine.dispose()


def test_every_revision_downgrades_and_upgrades_again(tmp_path):
    from alembic.script import ScriptDirectory

    engine, _ = database(tmp_path / "round-trip.sqlite3")
    migrate(engine)
    config = _config()
    revisions = [script.revision for script in ScriptDirectory.from_config(config).walk_revisions()]
    for target in [*revisions[1:], "base"]:
        with migration_connection(engine) as connection:
            config.attributes["connection"] = connection
            command.downgrade(config, target)
    assert tables(engine) == {"alembic_version"} or tables(engine) == set()
    assert migrate(engine) is True
    assert migrations_pending(engine) is False
    engine.dispose()


def test_the_engine_never_runs_out_of_connections(tmp_path):
    # Coordinators, classification workers, engine caches and requests share one
    # engine; however many hold a connection at once, none waits for a free one.
    engine, _ = database(tmp_path / "busy.sqlite3")
    held = [engine.connect() for _ in range(40)]
    try:
        assert all(connection.exec_driver_sql("SELECT 1").scalar() == 1 for connection in held)
    finally:
        for connection in held:
            connection.close()
        engine.dispose()


def test_timestamps_with_an_offset_are_rewritten_and_read_back_in_utc(tmp_path):
    from datetime import datetime, timedelta, timezone

    from sqlalchemy.orm import Session
    from trainer.models import Game, User

    engine, _ = database(tmp_path / "timestamps.sqlite3")
    upgrade_to(engine, "d2b6f8a0c3e5")
    with engine.begin() as connection:
        fill(connection, "users", id="u1", username="u1")
        for game_id, played in (
            ("offset", "2024-01-01 12:00:00+00:00"),
            ("eastern", "2024-01-01T07:00:00-05:00"),
            ("stored", "2024-01-01 12:00:00.000000"),
            ("plain", "2024-01-01 12:00:00"),
        ):
            fill(
                connection, "games", id=game_id, user_id="u1", fingerprint=game_id, played_at=played
            )
    upgrade_to(engine, "head")
    with engine.connect() as connection:
        raw = dict(connection.exec_driver_sql("SELECT id, played_at FROM games").fetchall())
    assert raw["offset"] == raw["eastern"] == raw["stored"] == "2024-01-01 12:00:00.000000"
    noon = datetime(2024, 1, 1, 12, tzinfo=timezone.utc)
    with Session(engine) as db:
        assert {game.played_at for game in db.query(Game)} == {noon}
        user = db.get(User, "u1")
        user.last_seen_at = datetime(2024, 1, 1, 7, tzinfo=timezone(-timedelta(hours=5)))
        db.commit()
        db.expire_all()
        assert db.get(User, "u1").last_seen_at == noon


def test_values_requests_used_to_fill_in_are_backfilled(tmp_path):
    engine, _ = database(tmp_path / "backfill.sqlite3")
    upgrade_to(engine, "f6c0e2a4b8d7")
    with engine.begin() as connection:
        fill(connection, "users", id="u1", username="u1")
        fill(
            connection,
            "games",
            id="g1",
            user_id="u1",
            fingerprint="g1",
            pgn="1. f3 e5 2. g4 Qh4# 0-1",
        )
        fill(connection, "games", id="g2", user_id="u1", fingerprint="g2", pgn="", move_count=None)
        fill(connection, "exercises", id="x1", user_id="u1", identity="x1")
        for session, response in (("s1", None), ("s2", None), ("s3", 900)):
            fill(
                connection,
                "review_sessions",
                id=session,
                user_id="u1",
                exercise_id="x1",
                response_ms=response,
            )
        for attempt, session, elapsed in (
            ("a1", "s1", 4000),
            ("a2", "s1", 2500),
            ("a3", "s3", 100),
        ):
            fill(
                connection,
                "exercise_attempts",
                id=attempt,
                user_id="u1",
                session_id=session,
                elapsed_ms=elapsed,
            )
    upgrade_to(engine, "head")
    with engine.connect() as connection:
        games = dict(connection.exec_driver_sql("SELECT id, move_count FROM games").fetchall())
        sessions = dict(
            connection.exec_driver_sql("SELECT id, response_ms FROM review_sessions").fetchall()
        )
    assert games == {"g1": 4, "g2": 0}
    assert sessions == {"s1": 2500, "s2": None, "s3": 900}
