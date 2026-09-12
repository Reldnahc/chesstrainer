import chess
import pytest
from test_local_classifier import evidence
from trainer.local_classifier import LocalClassifier

COMBINATIONS = [
    (
        "fork",
        "r3k3/6p1/5n2/1N4B1/8/8/8/6K1 w - - 0 1",
        ["g5f6", "g7f6", "b5c7", "e8d7", "c7a8", "d7c6", "a8c7", "c6b6"],
        ["g5h4", "e8d7", "b5c3", "d7c6", "h4e1", "c6b6"],
        [3, 5],
    ),
    (
        "discovered_attack",
        "q5k1/8/8/8/B7/8/8/R5K1 w - - 0 1",
        ["a4b5", "g8f7", "a1a8", "f7e6", "a8a1", "e6f5"],
        ["a1b1", "g8f7", "a4b3", "f7g6"],
        [1, 3],
    ),
    (
        "double_attack",
        "q5k1/8/2n5/8/B7/8/8/R5K1 w - - 0 1",
        ["a4b5", "c6d4", "a1a8", "g8f7", "b5c4", "f7g6"],
        ["a1b1", "g8f7", "a4b3", "f7g6"],
        [1, 3],
    ),
    (
        "deflection",
        "4k3/8/5n2/3q1B2/8/8/8/3R2K1 w - - 0 1",
        ["f5d7", "f6d7", "d1d5", "e8f7", "d5d1", "f7e6"],
        ["f5h3", "e8f7", "d1c1", "f7g6"],
        [1, 2, 3],
    ),
]


@pytest.mark.parametrize("black", [False, True])
@pytest.mark.parametrize("skill,fen,best,actual,plies", COMBINATIONS)
def test_connected_combination_witnesses(skill, fen, best, actual, plies, black):
    payload = evidence(fen, best, actual, 800, 0, black)
    result, _ = LocalClassifier().classify(payload)
    finding = next(f for f in result.findings if f.skill_id == skill)
    assert finding.plies == plies
    assert finding.actor == ("black" if black else "white")
    assert finding.moves == [payload["best_candidates"][0]["pv"][p - 1] for p in plies]
    assert finding.roles and finding.rule_id.endswith(f":{LocalClassifier.version}")


@pytest.mark.parametrize("black", [False, True])
def test_quiet_gap_prevents_attributing_a_later_fork(black):
    result, _ = LocalClassifier().classify(
        evidence(
            "r7/3k4/8/1N6/8/8/8/6K1 w - - 0 1",
            ["g1h2", "d7e8", "b5c7", "e8d7", "c7a8", "d7c6", "a8c7", "c6b6"],
            ["b5a3", "a8a3", "g1f2", "a3a2", "f2e3", "a2a1"],
            500,
            -500,
            black,
        )
    )
    assert "fork" not in {f.skill_id for f in result.findings}


CAUSE_FEN = "6k1/8/8/q7/8/8/2N5/R5K1 w - - 0 1"
CAUSE_BEST = ["a1a5", "g8f7", "a5a1", "f7e6"]
CAUSE_ACTUAL = ["c2e3", "a5a1", "g1f2", "a1a4", "f2g3", "a4b4"]


@pytest.mark.parametrize("black", [False, True])
def test_abandoned_defender_and_opponents_previous_threat(black):
    payload = evidence(CAUSE_FEN, CAUSE_BEST, CAUSE_ACTUAL, 900, -500, black)
    previous = chess.Board("6k1/8/8/1q6/8/8/2N5/R5K1 b - - 0 1")
    if black:
        previous = previous.mirror()
    payload["previous_move"] = {"fen": previous.fen(), "uci": "b4a4" if black else "b5a5"}
    result, _ = LocalClassifier().classify(payload)
    found = {f.skill_id: f for f in result.findings}
    assert {"abandoned_defender", "opponent_threat_recognition"} <= found.keys()
    assert found["abandoned_defender"].frame_ply == 0
    assert found["opponent_threat_recognition"].context_move == payload["previous_move"]["uci"]
    assert "newly attacks" in found["opponent_threat_recognition"].explanation


def test_extra_defender_and_existing_attack_are_not_new_causes():
    payload = evidence(CAUSE_FEN.replace("2N5", "1BN5"), CAUSE_BEST, CAUSE_ACTUAL, 900, -500)
    result, _ = LocalClassifier().classify(payload)
    assert "abandoned_defender" not in {f.skill_id for f in result.findings}
    payload = evidence(CAUSE_FEN, CAUSE_BEST, CAUSE_ACTUAL, 900, -500)
    payload["previous_move"] = {
        "fen": "6k1/8/q7/8/8/8/2N5/R5K1 b - - 0 1",
        "uci": "a6a5",
    }
    result, _ = LocalClassifier().classify(payload)
    assert "opponent_threat_recognition" not in {f.skill_id for f in result.findings}


@pytest.mark.parametrize("black", [False, True])
def test_bad_trade_counts_actual_capture_and_recapture(black):
    result, _ = LocalClassifier().classify(
        evidence(
            "3r2k1/8/8/3p4/8/8/8/3R2K1 w - - 0 1",
            ["g1h2", "g8h7", "h2g3", "h7g6"],
            ["d1d5", "d8d5", "g1f2", "g8f7", "f2e3", "f7e6"],
            0,
            -400,
            black,
        )
    )
    finding = next(f for f in result.findings if f.skill_id == "avoiding_bad_trades")
    assert finding.plies == [1, 2] and "4 material points" in finding.explanation


def test_corrupt_previous_context_rejected():
    payload = evidence(CAUSE_FEN, CAUSE_BEST, CAUSE_ACTUAL, 900, -500)
    payload["previous_move"] = {"fen": chess.STARTING_FEN, "uci": "e2e4"}
    with pytest.raises(ValueError, match="Previous move"):
        LocalClassifier().classify(payload)
