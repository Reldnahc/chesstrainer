"""Recognize opening moves from bundled public data, independently of evaluation."""

import csv
import io
from functools import cache
from importlib.resources import files
from threading import Lock

import chess
import chess.pgn

from trainer._vendor import lichess_openings
from trainer.chess_core import position_key

VERSION = f"lichess-openings-{lichess_openings.COMMIT[:8]}-1"
_load_lock = Lock()


@cache
def catalogue_lines():
    """Every bundled Lichess opening as (row, parsed game), in catalogue order.

    Parsing is most of the cost, so the book index and the opening-study
    catalogue share this one pass.
    """
    lines = []
    for volume in "abcde":
        text = files(lichess_openings).joinpath(f"{volume}.tsv").read_text(encoding="utf-8")
        for row in csv.DictReader(io.StringIO(text), delimiter="\t"):
            game = chess.pgn.read_game(io.StringIO(row["pgn"]))
            if game is None or game.errors:
                raise ValueError(f"Invalid bundled opening: {row['name']}")
            lines.append((row, game))
    return tuple(lines)


@cache
def _index():
    positions = set()
    names = {}
    for row, game in catalogue_lines():
        board = game.board()
        for move in game.mainline_moves():
            board.push(move)
            positions.add(position_key(board))
        # A few positions have aliases. Keep the catalogue's stable order.
        names.setdefault(position_key(board), (row["eco"], row["name"]))
    return positions, names


def book_move(fen: str, uci: str) -> dict | None:
    """Match a legal move from this position, allowing transposed move orders.

    A move is book when it reaches a position some catalogued line passes
    through, by any move order: 1.Nc3 e5 2.e4 reaches the Vienna Game. Move
    counters do not identify an opening; turn, castling rights and legal
    en-passant rights do. An opening name elsewhere in the game is not enough.
    """
    board = chess.Board(fen)
    move = chess.Move.from_uci(uci)
    if move not in board.legal_moves:
        return None
    # cache() alone allows duplicate first loads from concurrent review readers.
    with _load_lock:
        positions, names = _index()
    before = position_key(board)
    board.push(move)
    after = position_key(board)
    if after not in positions:
        return None
    opening = names.get(after) or names.get(before)
    return {
        "version": VERSION,
        "eco": opening[0] if opening else None,
        "name": opening[1] if opening else None,
    }
