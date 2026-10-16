"""Legal continuation replay and bounded, forward-only material endpoints.

A quiet endpoint is a position where material cannot change at once: no check,
no capture or promotion just played, and no capture pending. It describes this
finite line. It is not proof that all defenses
lose material, or that a sacrifice lacks longer-term compensation.
"""

from typing import Literal

import chess
from pydantic import BaseModel

from trainer.chess_core import (
    VALUES,
    Candidate,
    material,
    position_key,
    replay_moves,
    valid_board,
)
from trainer.config import Settings
from trainer.errors import EvidenceIntegrityError

# The classifier's default extension past the settled horizon.
EXTENSION_PLIES = Settings.model_fields["classification_extension_plies"].default


class ContinuationEnd(BaseModel):
    end_ply: int
    material_delta: int | None = None
    reason: Literal["quiet", "too_short", "in_check", "exchange_unfinished", "capture_pending"]
    extended_plies: int = 0
    saved_plies: int


def replay(board: chess.Board, candidate: Candidate) -> list[chess.Board]:
    return replay_moves(board, candidate.pv)


def balance(board: chess.Board, color: chess.Color) -> int:
    return material(board, color) - material(board, not color)


def _value(board: chess.Board, move: chess.Move) -> int:
    """Material a move takes, with a promotion's gain over the pawn."""
    if board.is_en_passant(move):
        taken = 1
    else:
        piece = board.piece_at(move.to_square)
        taken = VALUES.get(piece.piece_type, 0) if piece else 0
    return taken + (VALUES[move.promotion] - 1 if move.promotion else 0)


def _recapture_gain(board: chess.Board, square: chess.Square) -> int:
    """What the side to move nets by recapturing on ``square`` with its least
    valuable legal capturer, and so on, each side free to stop (a legal-move swap)."""
    captures = [m for m in board.legal_moves if m.to_square == square and board.is_capture(m)]
    if not captures:
        return 0
    move = min(captures, key=lambda m: VALUES.get(board.piece_type_at(m.from_square), 100))
    gain = _value(board, move)
    after = board.copy(stack=False)
    after.push(move)
    return max(0, gain - _recapture_gain(after, square))


def static_exchange(board: chess.Board, move: chess.Move) -> int:
    """Material the side to move nets by ``move`` if the reply recaptures as well as
    it can (static exchange evaluation, legal moves only, so pins count)."""
    after = board.copy(stack=False)
    after.push(move)
    return _value(board, move) - _recapture_gain(after, move.to_square)


def capture_pending(board: chess.Board, following: chess.Move | None = None) -> bool:
    """Whether material can still change at once, so the position is not quiet.

    The standard quiet-position test: the side to move has a capture or promotion
    that wins material by static exchange. The saved line's own next move counts
    too when it captures, promotes or checks: the engine itself plays on.
    """
    if following is not None and (
        board.is_capture(following) or following.promotion or board.gives_check(following)
    ):
        return True
    return any(
        (board.is_capture(move) or move.promotion) and static_exchange(board, move) > 0
        for move in board.legal_moves
    )


def endpoint_reason(boards: list[chess.Board], end: int, color: chess.Color) -> str:
    if end < 3:
        return "too_short"
    if boards[end].is_check():
        return "in_check"
    if len({balance(b, color) for b in boards[end - 2 : end + 1]}) != 1 or any(
        boards[p - 1].is_capture(boards[p].peek()) or boards[p].peek().promotion
        for p in (end - 1, end)
    ):
        return "exchange_unfinished"
    following = boards[end + 1].peek() if end + 1 < len(boards) else None
    if capture_pending(boards[end], following):
        return "capture_pending"
    return "quiet"


def continuation_end(
    boards: list[chess.Board], color: chess.Color, initial_plies: int = 16, extra_plies: int = 16
) -> ContinuationEnd:
    if not boards or initial_plies < 3 or extra_plies < 0:
        raise ValueError(
            "Continuation requires a board, at least three plies and a nonnegative extension"
        )
    start = min(len(boards) - 1, initial_plies)
    hard_end = min(len(boards) - 1, initial_plies + extra_plies)
    # Never scan backwards: an earlier favorable balance may precede a recapture
    # already present in the saved line. Extend only an unfinished endpoint.
    for end in range(start, hard_end + 1):
        reason = endpoint_reason(boards, end, color)
        if reason == "quiet":
            break
    return ContinuationEnd(
        end_ply=end,
        material_delta=balance(boards[end], color) - balance(boards[0], color)
        if reason == "quiet"
        else None,
        reason=reason,
        extended_plies=end - start,
        saved_plies=len(boards) - 1,
    )


def settled_delta(boards, color, max_plies, extra_plies=EXTENSION_PLIES):
    endpoint = continuation_end(boards, color, max_plies, extra_plies)
    return endpoint.material_delta, endpoint.end_ply


def extended_line(board, candidate, analysis_id, probes):
    """Join explicitly linked native tails; keep the original root evaluation."""
    boards = replay(board, candidate)
    pv = list(candidate.pv)
    for probe in sorted(
        (p for p in probes if p.kind == "tail" and p.root_analysis_id == analysis_id),
        key=lambda p: p.at_ply,
    ):
        if probe.at_ply != len(pv) or position_key(valid_board(probe.fen)) != position_key(
            boards[-1]
        ):
            raise EvidenceIntegrityError(
                "Continuation probe does not match its saved parent endpoint"
            )
        extra = Candidate.model_validate(probe.candidate)
        continuation = replay(boards[-1], extra)
        boards.extend(continuation[1:])
        pv.extend(extra.pv)
    return candidate.model_copy(update={"pv": pv}), boards
