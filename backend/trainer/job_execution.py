"""One job's execution, with its owner's resources captured before any work starts."""

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
    def __init__(self, runner, workspace):
        self.runner = runner
        self.settings, self.sessions = runner.settings, workspace.sessions
        self.human_models = workspace.human_models
        self.scheduler, self.classifier = runner.scheduler, runner.classifier
        self.engine_factory = runner.engine_factory
        self.mutation_lock = workspace.mutation_lock
        self.pipeline = None

    def cancelled(self, job_id):
        return self.runner.cancelled(job_id)

    def run(self, job_id, engine=None):
        log.info("job_started", extra={"job_id": job_id})
        try:
            with self.sessions() as db:
                kind = db.get(AnalysisJob, job_id).kind
            handlers = {
                JobKind.GAME_REVIEW: self.run_review,
                JobKind.SYNC: self.run_fetch,
                JobKind.CHESSCOM_FETCH: self.run_fetch,
                JobKind.PROVIDER_FETCH: self.run_fetch,
                JobKind.CLASSIFICATION: self.run_games,
                JobKind.ENRICHMENT: self.run_games,
                JobKind.PUZZLE_GENERATION: self.run_games,
                JobKind.ANALYSIS: self.run_games,
                JobKind.LEVEL_FIT: self.run_level_fit,
            }
            if kind not in handlers:
                raise ValueError(f"Unknown job kind {kind!r}")
            handlers[kind](job_id, kind, engine)
        except ImportCancelled:
            self.finish(job_id)
        except Exception as exc:
            log.exception("job_failed", extra={"job_id": job_id, "error_type": type(exc).__name__})
            with self.sessions() as db:
                job_lifecycle.fail(
                    db.get(AnalysisJob, job_id),
                    str(exc)
                    if isinstance(exc, (EngineUnavailable, ProviderError))
                    else f"{type(exc).__name__}: analysis interrupted; completed work retained.",
                )
                db.commit()
            # A caller that supplied ``engine`` owns it and closes it.
        finally:
            self.pipeline = None

    def finish(self, job_id, then=None):
        """Complete the job, or settle its cancellation; ``then(db, job)`` runs on completion."""
        with self.sessions() as db:
            job = db.get(AnalysisJob, job_id)
            if self.cancelled(job_id):
                job_lifecycle.finish_cancel(job)
            else:
                job_lifecycle.complete(job)
                if then:
                    then(db, job)
            db.commit()

    def run_review(self, job_id, kind, engine):

        run_review(self, job_id, engine)
        if not self.cancelled(job_id):
            self.train(job_id, engine)
        self.finish(job_id)

    def run_fetch(self, job_id, kind, engine):
        with self.sessions() as db:
            provider = db.get(ProviderImport, job_id).provider
        # One provider request at a time on the host, through the shared cooldown.
        with self.runner.providers.client(provider) as client:
            fetch_import(
                job_id,
                self.sessions,
                self.settings,
                client,
                lambda: self.cancelled(job_id),
                self.mutation_lock,
            )

        def queue_games(db, job):
            # Poller finds are fresh; manual imports of older games backfill.
            queue_imported(db, job.import_id, FRESH if kind == JobKind.SYNC else BACKFILL)

        with self.mutation_lock:
            self.finish(job_id, queue_games)

    def run_level_fit(self, job_id, kind, engine):

        run_level_fit(self, job_id)
        self.finish(job_id)

    def run_games(self, job_id, kind, engine):
        with self.sessions() as db:
            job = db.get(AnalysisJob, job_id)
            if kind == JobKind.CLASSIFICATION:
                game_ids = db.scalars(select(Game.id)).all()
            elif kind == JobKind.PUZZLE_GENERATION:
                game_ids = generation.unsearched_games(db, self.settings.puzzle_generation_games)
            elif kind == JobKind.ANALYSIS:
                game_ids = db.scalars(
                    select(ImportGame.game_id).where(
                        ImportGame.import_id == job.import_id, ImportGame.is_new.is_(True)
                    )
                ).all()
            else:
                game_ids = []
            job.games_total = len(game_ids)
            db.commit()
        self.pipeline = JobPipeline(self, job_id, engine)
        if kind == JobKind.ENRICHMENT:
            self.pipeline.run_enrichment()
        elif kind == JobKind.PUZZLE_GENERATION:
            self.pipeline.run_generation(game_ids)
        else:
            self.pipeline.run(game_ids, classification_only=kind == JobKind.CLASSIFICATION)
        with self.mutation_lock:
            self.finish(job_id)
        log.info("job_completed", extra={"job_id": job_id})

    def train(self, job_id, engine):
        """Training decisions (Weaknesses, practice) for the reviewed game."""
        with self.sessions() as db:
            game_id = db.scalar(select(GameReview.game_id).where(GameReview.job_id == job_id))
        if game_id is None:
            return  # The review saved no game, so there is nothing to train from.
        self.pipeline = JobPipeline(self, job_id, engine, counters=False)
        self.pipeline.run([game_id])
