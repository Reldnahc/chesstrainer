"""Workspace health, public configuration and saved counts."""

from fastapi import APIRouter
from sqlalchemy import func, select

from trainer.contracts.workspace import Health, Stats, WorkspaceSettings
from trainer.coverage import coverage
from trainer.models import ClassificationRun, Exercise, Review
from trainer.workspaces import CurrentWorkspace


def create_router(*, settings, health, classifier) -> APIRouter:
    router = APIRouter()

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
