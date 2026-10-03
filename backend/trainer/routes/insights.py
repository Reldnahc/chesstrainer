"""Read-only library insights over saved games and completed reviews."""

from typing import Literal

from fastapi import APIRouter, Query
from sqlalchemy import select

from trainer.contracts.insights import Insights
from trainer.game_insights import game_facts, summarize
from trainer.models import AnalysisJob, Game, GameReview
from trainer.review_reports import load_accuracy_scores
from trainer.workspaces import CurrentWorkspace


def create_router():
    router = APIRouter()

    @router.get("/api/insights", response_model=Insights)
    def insights(
        workspace: CurrentWorkspace,
        speed: Literal["all", "bullet", "blitz", "rapid", "classical", "daily"] = "all",
        days: int | None = Query(None, ge=1, le=3650),
        # Minutes east of UTC, so weekday and time-of-day use the viewer's clock.
        offset: int = Query(0, ge=-840, le=840),
    ):
        with workspace.sessions() as db:
            rows = db.execute(
                select(Game, AnalysisJob.status, GameReview.rating)
                .outerjoin(GameReview, GameReview.game_id == Game.id)
                .outerjoin(AnalysisJob, AnalysisJob.id == GameReview.job_id)
            ).all()
            completed = [game.id for game, status, _ in rows if status == "completed"]
            saved = load_accuracy_scores(db, completed)
            facts = [
                game_facts(game, saved.get(game.id) if status == "completed" else None, rating)
                for game, status, rating in rows
            ]
        return summarize(facts, speed=speed, days=days, offset_minutes=offset)

    return router
