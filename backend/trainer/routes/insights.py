"""Library insights over saved games and completed reviews."""

from fastapi import APIRouter, Query
from sqlalchemy import select

from trainer.contracts.insights import Insights, SpeedFilter
from trainer.game_insights import facts_key, game_facts, pack_facts, summarize, unpack_facts
from trainer.job_lifecycle import JobStatus
from trainer.models import AnalysisJob, Game, GameReview, InsightFacts
from trainer.review_reports import load_accuracy_scores
from trainer.workspaces import CurrentWorkspace

# Rebuilt facts are saved in batches, so a long first build keeps its progress for
# any request that arrives meanwhile or after an interruption.
SAVE_EVERY = 500


def library_facts(workspace):
    """Every counted game's facts. A game is replayed only when it, its review or the
    code has changed since its facts were saved; otherwise they are read back from its
    row, so no library is replayed per request and nothing is kept between them."""
    with workspace.sessions() as db:
        rows = db.execute(
            select(
                Game,
                AnalysisJob.status,
                GameReview.rating,
                GameReview.revision,
                InsightFacts.key,
                InsightFacts.facts,
            )
            .outerjoin(GameReview, GameReview.game_id == Game.id)
            .outerjoin(AnalysisJob, AnalysisJob.id == GameReview.job_id)
            .outerjoin(InsightFacts, InsightFacts.game_id == Game.id)
            .where(Game.counts_in_stats())
        ).all()
        facts, stale = [], []
        for index, (game, status, rating, revision, saved_key, saved) in enumerate(rows):
            completed = status == JobStatus.COMPLETED
            key = facts_key(game, rating, revision, completed)
            unpacked = None
            if key == saved_key:
                try:
                    unpacked = unpack_facts(saved)
                except Exception:  # A damaged row is rebuilt rather than failing Insights.
                    unpacked = None
            facts.append(unpacked)
            if unpacked is None:
                stale.append((index, game, rating, completed, key))
        scores = load_accuracy_scores(db, [item[1].id for item in stale if item[3]])
        rebuilt = []
        for index, game, rating, completed, key in stale:
            built = game_facts(game, scores.get(game.id) if completed else None, rating)
            facts[index] = built
            rebuilt.append(InsightFacts(game_id=game.id, key=key, facts=pack_facts(built)))
            if len(rebuilt) >= SAVE_EVERY:
                save(workspace, rebuilt)
                rebuilt = []
    save(workspace, rebuilt)
    return facts


def save(workspace, rows):
    if not rows:
        return
    with workspace.mutation_lock, workspace.sessions() as db:
        # A game deleted since it was read has nothing left to describe.
        present = set(db.scalars(select(Game.id).where(Game.id.in_([row.game_id for row in rows]))))
        for row in rows:
            if row.game_id in present:
                # Insert or replace: another request may have saved the same game meanwhile.
                db.merge(row)
        db.commit()


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
        return summarize(library_facts(workspace), speed=speed, days=days, offset_minutes=offset)

    return router
