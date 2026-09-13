"""Cold review, focused practice and exact-answer playback endpoints."""

from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from trainer.explanations import MoveExplanation, explain_review
from trainer.models import Exercise, ReviewSession
from trainer.practice import focus_queue
from trainer.reviews import queue, reveal, start_review, submit_move


class MoveRequest(BaseModel):
    from_square: str = Field(pattern="^[a-h][1-8]$")
    to_square: str = Field(pattern="^[a-h][1-8]$")
    promotion: Literal["q", "r", "b", "n"] | None = None


def create_router(*, settings, sessions, engine, scheduler, review_lock) -> APIRouter:
    router = APIRouter()

    @router.get("/api/review/queue")
    def review_queue(last_id: str | None = None):
        with sessions() as db:
            return queue(db, last_id)

    @router.get("/api/practice/queue")
    def focused_queue(skill_id: str):
        with sessions() as db:
            return focus_queue(db, skill_id)

    def require_review_exercise(db, exercise_id):
        exercise = db.get(Exercise, exercise_id)
        if exercise is not None and exercise.source == "repertoire":
            raise HTTPException(
                410, "This repertoire position is archived. Review your game mistakes instead."
            )

    @router.post("/api/review/{exercise_id}/start")
    def begin_review(exercise_id: str, focus_skill_id: str | None = None):
        with review_lock, sessions() as db:
            require_review_exercise(db, exercise_id)
            return start_review(db, exercise_id, focus_skill_id=focus_skill_id)

    def require_review_session(db, session_id):
        session = db.get(ReviewSession, session_id)
        if session is not None:
            require_review_exercise(db, session.exercise_id)
        if session is not None and session.lesson_item_id is not None:
            raise HTTPException(410, "This lesson attempt is archived. Start a position in Review.")

    @router.post("/api/review/sessions/{session_id}/move")
    def move(session_id: str, data: MoveRequest):
        with review_lock, sessions() as db:
            require_review_session(db, session_id)
            return submit_move(
                db,
                session_id,
                data.from_square + data.to_square + (data.promotion or ""),
                engine,
                scheduler,
                settings,
            )

    @router.post("/api/review/sessions/{session_id}/reveal")
    def show_move(session_id: str):
        with review_lock, sessions() as db:
            require_review_session(db, session_id)
            return reveal(db, session_id, scheduler, settings)

    @router.get("/api/review/sessions/{session_id}/explanation", response_model=MoveExplanation)
    def review_explanation(session_id: str, attempt_id: str | None = None, solution: bool = False):
        with review_lock, sessions() as db:
            return explain_review(db, session_id, attempt_id, solution)

    return router
