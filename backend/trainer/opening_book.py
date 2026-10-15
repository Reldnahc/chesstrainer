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


_lines = None
_lines_lock = Lock()


def catalogue_lines():
    """Every bundled Lichess opening as (eco, name, initial FEN, UCI moves), in order.

    Parsing is most of the cost, so the book index and the opening-study
    catalogue share this one pass, done once under a lock. Only plain values
    are kept, not the parsed PGN trees.
    """
    global _lines
    with _lines_lock:
        if _lines is None:
            lines = []
            for volume in "abcde":
                path = files(lichess_openings).joinpath(f"{volume}.tsv")
                text = path.read_text(encoding="utf-8")
                for row in csv.DictReader(io.StringIO(text), delimiter="	"):
                    game = chess.pgn.read_game(io.StringIO(row["pgn"]))
                    if game is None or game.errors:
                        raise ValueError(f"Invalid bundled opening: {row['name']}")
                    moves = tuple(move.uci() for move in game.mainline_moves())
                    lines.append((row["eco"], row["name"], game.board().fen(), moves))
            _lines = tuple(lines)
        return _lines


@cache
def _index():
    positions = set()
    names = {}
    for eco, name, initial_fen, moves in catalogue_lines():
        board = chess.Board(initial_fen)
        for uci in moves:
            board.push_uci(uci)
            positions.add(position_key(board))
        # A few positions have aliases. Keep the catalogue's stable order.
        names.setdefault(position_key(board), (eco, name))
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


def book_run(parsed):
    """A game's book moves and where it leaves the catalogue for good.

    Returns ({ply: book match}, the ply after the last book move, or None when the
    game ends in book). A move outside the catalogue followed by a return to it by
    transposition is not a departure: the badge, the review's departure event and
    Insights all read this one rule. Plies past the longest catalogued line cannot
    be book, so the walk stops there.
    """
    board = parsed.board()
    matches = {}
    total = 0
    for ply, move in enumerate(parsed.mainline_moves(), 1):
        total = ply
        if ply <= _longest_line():
            opening = book_move(board.fen(), move.uci())
            if opening is not None:
                matches[ply] = opening
        board.push(move)
    departure = max(matches, default=0) + 1
    return matches, departure if departure <= total else None


@cache
def _longest_line():
    """Plies in the longest catalogued line; no later move can reach a book position."""
    return max(len(moves) for _, _, _, moves in catalogue_lines())
