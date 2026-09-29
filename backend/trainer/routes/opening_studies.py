"""Catalogue and selected opening lines; their recalls use the existing Review routes."""

from fastapi import APIRouter, Query

from trainer.contracts.opening_studies import (
    OpeningCatalogue,
    OpeningEnrollment,
    OpeningLineView,
    OpeningPracticeStart,
    OpeningStudyLibrary,
    OpeningStudyView,
)
from trainer.contracts.study_lessons import LessonSessionView
from trainer.opening_studies import catalogue, service, sources
from trainer.workspaces import CurrentWorkspace


def create_router(*, providers, scheduler):
    router = APIRouter()

    @router.get("/api/openings/catalog", response_model=OpeningCatalogue)
    def catalog(
        workspace: CurrentWorkspace,
        q: str = "",
        eco: str = "",
        offset: int = Query(0, ge=0),
        limit: int = Query(50, ge=1, le=100),
    ):
        with workspace.sessions() as db:
            return catalogue.search(db, q, eco, offset, limit)

    @router.get("/api/openings/catalog/{key}", response_model=OpeningLineView)
    def detail(workspace: CurrentWorkspace, key: str):
        with workspace.sessions() as db:
            return catalogue.detail(db, key)

    @router.get("/api/openings/course-lines/{course_id}/{line_id}", response_model=OpeningLineView)
    def course_line(workspace: CurrentWorkspace, course_id: str, line_id: str, revision: str):
        with workspace.mutation_lock, workspace.sessions() as db:
            return sources.line_view(
                sources.course_line(db, providers, course_id, revision, line_id)
            )

    @router.get("/api/opening-studies", response_model=OpeningStudyLibrary)
    def studies(workspace: CurrentWorkspace):
        with workspace.mutation_lock, workspace.sessions() as db:
            return service.library(db)

    @router.get("/api/opening-studies/{study_id}", response_model=OpeningStudyView)
    def get_study(workspace: CurrentWorkspace, study_id: str):
        with workspace.mutation_lock, workspace.sessions() as db:
            return service.study_view(db, service.require_study(db, study_id))

    @router.post("/api/opening-studies", response_model=OpeningStudyView)
    def enroll(workspace: CurrentWorkspace, data: OpeningEnrollment):
        with workspace.mutation_lock, workspace.sessions() as db:
            return service.enroll_line(db, providers, data, scheduler)

    @router.delete("/api/opening-studies/{study_id}", response_model=OpeningStudyView)
    def disable(workspace: CurrentWorkspace, study_id: str):
        with workspace.mutation_lock, workspace.sessions() as db:
            return service.toggle(db, study_id, False)

    @router.post("/api/opening-studies/{study_id}/restore", response_model=OpeningStudyView)
    def restore(workspace: CurrentWorkspace, study_id: str):
        with workspace.mutation_lock, workspace.sessions() as db:
            return service.toggle(db, study_id, True)

    @router.post("/api/opening-studies/{study_id}/practice", response_model=LessonSessionView)
    def practice(workspace: CurrentWorkspace, study_id: str, data: OpeningPracticeStart):
        with workspace.mutation_lock, workspace.sessions() as db:
            return service.practice(db, study_id, data)

    return router
