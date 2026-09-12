"""Reduced, synthetic fixtures for audit findings; no private game positions."""

import pytest
from test_local_classifier import evidence
from trainer.local_classifier import LocalClassifier


@pytest.mark.parametrize("black", [False, True])
def test_undefended_queen_is_still_hanging_after_partial_compensation(black):
    result, _ = LocalClassifier().classify(
        evidence(
            "6k1/8/8/q7/1B6/2P5/8/Q5K1 w - - 0 1",
            ["b4a5", "g8f7", "a5b4", "f7e6"],
            ["g1f1", "a5a1", "f1e2", "a1a4", "e2d3", "a4b4", "c3b4", "g8f7", "d3e3", "f7e6"],
            900,
            -400,
            black,
        )
    )
    assert "hanging_piece" in {f.skill_id for f in result.findings}


@pytest.mark.parametrize("black", [False, True])
def test_equal_queen_trade_then_lost_knight_is_not_a_hung_queen(black):
    result, _ = LocalClassifier().classify(
        evidence(
            "4k3/4q3/8/8/1N6/8/8/4Q1K1 w - - 0 1",
            ["b4d5", "e8d8", "g1h1", "d8c8"],
            [
                "e1e7",
                "e8e7",
                "g1f1",
                "e7d6",
                "f1e1",
                "d6c5",
                "e1d1",
                "c5b4",
                "d1c2",
                "b4a3",
                "c2d3",
                "a3b2",
            ],
            300,
            0,
            black,
        )
    )
    skills = {f.skill_id for f in result.findings}
    assert "material_loss" in skills and "hanging_piece" not in skills


@pytest.mark.parametrize("black", [False, True])
def test_free_queen_then_pawn_cleanup_is_not_defender_removal(black):
    result, _ = LocalClassifier().classify(
        evidence(
            "6k1/6q1/8/3P4/3Q4/8/6P1/6K1 w - - 0 1",
            ["d4f4", "g8h8", "f4f1", "h8h7"],
            ["g1f1", "g7d4", "f1e2", "d4d5", "e2e3", "d5d6"],
            0,
            -900,
            black,
        )
    )
    assert "removing_defender" not in {f.skill_id for f in result.findings}


@pytest.mark.parametrize("black", [False, True])
def test_checking_capture_can_deflect_the_king_from_its_rook(black):
    result, _ = LocalClassifier().classify(
        evidence(
            "6rk/8/1q4r1/8/8/8/P4RP1/6K1 b - - 0 1",
            ["g6g2", "g1h1", "b6f2", "a2a3", "h8h7"],
            ["h8h7", "g1f1", "h7h8", "f1e1"],
            900,
            0,
            black,
        )
    )
    assert "deflection" in {f.skill_id for f in result.findings}


@pytest.mark.parametrize("black", [False, True])
def test_defender_still_on_its_file_is_pinned_not_deflected(black):
    result, _ = LocalClassifier().classify(
        evidence(
            "4r3/5k2/8/6Q1/4n3/3P4/8/6K1 w - - 0 1",
            ["g5d5", "e8e6", "d3e4", "f7g6", "d5d3", "g6h6"],
            ["g5h4", "f7g8", "h4h3", "g8f7"],
            200,
            0,
            black,
        )
    )
    skills = {f.skill_id for f in result.findings}
    assert "pin" in skills and "deflection" not in skills


@pytest.mark.parametrize("black", [False, True])
def test_pinned_queen_is_traced_through_its_legal_capture(black):
    result, _ = LocalClassifier().classify(
        evidence(
            "5bk1/8/2n5/8/8/2Q5/8/4K3 b - - 0 1",
            ["f8b4", "c3b4", "c6b4", "e1d2", "g8f7", "d2c3"],
            ["g8f7", "c3c4", "f7g6", "c4d4"],
            800,
            0,
            black,
        )
    )
    pin = next(f for f in result.findings if f.skill_id == "pin")
    assert pin.plies == [1, 3] and pin.frame_ply == 1


def test_opponents_interposition_makes_a_previously_pinned_capture_available():
    payload = evidence(
        "3q2k1/4b3/5n2/6B1/4N3/8/8/6K1 w - - 0 1",
        ["g5f6", "e7f6", "g1f2", "g8f7"],
        ["g1f2", "f6e4", "f2e3", "g8f7", "e3f3", "f7e6"],
        0,
        -400,
    )
    payload["previous_move"] = {"fen": "3q1bk1/8/5n2/6B1/4N3/8/8/6K1 b - - 0 1", "uci": "f8e7"}
    result, _ = LocalClassifier().classify(payload)
    finding = next(f for f in result.findings if f.skill_id == "opponent_threat_recognition")
    assert "breaks a relative pin" in finding.explanation
