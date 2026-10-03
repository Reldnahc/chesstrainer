import importlib.util
import time
from pathlib import Path

import chess
import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sqlalchemy import func, select
from trainer.api import create_app
from trainer.chess_core import Candidate, Score
from trainer.classification import Classification, classify_decision
from trainer.exercises import manual_exercise
from trainer.imports import import_games
from trainer.jobs import JobRunner
from trainer.models import (
    AnalysisJob,
    ClassificationRun,
    Decision,
    EngineAnalysis,
    Game,
    SkillEvidence,
)
from trainer.scheduling import FSRSScheduler
from trainer.taxonomy import seed_skills

PGN = '[White "Learner"]\n[Black "Opponent"]\n\n1. f3 e5 2. g4 Qh4# 0-1'


class FixtureClassifier:
    model = "test-classifier"
    calls = 0
    confidence = 0.9
    wrong_id = False
    fail = False

    def classify(self, evidence):
        self.calls += 1
        if self.fail:
            raise TimeoutError("Simulated network timeout")
        return Classification(
            decision_id="unrelated" if self.wrong_id else evidence["decision_id"],
            primary_skill="king_safety",
            secondary_skills=[],
            confidence=self.confidence,
            explanation="Verified mate threat.",
        ), {"input_tokens": 10, "output_tokens": 5}


@pytest.fixture
def decision(sessions):
    with sessions() as db:
        seed_skills(db)
        import_games(db, "fixture.pgn", PGN, ["Learner"], None)
        analysis = EngineAnalysis(
            cache_key="fixture",
            fen=chess.STARTING_FEN,
            engine_version="test",
            config={},
            candidates=[
                Candidate(
                    uci="e2e4", san="e4", score=Score(kind="cp", value=0), pv=["e2e4"]
                ).model_dump()
            ],
        )
        db.add(analysis)
        db.flush()
        item = Decision(
            game_id=db.scalar(select(Game.id)),
            ply=1,
            fen=chess.STARTING_FEN,
            position_key="fixture",
            learner_color=True,
            move_uci="f2f3",
            move_san="f3",
            before_analysis_id=analysis.id,
            played_analysis_id=analysis.id,
            loss_cp=200,
            meaningful=True,
            facts={"verified_line": []},
        )
        db.add(item)
        db.commit()
        return item.id


def test_classification_failure_retry_cache_and_evidence(settings, sessions, decision):
    classifier = FixtureClassifier()
    with sessions() as db:
        item = db.get(Decision, decision)
        classifier.fail = True
        assert not classify_decision(db, item, classifier, settings)
        assert db.scalar(select(ClassificationRun)).status == "failed"
        assert db.get(EngineAnalysis, item.before_analysis_id)
        classifier.fail = False
        assert classify_decision(db, item, classifier, settings)
        assert classify_decision(db, item, classifier, settings)
        assert classifier.calls == 2
        run = db.scalar(select(ClassificationRun))
        assert run.attempts == 2 and run.response["decision_id"] == decision
        assert db.scalar(select(SkillEvidence)).classification_run_id == run.id


@pytest.mark.parametrize("confidence,wrong_id", [(0.3, False), (0.9, True)])
def test_unreliable_classification_cannot_create_skill(
    settings, sessions, decision, confidence, wrong_id
):
    classifier = FixtureClassifier()
    classifier.confidence, classifier.wrong_id = confidence, wrong_id
    with sessions() as db:
        classify_decision(db, db.get(Decision, decision), classifier, settings)
        assert db.scalar(select(func.count()).select_from(SkillEvidence)) == 0


@pytest.mark.stockfish
def test_async_api_import_to_review_reload(settings, stockfish_path):
    settings.stockfish_path = stockfish_path
    with TestClient(create_app(settings, classifier=FixtureClassifier())) as client:
        response = client.post(
            "/api/imports",
            files={"file": ("fixture.pgn", PGN, "text/plain")},
            data={"usernames": "Learner"},
        )
        assert response.status_code == 200
        # The import only saves the game; its own analysis job then reviews and trains it.
        deadline = time.monotonic() + 25
        while time.monotonic() < deadline:
            queue = client.get("/api/analysis/queue").json()
            if queue["completed"] + queue["failed"]:
                break
            time.sleep(0.1)
        assert (queue["completed"], queue["failed"]) == (1, 0), queue
        assert client.get("/api/stats").json()["reviews"] == 0
        next_id = client.get("/api/review/queue").json()[0]["exercise_id"]
        session = client.post(f"/api/review/{next_id}/start").json()
        shown = client.post(f"/api/review/sessions/{session['session_id']}/reveal").json()
        assert shown["answers"]
        assert client.get("/api/stats").json()["reviews"] == 1
    with TestClient(create_app(settings, workers=False)) as client:
        assert client.get("/api/stats").json()["reviews"] == 1
        assert client.get("/api/weaknesses").json()["skills"]


