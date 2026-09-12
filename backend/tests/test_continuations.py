import chess
import pytest
from test_local_classifier import evidence
from trainer.chess_core import Candidate, valid_board
from trainer.continuations import continuation_end, replay
from trainer.local_classifier import LocalClassifier


def line(fen, moves, black=False):
    payload = evidence(fen, moves, moves, black=black)
    return replay(
        valid_board(payload["fen"]), Candidate.model_validate(payload["played_candidate"])
    )


@pytest.mark.parametrize("black", [False, True])
def test_forward_extension_includes_recapture_instead_of_temporary_gain(black):
    boards = line(
        "3r2k1/8/8/3p4/8/8/8/3R2K1 w - - 0 1",
        ["g1h2", "g8h7", "d1d5", "d8d5", "h2g3", "h7g6"],
        black,
    )
    end = continuation_end(boards, not black, initial_plies=3, extra_plies=3)
    assert (end.end_ply, end.material_delta, end.reason) == (6, -4, "quiet")
    assert end.extended_plies == 3 and end.saved_plies == 6
    limited = continuation_end(boards, not black, initial_plies=3, extra_plies=1)
    assert limited.end_ply == 4 and limited.material_delta is None
    assert limited.reason == "exchange_unfinished"


def test_quiet_endpoint_stays_put_and_never_searches_backwards():
    boards = line(
        "3r2k1/8/8/3p4/8/8/8/3R2K1 w - - 0 1",
        ["g1h2", "g8h7", "h2g3", "h7g6", "d1d5"],
    )
    assert continuation_end(boards, chess.WHITE, 3, 10).end_ply == 3
    tail = continuation_end(boards, chess.WHITE, 5, 10)
    assert tail.material_delta is None and tail.end_ply == 5


def test_check_promotion_and_short_line_have_explicit_reasons():
    boards = line("6k1/P7/8/8/8/8/8/6K1 w - - 0 1", ["g1h2", "g8h7", "a7a8q", "h7g6", "a8h8"])
    end = continuation_end(boards, chess.WHITE, 3, 0)
    assert end.reason == "exchange_unfinished"
    end = continuation_end(boards, chess.WHITE, 3, 2)
    assert end.material_delta == 8 and end.end_ply == 5
    assert continuation_end(boards[:3], chess.WHITE).reason == "too_short"
    checking = line("6k1/8/8/8/8/8/8/R5K1 w - - 0 1", ["g1h2", "g8h7", "a1a7"])
    assert continuation_end(checking, chess.WHITE, 3).reason == "in_check"


def test_classification_records_endpoints_and_extension_budget(settings):
    settings.classification_max_plies = 4
    settings.classification_extension_plies = 2
    result, _ = LocalClassifier(settings).classify(evidence())
    assert result.continuations["best"].end_ply == 5
    assert result.continuations["best"].extended_plies == 1
    assert result.continuations["best"].material_delta == 5
    settings.classification_extension_plies = 0
    limited, _ = LocalClassifier(settings).classify(evidence())
    assert not limited.outcomes and "continuation_unsettled" in limited.abstention_reasons
