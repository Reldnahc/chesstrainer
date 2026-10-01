from typing import Literal

from pydantic import JsonValue

from trainer.chess_core import Candidate
from trainer.contracts.common import Color, Contract, LegalMove
from trainer.contracts.opening_studies import OpeningContinuation, OpeningRecallContext
from trainer.explanations import Frame, SummaryKind


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
    opening: OpeningRecallContext | None = None
    non_scheduling_reason: str | None = None
    completed: bool | None = None
    feedback: "ReviewFeedback | None" = None


class AcceptedAnswer(Contract):
    uci: str
    san: str
    primary: bool


class ReviewFeedback(Contract):
    completed: bool
    grade: str
    attempt_id: str | None = None
    explanation_summary: str | None = None
    explanation_summary_kind: SummaryKind | None = None
    explanation_summary_frame: Frame | None = None
    submitted_san: str | None = None
    fen: str | None = None
    practice_only: bool | None = None
    message: str | None = None
    message_kind: (
        Literal[
            "good_move",
            "practice_saved",
            "relearning",
            "opening_rejected",
            "opening_rejected_changed",
            "opening_rejected_retired",
        ]
        | None
    ) = None
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
    # Historical evidence retains versioned JSON shapes.
    facts: dict[str, JsonValue] | None = None
    opening: OpeningRecallContext | None = None
    continuations: list[OpeningContinuation] | None = None
    non_scheduling_reason: str | None = None
    scheduling_status: (
        Literal["recorded", "previously_recorded", "content_changed", "practice"] | None
    ) = None


ColdPosition.model_rebuild()
