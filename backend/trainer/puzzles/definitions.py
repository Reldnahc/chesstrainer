"""Validated, versioned puzzle truth. Providers own answers; python-chess owns legality."""

from typing import Literal

import chess
from pydantic import Field, model_validator

from trainer.contracts.common import Color, Contract
from trainer.contracts.puzzles import PuzzleFrame, PuzzleProvenance, PuzzleSource


class PuzzleDefinition(Contract):
    # A future solution graph is a new format; existing session snapshots keep line-v1.
    format_version: Literal["line-v1"] = "line-v1"
    key: str = Field(min_length=1, max_length=200)
    version: str = Field(min_length=1, max_length=100)
    source: PuzzleSource
    initial_fen: str
    orientation: Color
    solution: tuple[str, ...] = Field(min_length=1, max_length=201)
    themes: tuple[str, ...] = ()
    rating: int | None = Field(default=None, ge=0)
    provenance: PuzzleProvenance

    @model_validator(mode="after")
    def legal_continuation(self):
        board = chess.Board(self.initial_fen)
        if not board.is_valid():
            raise ValueError("Puzzle initial position must be valid")
        if board.turn != (self.orientation == "white"):
            raise ValueError("Puzzle must begin with the learner to move")
        if len(self.solution) % 2 != 1:
            raise ValueError("Puzzle must end on a learner decision")
        if self.source == "games" and len(self.solution) < 3:
            raise ValueError("Game puzzles require at least two learner decisions")
        for uci in self.solution:
            move = chess.Move.from_uci(uci)
            if move not in board.legal_moves:
                raise ValueError("Every puzzle continuation move must be legal")
            board.push(move)
        if self.provenance.url and not self.provenance.url.startswith(("https://", "http://")):
            raise ValueError("Puzzle attribution URL must use HTTP or HTTPS")
        return self

    def frames(self) -> list[PuzzleFrame]:
        board = chess.Board(self.initial_fen)
        frames = []
        for uci in self.solution:
            before, san = board.fen(), board.san(chess.Move.from_uci(uci))
            board.push_uci(uci)
            frames.append(PuzzleFrame(uci=uci, san=san, before_fen=before, after_fen=board.fen()))
        return frames
