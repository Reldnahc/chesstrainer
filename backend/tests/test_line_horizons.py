"""Every reader of a saved line reads it to one horizon, and shows what it read."""

import random

import chess
import pytest
from trainer import game_review
from trainer.chess_core import Candidate
from trainer.classification_stages import line_parameters, line_rules
from trainer.continuations import continuation_end, replay, settled_delta


def random_line(seed, plies=40):
    rng = random.Random(seed)
    board = chess.Board()
    for _ in range(12):
        board.push(rng.choice(list(board.legal_moves)))
    walk, pv = board.copy(), []
    while len(pv) < plies and not walk.is_game_over():
        move = rng.choice(list(walk.legal_moves))
        pv.append(move.uci())
        walk.push(move)
    first = chess.Move.from_uci(pv[0])
    candidate = Candidate.model_validate(
        {"uci": pv[0], "san": board.san(first), "pv": pv, "score": {"kind": "cp", "value": 40}}
    )
    return board, candidate


@pytest.mark.parametrize("seed", range(12))
def test_review_explanation_and_classifier_settle_a_line_at_the_same_ply(seed):
    board, candidate = random_line(seed)
    parameters = line_parameters()
    rules = line_rules(parameters)
    review = game_review.line_evidence(board, candidate, "a", 2, parameters=parameters)
    boards = replay(board, candidate)
    classifier = continuation_end(
        boards, board.turn, parameters["max_plies"], parameters["extension_plies"]
    )
    explanation = settled_delta(
        boards[: rules.shown_plies + 1],
        board.turn,
        max_plies=rules.settle_plies,
        extra_plies=rules.extension_plies,
    )
    assert review["material_delta"] == classifier.material_delta == explanation[0]
    # The shown line reaches the farthest ply any reading can rest on, and no further.
    assert len(review["frames"]) - 1 == min(len(candidate.pv), rules.shown_plies)
    assert classifier.end_ply <= rules.shown_plies
    assert review["horizon"] == parameters


def test_a_configured_horizon_reaches_the_review_and_is_recorded():
    board, candidate = random_line(3)
    parameters = line_parameters() | {"max_plies": 6, "extension_plies": 4}
    line = game_review.line_evidence(board, candidate, "a", 1, parameters=parameters)
    assert len(line["frames"]) - 1 == 10
    assert line["horizon"] == parameters
    report = {"actual_line": line, "best_line": line}
    assert game_review.lines_current(report, parameters)
    assert not game_review.lines_current(report)


def test_both_review_lines_read_the_move_before(monkeypatch):
    board, best = random_line(5)
    other = next(m for m in board.legal_moves if m.uci() != best.uci)
    played = Candidate.model_validate(
        {
            "uci": other.uci(),
            "san": board.san(other),
            "pv": [other.uci()],
            "score": {"kind": "cp", "value": 0},
        }
    )
    seen = []
    real = game_review.line_evidence

    def spy(board, candidate, analysis_id, first, previous=None, parameters=None):
        seen.append(previous)
        return real(board, candidate, analysis_id, first, previous, parameters)

    monkeypatch.setattr(game_review, "line_evidence", spy)
    game_review.review_lines(board, best, played, "b", "a", True)
    before = board.copy(stack=True)
    last = before.pop()
    expected = {"fen": before.fen(), "uci": last.uci()}
    assert seen == [expected, expected]


def test_a_report_saved_before_the_shared_horizon_is_read_again_without_a_search():
    board, candidate = random_line(7)
    old_line = {"frames": [], "findings": [], "material_delta": None, "settled": False}
    report = {
        "best": candidate.model_dump(),
        "actual": candidate.model_dump(),
        "before_analysis_id": "b",
        "played_analysis_id": "a",
        "actual_line": old_line,
        "best_line": old_line,
        "opportunity_missed": False,
    }
    assert not game_review.lines_current(report)
    reread = game_review.reread_lines(report, board)
    assert game_review.lines_current(reread)
    fresh = game_review.line_evidence(board, candidate, "a", 1, game_review.previous_move(board))
    assert reread["actual_line"] == fresh and reread["best_line"] == fresh
