from typing import Literal

from pydantic import JsonValue

from trainer.chess_core import Candidate
from trainer.contracts.common import Color, Contract, LegalMove
from trainer.explanations import Frame


class PracticeQueueItem(Contract):
    exercise_id: str


class ReviewQueueItem(PracticeQueueItem):
    due: str
    new: bool


class ColdPosition(Contract):
    session_id: str
    last_attempt_id: str | None
    exercise_id: str
    fen: str
    orientation: Color
    failed: bool
    review_reason: Literal["new", "resume", "learning", "relearning", "review", "practice"]
    previous_reviews: int
    practice_only: bool
    legal_moves: list[LegalMove]


class AcceptedAnswer(Contract):
    uci: str
    san: str
    primary: bool


class ReviewFeedback(Contract):
    completed: bool
    grade: str
    attempt_id: str | None = None
    explanation_summary: str | None = None
    submitted_san: str | None = None
    fen: str | None = None
    practice_only: bool | None = None
    message: str | None = None
    attempt_frame: Frame | None = None
    counter_reply: Frame | None = None
    reveal_frame: Frame | None = None
    retired: bool | None = None
    retired_interval_days: float | None = None
    explanation: str | None = None
    answers: list[AcceptedAnswer] | None = None
    next_due: str | None = None
    decision_id: str | None = None
    source: str | None = None
    played_san: str | None = None
    candidates: list[Candidate] | None = None
    # Historical evidence and archived lesson results have versioned JSON shapes.
    facts: dict[str, JsonValue] | None = None
    lesson_result: dict[str, JsonValue] | None = None
