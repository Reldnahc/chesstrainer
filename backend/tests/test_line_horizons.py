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
    # The shown line stops where every reader settles it: the material claim and
    # the findings rest there, and nothing past it is shown.
    assert len(review["frames"]) - 1 == classifier.end_ply == explanation[1]
    assert all(max(f["plies"]) <= classifier.end_ply for f in review["findings"])
    assert review["horizon"] == parameters | {"reading": game_review.LINE_READING}


def test_a_configured_horizon_reaches_the_review_and_is_recorded():
    board, candidate = random_line(3)
    parameters = line_parameters() | {"max_plies": 6, "extension_plies": 4}
    line = game_review.line_evidence(board, candidate, "a", 1, parameters=parameters)
    assert 6 <= len(line["frames"]) - 1 <= 10
    assert game_review.without_reading(line["horizon"]) == parameters
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


def test_a_forced_mate_is_shown_through_the_mate():
    # 1.f3 e5 2.g4 Qh4#: the mating line is shown to the mate, past a quiet endpoint.
    board = chess.Board()
    board.push_uci("f2f3")
    pv = ["e7e5", "g2g4", "d8h4"]
    mate = Candidate.model_validate(
        {"uci": pv[0], "san": "e5", "pv": pv, "score": {"kind": "mate", "value": 2}}
    )
    rules = line_rules()
    assert rules.shown(mate, 1) == pv
    plain = mate.model_copy(update={"score": {"kind": "cp", "value": 900}})
    assert rules.shown(Candidate.model_validate(plain.model_dump()), 1) == pv[:1]


def test_play_renders_old_rows_to_the_configured_horizon():
    from review_intelligence_fixtures import move_report
    from trainer.models import PlayGame
    from trainer.play.sessions import parsed_for, rendered_reports

    board, _ = random_line(9)
    moves = [m.uci() for m in board.move_stack]
    reports, replayed = {}, chess.Board()
    for ply, uci in enumerate(moves, 1):
        reports[str(ply)] = move_report(replayed, played=uci)
        replayed.push_uci(uci)
    play = PlayGame(
        id="old-play-rows",
        coach_name="Coach",
        learner_color=True,
        opponent_rating=1200,
        learner_rating=1200,
        moves=moves,
        reports=reports,
        status="active",
    )
    parameters = line_parameters() | {"max_plies": 4, "extension_plies": 0}
    rendered = rendered_reports(play, parsed_for(play, "Learner"), parameters)
    assert all(game_review.lines_current(report, parameters) for report in rendered.values())


def test_review_and_classifier_agree_at_the_last_ply_of_a_long_line():
    # A line longer than the horizon whose next saved move is an equal rook trade:
    # every reader sees that move, so none settles at the horizon's last ply.
    board = chess.Board("3rk3/8/8/8/8/8/8/3RK3 w - - 0 1")
    pv = ["e1e2", "e8e7", "e2e1", "e7e8", "d1d8", "e8d8"]
    candidate = Candidate.model_validate(
        {"uci": pv[0], "san": "Ke2", "pv": pv, "score": {"kind": "cp", "value": 0}}
    )
    parameters = line_parameters() | {"max_plies": 4, "extension_plies": 0}
    review = game_review.line_evidence(board, candidate, "a", 1, parameters=parameters)
    classifier = continuation_end(replay(board, candidate), board.turn, 4, 0)
    assert classifier.reason == "capture_pending"
    assert review["material_delta"] == classifier.material_delta is None
