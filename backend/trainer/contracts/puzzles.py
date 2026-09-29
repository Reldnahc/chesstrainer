"""Puzzle practice HTTP contracts; active responses carry no future answers."""

from typing import Literal

from pydantic import Field

from trainer.contracts.common import Color, Contract, LegalMove

PuzzleSource = Literal["generic", "games"]


class PuzzleKey(Contract):
    provider_id: str = Field(min_length=1, max_length=100)
    key: str = Field(min_length=1, max_length=200)
    version: str = Field(min_length=1, max_length=100)


class PuzzleStart(PuzzleKey):
    request_id: str = Field(min_length=1, max_length=100)


class PuzzleCommand(Contract):
    request_id: str = Field(min_length=1, max_length=100)
    revision: int = Field(ge=0)


class PuzzleMove(PuzzleCommand):
    uci: str = Field(pattern="^[a-h][1-8][a-h][1-8][qrbn]?$")
    elapsed_ms: int = Field(default=0, ge=0, le=86_400_000)


class PuzzleFrame(Contract):
    uci: str
    san: str
    before_fen: str
    after_fen: str


class PuzzleProvenance(Contract):
    attribution: str
    url: str | None = None
    game_id: str | None = None
    source_ply: int | None = None


class PuzzleCompletion(Contract):
    themes: list[str]
    rating: int | None
    provenance: PuzzleProvenance
    solution: list[PuzzleFrame]


class PuzzleFeedback(Contract):
    grade: Literal["correct", "incorrect", "revealed"]
    submitted_san: str | None


class PuzzleSessionView(Contract):
    id: str
    source: PuzzleSource
    fen: str
    orientation: Color
    legal_moves: list[LegalMove]
    history: list[PuzzleFrame]
    revision: int
    current_step: int
    status: Literal["active", "solved", "revealed"]
    failed: bool
    feedback: PuzzleFeedback | None
    playback: list[PuzzleFrame]
    completion: PuzzleCompletion | None


class PuzzleResume(Contract):
    id: str
    source: PuzzleSource
    started_at: str
    updated_at: str
    failed: bool


class PuzzleProviderInfo(Contract):
    id: str
    name: str
    source: PuzzleSource
    count: int


class PuzzleStats(Contract):
    solved: int
    clean: int
    failed_then_solved: int
    revealed: int


class PuzzleLibrary(Contract):
    available: int
    sources: list[PuzzleProviderInfo]
    resume: list[PuzzleResume]
    stats: PuzzleStats
