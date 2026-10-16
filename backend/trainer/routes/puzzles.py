"""Puzzle practice is a separate account-owned domain from Review and FSRS."""

from typing import Annotated

from fastapi import APIRouter, Query

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
from trainer.job_lifecycle import JobKind, active_job, ensure_job
from trainer.puzzles import sessions
from trainer.workspaces import CurrentWorkspace


def create_router(*, providers, settings=None) -> APIRouter:
    router = APIRouter()

    @router.get("/api/puzzles", response_model=PuzzleLibrary)
    def library(workspace: CurrentWorkspace):
        with workspace.read() as db:
            return sessions.library(db, providers, settings=settings)

    @router.post(
        "/api/puzzles/generate",
        status_code=202,
        response_model=JobCreated,
        response_model_exclude_unset=True,
    )
    def generate(workspace: CurrentWorkspace):
        """Queue one bounded search of analyzed games not yet mined for puzzles."""
        with workspace.read() as db:
            queued = active_job(db, JobKind.PUZZLE_GENERATION) is not None
        if not queued:
            # Searches need Stockfish; fail now, not in the job. Started before the
            # write unit, since a running search can hold the engine meanwhile.
            workspace.engine.start()
        with workspace.write() as db:
            job, _ = ensure_job(db, JobKind.PUZZLE_GENERATION)
            return {"job_id": job.id}

    @router.get("/api/puzzles/next", response_model=PuzzleKey | None)
    def next_puzzle(workspace: CurrentWorkspace, query: Annotated[PuzzleQuery, Query()]):
        with workspace.read() as db:
            return sessions.next_puzzle(db, providers, query)

    @router.post("/api/puzzle-sessions", response_model=PuzzleSessionView)
    def start(workspace: CurrentWorkspace, data: PuzzleStart):
        with workspace.write() as db:
            return sessions.start_session(db, providers, data)

    @router.get("/api/puzzle-sessions/{session_id}", response_model=PuzzleSessionView)
    def get_session(workspace: CurrentWorkspace, session_id: str):
        with workspace.read() as db:
            return sessions.session_view(db, sessions.require_session(db, session_id))

    @router.post("/api/puzzle-sessions/{session_id}/move", response_model=PuzzleSessionView)
    def move(workspace: CurrentWorkspace, session_id: str, data: PuzzleMove):
        with workspace.write() as db:
            return sessions.command(db, session_id, data)

    @router.post("/api/puzzle-sessions/{session_id}/reveal", response_model=PuzzleSessionView)
    def reveal(workspace: CurrentWorkspace, session_id: str, data: PuzzleCommand):
        with workspace.write() as db:
            return sessions.command(db, session_id, data, reveal=True)

    return router