@pytest.mark.stockfish
def test_cancel_classification_then_resume_calls_only_unfinished_evidence(
    settings, sessions, stockfish_path
):
    from trainer.engine import Stockfish

    settings.stockfish_path = stockfish_path
    with sessions() as db:
        seed_skills(db)
        result = import_games(db, "two.pgn", PGN + '\n\n[Round "2"]\n' + PGN, ["Learner"], None)
    calls = []

    class CancellingClassifier(FixtureClassifier):
        def classify(self, evidence):
            calls.append(evidence["decision_id"])
            if len(calls) == 1:
                with sessions() as db:
                    db.get(AnalysisJob, result["job_id"]).cancel_requested = True
                    db.commit()
            return super().classify(evidence)

    runner = JobRunner(
        settings, sessions, FSRSScheduler(settings), classifier=CancellingClassifier()
    )
    engine = Stockfish(settings, sessions)
    try:
        assert runner.claim() == result["job_id"]
        runner.run_job(result["job_id"], engine)
        with sessions() as db:
            job = db.get(AnalysisJob, result["job_id"])
            assert job.status == "cancelled"
            assert (
                db.scalar(
                    select(func.count())
                    .select_from(ClassificationRun)
                    .where(ClassificationRun.status == "completed")
                )
                == 1
            )
            job.status, job.cancel_requested = "queued", False
            db.commit()
        assert runner.claim() == result["job_id"]
        runner.run_job(result["job_id"], engine)
        with sessions() as db:
            assert db.get(AnalysisJob, result["job_id"]).status == "completed"
            meaningful = db.scalar(
                select(func.count()).select_from(Decision).where(Decision.meaningful.is_(True))
            )
            assert meaningful >= 2
            assert len(calls) == len(set(calls)) == meaningful
        # A new classification job scans saved evidence, but makes no repeat provider calls.
        with sessions() as db:
            retry = AnalysisJob(kind="classification")
            db.add(retry)
            db.commit()
            retry_id = retry.id
        assert runner.claim() == retry_id
        runner.run_job(retry_id, engine)
        assert len(calls) == meaningful
    finally:
        engine.close()


def test_recover_cancel_and_partial_import(settings, sessions):
    with sessions() as db:
        result = import_games(
            db,
            "mixed.pgn",
            PGN + '\n\n[White "Learner"]\n[Black "Bad"]\n\n1. e4 e5 2. Bh6 *\n\n' + PGN,
            ["Learner"],
            None,
        )
        assert result["errors"] and result["imported"] == 1
        job = db.get(AnalysisJob, result["job_id"])
        job.status = "running"
        db.commit()
    runner = JobRunner(settings, sessions, FSRSScheduler(settings))
    runner.recover()
    with sessions() as db:
        job = db.get(AnalysisJob, result["job_id"])
        assert job.status == "queued"
        job.cancel_requested = True
        db.commit()
    assert runner.claim() is None
    with sessions() as db:
        assert db.get(AnalysisJob, result["job_id"]).status == "cancelled"


def test_backup_round_trip_has_no_secrets(settings, sessions, tmp_path):
    spec = importlib.util.spec_from_file_location("backup", Path("scripts/backup.py"))
    backup = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(backup)
    settings.lan_access_token = SecretStr("PRIVATE-TOKEN")
    with sessions() as db:
        manual_exercise(db, FSRSScheduler(settings), chess.STARTING_FEN, ["e2e4"], "white")
    archive = backup.export_backup(tmp_path / "backup.zip", settings)
    import zipfile

    with zipfile.ZipFile(archive) as contents:
        assert b"NEVER-IN-BACKUP" not in contents.read("settings.json")
        assert b"PRIVATE-TOKEN" not in contents.read("settings.json")
    destination = tmp_path / "restored.sqlite3"
    backup.restore_backup(archive, destination)
    import sqlite3

    with sqlite3.connect(destination) as db:
        assert db.execute("SELECT COUNT(*) FROM exercises").fetchone()[0] == 1
    with pytest.raises(ValueError):
        backup.restore_backup(archive, destination)


def test_unavailable_unknown_move_does_not_fail_recall(settings, sessions, decision):
    from trainer.engine import EngineUnavailable
    from trainer.exercises import exercise_from_decision
    from trainer.models import SRSState
    from trainer.reviews import start_review, submit_move

    class MissingEngine:
        def analyze(self, *args, **kwargs):
            raise EngineUnavailable("Unavailable for verification")

    scheduler = FSRSScheduler(settings)
    with sessions() as db:
        exercise = exercise_from_decision(db, db.get(Decision, decision), settings, scheduler)
        session = start_review(db, exercise.id)
        with pytest.raises(EngineUnavailable):
            submit_move(db, session["session_id"], "d2d4", MissingEngine(), scheduler, settings)
        assert db.get(SRSState, exercise.id).reviews == 0


def test_restore_refuses_stale_sqlite_sidecars_and_leaves_no_partial_files(
    settings, sessions, tmp_path
):
    spec = importlib.util.spec_from_file_location("backup", Path("scripts/backup.py"))
    backup = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(backup)
    with sessions() as db:
        manual_exercise(db, FSRSScheduler(settings), chess.STARTING_FEN, ["e2e4"], "white")
    archive = backup.export_backup(tmp_path / "backup.zip", settings)
    destination = tmp_path / "restored.sqlite3"
    stale = tmp_path / "restored.sqlite3-wal"
    stale.write_bytes(b"frames left behind by an interrupted server")
    # SQLite would replay a same-named WAL over the restored pages, so refuse up front.
    with pytest.raises(ValueError, match="sidecar"):
        backup.restore_backup(archive, destination)
    assert not destination.exists()
    stale.unlink()
    backup.restore_backup(archive, destination)
    assert destination.exists() and not list(tmp_path.glob("*.partial"))

    def interrupted(path):
        path.write_bytes(b"truncated")
        raise OSError("disk full")

    with pytest.raises(OSError):
        backup.write_atomically(interrupted, tmp_path / "broken.zip")
    assert not (tmp_path / "broken.zip").exists()
    assert not (tmp_path / "broken.zip.partial").exists()
