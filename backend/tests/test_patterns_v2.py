"""Deterministic positive/negative witnesses, not a claimed accuracy benchmark."""

import pytest
from test_local_classifier import evidence
from trainer.chess_core import Score
from trainer.local_classifier import LocalClassifier

CASES = [
    (
        "pin",
        "4k3/4n3/2p5/1B6/8/8/8/4R1K1 w - - 0 1",
        ["b5c6", "e8f8", "c6g2", "f8g7"],
        ["b5f1", "e8f8", "e1e3", "f8g7"],
    ),
    (
        "skewer",
        "8/7q/6k1/1B6/8/8/8/6K1 w - - 0 1",
        ["b5d3", "g6g5", "d3h7", "g5f4", "h7g8", "f4g3"],
        ["b5a4", "g6f6", "a4b3", "f6g5"],
    ),
    (
        "removing_defender",
        "6k1/6p1/5n2/3q2B1/8/8/8/3R2K1 w - - 0 1",
        ["g5f6", "g7f6", "d1d5", "g8f7", "d5d1", "f7g6"],
        ["g5f4", "g8f7", "d1c1", "f7g6"],
    ),
    ("back_rank", "6k1/5ppp/8/8/8/8/8/R3Q1K1 w - - 0 1", ["e1e8"], ["e1f1"]),
]


@pytest.mark.parametrize("black", [False, True])
@pytest.mark.parametrize("skill,fen,best,actual", CASES)
def test_new_witness_patterns(skill, fen, best, actual, black):
    payload = evidence(
        fen, best, actual, Score(kind="mate", value=1) if skill == "back_rank" else 800, 0, black
    )
    result, _ = LocalClassifier().classify(payload)
    finding = next(f for f in result.findings if f.skill_id == skill)
    assert finding.roles and finding.cue
    assert finding.actor == ("black" if black else "white")
    assert finding.analysis_id == "best"
    assert finding.moves == [payload["best_candidates"][0]["pv"][p - 1] for p in finding.plies]


def test_unpinned_defender_is_not_a_pin():
    result, _ = LocalClassifier().classify(
        evidence(
            "7k/4n3/2p5/1B6/8/8/8/4R1K1 w - - 0 1",
            ["b5c6", "h8g8", "c6g2", "g8h7"],
            ["b5f1", "h8g8", "e1e3", "g8h7"],
            200,
            0,
        )
    )
    assert "pin" not in {f.skill_id for f in result.findings}


def test_pawn_outcome_is_not_claimed_as_a_specific_pattern():
    result, _ = LocalClassifier().classify(
        evidence(
            "7k/8/8/8/4p3/8/4R3/6K1 w - - 0 1",
            ["e2e4", "h8g8", "e4e2", "g8h7"],
            ["e2d2", "h8g8", "d2d3", "g8h7"],
            200,
            0,
        )
    )
    assert result.outcomes[0].material_points == 1
    assert {f.skill_id for f in result.findings} == {"missed_material_gain"}
    assert "mechanism_unclassified" in result.abstention_reasons


def test_compensated_line_with_no_meaningful_score_loss_has_no_labels():
    result, _ = LocalClassifier().classify(evidence(actual_score=310))
    assert not result.findings and not result.outcomes


@pytest.mark.parametrize("black", [False, True])
def test_unrelated_check_and_capture_is_not_a_skewer(black):
    result, _ = LocalClassifier().classify(
        evidence(
            "8/8/q5k1/1B6/8/8/8/6K1 w - - 0 1",
            ["b5d3", "g6g5", "d3a6", "g5f4", "a6b5", "f4g3"],
            ["b5a4", "g6f6", "a4b3", "f6g5"],
            800,
            0,
            black,
        )
    )
    assert "skewer" not in {f.skill_id for f in result.findings}


def test_another_defender_prevents_removing_defender_claim():
    result, _ = LocalClassifier().classify(
        evidence(
            "6k1/6p1/2b2n2/3q2B1/8/8/8/3R2K1 w - - 0 1",
            ["g5f6", "g7f6", "d1d5", "g8f7", "d5d1", "f7g6"],
            ["g5f4", "g8f7", "d1c1", "f7g6"],
            800,
            0,
        )
    )
    assert "removing_defender" not in {f.skill_id for f in result.findings}


def test_back_rank_check_with_escape_is_not_mate_pattern():
    result, _ = LocalClassifier().classify(
        evidence(
            "6k1/5p1p/8/8/8/8/8/R3Q1K1 w - - 0 1",
            ["e1e8", "g8g7"],
            ["e1f1"],
            Score(kind="mate", value=5),
            0,
        )
    )
    assert "back_rank" not in {f.skill_id for f in result.findings}


def test_unsettled_recapture_after_quiet_prefix_does_not_establish_material():
    from trainer.chess_core import Candidate, valid_board
    from trainer.continuations import replay, settled_delta

    payload = evidence()
    # The earlier quiet prefix cannot replace an endpoint ending with a capture.
    boards = replay(
        valid_board(payload["fen"]), Candidate.model_validate(payload["best_candidates"][0])
    )
    assert settled_delta(boards[:4], True)[0] is None
    assert settled_delta(boards, True)[0] == 5
