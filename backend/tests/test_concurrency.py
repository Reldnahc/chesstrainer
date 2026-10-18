"""Scheduling fixtures test overlap and persistence, never model-provided chess truth."""

import threading
import time
from collections import Counter

import chess
import pytest
from classifier_fixtures import FixtureClassifierBase
from fastapi.testclient import TestClient
from job_fixtures import queue_import_analysis
from sqlalchemy import event, func, select
from trainer.api import create_app
from trainer.chess_core import Candidate, Score, position_key
from trainer.classification import Classification
from trainer.engine import EngineUnavailable
from trainer.imports import import_games, learner_decisions
from trainer.jobs import JobRunner
from trainer.models import AnalysisJob, ClassificationRun, Decision, EngineAnalysis, Game
from trainer.scheduling import FSRSScheduler
from trainer.taxonomy import seed_skills


def saved_job(sessions, games=4, decisions_per_game=2, kind="classification"):
    with sessions() as db:
        seed_skills(db)
        db.commit()
        pgn = "\n\n".join(
            f'[White "Learner"]\n[Black "Opponent"]\n[Round "{i}"]\n\n1. f3 e5 2. g4 Qh4# 0-1'
            for i in range(games)
        )
        imported = import_games(db, "fixture.pgn", pgn, ["Learner"], None)
        db.commit()
        imported["job_id"] = queue_import_analysis(db, imported)
        job = db.get(AnalysisJob, imported["job_id"])
        job.kind = kind
        for game in db.scalars(select(Game)):
            for index, (ply, board, move) in enumerate(learner_decisions(game)):
                if index >= decisions_per_game:
                    break
                candidate = next(iter(board.legal_moves))
                analysis = EngineAnalysis(
                    cache_key=f"fixture-{game.id}-{ply}",
                    fen=board.fen(),
                    engine_version="fixture",
                    config={},
                    candidates=[
                        Candidate(
                            uci=candidate.uci(),
                            san=board.san(candidate),
                            score=Score(kind="cp", value=0),
                            pv=[candidate.uci()],
                        ).model_dump()
                    ],
                )
                db.add(analysis)
                db.flush()
                db.add(
                    Decision(
                        game_id=game.id,
                        ply=ply,
                        fen=board.fen(),
                        position_key=position_key(board),
                        learner_color=board.turn,
                        move_uci=move.uci(),
                        move_san=board.san(move),
                        before_analysis_id=analysis.id,
                        played_analysis_id=analysis.id,
                        loss_cp=200,
                        meaningful=True,
                        deep=True,
                    )
                )
        db.commit()
        return job.id


class BlockingClassifier(FixtureClassifierBase):
    model = "concurrency-fixture"

    def __init__(self, workers):
        self.workers = workers
        self.entered = threading.Event()
        self.release = threading.Event()
        self.lock = threading.Lock()
        self.active = self.peak = 0
        self.calls = []

    def classify(self, evidence):
        with self.lock:
            self.active += 1
            self.peak = max(self.peak, self.active)
            self.calls.append(evidence["decision_id"])
            if self.active == self.workers:
                self.entered.set()
        try:
            assert self.release.wait(10), "Calls did not overlap before timeout"
            return Classification(
                decision_id=evidence["decision_id"],
                primary_skill="unclassified",
                secondary_skills=[],
                confidence=0.2,
                explanation="Scheduling fixture.",
            )
        finally:
            with self.lock:
                self.active -= 1


def wait_status(client, job_id, statuses):
    until = time.monotonic() + 15
    while time.monotonic() < until:
        job = next(j for j in client.get("/api/jobs").json() if j["id"] == job_id)
        if job["status"] in statuses:
            return job
        time.sleep(0.05)
    pytest.fail(f"Job did not finish: {job}")


