"""Cold review, focused practice and exact-answer playback endpoints."""

from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel, Field

from trainer.contracts.opening_studies import ReviewCount
from trainer.contracts.review import (
    ColdPosition,
    PracticeQueueItem,
    ReviewFeedback,
    ReviewQueueItem,
)
from trainer.explanations import MoveExplanation, explain_review
from trainer.practice import focus_queue
from trainer.reviews import queue, resume_review, reveal, start_review, submit_move
from trainer.workspaces import CurrentWorkspace


class MoveRequest(BaseModel):
    from_square: str = Field(pattern="^[a-h][1-8]$")
    to_square: str = Field(pattern="^[a-h][1-8]$")
    promotion: Literal["q", "r", "b", "n"] | None = None


def create_router(*, settings, scheduler) -> APIRouter:
    router = APIRouter()

    @router.get(
        "/api/review/queue", response_model=list[ReviewQueueItem], response_model_exclude_unset=True
    )
    def review_queue(workspace: CurrentWorkspace, last_id: str | None = None):
        with workspace.sessions() as db:
            return queue(db, last_id)

    @router.get("/api/review/count", response_model=ReviewCount)
    def review_count(workspace: CurrentWorkspace):
        with workspace.sessions() as db:
            return {"due": len(queue(db, limit=None))}

    @router.get(
        "/api/practice/queue",
        response_model=list[PracticeQueueItem],
        response_model_exclude_unset=True,
    )
    def focused_queue(workspace: CurrentWorkspace, skill_id: str):
        with workspace.sessions() as db:
            return focus_queue(db, skill_id)

    @router.post(
        "/api/review/{exercise_id}/start",
        response_model=ColdPosition,
        response_model_exclude_unset=True,
    )
    def begin_review(
        workspace: CurrentWorkspace, exercise_id: str, focus_skill_id: str | None = None
    ):
        with workspace.mutation_lock, workspace.sessions() as db:
            return start_review(db, exercise_id, focus_skill_id=focus_skill_id)

    @router.get(
        "/api/review/sessions/{session_id}",
        response_model=ColdPosition,
        response_model_exclude_unset=True,
    )
    def resume(workspace: CurrentWorkspace, session_id: str):
        with workspace.mutation_lock, workspace.sessions() as db:
            return resume_review(db, session_id)

    @router.post(
        "/api/review/sessions/{session_id}/move",
        response_model=ReviewFeedback,
        response_model_exclude_unset=True,
    )
    def move(workspace: CurrentWorkspace, session_id: str, data: MoveRequest):
        with workspace.mutation_lock, workspace.sessions() as db:
            return submit_move(
                db,
                session_id,
                data.from_square + data.to_square + (data.promotion or ""),
                workspace.engine,
                scheduler,
                settings,
            )

    @router.post(
        "/api/review/sessions/{session_id}/reveal",
        response_model=ReviewFeedback,
        response_model_exclude_unset=True,
    )
    def show_move(workspace: CurrentWorkspace, session_id: str):
        with workspace.mutation_lock, workspace.sessions() as db:
            return reveal(db, session_id, scheduler, settings)

    @router.get("/api/review/sessions/{session_id}/explanation", response_model=MoveExplanation)
    def review_explanation(
        workspace: CurrentWorkspace,
        session_id: str,
        attempt_id: str | None = None,
        solution: bool = False,
    ):
        with workspace.mutation_lock, workspace.sessions() as db:
            return explain_review(db, session_id, attempt_id, solution)

    return router
