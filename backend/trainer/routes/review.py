"""Cold review, focused practice and exact-answer playback endpoints."""

from fastapi import APIRouter

from trainer.contracts.common import SquareMove
from trainer.contracts.opening_studies import ReviewCount
from trainer.contracts.review import (
    ColdPosition,
    PracticeQueueItem,
    ReviewFeedback,
    ReviewQueueItem,
)
from trainer.explanations import MoveExplanation, explain_review
from trainer.practice import focus_queue
from trainer.reviews import (
    answer_search,
    queue,
    resume_review,
    reveal,
    search_answer,
    start_review,
    submit_move,
)
from trainer.workspaces import CurrentWorkspace


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
        with workspace.sessions() as db:
            return resume_review(db, session_id)

    @router.post(
        "/api/review/sessions/{session_id}/move",
        response_model=ReviewFeedback,
        response_model_exclude_unset=True,
    )
    def move(workspace: CurrentWorkspace, session_id: str, data: SquareMove):
        uci = data.uci
        # Grading an unseen answer is a deep search: it runs before the account lock
        # is taken, so the account's other work never waits on it.
        with workspace.sessions() as db:
            search = answer_search(db, session_id, uci)
        graded = None
        if search is not None:
            with workspace.variation_lock:
                graded = search_answer(workspace.engine, search)
        with workspace.mutation_lock, workspace.sessions() as db:
            return submit_move(
                db, session_id, uci, workspace.engine, scheduler, settings, graded=graded
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
        with workspace.sessions() as db:
            return explain_review(db, session_id, attempt_id, solution)

    return router
