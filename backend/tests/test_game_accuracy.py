"""Lichess reference examples plus Fieldwork's saved-review boundary cases."""

import chess
import pytest
from trainer._vendor.lichess_accuracy import game_accuracy, move_accuracy, win_percent
from trainer.chess_core import Score
from trainer.game_accuracy import VERSION, accuracy_cp, review_accuracy


@pytest.mark.parametrize(
    "cps,white,black,tolerance",
    [
        ([15, 15], 100, 100, 1),
        ([-900, -900], 10, 100, 5),
        ([15, 900], 100, 10, 5),
        ([-900, 0], 10, 10, 5),
        ([15] * 20, 100, 100, 1),
        ([15] * 20 + [-900], 50, 100, 5),
        ([15] * 21 + [900], 100, 50, 5),
        ([-50, 15] * 5, 76, 76, 8),
        ([-50, 15] * 50, 76, 76, 8),
        ([-135, 15] * 50, 54, 54, 8),
        ([-435, 15] * 50, 20, 20, 8),
    ],
)
def test_published_lichess_game_examples(cps, white, black, tolerance):
    # Inputs, expected values and tolerances from the pinned AccuracyPercentTest.scala.
    result = game_accuracy(cps)
    assert result["white"] == pytest.approx(white, abs=tolerance)
    assert result["black"] == pytest.approx(black, abs=tolerance)


@pytest.mark.parametrize(
    "cps,white,black",
    [([15, 15], 100, 100), ([900, 900], 100, 10), ([15, -900], 10, 100), ([900, 0], 10, 10)],
)
def test_published_black_start_examples(cps, white, black):
    result = game_accuracy(cps, start_white=False)
    assert result["white"] == pytest.approx(white, abs=5)
    assert result["black"] == pytest.approx(black, abs=5)


def test_win_conversion_move_clamps_and_harmonic_floor():
    assert win_percent(0) == 50
    assert win_percent(100_000) == win_percent(1000)
    assert win_percent(-100_000) == win_percent(-1000)
    assert win_percent(-80) == pytest.approx(100 - win_percent(80))
    assert move_accuracy(50, 50) == move_accuracy(50, 60) == 100
    assert move_accuracy(50, 49.9) == 100  # Upstream one-point allowance.
    assert move_accuracy(100, 0) == 0
    # Both moves lose nearly all winning chances. Lichess floors the harmonic
    # inputs at 1, giving a game score of 0.5 rather than NaN or a division error.
    assert game_accuracy([-1000, 1000], initial_cp=1000) == {"white": 0.5, "black": 0.5}


@pytest.mark.parametrize("cps", [[], [15]])
@pytest.mark.parametrize("start_white", [True, False])
def test_short_games_need_both_players(cps, start_white):
    assert game_accuracy(cps, start_white=start_white) is None


@pytest.mark.parametrize("length", [2, 19, 20, 29, 30, 70, 79, 80, 81, 121])
def test_color_symmetry_at_window_boundaries(length):
    cps = ([25, 175, -40, 20, -700, -690, 5, 1800, 200, 22] * 13)[:length]
    original = game_accuracy(cps)
    flipped = game_accuracy([-cp for cp in cps], start_white=False, initial_cp=-15)
    assert original["white"] == pytest.approx(flipped["black"])
    assert original["black"] == pytest.approx(flipped["white"])
    assert all(0 <= value <= 100 for value in original.values())


@pytest.mark.parametrize(
    "score,expected",
    [
        (Score(kind="cp", value=123), 123),
        (Score(kind="mate", value=3), 1000),
        (Score(kind="mate", value=-3), -1000),
        (Score(kind="mate", value=0), -1000),
        (Score(kind="mate", value=0, mate_given=True), 1000),
    ],
)
def test_typed_mate_outcomes(score, expected):
    assert accuracy_cp(score) == expected
    assert accuracy_cp(score.negate()) == -expected


def reports(cps):
    return {ply: {"white_score": {"kind": "cp", "value": cp}} for ply, cp in enumerate(cps, 1)}


def test_saved_review_uses_adjacent_evaluations_and_standard_initial_value():
    saved = reports([-900, 0])
    saved[1]["best"] = {"score": {"kind": "cp", "value": 300}}
    result = review_accuracy(saved, total=2, starting_board=chess.Board(), completed=True)
    assert result == {"version": VERSION, **game_accuracy([-900, 0])}
    # Elo-sensitive labels and candidate scores are not game accuracy inputs.
    saved[1].update(label="Blunder", rating=2500, best={"score": {"kind": "cp", "value": 500}})
    assert review_accuracy(saved, total=2, starting_board=chess.Board(), completed=True) == result


def test_custom_black_start_uses_actual_initial_evaluation():
    board = chess.Board("4k3/8/8/8/8/8/4p3/4K3 b - - 0 12")
    saved = reports([15, 0])
    saved[1]["best"] = {"score": {"kind": "cp", "value": 400}}
    assert review_accuracy(saved, total=2, starting_board=board, completed=True) == {
        "version": VERSION,
        **game_accuracy([15, 0], start_white=False, initial_cp=-400),
    }


@pytest.mark.parametrize(
    "saved,total,completed",
    [
        (reports([15, 15]), 2, False),
        ({}, 0, True),
        (reports([15]), 1, True),
        (reports([15]), 2, True),
        ({1: reports([15])[1], 3: reports([15])[1]}, 2, True),
        (reports([15, 15, 15]), 2, True),
        ({1: {}, 2: reports([15])[1]}, 2, True),
        ({1: {"white_score": {"kind": "unknown", "value": 0}}, 2: reports([15])[1]}, 2, True),
    ],
)
def test_incomplete_missing_and_invalid_reports_never_get_accuracy(saved, total, completed):
    assert (
        review_accuracy(saved, total=total, starting_board=chess.Board(), completed=completed)
        is None
    )
