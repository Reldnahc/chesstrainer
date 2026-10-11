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
LessonSource = Literal["built_in", "club"]


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
    source: LessonSource = "built_in"


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
    source: LessonSource = "built_in"
    can_manage: bool = False


class LessonResume(Contract):
    id: str
    course_id: str
    course_revision: str
    course_title: str
    course_topic: LessonTopic
    chapter_id: str
    chapter_title: str
    updated_at: str


class CourseFileProblem(Contract):
    file: str
    message: str


class LessonLibrary(Contract):
    courses: list[LessonCourseSummary]
    resume: list[LessonResume]
    # Course files may be imported, edited and deleted only by an administrator.
    can_manage: bool = False
    # Club course files that could not be loaded; listed for administrators only.
    problems: list[CourseFileProblem] = Field(default_factory=list)


class CourseFileStep(Contract):
    # Where a step starts (FEN and the SAN moves that reach it) and where it ends.
    fen: str
    # The position the SAN moves start from: the initial position or a step's own FEN.
    initial_fen: str
    position: str
    end_fen: str
    end_position: str


class CourseFileCheck(Contract):
    error: str | None
    # Keyed "chapter-id/step-id".
    steps: dict[str, CourseFileStep]


class EditorMove(Contract):
    from_square: str = Field(pattern="^[a-h][1-8]$")
    to_square: str = Field(pattern="^[a-h][1-8]$")
    promotion: Literal["q", "r", "b", "n"] | None = None


class EditorPositionRequest(Contract):
    fen: str | None = None
    moves: str = Field(default="", max_length=10_000)
    move: EditorMove | None = None


class EditorPosition(Contract):
    fen: str
    # SAN moves from the start, including the move just added.
    moves: str
    san: str | None
    turn: Color
    legal_moves: list[LegalMove]


class CourseFileDeleted(Contract):
    id: str
    # True when deleting the club file brought back the built-in course it replaced.
    built_in_restored: bool


class CourseFileSaved(Contract):
    id: str
    revision: str
    title: str
    # True when a changed course received a new revision so saved progress stays intact.
    revision_changed: bool


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
