"""Chosen opening material, its source identity, and honest recall context."""

from typing import Literal

from pydantic import Field

from trainer.contracts.common import Color, Contract
from trainer.contracts.puzzles import PuzzleFrame

OpeningSource = Literal["lichess_catalogue", "course_line"]


class OpeningLine(Contract):
    source: OpeningSource
    source_key: str
    source_version: str
    name: str
    eco: str | None
    initial_fen: str
    moves: list[str]
    course_id: str | None = None
    line_id: str | None = None


class OpeningLineSummary(Contract):
    source_key: str
    source_version: str
    name: str
    eco: str | None
    plies: int
    white_positions: int
    black_positions: int


class OpeningCatalogue(Contract):
    version: str
    total: int
    items: list[OpeningLineSummary]


class OpeningLineView(Contract):
    line: OpeningLine
    frames: list[PuzzleFrame]
    white_positions: int
    black_positions: int


class OpeningEnrollment(Contract):
    source: OpeningSource
    source_key: str = Field(min_length=1, max_length=200)
    source_version: str = Field(min_length=1, max_length=100)
    color: Color
    course_id: str | None = None
    line_id: str | None = None


class OpeningStudySummary(Contract):
    id: str
    source: OpeningSource
    source_key: str
    source_version: str
    name: str
    eco: str | None
    color: Color
    active: bool
    positions: int
    due_positions: int


class OpeningStudyView(OpeningStudySummary):
    line: OpeningLine
    frames: list[PuzzleFrame]


class OpeningStudyLibrary(Contract):
    items: list[OpeningStudySummary]
    active_studies: int
    learning_positions: int
    due_positions: int


class OpeningPracticeStart(Contract):
    request_id: str = Field(min_length=1, max_length=100)


class OpeningRecallContext(Contract):
    names: list[str]
    color: Color
    prompt: str
    revision: int


class OpeningContinuation(Contract):
    study_id: str
    name: str
    moves: list[PuzzleFrame]


class ReviewCount(Contract):
    due: int
