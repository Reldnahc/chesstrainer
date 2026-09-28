"""Human difficulty never replaces objective grading or manufactures population odds."""

from copy import deepcopy

import chess
import chess.pgn
import pytest
from trainer.chess_core import digest
from trainer.human_models.context import request_for
from trainer.human_models.types import HumanEvidence, HumanMove
from trainer.review_intelligence.difficulty import assess_difficulty, naturalness


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


@pytest.mark.parametrize(
    "rank,probability,expected",
    [
        (1, 0.1, "preferred"),
        (3, 0.1, "preferred"),
        (4, 0.1, "plausible"),
        (1, 0.099, "plausible"),
        (6, 0.01, "plausible"),
        (7, 0.03, "plausible"),
        (7, 0.029, "unusual"),
        (1, None, "preferred"),
        (7, None, "plausible"),
    ],
)
def test_naturalness_boundaries_are_explicit(rank, probability, expected):
    assert naturalness(HumanMove(uci="e2e4", rank=rank, probability=probability)) == expected


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


def test_domain_rating_history_and_rank_only_limit_confidence():
    base = report()
    assert assess_difficulty(base).confidence == "heuristic"
    assert assess_difficulty(report(shifted=True)).confidence == "limited"
    cases = [
        ({"conditioning": {"self_source": "fallback"}}, "rating_fallback"),
        ({"conditioning": {"opponent_rating": 3000}}, "outside_probed_rating_range"),
        ({"domain": {"history_from_start": False}}, "pre_setup_history_unknown"),
        ({"engine_best": {"probability": None}}, "incomplete_policy"),
    ]
    for changes, limitation in cases:
        data = deepcopy(base)
        for key, values in changes.items():
            data["human"][key].update(values)
        assessment = assess_difficulty(data)
        assert assessment.confidence == "limited"
        assert limitation in assessment.limitations
    assert "uncalibrated_population" in assess_difficulty(base).limitations


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


def test_stale_policy_projection_abstains_when_objective_best_changes():
    data = report()
    data["best"]["uci"] = "d2d4"
    result = assess_difficulty(data)
    assert result.best_find_difficulty == "unknown"
    assert "human_move_context_mismatch" in result.limitations


def test_candidate_coverage_is_a_lower_bound_and_unknown_runner_up_is_not_only_move():
    data = report()
    result = assess_difficulty(data)
    assert result.components.acceptable_count_lower_bound == 2
    assert not result.components.alternatives_complete
    data["second_score"] = None
    result = assess_difficulty(data)
    assert result.components.only_good_move_at_depth is None
    assert result.components.acceptable_count_lower_bound == 1


def test_inputs_remain_immutable_and_personality_never_changes_semantics():
    data = report()
    original = deepcopy(data)
    first = assess_difficulty(data)
    assert data == original
    data["coach"] = "A completely different personality line."
    data["best_line"]["frames"] = [{"annotation": "Unrelated presentation wording"}]
    assert assess_difficulty(data) == first
    data["human"]["conditioning"]["self_rating"] = 1600
    assert assess_difficulty(data).input_digest != first.input_digest


def test_forcing_trace_and_supported_horizon_are_not_entire_pv_length():
    data = report(best_rank=7, played_rank=7, probability=0.02)
    data["best_line"] = {
        "frames": [{}, {"gives_check": True}, {"capture": "pawn"}, {}, {"gives_check": True}],
        "findings": [{"plies": [1, 3]}],
    }
    result = assess_difficulty(data)
    assert result.components.best_forcing_plies == 2
    assert result.components.best_supported_horizon == 3
    assert result.best_find_difficulty == "difficult"
