"""Workspace health, public configuration and saved counts."""

from fastapi import APIRouter
from sqlalchemy import func, select

from trainer.coverage import coverage
from trainer.models import ClassificationRun, Exercise, Review


def create_router(*, settings, sessions, health, classifier) -> APIRouter:
    router = APIRouter()

    @router.get("/api/health")
    def get_health():
        return {"database": "ready", **health, "classification_available": classifier is not None}

    @router.get("/api/settings")
    def get_settings():
        with sessions() as db:
            return (
                settings.public()
                | health
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

    @router.get("/api/stats")
    def stats():
        with sessions() as db:
            return {
                "exercises": db.scalar(select(func.count()).select_from(Exercise)),
                "reviews": db.scalar(select(func.count()).select_from(Review)),
            }

    return router
