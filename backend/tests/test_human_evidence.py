"""Private evidence, honest probabilities, domain conditioning, and durable reuse."""

import io
from concurrent.futures import ThreadPoolExecutor

import chess
import chess.pgn
import pytest
from human_fixtures import PolicyProvider
from sqlalchemy import func, select
from trainer.accounts import Accounts
from trainer.human_models.context import request_for
from trainer.human_models.preset import provenance, verify_source
from trainer.human_models.runtime import HumanUnavailable
from trainer.human_models.service import HumanModels
from trainer.human_models.types import HumanPolicy
from trainer.models import Game, GameReviewMove, HumanAnalysis
from trainer.ownership import account_sessions


def parsed():
    return chess.pgn.read_game(
        io.StringIO(
            '[Site "https://chess.com/game/live/1"]\n[Event "Live Rapid"]\n'
            '[WhiteElo "700"]\n[BlackElo "1800"]\n[TimeControl "600"]\n\n1. e4 e5 *'
        )
    )


def evidence(service, sessions, game=None, board=None, **kwargs):
    return service.evidence(
        sessions, game or parsed(), board or chess.Board(), "e2e4", "d2d4", 1000, **kwargs
    )


def test_both_colors_history_and_domain_are_explicit():
    game = parsed()
    board = game.board()
    first = request_for(game, board, 900)
    assert (first.conditioning.self_rating, first.conditioning.opponent_rating) == (700, 1800)
    assert first.domain.alignment == "shifted"
    assert first.domain.calibration == "unvalidated"
    board.push_uci("e2e4")
    second = request_for(game, board, 900)
    assert (second.conditioning.self_rating, second.conditioning.opponent_rating) == (1800, 700)
    assert second.history.moves == ["e2e4"]
    del game.headers["WhiteElo"]
    third = request_for(game, board, 900)
    assert third.conditioning.opponent_rating == 900
    assert third.conditioning.opponent_source == "fallback"
    game.headers["Site"], game.headers["Event"] = "https://lichess.org/1", "Rated Blitz"
    assert request_for(game, board, 900).domain.alignment == "related"
    game.headers["Site"] = "https://[invalid"
    assert request_for(game, board, 900).domain.alignment == "unknown"
    assert not request_for(
        game, chess.Board("8/8/8/8/8/4k3/6P1/4K3 w - - 0 1"), 900
    ).domain.history_from_start


def test_cache_restart_key_inputs_and_worker_count(settings, sessions):
    provider = PolicyProvider(settings)
    service = HumanModels(settings, provider)
    first = evidence(service, sessions)
    assert first["status"] == "available"
    assert first["played"]["probability"] == 0.05
    assert first["normalized_entropy"] == pytest.approx(1)
    assert first["top_three_mass"] == pytest.approx(0.15)
    assert len(provider.calls) == 1
    settings.human_model_workers = 4
    restarted = PolicyProvider(settings)
    assert evidence(HumanModels(settings, restarted), sessions) == first
    assert restarted.calls == []
    variants = []
    for name, value in [
        ("WhiteElo", "701"),
        ("BlackElo", "1801"),
        ("TimeControl", "300"),
        ("Site", "https://lichess.org/1"),
        ("Event", "Live Blitz"),
    ]:
        game = parsed()
        game.headers[name] = value
        variants.append(evidence(service, sessions, game))
    board = chess.Board()
    for move in ["g1f3", "g8f6", "f3g1", "f6g8"]:
        board.push_uci(move)
    variants.append(evidence(service, sessions, board=board))
    for field, value in [("adapter_version", "next"), ("model_revision", "other")]:
        other = PolicyProvider(settings)
        other.provenance = other.provenance.model_copy(update={field: value})
        variants.append(evidence(HumanModels(settings, other), sessions))
    settings.human_model_threads = 3
    variants.append(evidence(HumanModels(settings, PolicyProvider(settings)), sessions))
    assert len({row["evidence_id"] for row in [first, *variants]}) == len(variants) + 1
    assert all(row["status"] == "available" for row in variants)


