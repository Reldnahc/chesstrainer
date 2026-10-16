"""Every saved game gets one analysis job; fresh games run before older backfill."""

from sqlalchemy import select

from trainer import job_lifecycle
from trainer.classification_stages import line_parameters
from trainer.game_library import DEFAULT_RATING
from trainer.game_review import lines_current, parsed_game
from trainer.job_lifecycle import JobKind, JobStatus
from trainer.models import (
    AnalysisJob,
    Game,
    GameReview,
    GameReviewMove,
    ImportGame,
    ReviewRefinement,
    uid,
)
from trainer.review_reports import stale_adopted

# Lower runs sooner. A game the learner opens beats games the poller found,
# which beat older games brought in by a manual or PGN import.
REQUESTED, FRESH, BACKFILL = 0, 10, 20
# Game ids per IN list, under SQLite's bound-parameter limit.
CHUNK = 500


def queue_games(db, game_ids, priority):
    """Queue review + training analysis for each game, raising queued priority.

    Completed, running, failed and cancelled jobs are left alone; the learner
    can retry those from the game. Returns how many jobs were created.
    """
    game_ids = list(dict.fromkeys(game_ids))
    jobs = {}
    for start in range(0, len(game_ids), CHUNK):
        jobs.update(
            db.execute(
                select(GameReview.game_id, AnalysisJob)
                .join(AnalysisJob, AnalysisJob.id == GameReview.job_id)
                .where(GameReview.game_id.in_(game_ids[start : start + CHUNK]))
            ).all()
        )
    for job in jobs.values():
        if job.status == JobStatus.QUEUED and job.priority > priority:
            job.priority = priority
    missing = [game_id for game_id in game_ids if game_id not in jobs]
    for game_id in missing:
        _new_review(db, game_id, priority, DEFAULT_RATING)
    return len(missing)


def _new_review(db, game_id, priority, rating):
    job = AnalysisJob(id=uid(), kind=JobKind.GAME_REVIEW, games_total=1, priority=priority)
    db.add_all([job, GameReview(game_id=game_id, job_id=job.id, rating=rating)])
    return job


def request_review(db, game, *, rating, refine, settings, human_models):
    """The learner opened ``game``: its review goes to the front of the queue.

    A failed or cancelled review runs again, and a completed one runs again
    when refinement, saved Maia evidence or its saved lines are due for a refresh.
    """
    review = db.get(GameReview, game.id)
    if review is None:
        return _new_review(db, game.id, REQUESTED, rating or DEFAULT_RATING)
    if rating is not None:
        review.rating = rating
    job = db.get(AnalysisJob, review.job_id)
    refresh = job.status == JobStatus.COMPLETED and bool(
        settings.review_refinement_positions and (refine or review.refinement_plan is None)
    )
    if refine and job.status not in job_lifecycle.ACTIVE:
        review.refinement_plan = None
        for task in db.scalars(
            select(ReviewRefinement).where(
                ReviewRefinement.game_id == game.id, ReviewRefinement.status == "unavailable"
            )
        ):
            task.status, task.reason = "pending", None
    if job.status == JobStatus.COMPLETED and human_models.can_attempt():
        parsed = parsed_game(game)
        starting = parsed.board().turn
        refresh = refresh or any(
            human_models.needs_refresh(
                row.report.get("human"),
                parsed,
                starting if row.ply % 2 else not starting,
                review.rating,
            )
            for row in db.scalars(select(GameReviewMove).where(GameReviewMove.game_id == game.id))
        )
    if job.status == JobStatus.COMPLETED and not refresh:
        # Lines saved before the shared horizon, or under another one, are read
        # again from their saved candidates; no position is searched again.
        parameters = line_parameters(settings)
        refresh = any(
            not lines_current(row.report, parameters)
            for row in db.scalars(select(GameReviewMove).where(GameReviewMove.game_id == game.id))
        ) or bool(stale_adopted(db, game.id, parameters))
    if job.status in job_lifecycle.RETRYABLE or refresh:
        job_lifecycle.requeue(job, reset_progress=True)
    job.priority = REQUESTED
    return job


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
