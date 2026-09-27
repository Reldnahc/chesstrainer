"""Legal full-history inputs shared by native model and review benchmarks."""

import json
from pathlib import Path

import chess
from trainer.chess_core import engine_context, legal_move

CORPUS_PATH = Path(__file__).with_name("corpus.json")


def load_corpus(path=CORPUS_PATH):
    corpus = json.loads(Path(path).read_text(encoding="utf-8"))
    ids = set()
    for item in corpus["positions"]:
        if item["id"] in ids:
            raise ValueError("Duplicate benchmark position identity")
        ids.add(item["id"])
        board = board_for(item)
        legal_move(board, item["played"])
        item["context"] = engine_context(board)
    return corpus


def board_for(item):
    board = chess.Board(item.get("root", chess.STARTING_FEN))
    if not board.is_valid():
        raise ValueError("Invalid benchmark root")
    for uci in item["moves"].split():
        if board.is_game_over():
            raise ValueError("Benchmark continues after game end")
        board.push(legal_move(board, uci))
    return board
