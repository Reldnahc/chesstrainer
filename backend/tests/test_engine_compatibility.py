import chess
import pytest
from trainer.engine import EngineUnavailable, Stockfish
from trainer.exercises import manual_exercise
from trainer.models import SRSState
from trainer.reviews import queue, start_review, submit_move
from trainer.scheduling import FSRSScheduler


@pytest.mark.stockfish
def test_reference_analysis_uses_saved_limits(settings, sessions, stockfish_path):
    settings.stockfish_path = stockfish_path
    engine = Stockfish(settings, sessions)
    board = chess.Board()
    try:
        original = engine.analyze(board, deep=True)
        settings.deep_time = 0.01
        settings.deep_depth = 3
        result = engine.analyze(
            board, deep=True, root_moves=["d2d4"], multipv=1, reference=original
        )
        assert result.config["time"] == original.config["time"]
        assert result.config["depth"] == original.config["depth"]
        original.engine_version = "incompatible-version"
        with pytest.raises(EngineUnavailable, match="different Stockfish"):
            engine.analyze(board, deep=True, root_moves=["d2d4"], reference=original)
    finally:
        engine.close()


def test_failed_unfinished_session_survives_queue_reload(settings, sessions):
    scheduler = FSRSScheduler(settings)
    with sessions() as db:
        exercise = manual_exercise(db, scheduler, chess.STARTING_FEN, ["e2e4"], "white")
        session = start_review(db, exercise.id)
        submit_move(db, session["session_id"], "d2d4", None, scheduler, settings)
        assert db.get(SRSState, exercise.id).reviews == 1
        assert queue(db)[0]["exercise_id"] == exercise.id
        assert start_review(db, exercise.id)["session_id"] == session["session_id"]


def test_search_config_resolves_one_profile(settings):
    from types import SimpleNamespace

    from trainer.engine import ADAPTER_VERSION, search_config
    from trainer.search_limits import SearchLimits

    triage = search_config(settings, "hash")
    assert (triage["depth"], triage["multipv"], triage["adapter_version"]) == (
        settings.triage_depth,
        1,
        ADAPTER_VERSION,
    )
    deep = search_config(settings, "hash", deep=True, root_moves=["e2e4", "d2d4"])
    assert (deep["depth"], deep["multipv"], deep["root_moves"]) == (
        settings.deep_depth,
        settings.multipv,
        ["d2d4", "e2e4"],
    )
    reference = SimpleNamespace(
        config={"threads": 3, "hash_mb": 7, "depth": 30, "time": 9.0, "nodes": None}
    )
    extended = search_config(settings, "hash", reference=reference, multipv=2)
    assert (extended["depth"], extended["threads"], extended["multipv"]) == (30, 3, 2)
    probe = search_config(settings, "hash", classification_probe=True)
    assert probe["depth"] == settings.classification_probe_depth and probe["nodes"] is None
    limits = SearchLimits(depth=5, time=0.1, nodes=None)
    for clash in (
        {"reference": reference, "classification_probe": True},
        {"reference": reference, "limits": limits},
        {"classification_probe": True, "limits": limits},
    ):
        with pytest.raises(ValueError):
            search_config(settings, "hash", **clash)
