"""Real review jobs keep Stockfish authority while refreshing independent human facts."""

import io

import pytest
from fastapi.testclient import TestClient
from human_fixtures import PolicyProvider
from sqlalchemy import select
from test_game_review import seed
from trainer.api import create_app
from trainer.game_review import classify
from trainer.human_models.runtime import HumanCancelled, HumanUnavailable
from trainer.models import GameReviewMove


@pytest.mark.stockfish
def test_review_fallback_refresh_without_stockfish_restart_or_coach_dependency(
    settings, stockfish_path
):
    settings.stockfish_path = stockfish_path
    initial = create_app(settings, workers=False)
    with TestClient(initial) as client:
        game = seed(initial)
        job = client.post(f"/api/games/{game}/review", json={}).json()["job_id"]
        initial.state.runner.run_job(job)
        original = client.get(f"/api/games/{game}").json()
        assert all(
            frame["report"]["human"]["status"] == "unavailable" for frame in original["frames"][1:]
        )
    settings.stockfish_path = "must-not-start-for-human-refresh"
    provider = PolicyProvider(settings)
    upgraded = create_app(settings, workers=False, start_engine=False, human_provider=provider)
    with TestClient(upgraded) as client:
        assert client.get("/api/human-model").json()["status"] == "ready"
        response = client.post(f"/api/games/{game}/review", json={}).json()
        assert response == {"job_id": job, "status": "queued"}
        assert client.get(f"/api/games/{game}").json()["job"]["completed"] == 0
        assert client.get(f"/api/games/{game}/review").json()["moves"] == []
        upgraded.state.runner.run_job(job)
        updated = client.get(f"/api/games/{game}").json()
        assert updated["job"]["status"] == "completed", updated["job"]
        assert updated["accuracy"] == original["accuracy"]
        for old, new in zip(original["frames"][1:], updated["frames"][1:]):
            assert {
                k: v
                for k, v in new["report"].items()
                if k not in {"human", "practical", "intelligence"}
            } == {
                k: v
                for k, v in old["report"].items()
                if k not in {"human", "practical", "intelligence"}
            }
            assert [
                e for e in new["report"]["intelligence"]["events"] if e["kind"] != "human_contrast"
            ] == [
                e for e in old["report"]["intelligence"]["events"] if e["kind"] != "human_contrast"
            ]
            assert new["report"]["human"]["status"] == "available"
            assert classify(new["report"], 1000) == classify(old["report"], 1000)
        assert len(provider.calls) == 4
        assert [r.history.moves for r in provider.calls] == [
            [],
            ["f2f3"],
            ["f2f3", "e7e5"],
            ["f2f3", "e7e5", "g2g4"],
        ]
        assert client.post(f"/api/games/{game}/review", json={}).json()["status"] == "completed"
        assert (
            client.put(
                "/api/preferences/coach", json={"coach_id": "dog-collie", "motion": "natural"}
            ).status_code
            == 200
        )
        assert client.get(f"/api/games/{game}").json() == updated
        assert len(provider.calls) == 4
    assert provider.closed
    restarted = PolicyProvider(settings)
    with TestClient(
        create_app(settings, workers=False, start_engine=False, human_provider=restarted)
    ) as client:
        assert client.post(f"/api/games/{game}/review", json={}).json()["status"] == "completed"
        assert client.get(f"/api/games/{game}").json() == updated
        assert not restarted.calls


@pytest.mark.stockfish
def test_human_failure_and_cancellation_keep_stockfish_reports(settings, stockfish_path):
    settings.stockfish_path = stockfish_path
    provider = PolicyProvider(settings)
    app = create_app(settings, workers=False, human_provider=provider)
    with TestClient(app) as client:
        game = seed(app)
        job = client.post(f"/api/games/{game}/review", json={}).json()["job_id"]
        original_predict = provider.predict

        def cancel(*_):
            client.post(f"/api/jobs/{job}/cancel")
            raise HumanCancelled("cancelled")

        provider.predict = cancel
        app.state.runner.run_job(job)
        first = client.get(f"/api/games/{game}").json()
        assert first["job"]["status"] == "cancelled"
        assert first["frames"][1]["report"]["human"]["status"] == "cancelled"
        analysis_id = first["frames"][1]["report"]["before_analysis_id"]

        def fail(*_):
            raise HumanUnavailable("synthetic native failure")

        provider.predict = fail
        client.post(f"/api/games/{game}/review", json={})
        app.state.runner.run_job(job)
        second = client.get(f"/api/games/{game}").json()
        assert second["job"]["status"] == "completed"
        assert second["frames"][1]["report"]["before_analysis_id"] == analysis_id
        provider.predict = original_predict
        client.post(f"/api/games/{game}/review", json={})
        app.state.runner.run_job(job)
        assert all(
            f["report"]["human"]["status"] == "available"
            for f in client.get(f"/api/games/{game}").json()["frames"][1:]
        )
        with app.state.sessions() as db:
            assert all(r.human_analysis_id for r in db.scalars(select(GameReviewMove)))


def test_cold_contract_excludes_human_insights():
    from trainer.contracts.review import ColdPosition

    assert (
        not {"human", "difficulty", "insight", "history", "best_move", "coach"}
        & ColdPosition.model_fields.keys()
    )
    # The explicit response schema cannot silently serialize model evidence.
    assert ColdPosition.model_config["extra"] == "forbid"


def test_setup_is_explicit_integrity_checked_atomic_and_offline_reusable(tmp_path, monkeypatch):
    import hashlib

    from trainer.human_models import preset, setup

    content = b"synthetic checkpoint bytes"
    monkeypatch.setitem(preset.MODEL, "bytes", len(content))
    monkeypatch.setitem(preset.MODEL, "sha256", hashlib.sha256(content).hexdigest())
    destination = tmp_path / "models" / "fixture.pt"
    calls = []

    def download(url, **kwargs):
        calls.append(url)
        return io.BytesIO(content)

    assert setup.acquire(destination, opener=download) == "verified"
    assert (
        setup.acquire(
            destination, opener=lambda *_a, **_kw: pytest.fail("Offline cache downloaded")
        )
        == "already_verified"
    )
    assert len(calls) == 1 and preset.MODEL["revision"] in calls[0]
    assert not list(destination.parent.glob("*.partial"))
    broken = tmp_path / "models" / "broken.pt"
    with pytest.raises(ValueError):
        setup.acquire(broken, opener=lambda *_a, **_kw: io.BytesIO(b"bad"))
    assert not broken.exists()
    assert not list(destination.parent.glob("*.partial"))
