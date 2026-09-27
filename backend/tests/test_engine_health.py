"""Health follows real engine use without spending CPU on idle hosted accounts."""

import json
import logging

import chess
import pytest
from fastapi.testclient import TestClient
from test_accounts import signup
from trainer.__main__ import JSONFormatter
from trainer.api import create_app
from trainer.engine import EngineReferenceMismatch, EngineUnavailable, Stockfish
from trainer.engine_health import EngineHealth
from trainer.models import AnalysisJob


@pytest.mark.parametrize("hosted", [False, True])
def test_unstarted_engine_is_unknown_then_reports_missing_executable(settings, hosted, caplog):
    settings.accounts_enabled = hosted
    settings.public_origin = "http://testserver" if hosted else ""
    settings.session_secure = False
    settings.stockfish_path = "missing-private-path-for-health-test"
    app = create_app(settings, workers=False, start_engine=hosted)
    with TestClient(app) as client:
        owner = signup(client, "health-user")[0]["user"]["id"] if hosted else "local"
        for endpoint in ("/api/health", "/api/settings"):
            result = client.get(endpoint).json()
            assert result["engine_status"] == "unchecked"
            assert result["engine_available"] is None
            assert result["engine_error"] is None
            assert result["engine_version"] is None
        with app.state.workspaces.open(owner) as workspace:
            with pytest.raises(EngineUnavailable):
                workspace.engine.start()
        result = client.get("/api/health").json()
        assert result["engine_status"] == "unavailable"
        assert result["engine_available"] is False
        assert "STOCKFISH_PATH" in result["engine_error"]
        assert settings.stockfish_path not in result["engine_error"]
        assert settings.stockfish_path in caplog.text


@pytest.mark.parametrize("hosted", [False, True])
def test_startup_failure_recovery_and_later_search_failure_update_health(settings, hosted):
    class Engine:
        version = "Stockfish health fixture"
        available = False

        def __init__(self, _settings, sessions):
            self.sessions = sessions

        def start(self):
            if not self.available:
                raise EngineUnavailable("test failure")

        def analyze(self, *_args, **_kwargs):
            self.start()
            return "verified"

        def close(self):
            pass

    settings.accounts_enabled = hosted
    settings.public_origin = "http://testserver" if hosted else ""
    settings.session_secure = False
    app = create_app(settings, engine_factory=Engine, workers=False)
    with TestClient(app) as client:
        owner = signup(client, "health-recovery")[0]["user"]["id"] if hosted else "local"
        with app.state.workspaces.open(owner) as workspace:
            if hosted:
                assert client.get("/api/health").json()["engine_status"] == "unchecked"
                with pytest.raises(EngineUnavailable):
                    workspace.engine.start()
            assert client.get("/api/health").json()["engine_status"] == "unavailable"
            Engine.available = True
            assert workspace.engine.analyze(chess.Board()) == "verified"
            ready = client.get("/api/health").json()
            assert ready["engine_status"] == "ready" and ready["engine_available"] is True
            assert ready["engine_version"] == Engine.version and ready["engine_error"] is None
            Engine.available = False
            with pytest.raises(EngineUnavailable):
                workspace.engine.analyze(chess.Board())
            assert client.get("/api/settings").json()["engine_status"] == "unavailable"
            Engine.available = True
            workspace.engine.start()
            assert client.get("/api/health").json()["engine_status"] == "ready"


@pytest.mark.stockfish
def test_native_reference_mismatch_does_not_mark_working_engine_unavailable(
    settings, sessions, stockfish_path
):
    settings.stockfish_path = stockfish_path
    health = EngineHealth()
    engine = health.observe(Stockfish)(settings, sessions)
    try:
        original = engine.analyze(chess.Board())
        assert health.snapshot()["engine_status"] == "ready"
        original.engine_version = "different-saved-engine"
        with pytest.raises(EngineReferenceMismatch):
            engine.analyze(chess.Board(), reference=original)
        assert health.snapshot()["engine_available"] is True
        assert health.snapshot()["engine_error"] is None
    finally:
        engine.close()


def test_job_traceback_is_preserved_in_json_logs_but_not_client_payload(
    settings, monkeypatch, caplog
):
    def fail_pipeline(*_args, **_kwargs):
        try:
            raise ValueError("private-position-detail")
        except ValueError as cause:
            raise RuntimeError("private-analysis-detail") from cause

    monkeypatch.setattr("trainer.pipeline.JobPipeline.run", fail_pipeline)
    app = create_app(settings, workers=False, start_engine=False)
    with TestClient(app) as client:
        with app.state.sessions() as db:
            job = AnalysisJob(kind="classification")
            db.add(job)
            db.commit()
            job_id = job.id
        app.state.runner.run_job(job_id)
        result = next(job for job in client.get("/api/jobs").json() if job["id"] == job_id)
        assert result["status"] == "failed"
        assert "RuntimeError" in result["error"]
        assert "private-" not in json.dumps(result)
        record = next(record for record in caplog.records if record.message == "job_failed")
        logged = json.loads(JSONFormatter().format(record))
        assert logged["job_id"] == job_id
        assert logged["error_type"] == "RuntimeError"
        assert "fail_pipeline" in logged["exception"]
        assert "private-position-detail" in logged["exception"]
        assert "private-analysis-detail" in logged["exception"]
        assert "direct cause" in logged["exception"]


def test_json_formatter_preserves_stack_info_without_exception():
    record = logging.LogRecord(
        "diagnostic", logging.WARNING, __file__, 1, "trace", (), None, sinfo="saved stack"
    )
    result = json.loads(JSONFormatter().format(record))
    assert result["stack"] == "saved stack"
    assert "exception" not in result
