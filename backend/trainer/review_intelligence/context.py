"""Structured mainline metadata; arbitrary branches never inherit recorded clocks."""

from dataclasses import dataclass

import chess

from trainer.chess_core import digest
from trainer.opening_book import VERSION as BOOK_VERSION
from trainer.opening_book import book_move
from trainer.review_intelligence.clocks import clock_facts
from trainer.review_intelligence.events_types import ClockFacts


@dataclass(frozen=True)
class MoveContext:
    ply: int
    pgn_digest: str
    before_fen: str
    uci: str
    clock: ClockFacts
    opening_departure: dict | None = None


def move_contexts(parsed):
    clocks = clock_facts(parsed)
    pgn_key = digest(str(parsed))
    board = parsed.board()
    opening = board.fen() == chess.STARTING_FEN
    last_book = None
    output = {}
    for ply, move in enumerate(parsed.mainline_moves(), 1):
        matched = book_move(board.fen(), move.uci()) if opening else None
        departure = None
        if opening and not matched:
            departure = {
                "catalogue": BOOK_VERSION,
                "previous_book_ply": ply - 1,
                "previous_name": last_book.get("name") if last_book else None,
            }
            opening = False
        if matched:
            last_book = matched
        output[ply] = MoveContext(ply, pgn_key, board.fen(), move.uci(), clocks[ply], departure)
        board.push(move)
    return output
