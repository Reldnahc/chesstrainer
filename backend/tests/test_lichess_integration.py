"""Regression contracts for upstream recognition versus supported mistake evidence."""

import pytest
from test_local_classifier import evidence
from trainer.chess_core import Candidate, valid_board
from trainer.continuations import replay
from trainer.local_classifier import LocalClassifier
from trainer.tactical_patterns import recognized_patterns
from trainer.verified_patterns import detect_patterns as old_patterns


@pytest.mark.parametrize("black", [False, True])
def test_lichess_adds_pin_exploitation_without_requiring_capture_on_the_pinned_square(black):
    # Qf5 forks the rooks. The e7 knight attacks f5 but is pinned to its king,
    # allowing the queen to use that square. Scores are synthetic contract data.
    payload = evidence(
        "4k3/4n3/8/r6r/8/7Q/8/4R1K1 w - - 0 1",
        ["h3f5", "a5a8", "f5h5", "e8d8", "h5h3", "d8c7"],
        ["h3g2", "e8d8", "g2f1", "d8c8"],
        500,
        0,
        black,
    )
    boards = replay(
        valid_board(payload["fen"]), Candidate.model_validate(payload["best_candidates"][0])
    )
    old = old_patterns(
        boards,
        1,
        len(boards) - 1,
        "best",
        "missed_opportunity",
        material_supported=True,
        mate_supported=False,
    )
    assert "pin" not in {item.skill_id for item in old}
    result, _ = LocalClassifier().classify(payload)
    pin = next(f for f in result.findings if f.skill_id == "pin")
    assert pin.rule_id.startswith("lichess:pin_prevents_attack:8d9faff6:")
    assert pin.frame_ply == 1 and pin.plies == [1]
    assert pin.roles["pinned_defender"] == (["e2"] if black else ["e7"])
    assert pin.roles["target"] == (["f4"] if black else ["f5"])
    assert "missed_material_gain" in {f.skill_id for f in result.findings}


def test_visible_double_check_is_recognized_without_claiming_a_verified_mistake():
    payload = evidence(
        "4k3/8/8/8/8/8/4B3/4R1K1 w - - 0 1",
        ["e2b5"],
        ["e2f1"],
        300,
        290,
    )
    boards = replay(
        valid_board(payload["fen"]), Candidate.model_validate(payload["best_candidates"][0])
    )
    raw = recognized_patterns(boards, 1, 1, "best", "missed_opportunity")
    assert any(f.skill_id == "double_attack" and f.rule_id.startswith("lichess:") for f in raw)
    result, _ = LocalClassifier().classify(payload)
    assert result.primary_skill == "unclassified"
    assert not result.findings and not result.outcomes