def test_account_private_cache_and_same_account_concurrent_dedup(settings, sessions):
    owner = Accounts(settings.database_path).create("second-owner", "testing-password")
    private = account_sessions(sessions.kw["bind"], owner["id"])
    provider = PolicyProvider(settings)
    service = HumanModels(settings, provider)
    with ThreadPoolExecutor(max_workers=4) as pool:
        local = list(pool.map(lambda _: evidence(service, sessions), range(4)))
    other = evidence(service, private)
    assert len(provider.calls) == 2
    assert len({r["evidence_id"] for r in local}) == 1
    assert other["evidence_id"] != local[0]["evidence_id"]
    for factory, hidden in [(sessions, other["evidence_id"]), (private, local[0]["evidence_id"])]:
        with factory() as db:
            assert db.get(HumanAnalysis, hidden) is None
            assert db.scalar(select(func.count()).select_from(HumanAnalysis)) == 1
            row = db.scalar(select(HumanAnalysis))
            row.user_id = "someone-else"
            with pytest.raises(ValueError, match="ownership"):
                db.flush()
            db.rollback()
    with sessions() as db:
        game = Game(
            fingerprint="human-fk-fixture", white="A", black="B", learner_color=True, pgn="*"
        )
        db.add(game)
        db.flush()
        db.add(
            GameReviewMove(
                game_id=game.id, ply=1, report={}, human_analysis_id=other["evidence_id"]
            )
        )
        with pytest.raises(ValueError, match="not in this account"):
            db.flush()


def test_rank_only_is_not_fake_probability_and_failure_never_persists(settings, sessions):
    provider = PolicyProvider(settings, ranked=True)
    service = HumanModels(settings, provider)
    result = evidence(service, sessions)
    assert result["status"] == "available"
    assert result["played"] is None  # Outside top N, not zero percent.
    assert result["normalized_entropy"] is None
    assert result["top_three_mass"] is None
    assert all(row["probability"] is None for row in result["top_moves"])
    provider.provenance = provider.provenance.model_copy(update={"adapter_version": "fail"})

    def broken(*_):
        raise HumanUnavailable("no model")

    provider.predict = broken
    failed = HumanModels(settings, provider)
    assert evidence(failed, sessions)["status"] == "unavailable"
    assert evidence(failed, sessions, cancelled=lambda: True)["status"] == "cancelled"
    settings.human_model_enabled = False
    assert evidence(failed, sessions)["status"] == "disabled"
    with sessions() as db:
        assert db.scalar(select(func.count()).select_from(HumanAnalysis)) == 1


@pytest.mark.parametrize(
    "moves",
    [
        [{"uci": "e2e4", "rank": 1, "probability": 0.8}],
        [{"uci": "e2e4", "rank": 2, "probability": 1}],
        [{"uci": "e2e4", "rank": 1, "probability": float("nan")}],
        [
            {"uci": "e2e4", "rank": 1, "probability": 0.5},
            {"uci": "e2e4", "rank": 2, "probability": 0.5},
        ],
        [{"uci": "e2e4", "rank": 1, "probability": 0.5}, {"uci": "d2d4", "rank": 2}],
    ],
)
def test_invalid_policy_is_rejected(settings, moves):
    with pytest.raises(ValueError):
        HumanPolicy(provenance=provenance(settings), complete=True, moves=moves)


def test_pinned_source_and_missing_model_never_download(settings, sessions, monkeypatch):
    verify_source()
    monkeypatch.setattr(
        "urllib.request.urlopen", lambda *_a, **_k: pytest.fail("Implicit download")
    )
    service = HumanModels(settings)
    assert service.snapshot().status == "not_configured"
    assert evidence(service, sessions)["status"] == "unavailable"
    service.close()
