"""New authored Study lessons. Historical course endpoints remain archived."""

from fastapi import APIRouter

from trainer.contracts.study_lessons import (
    LessonCommand,
    LessonCourseView,
    LessonLibrary,
    LessonSessionView,
    LessonStart,
)
from trainer.study_lessons import presentation, queries, sessions
from trainer.workspaces import CurrentWorkspace


def create_router(*, providers):
    router = APIRouter()

    @router.get("/api/study/courses", response_model=LessonLibrary)
    def library(workspace: CurrentWorkspace):
        with workspace.mutation_lock, workspace.sessions() as db:
            return queries.library(db, providers)

    @router.get("/api/study/courses/{course_id}", response_model=LessonCourseView)
    def course(workspace: CurrentWorkspace, course_id: str, revision: str | None = None):
        with workspace.mutation_lock, workspace.sessions() as db:
            return queries.course_view(db, providers, course_id, revision)

    @router.post("/api/study/lesson-sessions", response_model=LessonSessionView)
    def start(workspace: CurrentWorkspace, data: LessonStart):
        with workspace.mutation_lock, workspace.sessions() as db:
            return sessions.start_session(db, providers, data)

    @router.get("/api/study/lesson-sessions/{session_id}", response_model=LessonSessionView)
    def get_session(workspace: CurrentWorkspace, session_id: str):
        with workspace.mutation_lock, workspace.sessions() as db:
            return presentation.view(sessions.require_session(db, session_id))

    @router.post(
        "/api/study/lesson-sessions/{session_id}/command", response_model=LessonSessionView
    )
    def command(workspace: CurrentWorkspace, session_id: str, data: LessonCommand):
        with workspace.mutation_lock, workspace.sessions() as db:
            return sessions.command(db, session_id, data)

    return router
