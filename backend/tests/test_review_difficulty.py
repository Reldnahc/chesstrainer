"""Human difficulty never replaces objective grading or manufactures population odds."""

import chess
import chess.pgn
import pytest
from trainer.chess_core import digest
from trainer.human_models.context import request_for
from trainer.human_models.types import HumanEvidence, HumanMove
from trainer.review_intelligence.difficulty import assess_difficulty


def report(*, loss=0, best_rank=1, played_rank=1, probability=0.4, shifted=False):
    game = chess.pgn.Game()
    game.headers.update(
        Site="https://chess.com" if shifted else "https://lichess.org",
        Event="Rated Blitz",
        WhiteElo="1200",
        BlackElo="1400",
    )
    request = request_for(game, chess.Board(), 1000)
    human = HumanEvidence(
        status="available",
        evidence_id="human-evidence",
        configuration_key="pinned",
        history_key=digest(request.history.model_dump()),
        mover=request.mover,
        conditioning=request.conditioning,
        domain=request.domain,
        played=HumanMove(uci="e2e4", rank=played_rank, probability=probability),
        engine_best=HumanMove(uci="e2e4", rank=best_rank, probability=probability),
        legal_count=20,
    )
    return dict(
        best={"score": {"kind": "cp", "value": 0}, "uci": "e2e4"},
        actual={"score": {"kind": "cp", "value": -loss}, "uci": "e2e4"},
        second_score={"kind": "cp", "value": -20},
        legal_count=20,
        sacrifice=None,
        before_analysis_id="stockfish-root",
        played_analysis_id="stockfish-played",
        best_line={"frames": [], "findings": []},
        human=human.model_dump(mode="json"),
    )


def test_natural_mistake_and_rare_strong_move_are_not_contradictions():
    bad = report(loss=200)
    result = assess_difficulty(bad)
    assert result.interpretations == ["natural_error"]
    assert result.played_naturalness == "preferred"
    rare = report(best_rank=10, played_rank=10, probability=0.001)
    result = assess_difficulty(rare)
    assert result.interpretations == ["unusual_strong_move"]
    assert result.best_find_difficulty == "challenging"  # Rarity alone cannot escalate.
    rare["sacrifice"] = {"analysis_id": "acceptance-search"}
    assert assess_difficulty(rare).best_find_difficulty == "difficult"
    rare["actual"]["uci"] = "d2d4"
    rare["human"]["played"]["uci"] = "d2d4"
    assert assess_difficulty(rare).best_find_difficulty == "challenging"


@pytest.mark.parametrize(
    ("rank", "probability", "expected"),
    [
        (3, 0.04, "natural"),
        (4, 0.06, "challenging"),
    ],
)
def test_a_best_move_among_the_model_top_three_is_never_a_hard_find(rank, probability, expected):
    assert (
        assess_difficulty(report(best_rank=rank, probability=probability)).best_find_difficulty
        == expected
    )


def test_only_move_requires_losing_alternative_not_just_missing_mate():
    data = report(best_rank=10, played_rank=10, probability=0.001)
    data["second_score"]["value"] = -200
    result = assess_difficulty(data)
    assert result.components.only_good_move_at_depth
    assert result.best_find_difficulty == "difficult"
    assert "hard_to_find_defense" in result.interpretations
    for other in [0, 260, 500]:
        data["best"]["score"] = {"kind": "mate", "value": 1}
        data["actual"]["score"] = {"kind": "mate", "value": 1}
        data["second_score"] = {"kind": "cp", "value": other}
        assert not assess_difficulty(data).components.only_good_move_at_depth
    data["second_score"]["value"] = -200
    assert assess_difficulty(data).components.only_good_move_at_depth
    data["best"]["score"] = {"kind": "cp", "value": -500}
    data["actual"]["score"] = {"kind": "cp", "value": -500}
    data["second_score"]["value"] = -800
    assert not assess_difficulty(data).components.only_good_move_at_depth


def test_missing_policy_and_legacy_versions_abstain_but_forced_move_is_structural():
    data = report()
    for human in [None, {}, {"schema_version": "unsupported"}]:
        data["human"] = human
        result = assess_difficulty(data)
        assert result.best_find_difficulty == "unknown"
        assert result.played_naturalness == "unknown"
        assert result.confidence == "unavailable"
    data["legal_count"] = 1
    result = assess_difficulty(data)
    assert result.best_find_difficulty == "forced"
    assert result.interpretations == ["forced_reply"]
    assert result.confidence == "structural"
