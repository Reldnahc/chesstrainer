"""Puzzle practice HTTP contracts; active responses carry no future answers."""

from typing import Literal

from pydantic import Field

from trainer.contracts.common import Color, Contract, LegalMove

PuzzleSource = Literal["generic", "games"]
PuzzleMode = Literal["new", "retry"]
# Checkmate puzzles carry the mate theme in both the Lichess packs and generated lines.
PuzzleGoal = Literal["mate", "material"]


class PuzzleQuery(Contract):
    """Selection preferences; the server still chooses among matching puzzles."""

    source: PuzzleSource | None = None
    min_rating: int | None = Field(default=None, ge=0, le=4000)
    max_rating: int | None = Field(default=None, ge=0, le=4000)
    theme: str | None = Field(default=None, min_length=1, max_length=50, pattern="^[A-Za-z0-9_]+$")
    goal: PuzzleGoal | None = None
    mode: PuzzleMode = "new"


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
    attribution: str | None
    url: str | None
    rating_min: int | None
    rating_max: int | None


class PuzzleThemeCount(Contract):
    id: str
    count: int


class PuzzleStats(Contract):
    solved: int
    clean: int
    failed_then_solved: int
    revealed: int


class PuzzleGeneration(Contract):
    """Where the account's own-game puzzles stand; counts, never a mastery claim."""

    automatic: bool
    analyzed_games: int
    searched_games: int
    unsearched_games: int
    puzzles: int
    candidates: int
    kept: int
    last_searched_at: str | None
    job_status: Literal["queued", "running"] | None


class PuzzleLibrary(Contract):
    available: int
    sources: list[PuzzleProviderInfo]
    themes: list[PuzzleThemeCount]
    retry_available: int
    solved_puzzles: int
    resume: list[PuzzleResume]
    stats: PuzzleStats
    generation: PuzzleGeneration
