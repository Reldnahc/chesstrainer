"""Authored lesson presentation and revisioned player commands."""

from typing import Annotated, Literal

from pydantic import Field, model_validator

from trainer.contracts.common import Color, Contract, LegalMove
from trainer.contracts.puzzles import PuzzleFrame

LessonKind = Literal[
    "explanation", "demonstration", "decision", "branch", "game_excerpt", "rehearsal"
]
LessonAction = Literal[
    "continue",
    "back",
    "move",
    "hint",
    "show_move",
    "enter_branch",
    "return_branch",
    "open_game",
    "close_game",
    "game_seek",
]
LessonTopic = Literal["opening", "skills"]


class LessonAttribution(Contract):
    text: str = Field(min_length=1)
    url: str | None = None
    license: str | None = None

    @model_validator(mode="after")
    def safe_url(self):
        if self.url and not self.url.startswith(("https://", "http://")):
            raise ValueError("Lesson attribution URL must use HTTP or HTTPS")
        return self


class LessonArrow(Contract):
    from_square: str = Field(pattern="^[a-h][1-8]$")
    to_square: str = Field(pattern="^[a-h][1-8]$")


class LessonAnnotations(Contract):
    squares: list[Annotated[str, Field(pattern="^[a-h][1-8]$")]] = Field(default_factory=list)
    arrows: list[LessonArrow] = Field(default_factory=list)


class LessonChapterSummary(Contract):
    id: str
    title: str
    completed: bool


class LessonLineSummary(Contract):
    id: str
    title: str
    repertoire: bool


class LessonCourseSummary(Contract):
    id: str
    revision: str
    title: str
    description: str
    learner_color: Color
    chapter_count: int
    completed_chapters: int
    topic: LessonTopic


class LessonCourseView(Contract):
    id: str
    revision: str
    title: str
    description: str
    learner_color: Color
    topic: LessonTopic
    chapters: list[LessonChapterSummary]
    attributions: list[LessonAttribution]
    lines: list[LessonLineSummary]


class LessonResume(Contract):
    id: str
    course_id: str
    course_revision: str
    course_title: str
    course_topic: LessonTopic
    chapter_id: str
    chapter_title: str
    updated_at: str


class LessonLibrary(Contract):
    courses: list[LessonCourseSummary]
    resume: list[LessonResume]


class LessonStart(Contract):
    course_id: str = Field(min_length=1, max_length=100)
    course_revision: str = Field(min_length=1, max_length=100)
    chapter_id: str = Field(min_length=1, max_length=100)
    request_id: str = Field(min_length=1, max_length=100)


class LessonCommand(Contract):
    request_id: str = Field(min_length=1, max_length=100)
    revision: int = Field(ge=0)
    action: LessonAction
    uci: str | None = Field(default=None, pattern="^[a-h][1-8][a-h][1-8][qrbn]?$")
    ply: int | None = Field(default=None, ge=0)


class LessonStepView(Contract):
    id: str
    kind: LessonKind
    title: str
    text: str
    phase: Literal["ready", "complete"]
    annotations: LessonAnnotations


class LessonFeedback(Contract):
    kind: Literal["correct", "incorrect", "revealed", "hint"]
    text: str


class LessonBranchView(Contract):
    title: str


class LessonGameNote(Contract):
    text: str
    annotations: LessonAnnotations


class LessonGameView(Contract):
    title: str
    ply: int
    total_plies: int
    attributions: list[LessonAttribution]
    note: LessonGameNote | None


class LessonSessionView(Contract):
    id: str
    revision: int
    course_id: str
    course_revision: str
    course_title: str
    course_topic: LessonTopic
    chapter_id: str
    chapter_title: str
    orientation: Color
    fen: str
    history: list[PuzzleFrame]
    playback: list[PuzzleFrame]
    legal_moves: list[LegalMove]
    step: LessonStepView
    actions: list[LessonAction]
    feedback: LessonFeedback | None
    branch: LessonBranchView | None
    game: LessonGameView | None
    status: Literal["active", "completed"]
    assisted: bool
    failed: bool
