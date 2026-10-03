"""Scheduling fixtures test overlap and persistence, never model-provided chess truth."""

import threading
import time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor

import chess
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from trainer.api import create_app
from trainer.chess_core import Candidate, Score, position_key
from trainer.classification import Classification
from trainer.engine import EngineUnavailable, Stockfish
from trainer.imports import import_games, learner_decisions
from trainer.jobs import JobRunner
from trainer.models import AnalysisJob, ClassificationRun, Decision, EngineAnalysis, Game
from trainer.scheduling import FSRSScheduler
from trainer.taxonomy import seed_skills


def saved_job(sessions, games=4, decisions_per_game=2, kind="classification"):
    with sessions() as db:
        seed_skills(db)
        pgn = "\n\n".join(
            f'[White "Learner"]\n[Black "Opponent"]\n[Round "{i}"]\n\n1. f3 e5 2. g4 Qh4# 0-1'
            for i in range(games)
        )
        imported = import_games(db, "fixture.pgn", pgn, ["Learner"], None)
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
                        facts={"verified_line": []},
                    )
                )
        db.commit()
        return job.id


class BlockingClassifier:
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
            ), {}
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


@pytest.mark.parametrize("games,decisions", [(1, 2), (4, 1)])
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


def test_single_import_uses_multiple_game_workers_and_closes_engines(
    settings, sessions, monkeypatch
):
    settings.stockfish_workers = 2
    job_id = saved_job(sessions, games=4, kind="analysis")
    guard, rendezvous = threading.Lock(), threading.Barrier(2)
    active = peak = calls = 0
    engines = []

    class EngineFixture:
        def __init__(self, *_):
            self.closed = False
            with guard:
                engines.append(self)

        def close(self):
            self.closed = True

    def analysis(db, engine, config, game, ply, *_):
        nonlocal active, peak, calls
        with guard:
            active += 1
            peak = max(peak, active)
            calls += 1
            first_pair = calls <= 2
        try:
            if first_pair:
                rendezvous.wait(5)
            time.sleep(0.015)
            return db.scalar(
                select(Decision).where(Decision.game_id == game.id, Decision.ply == ply)
            )
        finally:
            with guard:
                active -= 1

    monkeypatch.setattr("trainer.pipeline.analyze_decision", analysis)
    runner = JobRunner(settings, sessions, FSRSScheduler(settings), engine_factory=EngineFixture)
    assert runner.claim() == job_id
    runner.run_job(job_id)
    with sessions() as db:
        job = db.get(AnalysisJob, job_id)
        assert job.status == "completed", job.error
        assert (job.games_processed, job.positions_triaged) == (4, 8)
    assert peak == 2 and calls == 8 and len(engines) == 2
    assert all(engine.closed for engine in engines)


@pytest.mark.stockfish
def test_concurrent_native_engines_share_identical_cached_search(
    settings, sessions, stockfish_path
):
    settings.stockfish_path = stockfish_path
    engines = [Stockfish(settings, sessions), Stockfish(settings, sessions)]
    rendezvous = threading.Barrier(2)

    def search(engine):
        engine.start()
        rendezvous.wait(10)
        return engine.analyze(chess.Board()).id

    try:
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(search, engines))
        assert results[0] == results[1]
        assert sum(engine.misses for engine in engines) == 1
        assert sum(engine.hits for engine in engines) == 1
    finally:
        for engine in engines:
            engine.close()
    assert all(engine.process is None for engine in engines)


@pytest.mark.stockfish
def test_parallel_native_import_persists_every_decision_and_classification(
    settings, sessions, stockfish_path
):
    settings.stockfish_path = stockfish_path
    settings.stockfish_workers = settings.classification_workers = 3
    engines = []

    def engine_factory(*args):
        engine = Stockfish(*args)
        engines.append(engine)
        return engine

    classifier = BlockingClassifier(3)
    classifier.release.set()
    with sessions() as db:
        seed_skills(db)
        pgn = "\n\n".join(
            f'[White "Learner"]\n[Black "Opponent"]\n[Round "native-{i}"]\n\n1. f3 e5 2. g4 Qh4# 0-1'
            for i in range(6)
        )
        imported = import_games(db, "native.pgn", pgn, ["Learner"], None)
    runner = JobRunner(
        settings,
        sessions,
        FSRSScheduler(settings),
        classifier=classifier,
        engine_factory=engine_factory,
    )
    assert runner.claim() == imported["job_id"]
    runner.run_job(imported["job_id"])
    with sessions() as db:
        job = db.get(AnalysisJob, imported["job_id"])
        assert job.status == "completed", job.error
        assert (job.games_processed, job.positions_triaged) == (6, 12)
        assert db.scalar(select(func.count()).select_from(Decision)) == 12
        meaningful = db.scalar(
            select(func.count()).select_from(Decision).where(Decision.meaningful.is_(True))
        )
        assert meaningful >= 6
        assert job.classifications_completed == meaningful == len(classifier.calls)
        assert len(set(classifier.calls)) == meaningful
    assert len(engines) == 3 and all(engine.process is None for engine in engines)


def test_analysis_continues_while_model_request_is_waiting(settings, sessions, monkeypatch):
    settings.stockfish_path = "missing-fixture-engine"
    settings.stockfish_workers = settings.classification_workers = 1
    job_id = saved_job(sessions, games=1, kind="analysis")
    classifier = BlockingClassifier(1)

    def analysis(db, engine, config, game, ply, *_):
        return db.scalar(select(Decision).where(Decision.game_id == game.id, Decision.ply == ply))

    monkeypatch.setattr("trainer.pipeline.analyze_decision", analysis)
    with TestClient(create_app(settings, classifier=classifier)) as client:
        try:
            assert classifier.entered.wait(10)
            until = time.monotonic() + 5
            while time.monotonic() < until:
                job = next(j for j in client.get("/api/jobs").json() if j["id"] == job_id)
                if job["positions_triaged"] == 2:
                    break
                time.sleep(0.05)
            assert job["positions_triaged"] == 2
            assert job["games_processed"] == 0  # Waiting classifications still belong to this game.
            assert job["activity"]["classifications"]["pending"] == 2
        finally:
            classifier.release.set()
        assert wait_status(client, job_id, {"completed", "failed"})["status"] == "completed"


def test_failed_worker_drains_and_closes_processes_before_next_job(settings, sessions, monkeypatch):
    settings.stockfish_workers = 2
    job_id = saved_job(sessions, kind="analysis")
    engines = []

    class BrokenEngine:
        def __init__(self, *_):
            self.closed = False
            engines.append(self)

        def close(self):
            self.closed = True

    def broken_analysis(db, engine, *_):
        engine()  # Engines start lazily; start one so the drain has a process to close.
        raise EngineUnavailable("Fixture engine exited")

    monkeypatch.setattr("trainer.pipeline.analyze_decision", broken_analysis)
    runner = JobRunner(settings, sessions, FSRSScheduler(settings), engine_factory=BrokenEngine)
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
