"""One job's bounded chess and pedagogy stages, with independent process/session ownership."""

import threading
from contextlib import contextmanager

from sqlalchemy import select, update

from trainer.analysis import analyze_decision
from trainer.classification import classify_decision
from trainer.enrichment import enrich_decision, plan_probes
from trainer.exercises import exercise_from_decision
from trainer.imports import learner_decisions
from trainer.models import AnalysisJob, Decision, Game
from trainer.puzzles.generation import EngineSearch, generate_for_game
from trainer.work_pool import GameCompletion, WorkPool


class JobPipeline:
    def __init__(self, runner, job_id, engine_override=None, *, counters=True):
        self.runner, self.job_id = runner, job_id
        # A game review job reuses this pipeline; its counters describe the review.
        self.counters = counters
        self.sessions, self.settings = runner.sessions, runner.settings
        self.engine_override = engine_override
        self.local = threading.local()
        self.engines = []
        self.engines_lock = threading.Lock()
        self.failed = threading.Event()
        self.games = WorkPool(
            1 if engine_override else self.settings.stockfish_workers, "chess", self.cancelled
        )
        self.classifications = WorkPool(
            self.settings.classification_workers, "pedagogy", self.cancelled
        )

    def cancelled(self):
        return self.failed.is_set() or self.runner.cancelled(self.job_id)

    def bump(self, **increments):
        # SQL increments and a short shared write lock prevent lost progress updates.
        if not self.counters:
            return
        with self.runner.write() as db:
            db.execute(
                update(AnalysisJob)
                .where(AnalysisJob.id == self.job_id)
                .values(
                    **{
                        name: getattr(AnalysisJob, name) + value
                        for name, value in increments.items()
                    }
                )
            )

    def engine(self):
        if self.engine_override:
            return self.engine_override
        if not hasattr(self.local, "engine"):
            engine = self.runner.engine_factory(self.settings, self.sessions)
            self.local.engine = engine
            with self.engines_lock:
                self.engines.append(engine)
        return self.local.engine

    def classify(self, decision_id, completion):
        success = False
        try:
            if self.cancelled():
                return
            classified = classify_decision(self.runner, decision_id, self.runner.classifier)
            self.bump(classifications_completed=int(classified))
            success = True
        except Exception:
            self.failed.set()
            raise
        finally:
            completion.finish(success)

    def process_decision(self, decision, completion, ensure_exercise=True):
        if decision.meaningful and ensure_exercise:
            with self.runner.write() as db:
                exercise_from_decision(db, decision, self.settings, self.runner.scheduler)
        self.bump(
            positions_triaged=1,
            deep_completed=int(decision.deep),
            mistakes_identified=int(decision.meaningful),
        )
        if decision.meaningful:
            completion.add()
            if not self.classifications.submit(self.classify, decision.id, completion):
                completion.finish(False)

    def game(self, game_id, classification_only):
        completion = GameCompletion(lambda: self.bump(games_processed=1))
        success = False
        try:
            if self.cancelled():
                return
            with self.runner.read() as db:
                if classification_only:
                    # Saved decision records suffice: no PGN replay or Stockfish process.
                    decisions = db.scalars(
                        select(Decision).where(Decision.game_id == game_id).order_by(Decision.ply)
                    ).all()
                else:
                    game = db.get(Game, game_id)
            if classification_only:
                for decision in decisions:
                    if self.cancelled():
                        return
                    self.process_decision(decision, completion, ensure_exercise=False)
            else:
                for ply, board, move in learner_decisions(game):
                    if self.cancelled():
                        return
                    decision = analyze_decision(
                        self.runner, self.engine, self.settings, game, ply, board, move
                    )
                    self.process_decision(decision, completion)
                if self.settings.puzzle_generation:
                    # The game's decisions are committed; mine them while the
                    # engine is warm. Classification runs independently.
                    self.mine(game_id)
            success = True
        except Exception:
            self.failed.set()
            raise
        finally:
            completion.finish(success)

    def mine(self, game_id):
        result = generate_for_game(
            self.runner,
            EngineSearch(self.engine(), self.settings),
            self.settings,
            game_id,
            cancelled=self.cancelled,
        )
        if result is not None:
            self.bump(puzzles_found=result["kept"])
        return result

    def generate(self, game_id):
        try:
            if self.cancelled():
                return
            result = self.mine(game_id)
            if result is not None:
                self.bump(games_processed=1)
        except Exception:
            self.failed.set()
            raise

    @contextmanager
    def _drain(self):
        """Run a submitting block, then always drain both pools and close engines.

        Producers finish before their consumer pool closes. Already-started work
        commits even on cancel; queued tasks check cancellation before running.
        The first worker error from either pool is raised once both are drained.
        """
        try:
            yield
        finally:
            self.games.close()
            self.classifications.close()
            for engine in self.engines:
                engine.close()
        errors = self.games.errors + self.classifications.errors
        if errors:
            raise errors[0]

    def run_generation(self, game_ids):
        with self._drain():
            for game_id in game_ids:
                if not self.games.submit(self.generate, game_id):
                    break

    def run(self, game_ids, classification_only=False):
        with self._drain():
            for game_id in game_ids:
                if not self.games.submit(self.game, game_id, classification_only):
                    break

    def probe(self, task):
        if self.cancelled():
            return
        if not enrich_decision(self.runner, task, self.engine(), self.cancelled):
            return
        classified = classify_decision(self.runner, task.decision_id, self.runner.classifier)
        self.bump(positions_triaged=1, deep_completed=1, classifications_completed=int(classified))

    def run_enrichment(self):
        with self._drain():
            tasks = plan_probes(self.runner, self.job_id, self.settings, self.engine())
            for task in tasks:
                if not self.games.submit(self.probe, task):
                    break

    def snapshot(self):
        return {"games": self.games.snapshot(), "classifications": self.classifications.snapshot()}
