"""Puzzle practice is a separate account-owned domain from Review and FSRS."""

from fastapi import APIRouter

from trainer.contracts.puzzles import (
    PuzzleCommand,
    PuzzleKey,
    PuzzleLibrary,
    PuzzleMove,
    PuzzleSessionView,
    PuzzleSource,
    PuzzleStart,
)
from trainer.puzzles import sessions
from trainer.workspaces import CurrentWorkspace


def create_router(*, providers) -> APIRouter:
    router = APIRouter()

    @router.get("/api/puzzles", response_model=PuzzleLibrary)
    def library(workspace: CurrentWorkspace):
        with workspace.sessions() as db:
            return sessions.library(db, providers)

    @router.get("/api/puzzles/next", response_model=PuzzleKey | None)
    def next_puzzle(workspace: CurrentWorkspace, source: PuzzleSource | None = None):
        with workspace.sessions() as db:
            return sessions.next_puzzle(db, providers, source)

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
