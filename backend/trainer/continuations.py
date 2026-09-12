"""Legal continuation replay and bounded, forward-only material endpoints.

A quiet endpoint describes this finite line. It is not proof that all defenses
lose material, or that a sacrifice lacks longer-term compensation.
"""

from typing import Literal

import chess
from pydantic import BaseModel

from trainer.chess_core import Candidate, legal_move, material, position_key, valid_board


class ContinuationEnd(BaseModel):
    end_ply: int
    material_delta: int | None = None
    reason: Literal["quiet", "too_short", "in_check", "exchange_unfinished"]
    extended_plies: int = 0
    saved_plies: int


def replay(board: chess.Board, candidate: Candidate) -> list[chess.Board]:
    boards = [board.copy(stack=True)]
    for uci in candidate.pv:
        following = boards[-1].copy(stack=True)
        following.push(legal_move(following, uci))
        boards.append(following)
    return boards


def balance(board: chess.Board, color: chess.Color) -> int:
    return material(board, color) - material(board, not color)


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


def settled_delta(boards, color, max_plies=16, extra_plies=16):
    endpoint = continuation_end(boards, color, max_plies, extra_plies)
    return endpoint.material_delta, endpoint.end_ply


def extended_line(board, candidate, analysis_id, probes):
    """Join explicitly linked native tails; keep the original root evaluation."""
    boards = replay(board, candidate)
    pv = list(candidate.pv)
    for probe in sorted(
        (p for p in probes if p["kind"] == "tail" and p["root_analysis_id"] == analysis_id),
        key=lambda p: p["at_ply"],
    ):
        if probe["at_ply"] != len(pv) or position_key(valid_board(probe["fen"])) != position_key(
            boards[-1]
        ):
            raise ValueError("Continuation probe does not match its saved parent endpoint")
        extra = Candidate.model_validate(probe["candidate"])
        continuation = replay(boards[-1], extra)
        boards.extend(continuation[1:])
        pv.extend(extra.pv)
    return candidate.model_copy(update={"pv": pv}), boards
