"""Opening recognition is factual, position-specific, and separate from quality."""

import copy
import hashlib
import json
from importlib.resources import files

import chess
import pytest
from trainer._vendor import lichess_openings
from trainer.explanations import replay_line
from trainer.game_accuracy import review_accuracy
from trainer.game_review import public_report
from trainer.opening_book import VERSION, book_move


def before_last(line):
    board = chess.Board()
    for san in line.split()[:-1]:
        board.push_san(san)
    return board, board.parse_san(line.split()[-1])


def test_bundled_catalogue_matches_pinned_upstream():
    root = files(lichess_openings)
    manifest = json.loads(root.joinpath("UPSTREAM.json").read_text())
    assert manifest["commit"] == lichess_openings.COMMIT
    assert manifest["license"] == "CC0-1.0"
    assert set(manifest["files"]) == {"a.tsv", "b.tsv", "c.tsv", "d.tsv", "e.tsv", "COPYING.txt"}
    for name, expected in manifest["files"].items():
        assert hashlib.sha256(root.joinpath(name).read_bytes()).hexdigest() == expected


@pytest.mark.parametrize(
    "line,name",
    [
        ("e4 e5 Nf3 Nc6 Bc4", "Italian Game"),
        ("e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6", "Najdorf"),
        ("e4 e5 Ke2", "Bongcloud"),
        ("e4 e5 Nf3 f6", "Damiano"),
        ("f3 e5 g4 Qh4#", "Fool's Mate"),
    ],
)
def test_recognizes_common_and_unsound_named_openings(line, name):
    board, move = before_last(line)
    result = book_move(board.fen(), move.uci())
    assert result["version"] == VERSION
    assert name in result["name"]
    assert result["eco"]


def test_transpositions_and_move_counters_share_recognition():
    first, move = before_last("Nf3 d5 d4 Nf6 c4")
    second, other = before_last("d4 Nf6 Nf3 d5 c4")
    assert first.epd() == second.epd()
    expected = book_move(first.fen(), move.uci())
    assert expected is not None
    second.halfmove_clock, second.fullmove_number = 7, 12
    assert book_move(second.fen(), other.uci()) == expected


def test_names_do_not_make_every_following_move_book_and_position_rights_matter():
    board, move = before_last("e4 e5 Ke2 Nc6")
    assert book_move(board.fen(), move.uci()) is None
    assert book_move(chess.STARTING_FEN, "e2e5") is None  # Illegal, even in the opening.
    board, move = before_last("e4 e5 Nf3 Nc6 Bc4")
    board.castling_rights = 0
    assert book_move(board.fen(), move.uci()) is None
    endgame = chess.Board("4k3/8/8/8/8/8/4P3/4K3 w - - 0 1")
    assert book_move(endgame.fen(), "e2e4") is None


def saved_report(board, move, value):
    actual = {"uci": move.uci(), "san": board.san(move), "score": {"kind": "cp", "value": value}}
    return {
        "best": {"uci": "g1f3", "score": {"kind": "cp", "value": 25}},
        "actual": actual,
        "opportunity_missed": False,
        "sacrifice": None,
        "legal_count": board.legal_moves.count(),
        "second_score": {"kind": "cp", "value": 0},
        "previous_score": None,
        "actual_line": {
            "findings": [],
            "frames": [frame.model_dump() for frame in replay_line(board, [move.uci()])],
        },
        "white_score": {"kind": "cp", "value": value if board.turn else -value},
    }


def test_book_overrides_bad_quality_without_mutating_saved_evidence_or_accuracy():
    board = chess.Board()
    saved = {}
    for ply, (san, score) in enumerate([("e4", 25), ("e5", 0), ("Ke2", -300)], 1):
        move = board.parse_san(san)
        saved[ply] = saved_report(board, move, score)
        board.push(move)
    untouched = copy.deepcopy(saved)
    for rating in [400, 2500]:
        public = {ply: public_report(report, rating) for ply, report in saved.items()}
        assert all(report["label"] == "Book" for report in public.values())
        assert public[3]["engine_label"] == "Blunder"
        assert "Bongcloud" in public[3]["coach"]
        assert public[3]["white_score"] == saved[3]["white_score"]
        arguments = {"total": 3, "starting_board": chess.Board(), "completed": True}
        assert review_accuracy(public, **arguments) == review_accuracy(saved, **arguments)
        assert review_accuracy(public, **arguments)["white"] < 100
    assert saved == untouched
