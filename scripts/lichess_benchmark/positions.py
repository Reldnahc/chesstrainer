"""Adapt Lichess setup/solver moves with python-chess; never invent engine scores."""

from dataclasses import dataclass

import chess
from trainer.chess_core import legal_move, valid_board

from .dataset import PuzzleRow

# A malformed local row must not request an unbounded copied board history.
# This is a data-safety limit, not a puzzle difficulty or rating filter.
MAX_SOLUTION_PLIES = 256


class ReconstructionError(ValueError):
    def __init__(self, reason: str, detail: str):
        self.reason = reason
        super().__init__(detail)


@dataclass
class PuzzleLine:
    row: PuzzleRow
    initial_fen: str
    setup_uci: str
    setup_san: str
    boards: list[chess.Board]
    solution_uci: list[str]
    solution_san: list[str]

    @property
    def solver(self) -> chess.Color:
        return self.boards[0].turn


def reconstruct(row: PuzzleRow) -> PuzzleLine:
    if row.problem:
        raise ReconstructionError(row.problem, "CSV field count does not match its header")
    variant = row.fields.get("Variant", row.fields.get("Rules", "standard")).lower()
    if variant not in {"", "standard", "chess"}:
        raise ReconstructionError("unsupported_variant", f"Unsupported variant: {variant}")
    moves = row.fields.get("Moves", "").split()
    if len(moves) < 2:
        raise ReconstructionError(
            "missing_solution", "Need an opponent setup move and a solver move"
        )
    if len(moves) - 1 > MAX_SOLUTION_PLIES:
        raise ReconstructionError(
            "solution_too_long", f"More than {MAX_SOLUTION_PLIES} solution plies"
        )
    initial = row.fields.get("FEN", "")
    try:
        board = valid_board(initial)
    except ValueError as exc:
        raise ReconstructionError("invalid_fen", str(exc)) from exc
    boards, sans = [], []
    setup_san = ""
    for index, uci in enumerate(moves):
        try:
            move = legal_move(board, uci)
            san = board.san(move)
        except ValueError as exc:
            raise ReconstructionError(
                "illegal_setup" if index == 0 else "illegal_solution",
                f"Moves token {index + 1} ({uci}): {exc}",
            ) from exc
        board.push(move)
        if index == 0:
            setup_san = san
        else:
            sans.append(san)
        boards.append(board.copy(stack=True))
    return PuzzleLine(row, initial, moves[0], setup_san, boards, moves[1:], sans)
