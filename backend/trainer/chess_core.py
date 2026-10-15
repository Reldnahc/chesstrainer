import hashlib
import json
from typing import Literal

import chess
import chess.engine
from pydantic import BaseModel, model_validator

from trainer.errors import InvalidInput

VALUES = {chess.PAWN: 1, chess.KNIGHT: 3, chess.BISHOP: 3, chess.ROOK: 5, chess.QUEEN: 9}


def digest(value: object) -> str:
    return hashlib.sha256(
        json.dumps(value, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()


def valid_board(fen: str) -> chess.Board:
    try:
        board = chess.Board(fen)
    except ValueError as exc:
        raise InvalidInput(f"Invalid FEN: {exc}") from exc
    if not board.is_valid():
        raise InvalidInput(f"Invalid chess position (python-chess status {board.status()})")
    return board


def position_key(board: chess.Board) -> str:
    """Legal-play identity; irrelevant ep targets and clocks do not split cards."""
    return " ".join(board.fen(en_passant="legal").split()[:4])


def engine_context(board: chess.Board) -> dict:
    # Full history is intentional: identical FENs can have different repetition claims.
    return {
        "root": board.root().fen(),
        "moves": [m.uci() for m in board.move_stack],
        "fen": board.fen(),
    }


def legal_move(board: chess.Board, uci: str) -> chess.Move:
    try:
        move = chess.Move.from_uci(uci)
        # python-chess parses the UCI null move, but passing a turn is not legal chess.
        # Check before normalization, which can discard an invalid castling promotion.
        if move not in board.legal_moves:
            raise InvalidInput("Null/illegal move")
        return board.parse_uci(uci)
    except ValueError as exc:
        raise InvalidInput("Move is not legal in this position") from exc


def legal_move_options(board: chess.Board) -> list[dict]:
    """Board interaction aids, never accepted answers or a game-termination policy."""
    return [
        {
            "from_square": chess.square_name(move.from_square),
            "to_square": chess.square_name(move.to_square),
            "promotion": chess.piece_symbol(move.promotion) if move.promotion else None,
            "capture": board.is_capture(move),
        }
        for move in board.legal_moves
    ]


class Score(BaseModel):
    kind: Literal["cp", "mate"]
    value: int
    mate_given: bool = False

    @classmethod
    def from_engine(cls, score: chess.engine.PovScore, color: chess.Color):
        relative = score.pov(color)
        if relative.is_mate():
            # Mate(0) is loss; MateGiven is represented by +0 and needs explicit handling.
            if relative == chess.engine.MateGiven:
                return cls(kind="mate", value=0, mate_given=True)
            return cls(kind="mate", value=relative.mate())
        return cls(kind="cp", value=relative.score())

    def outcome(self) -> int:
        return (1 if self.value > 0 or self.mate_given else -1) if self.kind == "mate" else 0

    def order_key(self):
        """Sort key from the mover's side: a mate given beats any centipawns, sooner
        is better, and a mate against is worse than any centipawns, later is better."""
        if self.kind == "cp":
            return 1, self.value
        return (2, -abs(self.value)) if self.outcome() == 1 else (0, abs(self.value))

    def negate(self):
        if self.kind == "mate" and self.value == 0:
            return Score(kind="mate", value=0, mate_given=not self.mate_given)
        return Score(kind=self.kind, value=-self.value)


class Loss(BaseModel):
    cp: int | None = None
    mate_lost: bool = False
    allows_mate: bool = False


# A centipawn score at least this large is a clearly winning (or, negated,
# clearly lost) position.
DECISIVE_CP = 300
# Mates at least this long can be seen by one search and not by another at the
# same depth; shorter ones are found reliably.
LONG_MATE = 4


def evaluation_loss(best: Score, played: Score) -> Loss:
    if best.kind == played.kind == "cp":
        return Loss(cp=max(0, best.value - played.value))
    return Loss(
        mate_lost=best.outcome() == 1 and played.outcome() != 1,
        allows_mate=best.outcome() != -1 and played.outcome() == -1,
    )


def mate_horizon(best: Score, played: Score) -> bool:
    """The best move's search mates in four or more and the played move's
    restricted search reads only a decisive centipawn win: the played move may
    keep the mate beyond its search's horizon, so it is asked again deeper."""
    return (
        best.outcome() == 1
        and best.value >= LONG_MATE
        and played.kind == "cp"
        and played.value >= DECISIVE_CP
    )


class Candidate(BaseModel):
    uci: str
    san: str
    score: Score
    pv: list[str]
    depth: int = 0

    @model_validator(mode="after")
    def begins_with_move(self):
        if not self.pv or self.pv[0] != self.uci:
            raise ValueError("PV must begin with candidate move")
        return self


def material(board: chess.Board, color: chess.Color) -> int:
    return sum(len(board.pieces(piece, color)) * value for piece, value in VALUES.items())


# Material (pawn = 1) at or below which a position counts as an endgame.
ENDGAME_MATERIAL = 26
OPENING_MOVES = 10


def game_phase(board: chess.Board) -> str:
    if material(board, True) + material(board, False) <= ENDGAME_MATERIAL:
        return "endgame"
    return "opening" if board.fullmove_number <= OPENING_MOVES else "middlegame"


def replay_moves(board: chess.Board, ucis) -> list[chess.Board]:
    """``board`` and the board after each legal move of ``ucis``, with full history."""
    boards = [board.copy(stack=True)]
    for uci in ucis:
        following = boards[-1].copy(stack=True)
        following.push(legal_move(following, uci))
        boards.append(following)
    return boards


def board_facts(board: chess.Board, move: chess.Move, pv: list[str]) -> dict:
    color = board.turn
    facts = {
        "side_to_move": "white" if color else "black",
        "move_number": board.fullmove_number,
        "in_check": board.is_check(),
        "capture": board.is_capture(move),
        "gives_check": board.gives_check(move),
        "castling_move": board.is_castling(move),
        "castling_rights": board.has_castling_rights(color),
        "material_before": {
            "learner": material(board, color),
            "opponent": material(board, not color),
        },
        "attacked_undefended": [
            chess.square_name(sq)
            for sq, p in board.piece_map().items()
            if p.color == color
            and p.piece_type != chess.KING
            and board.is_attacked_by(not color, sq)
            and not board.is_attacked_by(color, sq)
        ],
        "phase": game_phase(board),
    }
    replay = board.copy()
    trace = []
    for uci in pv:
        next_move = legal_move(replay, uci)
        san = replay.san(next_move)
        replay.push(next_move)
        trace.append(
            {
                "uci": uci,
                "san": san,
                "learner_material": material(replay, color),
                "opponent_material": material(replay, not color),
                "checkmate": replay.is_checkmate(),
            }
        )
    facts["verified_line"] = trace
    facts["material_balance_change_in_line"] = (
        material(replay, color)
        - material(replay, not color)
        - material(board, color)
        + material(board, not color)
    )
    return facts
