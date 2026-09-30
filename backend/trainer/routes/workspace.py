"""Workspace health, public configuration and saved counts."""

from fastapi import APIRouter
from sqlalchemy import func, select

from trainer.contracts.preferences import AudioPreferences, CoachPreferences, MotionPreferences
from trainer.contracts.workspace import Health, Stats, WorkspaceSettings
from trainer.coverage import coverage
from trainer.human_models.types import HumanReadiness
from trainer.models import ClassificationRun, Exercise, Review
from trainer.preferences import (
    audio_preferences,
    coach_preferences,
    motion_preferences,
    save_audio_preferences,
    save_coach_preferences,
    save_motion_preferences,
)
from trainer.workspaces import CurrentWorkspace


def create_router(*, settings, health, classifier) -> APIRouter:
    router = APIRouter()

    @router.get("/api/human-model", response_model=HumanReadiness)
    def human_model_readiness(workspace: CurrentWorkspace):
        return workspace.human_models.snapshot()

    @router.get("/api/preferences/coach", response_model=CoachPreferences)
    def get_coach_preferences(workspace: CurrentWorkspace):
        with workspace.sessions() as db:
            return coach_preferences(db)

    @router.put("/api/preferences/coach", response_model=CoachPreferences)
    def put_coach_preferences(value: CoachPreferences, workspace: CurrentWorkspace):
        with workspace.sessions() as db:
            return save_coach_preferences(db, value)

    @router.get("/api/preferences/motion", response_model=MotionPreferences)
    def get_motion_preferences(workspace: CurrentWorkspace):
        with workspace.sessions() as db:
            return motion_preferences(db)

    @router.put("/api/preferences/motion", response_model=MotionPreferences)
    def put_motion_preferences(value: MotionPreferences, workspace: CurrentWorkspace):
        with workspace.sessions() as db:
            return save_motion_preferences(db, value)

    @router.get("/api/preferences/audio", response_model=AudioPreferences)
    def get_audio_preferences(workspace: CurrentWorkspace):
        with workspace.sessions() as db:
            return audio_preferences(db)

    @router.put("/api/preferences/audio", response_model=AudioPreferences)
    def put_audio_preferences(value: AudioPreferences, workspace: CurrentWorkspace):
        with workspace.sessions() as db:
            return save_audio_preferences(db, value)

    @router.get("/api/health", response_model=Health, response_model_exclude_unset=True)
    def get_health(workspace: CurrentWorkspace):
        return {
            "database": "ready",
            **health.snapshot(),
            "classification_available": classifier is not None,
        }

    @router.get(
        "/api/settings", response_model=WorkspaceSettings, response_model_exclude_unset=True
    )
    def get_settings(workspace: CurrentWorkspace):
        with workspace.sessions() as db:
            return (
                settings.public()
                | health.snapshot()
                | {
                    "classification_available": classifier is not None,
                    "coverage": coverage(db),
                    "classification_provider": "local_rules",
                    "classification_version": classifier.version
                    if hasattr(classifier, "version")
                    else "test",
                    "classification_runs": db.scalar(
                        select(func.count())
                        .select_from(ClassificationRun)
                        .where(ClassificationRun.provider == "local_rules")
                    ),
                    "classification_failed": db.scalar(
                        select(func.count())
                        .select_from(ClassificationRun)
                        .where(
                            ClassificationRun.provider == "local_rules",
                            ClassificationRun.status == "failed",
                        )
                    ),
                    "classification_rejected": db.scalar(
                        select(func.count())
                        .select_from(ClassificationRun)
                        .where(
                            ClassificationRun.provider == "local_rules",
                            ClassificationRun.status == "rejected",
                        )
                    ),
                    "classification_abstained": db.scalar(
                        select(func.count())
                        .select_from(ClassificationRun)
                        .where(
                            ClassificationRun.provider == "local_rules",
                            ClassificationRun.status == "completed",
                            ClassificationRun.confidence == 0,
                        )
                    ),
                }
            )

    @router.get("/api/stats", response_model=Stats, response_model_exclude_unset=True)
    def stats(workspace: CurrentWorkspace):
        with workspace.sessions() as db:
            return {
                "exercises": db.scalar(select(func.count()).select_from(Exercise)),
                "reviews": db.scalar(select(func.count()).select_from(Review)),
            }

    return router
