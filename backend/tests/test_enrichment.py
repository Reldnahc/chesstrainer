import copy

import pytest
from explanation_fixtures import seed_review
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from trainer.api import create_app
from trainer.classification import verified_payload
from trainer.engine import EngineUnavailable, Stockfish
from trainer.enrichment import enrich_decision, plan_probes
from trainer.models import (
    AnalysisJob,
    ClassificationAnalysis,
    ClassificationRun,
    ClassificationTask,
    Decision,
    ExerciseAnswer,
    SRSState,
)


@pytest.mark.stockfish
def test_bounded_probes_cache_resume_and_preserve_grading(settings, stockfish_path):
    settings.stockfish_path = stockfish_path
    settings.classification_probe_positions = 1
    settings.classification_probe_time = 0.05
    settings.classification_probe_depth = 12
    app = create_app(settings, workers=False)
    with TestClient(app) as client:
        with app.state.sessions() as db:
            seed_review(db, settings, key="one")
            seed_review(db, settings, black=True, key="two")
            decisions = {
                d.id: (d.before_analysis_id, d.played_analysis_id)
                for d in db.scalars(select(Decision))
            }
            answers = [
                (a.exercise_id, a.uci, a.grade, a.analysis_id)
                for a in db.scalars(select(ExerciseAnswer))
            ]
            states = [
                (s.exercise_id, copy.deepcopy(s.card), s.due, s.reviews)
                for s in db.scalars(select(SRSState))
            ]
        job_id = client.post("/api/classifications/enrich").json()["job_id"]
        assert client.post("/api/classifications/enrich").json()["job_id"] == job_id
        engine = Stockfish(settings, app.state.sessions)
        try:
            with app.state.sessions() as db:
                tasks = plan_probes(db, job_id, settings, engine)
                assert len(tasks) == 1
            settings.classification_probe_depth += 1
            with pytest.raises(EngineUnavailable, match="settings changed"):
                enrich_decision(
                    app.state.sessions,
                    tasks[0],
                    engine,
                    app.state.runner.import_lock,
                    lambda: False,
                )
            settings.classification_probe_depth -= 1
            # Cancel after the first search; it is still in the persistent engine cache.
            assert not enrich_decision(
                app.state.sessions, tasks[0], engine, app.state.runner.import_lock, lambda: True
            )
            misses = engine.misses
            assert enrich_decision(
                app.state.sessions, tasks[0], engine, app.state.runner.import_lock, lambda: False
            )
            assert engine.hits >= 1 and engine.misses == misses + 1
        finally:
            engine.close()
        app.state.runner.run_job(job_id)
        with app.state.sessions() as db:
            assert db.get(AnalysisJob, job_id).status == "completed"
            assert db.scalar(select(func.count()).select_from(ClassificationAnalysis)) == 1
            assert db.scalar(select(func.count()).select_from(ClassificationTask)) == 1
            assert {
                d.id: (d.before_analysis_id, d.played_analysis_id)
                for d in db.scalars(select(Decision))
            } == decisions
            assert [
                (a.exercise_id, a.uci, a.grade, a.analysis_id)
                for a in db.scalars(select(ExerciseAnswer))
            ] == answers
            assert [
                (s.exercise_id, s.card, s.due, s.reviews) for s in db.scalars(select(SRSState))
            ] == states
            supplement = db.scalar(select(ClassificationAnalysis))
            payload = verified_payload(db, db.get(Decision, supplement.decision_id))
            assert payload["evidence_ids"] == [
                supplement.before_analysis_id,
                supplement.played_analysis_id,
            ]
            run = db.scalar(select(ClassificationRun))
            assert run.status == "completed"
        # Retrying this job cannot expand its persisted one-position budget.
        app.state.runner.run_job(job_id)
        with app.state.sessions() as db:
            assert db.scalar(select(func.count()).select_from(ClassificationAnalysis)) == 1
            assert db.scalar(select(func.count()).select_from(ClassificationRun)) == 1
