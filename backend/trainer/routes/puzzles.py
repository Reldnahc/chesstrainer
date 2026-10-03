"""Puzzle practice is a separate account-owned domain from Review and FSRS."""

from typing import Annotated

from fastapi import APIRouter, Query
from sqlalchemy import select

from trainer.contracts.common import JobCreated
from trainer.contracts.puzzles import (
    PuzzleCommand,
    PuzzleKey,
    PuzzleLibrary,
    PuzzleMove,
    PuzzleQuery,
    PuzzleSessionView,
    PuzzleStart,
)
from trainer.models import AnalysisJob
from trainer.puzzles import sessions
from trainer.puzzles.generation import JOB_KIND
from trainer.workspaces import CurrentWorkspace


def create_router(*, providers, settings=None) -> APIRouter:
    router = APIRouter()

    @router.get("/api/puzzles", response_model=PuzzleLibrary)
    def library(workspace: CurrentWorkspace):
        with workspace.sessions() as db:
            return sessions.library(db, providers, settings=settings)

    @router.post(
        "/api/puzzles/generate",
        status_code=202,
        response_model=JobCreated,
        response_model_exclude_unset=True,
    )
    def generate(workspace: CurrentWorkspace):
        """Queue one bounded search of analyzed games not yet mined for puzzles."""
        with workspace.mutation_lock, workspace.sessions() as db:
            existing = db.scalar(
                select(AnalysisJob).where(
                    AnalysisJob.kind == JOB_KIND, AnalysisJob.status.in_(["queued", "running"])
                )
            )
            if existing:
                return {"job_id": existing.id}
            workspace.engine.start()
            job = AnalysisJob(kind=JOB_KIND)
            db.add(job)
            db.commit()
            return {"job_id": job.id}

    @router.get("/api/puzzles/next", response_model=PuzzleKey | None)
    def next_puzzle(workspace: CurrentWorkspace, query: Annotated[PuzzleQuery, Query()]):
        with workspace.sessions() as db:
            return sessions.next_puzzle(db, providers, query)

    @router.post("/api/puzzle-sessions", response_model=PuzzleSessionView)
    def start(workspace: CurrentWorkspace, data: PuzzleStart):
        with workspace.mutation_lock, workspace.sessions() as db:
            return sessions.start_session(db, providers, data)

    @router.get("/api/puzzle-sessions/{session_id}", response_model=PuzzleSessionView)
    def get_session(workspace: CurrentWorkspace, session_id: str):
        with workspace.mutation_lock, workspace.sessions() as db:
            return sessions.session_view(db, sessions.require_session(db, session_id))

    @router.post("/api/puzzle-sessions/{session_id}/move", response_model=PuzzleSessionView)
    def move(workspace: CurrentWorkspace, session_id: str, data: PuzzleMove):
        with workspace.mutation_lock, workspace.sessions() as db:
            return sessions.command(db, session_id, data)

    @router.post("/api/puzzle-sessions/{session_id}/reveal", response_model=PuzzleSessionView)
    def reveal(workspace: CurrentWorkspace, session_id: str, data: PuzzleCommand):
        with workspace.mutation_lock, workspace.sessions() as db:
            return sessions.command(db, session_id, data, reveal=True)

    return router
