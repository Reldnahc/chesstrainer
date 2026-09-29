"""Versioned course source format. Transitions are validated against full chess history."""

from typing import Annotated, Literal

import chess
from pydantic import Field, model_validator

from trainer.chess_core import legal_move
from trainer.contracts.common import Color, Contract
from trainer.contracts.puzzles import PuzzleFrame
from trainer.contracts.study_lessons import LessonAnnotations, LessonAttribution


class Position(Contract):
    initial_fen: str = chess.STARTING_FEN
    moves: tuple[str, ...] = Field(default=(), max_length=600)

    def board(self):
        board = chess.Board(self.initial_fen)
        if not board.is_valid():
            raise ValueError("Lesson position must be valid")
        for uci in self.moves:
            move = chess.Move.from_uci(uci)
            if move not in board.legal_moves:
                raise ValueError(f"Illegal lesson move: {uci}")
            board.push(move)
        return board

    @model_validator(mode="after")
    def validate_history(self):
        self.board()
        return self

    def after(self, moves):
        return Position(initial_fen=self.initial_fen, moves=(*self.moves, *moves))

    def frames(self):
        board = chess.Board(self.initial_fen)
        frames = []
        for uci in self.moves:
            move = legal_move(board, uci)
            before, san = board.fen(), board.san(move)
            board.push(move)
            frames.append(
                PuzzleFrame(uci=move.uci(), san=san, before_fen=before, after_fen=board.fen())
            )
        return frames


class Line(Contract):
    id: str = Field(min_length=1, max_length=100)
    title: str
    position: Position = Field(default_factory=Position)
    moves: tuple[str, ...] = Field(min_length=1, max_length=200)
    repertoire: bool = False
    eco: str | None = None

    @model_validator(mode="after")
    def legal(self):
        self.position.after(self.moves)
        return self


class GameAnnotation(Contract):
    ply: int = Field(ge=0)
    text: str
    annotations: LessonAnnotations = Field(default_factory=LessonAnnotations)


class SourceGame(Contract):
    id: str = Field(min_length=1, max_length=100)
    title: str
    position: Position = Field(default_factory=Position)
    moves: tuple[str, ...] = Field(min_length=1, max_length=600)
    annotations: tuple[GameAnnotation, ...] = ()
    attributions: tuple[LessonAttribution, ...] = Field(min_length=1)

    @model_validator(mode="after")
    def legal(self):
        self.position.after(self.moves)
        if len({note.ply for note in self.annotations}) != len(self.annotations):
            raise ValueError("Game annotation plies must be unique")
        if any(note.ply > len(self.moves) for note in self.annotations):
            raise ValueError("Game annotation outside the game")
        return self


class Step(Contract):
    id: str = Field(min_length=1, max_length=100)
    title: str
    text: str = ""
    position: Position = Field(default_factory=Position)
    annotations: LessonAnnotations = Field(default_factory=LessonAnnotations)
    next_step: str | None = None


class Explanation(Step):
    kind: Literal["explanation"] = "explanation"


class Demonstration(Step):
    kind: Literal["demonstration"] = "demonstration"
    moves: tuple[str, ...] = Field(min_length=1, max_length=100)


class Choice(Contract):
    uci: str
    reply: tuple[str, ...] = Field(default=(), max_length=1)
    next_step: str | None
    feedback: str = "That is a move taught in this lesson."


class Decision(Step):
    kind: Literal["decision"] = "decision"
    choices: tuple[Choice, ...] = Field(min_length=1)
    hint: str | None = None


class Branch(Step):
    kind: Literal["branch"] = "branch"
    branch_start: str


class GameExcerpt(Step):
    kind: Literal["game_excerpt"] = "game_excerpt"
    game_id: str
    from_ply: int = Field(ge=0)
    to_ply: int = Field(ge=1)


class Rehearsal(Step):
    kind: Literal["rehearsal"] = "rehearsal"
    line_id: str


LessonStep = Annotated[
    Explanation | Demonstration | Decision | Branch | GameExcerpt | Rehearsal,
    Field(discriminator="kind"),
]


class Chapter(Contract):
    id: str = Field(min_length=1, max_length=100)
    title: str
    entry_step: str
    steps: tuple[LessonStep, ...] = Field(min_length=1, max_length=200)

    def step(self, step_id):
        return next(step for step in self.steps if step.id == step_id)


class CourseDefinition(Contract):
    format_version: Literal["course-v1"] = "course-v1"
    id: str = Field(min_length=1, max_length=100)
    revision: str = Field(min_length=1, max_length=100)
    title: str
    description: str = ""
    learner_color: Color
    attributions: tuple[LessonAttribution, ...] = Field(min_length=1)
    chapters: tuple[Chapter, ...] = Field(min_length=1, max_length=100)
    lines: tuple[Line, ...] = ()
    games: tuple[SourceGame, ...] = ()

    def chapter(self, chapter_id):
        return next(chapter for chapter in self.chapters if chapter.id == chapter_id)

    def line(self, line_id):
        return next(line for line in self.lines if line.id == line_id)

    def game(self, game_id):
        return next(game for game in self.games if game.id == game_id)

    @model_validator(mode="after")
    def validate_course(self):
        from trainer.study_lessons.validation import validate_course

        validate_course(self)
        return self
