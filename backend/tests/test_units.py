import sqlite3
import threading

import chess
import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import OperationalError
from trainer.db import Units
from trainer.models import EngineAnalysis, Game, keep_shared


def _game(key):
    return Game(fingerprint=key, white="A", black="B", learner_color=True, pgn="1. e4 *")


def _count(sessions):
    with sessions() as db:
        return db.scalar(select(func.count()).select_from(Game))


def _other_writer(path):
    return sqlite3.connect(path, timeout=0, isolation_level=None)


def test_a_write_unit_commits_when_it_ends_and_discards_on_an_error(sessions):
    units = Units(sessions, threading.RLock())
    with units.write() as db:
        db.add(_game("kept"))
    with pytest.raises(LookupError), units.write() as db:
        db.add(_game("dropped"))
        db.flush()
        raise LookupError("refused")
    assert _count(sessions) == 1


def test_a_write_unit_takes_the_lock_then_sqlite_at_once(settings, sessions):
    lock = threading.Lock()
    units = Units(sessions, lock)
    with units.write() as db:
        assert lock.locked()
        db.scalar(select(func.count()).select_from(Game))
        # Only read so far, but the unit's first statement took SQLite's write lock.
        with pytest.raises(sqlite3.OperationalError, match="locked"):
            _other_writer(settings.database_path).execute("BEGIN IMMEDIATE")
    assert not lock.locked()

    entered = threading.Event()

    def write():
        with units.write():
            entered.set()

    lock.acquire()
    try:
        thread = threading.Thread(target=write)
        thread.start()
        # Waiting on the account lock, the unit holds nothing in SQLite.
        assert not entered.wait(0.2)
        writer = _other_writer(settings.database_path)
        writer.execute("BEGIN IMMEDIATE")
        writer.execute("ROLLBACK")
    finally:
        lock.release()
    thread.join(5)
    assert entered.is_set()


def test_a_read_unit_sees_one_snapshot_and_cannot_write(settings, sessions):
    units = Units(sessions, threading.RLock())
    with units.read() as db:
        assert db.scalar(select(func.count()).select_from(Game)) == 0
        with Units(sessions, threading.RLock()).write() as other:
            other.add(_game("meanwhile"))
        assert db.scalar(select(func.count()).select_from(Game)) == 0
        db.add(_game("refused"))
        with pytest.raises(OperationalError, match="readonly"):
            db.flush()
        db.rollback()
    assert _count(sessions) == 1
    # The pooled connection is writable again for whoever takes it next.
    for _ in range(3):
        with units.write() as db:
            db.add(_game(f"after-{_}"))
    assert _count(sessions) == 4


def test_one_thread_cannot_write_twice_at_once(sessions):
    units = Units(sessions, threading.RLock())
    with units.write():
        with pytest.raises(RuntimeError, match="already open"), units.write():
            pass
        # An engine cache insert from inside a unit would wait on the unit itself.
        with sessions() as cache, pytest.raises(RuntimeError, match="Another session wrote"):
            cache.execute(
                keep_shared(
                    EngineAnalysis,
                    "inside",
                    fen=chess.STARTING_FEN,
                    engine_version="fixture",
                    config={},
                    candidates=[],
                )
            )
    with units.write() as db:
        db.add(_game("after"))
    assert _count(sessions) == 1
