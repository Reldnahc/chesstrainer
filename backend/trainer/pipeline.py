"""One job's bounded chess and pedagogy stages, with independent process/session ownership."""

import threading

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
        with self.runner.import_lock, self.sessions() as db:
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
            db.commit()

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
            with self.sessions() as db:
                classified = classify_decision(
                    db,
                    decision_id,
                    self.runner.classifier,
                    self.settings,
                    write_lock=self.runner.import_lock,
                )
            self.bump(classifications_completed=int(classified))
            success = True
        except Exception:
            self.failed.set()
            raise
        finally:
            completion.finish(success)

    def process_decision(self, db, decision, completion, ensure_exercise=True):
        if decision.meaningful and ensure_exercise:
            with self.runner.import_lock:
                exercise_from_decision(db, decision, self.settings, self.runner.scheduler)
        self.bump(
            positions_triaged=1,
            deep_completed=int(decision.deep),
            mistakes_identified=int(decision.meaningful),
        )
        if decision.meaningful and self.runner.classifier:
            completion.add()
            if not self.classifications.submit(self.classify, decision.id, completion):
                completion.finish(False)

    def game(self, game_id, classification_only):
        completion = GameCompletion(lambda: self.bump(games_processed=1))
        success = False
        try:
            if self.cancelled():
                return
            with self.sessions() as db:
                if classification_only:
                    # Saved decision records suffice: no PGN replay or Stockfish process.
                    decisions = db.scalars(
                        select(Decision).where(Decision.game_id == game_id).order_by(Decision.ply)
                    ).all()
                    for decision in decisions:
                        if self.cancelled():
                            return
                        self.process_decision(db, decision, completion, ensure_exercise=False)
                else:
                    game = db.get(Game, game_id)
                    for ply, board, move in learner_decisions(game):
                        if self.cancelled():
                            return
                        decision = analyze_decision(
                            db, self.engine, self.settings, game, ply, board, move
                        )
                        self.process_decision(db, decision, completion)
                    if self.settings.puzzle_generation:
                        # The game's decisions are committed; mine them while the
                        # engine is warm. Classification runs independently.
                        self.mine(db, game)
            success = True
        except Exception:
            self.failed.set()
            raise
        finally:
            completion.finish(success)

    def mine(self, db, game):
        result = generate_for_game(
            db,
            EngineSearch(self.engine(), self.settings),
            self.settings,
            game,
            cancelled=self.cancelled,
            write_lock=self.runner.import_lock,
        )
        if result is not None:
            self.bump(puzzles_found=result["kept"])
        return result

    def generate(self, game_id):
        try:
            if self.cancelled():
                return
            with self.sessions() as db:
                result = self.mine(db, db.get(Game, game_id))
            if result is not None:
                self.bump(games_processed=1)
        except Exception:
            self.failed.set()
            raise

    def run_generation(self, game_ids):
        try:
            for game_id in game_ids:
                if not self.games.submit(self.generate, game_id):
                    break
        finally:
            self.games.close()
            self.classifications.close()
            for engine in self.engines:
                engine.close()
        if self.games.errors:
            raise self.games.errors[0]

    def run(self, game_ids, classification_only=False):
        try:
            for game_id in game_ids:
                if not self.games.submit(self.game, game_id, classification_only):
                    break
        finally:
            # Producers finish before closing their consumer pool. Already-started API
            # calls commit even on cancel; queued tasks check cancellation before calling.
            self.games.close()
            self.classifications.close()
            for engine in self.engines:
                engine.close()
        errors = self.games.errors + self.classifications.errors
        if errors:
            raise errors[0]

    def probe(self, task):
        if self.cancelled():
            return
        if not enrich_decision(
            self.sessions, task, self.engine(), self.runner.import_lock, self.cancelled
        ):
            return
        with self.sessions() as db:
            classified = classify_decision(
                db,
                task.decision_id,
                self.runner.classifier,
                self.settings,
                write_lock=self.runner.import_lock,
            )
        self.bump(positions_triaged=1, deep_completed=1, classifications_completed=int(classified))

    def run_enrichment(self):
        try:
            with self.sessions() as db:
                tasks = plan_probes(
                    db,
                    self.job_id,
                    self.settings,
                    self.engine(),
                    write_lock=self.runner.import_lock,
                )
            for task in tasks:
                if not self.games.submit(self.probe, task):
                    break
        finally:
            self.games.close()
            self.classifications.close()
            for engine in self.engines:
                engine.close()
        if self.games.errors:
            raise self.games.errors[0]

    def snapshot(self):
        return {"games": self.games.snapshot(), "classifications": self.classifications.snapshot()}
