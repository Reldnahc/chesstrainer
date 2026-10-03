"""Every saved game gets one analysis job; fresh games run before older backfill."""

from sqlalchemy import select

from trainer.models import AnalysisJob, Game, GameReview, ImportGame

# Lower runs sooner. A game the learner opens beats games the poller found,
# which beat older games brought in by a manual or PGN import.
REQUESTED, FRESH, BACKFILL = 0, 10, 20
DEFAULT_RATING = 1000


def queue_games(db, game_ids, priority):
    """Queue review + training analysis for each game, raising queued priority.

    Completed, running, failed and cancelled jobs are left alone; the learner
    can retry those from the game. Returns how many jobs were created.
    """
    created = 0
    for game_id in game_ids:
        review = db.get(GameReview, game_id)
        if review is None:
            job = AnalysisJob(kind="game_review", games_total=1, priority=priority)
            db.add(job)
            db.flush()
            db.add(GameReview(game_id=game_id, job_id=job.id, rating=DEFAULT_RATING))
            created += 1
            continue
        job = db.get(AnalysisJob, review.job_id)
        if job.status == "queued" and job.priority > priority:
            job.priority = priority
    return created


def unanalyzed_game_ids(db, import_id=None):
    query = (
        select(Game.id)
        .outerjoin(GameReview, GameReview.game_id == Game.id)
        .where(GameReview.game_id.is_(None))
    )
    if import_id is not None:
        query = query.join(ImportGame, ImportGame.game_id == Game.id).where(
            ImportGame.import_id == import_id
        )
    return db.scalars(query).all()


def queue_imported(db, import_id, priority):
    """Queue an import's unanalyzed games, then any other saved game as backfill."""
    created = queue_games(db, unanalyzed_game_ids(db, import_id), priority)
    return created + queue_games(db, unanalyzed_game_ids(db), BACKFILL)
