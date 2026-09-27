import json

import chess
import pytest

from scripts.review_benchmark.corpus import board_for, load_corpus
from scripts.review_benchmark.games import game_corpus
from scripts.review_benchmark.metrics import peak_rss_bytes, summary


def test_corpus_preserves_legal_histories_and_domains():
    corpus = load_corpus()
    assert len(corpus["positions"]) >= 12
    assert len(corpus["ratings"]) >= 4
    assert {item["platform"] for item in corpus["positions"]} == {"chesscom", "lichess", "unknown"}
    for item in corpus["positions"]:
        board = board_for(item)
        assert chess.Move.from_uci(item["played"]) in board.legal_moves
        assert len(board.move_stack) == len(item["context"]["moves"])
    by_id = {item["id"]: item for item in corpus["positions"]}
    repeated = board_for(by_id["repeated-start"])
    assert repeated.is_repetition(2)
    assert repeated.board_fen() == chess.Board().board_fen()
    assert by_id["repeated-start"]["context"] != by_id["first-move"]["context"]


def test_corpus_rejects_illegal_sequence(tmp_path):
    path = tmp_path / "bad.json"
    path.write_text(
        json.dumps({"positions": [{"id": "illegal", "moves": "e2e5", "played": "a2a3"}]})
    )
    with pytest.raises(ValueError, match="legal"):
        load_corpus(path)


def test_measurements_are_explicit_about_unavailable_values():
    assert summary([])["median_seconds"] is None
    assert summary([1, 2, 3])["median_seconds"] == 2
    memory = peak_rss_bytes()
    assert memory is None or memory > 0


def test_whole_game_corpus_has_legal_outcomes_full_history_and_distinct_metadata():
    import io

    import chess.pgn
    from trainer.human_models.context import request_for
    from trainer.review_intelligence.clocks import clock_facts

    domains, ratings, coverage = set(), set(), set()
    corpus = game_corpus()
    assert len({item["id"] for item in corpus}) == len(corpus)
    for item in corpus:
        game = chess.pgn.read_game(io.StringIO(item["pgn"]))
        assert not game.errors
        board = game.board()
        assert board.is_valid()
        moves = list(game.mainline_moves())
        assert len(moves) == item["plies"]
        for move in moves:
            assert not board.is_game_over() and move in board.legal_moves
            board.push(move)
        if board.is_game_over():
            assert game.headers["Result"] == board.result()
        request = request_for(game, game.board(), 1000)
        domains.add(request.domain.alignment)
        ratings.add(request.conditioning.self_rating)
        coverage.update(item["coverage"])
        if item["id"] == "mate-low-clock":
            assert clock_facts(game)[3].before_band == "critical"
    assert domains == {"unknown", "related", "shifted"}
    assert {600, 1200, 1800, 2400} <= ratings
    assert {"winning_conversion", "failed_conversion", "draw", "recovery", "quiet"} <= coverage


@pytest.mark.stockfish
def test_native_benchmark_has_cache_parity_and_isolated_evidence(stockfish_path):
    from scripts.review_benchmark.stockfish import run

    corpus = load_corpus()
    corpus["positions"] = [
        next(item for item in corpus["positions"] if item["id"] == "finish-mate")
    ]
    result = run(corpus, stockfish_path)
    assert result["cache_hits"] > 0
    assert result["cache_misses"] > 0
    assert result["cached_output_equal"]
    assert result["limits"]["deep_depth"] == 16
    assert result["limits"]["deep_time"] == 0.8
    assert result["passes"][0]["rows"][0]["report"]["actual"]["score"]["kind"] == "mate"
