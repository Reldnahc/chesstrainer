"""One job's execution from its ``JobContext``, captured before any work starts."""

import logging

from sqlalchemy import select

from trainer import job_lifecycle
from trainer.engine import EngineUnavailable
from trainer.game_analysis import BACKFILL, FRESH, queue_imported
from trainer.game_providers.base import ImportCancelled, ProviderError
from trainer.game_providers.ingest import fetch_import
from trainer.job_lifecycle import JobKind
from trainer.models import AnalysisJob, Game, GameReview, ImportGame, ProviderImport
from trainer.pipeline import JobPipeline
from trainer.play.level import run_level_fit
from trainer.puzzles import generation
from trainer.review_jobs import run_review

log = logging.getLogger(__name__)


class JobExecution:
    """Runs one job from its ``JobContext``; ``pipeline`` is the running game pipeline."""

    def __init__(self, context):
        self.context = context
        self.pipeline = None

    def run(self, engine=None):
        context = self.context
        log.info("job_started", extra={"job_id": context.job_id})
        try:
            with context.read() as db:
                kind = db.get(AnalysisJob, context.job_id).kind
            handlers = {
                JobKind.GAME_REVIEW: self.run_review,
                JobKind.SYNC: self.run_fetch,
                JobKind.PROVIDER_FETCH: self.run_fetch,
                JobKind.CLASSIFICATION: self.run_games,
                JobKind.ENRICHMENT: self.run_games,
                JobKind.PUZZLE_GENERATION: self.run_games,
                JobKind.ANALYSIS: self.run_games,
                JobKind.LEVEL_FIT: self.run_level_fit,
            }
            if kind not in handlers:
                raise ValueError(f"Unknown job kind {kind!r}")
            handlers[kind](kind, engine)
        except ImportCancelled:
            self.finish()
        except Exception as exc:
            log.exception(
                "job_failed", extra={"job_id": context.job_id, "error_type": type(exc).__name__}
            )
            with context.write() as db:
                job_lifecycle.fail(
                    db.get(AnalysisJob, context.job_id),
                    str(exc)
                    if isinstance(exc, (EngineUnavailable, ProviderError))
                    else f"{type(exc).__name__}: analysis interrupted; completed work retained.",
                )
            # A caller that supplied ``engine`` owns it and closes it.
        finally:
            self.pipeline = None

    def finish(self, then=None):
        """Complete the job, or settle its cancellation; ``then(db, job)`` runs on completion."""
        with self.context.write() as db:
            job = db.get(AnalysisJob, self.context.job_id)
            # Read from the row in this unit, so a cancel cannot land in between.
            if self.context.stopping() or job.cancel_requested:
                job_lifecycle.finish_cancel(job)
            else:
                job_lifecycle.complete(job)
                if then:
                    then(db, job)

    def run_review(self, kind, engine):
        run_review(self.context, engine)
        if not self.context.cancelled():
            self.train(engine)
        self.finish()

    def run_fetch(self, kind, engine):
        context = self.context
        with context.read() as db:
            provider = db.get(ProviderImport, context.job_id).provider
        # One provider request at a time on the host, through the shared cooldown.
        with context.providers.client(provider) as client:
            fetch_import(context, client)

        def queue_games(db, job):
            # Poller finds are fresh; manual imports of older games backfill.
            queue_imported(db, job.import_id, FRESH if kind == JobKind.SYNC else BACKFILL)

        self.finish(queue_games)

    def run_level_fit(self, kind, engine):
        run_level_fit(self.context)
        self.finish()

    def run_games(self, kind, engine):
        context = self.context
        with context.write() as db:
            job = db.get(AnalysisJob, context.job_id)
            if kind == JobKind.CLASSIFICATION:
                game_ids = db.scalars(select(Game.id)).all()
            elif kind == JobKind.PUZZLE_GENERATION:
                game_ids = generation.unsearched_games(db, context.settings.puzzle_generation_games)
            elif kind == JobKind.ANALYSIS:
                game_ids = db.scalars(
                    select(ImportGame.game_id).where(
                        ImportGame.import_id == job.import_id, ImportGame.is_new.is_(True)
                    )
                ).all()
            else:
                game_ids = []
            job.games_total = len(game_ids)
        self.pipeline = JobPipeline(context, engine)
        if kind == JobKind.ENRICHMENT:
            self.pipeline.run_enrichment()
        elif kind == JobKind.PUZZLE_GENERATION:
            self.pipeline.run_generation(game_ids)
        else:
            self.pipeline.run(game_ids, classification_only=kind == JobKind.CLASSIFICATION)
        self.finish()
        log.info("job_completed", extra={"job_id": context.job_id})

    def train(self, engine):
        """Training decisions (Weaknesses, practice) for the reviewed game."""
        with self.context.read() as db:
            game_id = db.scalar(
                select(GameReview.game_id).where(GameReview.job_id == self.context.job_id)
            )
        if game_id is None:
            return  # The review saved no game, so there is nothing to train from.
        self.pipeline = JobPipeline(self.context, engine, counters=False)
        self.pipeline.run([game_id])
