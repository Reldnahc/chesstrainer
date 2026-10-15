import chess
import pytest
from trainer.engine import EngineUnavailable, Stockfish
from trainer.exercises import manual_exercise
from trainer.models import SRSState
from trainer.reviews import queue, start_review, submit_move
from trainer.scheduling import FSRSScheduler
from trainer.search_limits import DEEP, PROBE, TRIAGE, SearchLimits, SearchProfile


@pytest.mark.stockfish
def test_reference_analysis_uses_saved_limits(settings, sessions, stockfish_path):
    settings.stockfish_path = stockfish_path
    engine = Stockfish(settings, sessions)
    board = chess.Board()
    try:
        original = engine.analyze(board, DEEP)
        settings.deep_time = 0.01
        settings.deep_depth = 3
        result = engine.analyze(
            board, SearchProfile.extending(original), root_moves=["d2d4"], multipv=1
        )
        assert result.config["time"] == original.config["time"]
        assert result.config["depth"] == original.config["depth"]
        original.engine_version = "incompatible-version"
        with pytest.raises(EngineUnavailable, match="different Stockfish"):
            engine.analyze(board, SearchProfile.extending(original), root_moves=["d2d4"])
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

    assert search_config(settings, "hash") == search_config(settings, "hash", TRIAGE)
    triage = search_config(settings, "hash")
    assert (triage["depth"], triage["multipv"], triage["adapter_version"]) == (
        settings.triage_depth,
        1,
        ADAPTER_VERSION,
    )
    deep = search_config(settings, "hash", DEEP, root_moves=["e2e4", "d2d4"])
    assert (deep["depth"], deep["multipv"], deep["root_moves"]) == (
        settings.deep_depth,
        settings.multipv,
        ["d2d4", "e2e4"],
    )
    reference = SimpleNamespace(
        config={"threads": 3, "hash_mb": 7, "depth": 30, "time": 9.0, "nodes": None}
    )
    extended = search_config(settings, "hash", SearchProfile.extending(reference), multipv=2)
    assert (extended["depth"], extended["threads"], extended["multipv"]) == (30, 3, 2)
    assert search_config(settings, "hash", SearchProfile.extending(reference))["multipv"] == (
        settings.multipv
    )
    probe = search_config(settings, "hash", PROBE)
    assert probe["depth"] == settings.classification_probe_depth and probe["nodes"] is None
    assert (probe["threads"], probe["multipv"]) == (settings.stockfish_threads, 1)
    limits = SearchLimits(depth=5, time=0.1, nodes=None)
    explicit = search_config(settings, "hash", SearchProfile.explicit(limits))
    assert (explicit["depth"], explicit["time"], explicit["nodes"], explicit["multipv"]) == (
        5,
        0.1,
        None,
        settings.multipv,
    )
    # A profile is one source of limits; it cannot carry a second one.
    for clash in (
        {"kind": "reference", "reference": reference, "limits": limits},
        {"kind": "explicit", "reference": reference, "limits": limits},
        {"kind": "probe", "limits": limits},
        {"kind": "deep", "reference": reference},
        {"kind": "reference"},
        {"kind": "explicit"},
    ):
        with pytest.raises(ValueError):
            SearchProfile(**clash)
