"""Read-only library insights over saved games and completed reviews."""

from fastapi import APIRouter, Query
from sqlalchemy import select

from trainer.contracts.insights import Insights, SpeedFilter
from trainer.game_insights import game_facts, summarize
from trainer.job_lifecycle import JobStatus
from trainer.models import AnalysisJob, Game, GameReview
from trainer.recent_cache import RecentCache
from trainer.review_reports import load_accuracy_scores
from trainer.workspaces import CurrentWorkspace

# Per-game facts for every account's library; ids are unique across accounts.
# A reviewed 80-ply game's facts take about 17 KB (measured with tracemalloc), so
# the bound keeps the cache near 100 MB. A larger library replays only the games
# beyond the bound on each request, about 7 ms each.
FACTS_CACHE_SIZE = 6000
_facts = RecentCache(FACTS_CACHE_SIZE)


def create_router():
    router = APIRouter()

    @router.get("/api/insights", response_model=Insights)
    def insights(
        workspace: CurrentWorkspace,
        speed: SpeedFilter = "all",
        days: int | None = Query(None, ge=1, le=3650),
        # Minutes east of UTC, so weekday and time-of-day use the viewer's clock.
        offset: int = Query(0, ge=-840, le=840),
    ):
        with workspace.sessions() as db:
            rows = db.execute(
                select(Game, AnalysisJob.status, GameReview.rating, GameReview.revision)
                .outerjoin(GameReview, GameReview.game_id == Game.id)
                .outerjoin(AnalysisJob, AnalysisJob.id == GameReview.job_id)
                .where(Game.counts_in_stats())
            ).all()
            # A game's facts change only with its review (every saved or adopted
            # report bumps the revision), so each is replayed once per revision.
            keyed = [
                (
                    (game.id, game.learner_color, game.played_at, revision, rating, status),
                    game,
                    status == JobStatus.COMPLETED,
                    rating,
                )
                for game, status, rating, revision in rows
            ]
            # Every hit is taken before any miss is stored, so a library larger
            # than the cache still reuses what the cache holds instead of each new
            # entry evicting one this request is about to read.
            cached = {key: value for key, *_ in keyed if (value := _facts.get(key)) is not None}
            saved = load_accuracy_scores(
                db,
                [game.id for key, game, completed, _ in keyed if completed and key not in cached],
            )
            facts = [
                cached[key]
                if key in cached
                else _facts.put(
                    key, game_facts(game, saved.get(game.id) if completed else None, rating)
                )
                for key, game, completed, rating in keyed
            ]
        return summarize(facts, speed=speed, days=days, offset_minutes=offset)

    return router
