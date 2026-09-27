"""Archived product routes and retained low-level/manual audit contracts."""

from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from trainer.contracts.classification import TeachingAudit
from trainer.contracts.common import ApiError, CreatedId, Rejected
from trainer.exercises import manual_exercise
from trainer.models import TeachingRun
from trainer.workspaces import CurrentWorkspace


class ManualRequest(BaseModel):
    fen: str = Field(max_length=200)
    moves: list[str] = Field(min_length=1, max_length=100)
    orientation: Literal["white", "black"] = "white"
    explanation: str = Field(default="", max_length=5000)
    tags: list[str] = Field(default_factory=list, max_length=20)


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
        raise HTTPException(
            410, "Lessons have been removed. Use Review. Saved history is preserved."
        )

    @router.post("/api/course/teaching", status_code=410, response_model=ApiError)
    def generate_lesson_teaching(workspace: CurrentWorkspace):
        raise HTTPException(
            410, "Model teaching generation has been removed. Saved lesson history is preserved."
        )

    @router.get(
        "/api/teaching-runs/{run_id}",
        response_model=TeachingAudit,
        response_model_exclude_unset=True,
    )
    def teaching_audit(workspace: CurrentWorkspace, run_id: str):
        with workspace.sessions() as db:
            run = db.get(TeachingRun, run_id)
            if run is None:
                raise HTTPException(404, "Teaching run not found")
            return {
                column.name: getattr(run, column.name) for column in TeachingRun.__table__.columns
            }

    @router.post(
        "/api/teaching-runs/{run_id}/reject",
        response_model=Rejected,
        response_model_exclude_unset=True,
    )
    def reject_teaching(workspace: CurrentWorkspace, run_id: str):
        with workspace.mutation_lock, workspace.sessions() as db:
            run = db.get(TeachingRun, run_id)
            if run is None:
                raise HTTPException(404, "Teaching run not found")
            run.status = "rejected"
            db.commit()
            return {"rejected": True}

    @router.post(
        "/api/exercises/manual", response_model=CreatedId, response_model_exclude_unset=True
    )
    def add_manual(workspace: CurrentWorkspace, data: ManualRequest):
        with workspace.mutation_lock, workspace.sessions() as db:
            exercise = manual_exercise(db, scheduler, **data.model_dump())
            return {"id": exercise.id}

    @router.get("/api/repertoires", include_in_schema=False)
    @router.post("/api/repertoires", include_in_schema=False)
    def archived_repertoires(workspace: CurrentWorkspace):
        raise HTTPException(
            410, "Repertoire training has been removed. Saved history is preserved."
        )

    return router
