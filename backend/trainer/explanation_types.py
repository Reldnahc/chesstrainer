"""What an explanation says about a move, and the legal replay of a saved line.

Shared by Review explanations, opening recall and game review, below all of them.
"""

from typing import Literal

import chess
from pydantic import BaseModel, Field

from trainer.chess_core import Score, legal_move, material
from trainer.diagnosis_types import Finding
from trainer.errors import InvalidInput
from trainer.models import Attempt

# Both explanation paths refuse alike.
SOLVE_FIRST = "Solve the position or use Reveal move before opening the solution"
NO_SOLUTION = "No saved solution is available"


def attempt_for(db, session, attempt_id=None):
    """The attempt an explanation is about: the one asked for, else the session's latest."""
    attempt_id = attempt_id or session.last_attempt_id
    attempt = db.get(Attempt, attempt_id) if attempt_id else None
    if attempt is None or attempt.session_id != session.id:
        raise InvalidInput("Submit a move in this review before asking for its explanation")
    return attempt


SummaryKind = Literal[
    "mate_for_mover",
    "mate_against_mover",
    "material_gain",
    "material_loss",
    "engine_accepted",
    "engine_rejected",
    "curated_accepted",
    "curated_rejected",
    "frame",
]
NoteKind = Literal[
    "curated_authority", "strong_replies", "material_scope", "no_simple_reason", "saved_policy"
]


class Frame(BaseModel):
    fen: str
    uci: str | None
    san: str
    annotation: str
    highlights: list[str]
    material_change: int
    capture: str | None = None
    gives_check: bool = False
    # Only legal replay produces this version; absent legacy facts stay unknown.
    facts_version: Literal[1] | None = None
    promotion: str | None = None
    castling: bool = False
    checkmate: bool = False
    escaped_check: bool = False


class MoveExplanation(BaseModel):
    version: str = "1"
    attempt_id: str | None
    authority: Literal["stockfish", "curated"]
    accepted: bool
    move_uci: str
    move_san: str
    summary: str
    summary_kind: SummaryKind | None = None
    summary_frame_index: int | None = None
    notes: list[str]
    note_kinds: list[NoteKind | None] = Field(default_factory=list)
    frames: list[Frame]
    orientation: Literal["white", "black"]
    analysis_id: str | None = None
    engine_version: str | None = None
    score: Score | None = None
    findings: list[Finding] = Field(default_factory=list)


def color_name(color):
    return "White" if color else "Black"


def replay_line(board, line):
    replay = board.copy(stack=True)
    learner = board.turn
    initial_balance = material(board, learner) - material(board, not learner)
    frames = [
        Frame(
            fen=board.fen(),
            uci=None,
            san="Start",
            annotation="The original position.",
            highlights=[],
            material_change=0,
            facts_version=1,
        )
    ]
    for uci in line:
        move = legal_move(replay, uci)
        san = replay.san(move)
        actor = color_name(replay.turn)
        opponent = color_name(not replay.turn)
        capture_square = move.to_square
        if replay.is_en_passant(move):
            capture_square += -8 if replay.turn else 8
        captured = replay.piece_at(capture_square) if replay.is_capture(move) else None
        castling = replay.is_castling(move)
        annotation = f"{actor} plays {san}"
        if captured:
            annotation += f", capturing {opponent}'s {chess.piece_name(captured.piece_type)}"
        if move.promotion:
            annotation += f" and promoting to a {chess.piece_name(move.promotion)}"
        if castling:
            annotation += " and castles"
        was_check = replay.is_check()
        replay.push(move)
        if replay.is_checkmate():
            annotation += ". This is checkmate"
        elif replay.is_check():
            annotation += ", giving check"
        elif was_check:
            annotation += ", getting out of check"
        highlights = [chess.square_name(move.from_square), chess.square_name(move.to_square)]
        if captured and capture_square != move.to_square:
            highlights.append(chess.square_name(capture_square))
        frames.append(
            Frame(
                fen=replay.fen(),
                uci=uci,
                san=san,
                annotation=annotation + ".",
                highlights=highlights,
                capture=chess.piece_name(captured.piece_type) if captured else None,
                gives_check=replay.is_check(),
                facts_version=1,
                promotion=chess.piece_name(move.promotion) if move.promotion else None,
                castling=castling,
                checkmate=replay.is_checkmate(),
                escaped_check=was_check,
                material_change=material(replay, learner)
                - material(replay, not learner)
                - initial_balance,
            )
        )
    return frames