@pytest.mark.parametrize("games,decisions", [(1, 2)])
def test_llm_concurrency_cancel_and_resume_without_repeat_calls(
    settings, sessions, games, decisions
):
    settings.stockfish_path = "missing-for-classification-only"
    settings.stockfish_workers = 2
    settings.classification_workers = 2
    job_id = saved_job(sessions, games, decisions)
    classifier = BlockingClassifier(2)
    with TestClient(create_app(settings, classifier=classifier)) as client:
        try:
            assert classifier.entered.wait(10), "Expected two concurrent model calls"
            job = next(j for j in client.get("/api/jobs").json() if j["id"] == job_id)
            assert job["activity"]["classifications"]["active"] == 2
            assert job["activity"]["classifications"]["pending"] <= 4
            client.post(f"/api/jobs/{job_id}/cancel")
        finally:
            classifier.release.set()
        cancelled = wait_status(client, job_id, {"cancelled", "failed"})
        assert cancelled["status"] == "cancelled", cancelled
        with sessions() as db:
            assert (
                db.scalar(
                    select(func.count())
                    .select_from(ClassificationRun)
                    .where(ClassificationRun.status == "completed")
                )
                == 2
            )
        assert classifier.peak == 2 and len(classifier.calls) == 2
        client.post(f"/api/jobs/{job_id}/retry")
        completed = wait_status(client, job_id, {"completed", "failed"})
        assert completed["status"] == "completed", completed
        assert completed["games_processed"] == games
        assert completed["classifications_completed"] == games * decisions
        assert len(classifier.calls) == games * decisions
        assert set(Counter(classifier.calls).values()) == {1}


def test_failed_worker_drains_and_closes_processes_before_next_job(
    settings, sessions, sql_engine, monkeypatch
):
    settings.stockfish_workers = 2
    job_id = saved_job(sessions, kind="analysis")
    engines = []

    class BrokenEngine:
        def __init__(self, *_):
            self.closed = False
            engines.append(self)

        def close(self):
            self.closed = True

    def broken_analysis(units, engine, *_):
        engine()  # Engines start lazily; start one so the drain has a process to close.
        raise EngineUnavailable("Fixture engine exited")

    monkeypatch.setattr("trainer.pipeline.analyze_decision", broken_analysis)
    runner = JobRunner(settings, sql_engine, FSRSScheduler(settings), engine_factory=BrokenEngine)
    assert runner.claim() == job_id
    runner.run_job(job_id)
    with sessions() as db:
        failed = db.get(AnalysisJob, job_id)
        assert failed.status == "failed" and "exited" in failed.error
        assert db.scalar(select(func.count()).select_from(Decision)) == 8
        followup = AnalysisJob(kind="classification")
        db.add(followup)
        db.commit()
        next_id = followup.id
    assert engines and all(engine.closed for engine in engines)
    assert runner.activity(job_id) is None
    assert runner.claim() == next_id
    runner.run_job(next_id)
    with sessions() as db:
        assert db.get(AnalysisJob, next_id).status == "completed"


def test_a_game_holds_no_database_connection_while_stockfish_searches(
    settings, sessions, sql_engine
):
    settings.stockfish_workers = 1
    with sessions() as db:
        seed_skills(db)
        db.commit()
        pgn = '[White "Learner"]\n[Black "Opponent"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 *'
        imported = import_games(db, "held.pgn", pgn, ["Learner"], None)
        db.commit()
        job_id = queue_import_analysis(db, imported)
    held, searches = Counter(), []
    lock = threading.Lock()

    def checkout(*_):
        with lock:
            held[threading.get_ident()] += 1

    def checkin(*_):
        with lock:
            held[threading.get_ident()] -= 1

    class SearchFixture:
        """Every move scores 0.00, so nothing is a mistake and nothing is classified."""

        def __init__(self, _settings, engine_sessions):
            self.sessions = engine_sessions

        def analyze(self, board, _profile=None, *, root_moves=None, **_):
            with lock:
                searches.append(held[threading.get_ident()])
            move = (
                chess.Move.from_uci(root_moves[0]) if root_moves else next(iter(board.legal_moves))
            )
            with self.sessions() as cache:
                analysis = EngineAnalysis(
                    cache_key=f"held-{len(searches)}",
                    fen=board.fen(),
                    engine_version="fixture",
                    config={},
                    candidates=[
                        Candidate(
                            uci=move.uci(),
                            san=board.san(move),
                            score=Score(kind="cp", value=0),
                            pv=[move.uci()],
                        ).model_dump()
                    ],
                )
                cache.add(analysis)
                cache.commit()
                return analysis

        def close(self):
            pass

    event.listen(sql_engine, "checkout", checkout)
    event.listen(sql_engine, "checkin", checkin)
    try:
        runner = JobRunner(
            settings, sql_engine, FSRSScheduler(settings), engine_factory=SearchFixture
        )
        assert runner.claim() == job_id
        runner.run_job(job_id)
    finally:
        event.remove(sql_engine, "checkout", checkout)
        event.remove(sql_engine, "checkin", checkin)
    with sessions() as db:
        job = db.get(AnalysisJob, job_id)
        assert job.status == "completed", job.error
        assert db.scalar(select(func.count()).select_from(Decision)) == 3
    # Two searches per learner move, each started with no connection checked out
    # by the searching thread.
    assert searches and set(searches) == {0}
