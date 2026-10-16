"""Removed product routes, answered with 410, and the manual exercise endpoint."""

from fastapi import APIRouter, HTTPException

from trainer.contracts.common import ApiError, CreatedId
from trainer.contracts.review import ManualRequest
from trainer.exercises import manual_exercise
from trainer.workspaces import CurrentWorkspace


def create_router(*, scheduler) -> APIRouter:
    router = APIRouter()

    @router.get("/api/course", include_in_schema=False)
    @router.get("/api/course/revisions", include_in_schema=False)
    @router.post("/api/course/rebuild", include_in_schema=False)
    @router.post("/api/lessons/{lesson_id}/complete", include_in_schema=False)
    @router.post("/api/course/units/{unit_id}/next", include_in_schema=False)
    @router.post("/api/course/units/{unit_id}/extend", include_in_schema=False)
    @router.post("/api/lesson-items/{item_id}/acknowledge", include_in_schema=False)
    def archived_lessons(workspace: CurrentWorkspace):
        raise HTTPException(410, "Lessons have been removed. Use Review.")

    @router.post("/api/course/teaching", status_code=410, response_model=ApiError)
    def generate_lesson_teaching(workspace: CurrentWorkspace):
        raise HTTPException(410, "Model teaching generation has been removed.")

    @router.get("/api/teaching-runs/{run_id}", include_in_schema=False)
    @router.post("/api/teaching-runs/{run_id}/reject", include_in_schema=False)
    def archived_teaching(workspace: CurrentWorkspace, run_id: str):
        raise HTTPException(410, "Model teaching has been removed, with its saved runs.")

    @router.post(
        "/api/exercises/manual", response_model=CreatedId, response_model_exclude_unset=True
    )
    def add_manual(workspace: CurrentWorkspace, data: ManualRequest):
        with workspace.write() as db:
            exercise = manual_exercise(db, scheduler, **data.model_dump())
            return {"id": exercise.id}

    @router.get("/api/repertoires", include_in_schema=False)
    @router.post("/api/repertoires", include_in_schema=False)
    def archived_repertoires(workspace: CurrentWorkspace):
        raise HTTPException(410, "Repertoire training has been removed.")

    return router
