"""Explicit search profiles share native caching and remain interruptible."""

from concurrent.futures import ThreadPoolExecutor
from threading import Event
from time import monotonic
from types import SimpleNamespace

import chess
import pytest
from sqlalchemy import func, select
from trainer.engine import EngineReferenceMismatch, Stockfish
from trainer.engine_pool import EnginePool
from trainer.models import EngineAnalysis
from trainer.review_intelligence.refinement_search import RefinementEngine
from trainer.search_limits import EngineCancelled, SearchLimits


def test_actual_leased_engine_identity_is_verified_before_persisting(sessions):
    task = SimpleNamespace(
        queries=[],
        config={
            "multipv": 2,
            "max_queries": 4,
            "engine_version": "Stockfish",
            "binary_sha256": "pinned",
            "limits": {"depth": 22, "time": 2},
        },
    )
    native = SimpleNamespace(
        version="Stockfish",
        binary_hash="pinned",
        start=lambda **_: None,
        analyze=lambda *_, **__: EngineAnalysis(
            engine_version="Stockfish", config={"binary_sha256": "replaced"}
        ),
    )
    bounded = RefinementEngine(native, task, sessions, lambda: False)
    with pytest.raises(EngineReferenceMismatch):
        bounded.analyze(chess.Board())
    assert bounded.queries == []


@pytest.mark.stockfish
def test_explicit_limits_are_cached_separately_and_cancelled_search_is_not_saved(
    settings, sessions, stockfish_path
):
    settings.stockfish_path = stockfish_path
    engine = Stockfish(settings, sessions)
    board = chess.Board()
    limits = SearchLimits(depth=14, time=0.3)
    try:
        baseline = engine.analyze(board, deep=True, multipv=2)
        refined = engine.analyze(
            board, deep=True, multipv=2, limits=limits, cancelled=lambda: False
        )
        assert refined.id != baseline.id
        assert refined.config["depth"] == 14 and refined.config["time"] == 0.3
        assert engine.analyze(board, deep=True, multipv=2, limits=limits).id == refined.id
        with pytest.raises(ValueError):
            engine.analyze(board, reference=baseline, limits=limits)
        with sessions() as db:
            before = db.scalar(select(func.count()).select_from(EngineAnalysis))
        start = monotonic()
        with pytest.raises(EngineCancelled):
            engine.analyze(
                board,
                deep=True,
                limits=SearchLimits(depth=40, time=10),
                cancelled=lambda: monotonic() - start > 0.15,
            )
        assert monotonic() - start < 3
        assert engine.process is None
        with sessions() as db:
            assert db.scalar(select(func.count()).select_from(EngineAnalysis)) == before
        assert engine.analyze(board, deep=True, multipv=2, limits=limits).id == refined.id
    finally:
        engine.close()


def test_waiting_for_shared_slot_can_cancel_without_acquiring_or_leaking_it(settings, sessions):
    entered, release, cancel = Event(), Event(), Event()

    class SlowEngine:
        version, binary_hash = "synthetic", "binary"

        def __init__(self, *_):
            pass

        def analyze(self):
            entered.set()
            assert release.wait(5)

        def close(self):
            pass

    pool = EnginePool(SlowEngine, 1)
    one, two = pool.handle(settings, sessions), pool.handle(settings, sessions)
    with ThreadPoolExecutor(max_workers=2) as executor:
        active = executor.submit(one.analyze)
        assert entered.wait(2)
        waiting = executor.submit(two.start, cancelled=cancel.is_set)
        cancel.set()
        try:
            with pytest.raises(EngineCancelled):
                waiting.result(timeout=1)
        finally:
            release.set()
            active.result(timeout=2)
    assert pool.available.qsize() == 1
    pool.close()
