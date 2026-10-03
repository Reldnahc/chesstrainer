"""Additional investigation preserves baseline truth and resumes bounded native work."""

from copy import deepcopy

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from test_game_review import seed
from test_review_difficulty import report as difficulty_report
from trainer.api import create_app
from trainer.engine import EngineUnavailable, Stockfish
from trainer.models import AnalysisJob, GameReview, GameReviewMove, ReviewRefinement
from trainer.review_intelligence.refinement_plan import plan_key, selection
from trainer.review_intelligence.refinement_search import RefinementEngine, adoption_reason
from trainer.search_limits import EngineCancelled


def test_nominations_are_finite_prioritized_and_depend_only_on_baseline(settings):
    data = difficulty_report(loss=205) | {"actual_line": {"findings": []}}
    reports = {1: data, 2: deepcopy(data), 3: deepcopy(data)}
    reports[2]["actual"]["score"] = {"kind": "mate", "value": -1}
    settings.review_refinement_positions = 2
    choices = selection(reports, settings)
    assert [ply for ply, _ in choices] == [2, 1]
    assert choices[0][1][0] == "mate_transition"
    key = plan_key(reports, settings)
    reports[1]["coach"] = "An unrelated presentation change"
    assert plan_key(reports, settings) == key
    settings.review_refinement_queries += 1
    assert plan_key(reports, settings) != key
    settings.review_refinement_positions = 0
    assert selection(reports, settings) == []


def test_shallower_inconsistent_or_different_engine_cannot_replace_baseline():
    base = difficulty_report() | {"depth": 16, "engine_version": "pinned"}
    for change, reason in [
        ({"depth": 15}, "insufficient_depth"),
        ({"root_candidates": [{"depth": 15}]}, "insufficient_depth"),
        ({"engine_version": "other"}, "incompatible_engine"),
        ({"actual": {"score": {"kind": "cp", "value": 30}}}, "inconsistent_roots"),
    ]:
        assert adoption_reason(base, base | change) == reason
    assert adoption_reason(base, base | {"depth": 22}) is None


def baseline(client, app):
    game = seed(app)
    job = client.post(f"/api/games/{game}/review", json={}).json()["job_id"]
    app.state.runner.run_job(job)
    with app.state.sessions() as db:
        original = {row.ply: deepcopy(row.report) for row in db.scalars(select(GameReviewMove))}
    return game, job, original


@pytest.mark.stockfish
def test_native_refinement_preserves_baseline_polls_earlier_moves_and_reuses_completed_work(
    settings, stockfish_path, monkeypatch
):
    settings.stockfish_path = stockfish_path
    settings.review_refinement_depth, settings.review_refinement_time = 16, 0.4
    app = create_app(settings, workers=False)
    with TestClient(app) as client:
        game, job, original = baseline(client, app)
        before = client.get(f"/api/games/{game}").json()
        app.state.settings.review_refinement_positions = 4
        assert (
            client.post(f"/api/games/{game}/review", json={"refine": True}).json()["status"]
            == "queued"
        )
        app.state.runner.run_job(job)
        after = client.get(f"/api/games/{game}").json()
        assert after["job"]["status"] == "completed", after["job"]
        assert after["review_revision"] > before["review_revision"]
        updates = client.get(
            f"/api/games/{game}/review", params={"after_revision": before["review_revision"]}
        ).json()
        assert updates["revision"] == after["review_revision"]
        assert updates["moves"] and any(m["ply"] < 4 for m in updates["moves"])
        for move in updates["moves"]:
            assert move["report"] == {
                k: v
                for k, v in after["frames"][move["ply"]]["report"].items()
                if k in move["report"]
            }
        assert (
            client.get(
                f"/api/games/{game}/review", params={"after_revision": updates["revision"]}
            ).json()["moves"]
            == []
        )
        assert (
            updates["accuracy"]
            == after["accuracy"]
            == client.get("/api/games").json()["items"][0]["accuracy"]
        )
        with app.state.sessions() as db:
            tasks = db.scalars(select(ReviewRefinement)).all()
            assert 0 < len(tasks) <= 4
            assert any(task.adopted for task in tasks)
            assert all(len(task.queries) <= 4 for task in tasks)
            assert {r.ply: r.report for r in db.scalars(select(GameReviewMove))} == original

        def forbidden(*_args, **_kwargs):
            pytest.fail("Completed investigations must not restart Stockfish")

        monkeypatch.setattr(Stockfish, "analyze", forbidden)
        assert client.post(f"/api/games/{game}/review", json={}).json()["status"] == "completed"
        app.state.runner.run_job(job)
        assert client.get(f"/api/games/{game}").json() == after


@pytest.mark.stockfish
def test_refinement_questions_share_the_review_engine_workers(
    settings, stockfish_path, monkeypatch
):
    settings.stockfish_path = stockfish_path
    settings.stockfish_workers = 2
    settings.review_refinement_depth, settings.review_refinement_time = 12, 0.2
    app = create_app(settings, workers=False)
    with TestClient(app) as client:
        game, job, original = baseline(client, app)
        app.state.settings.review_refinement_positions = 4
        client.post(f"/api/games/{game}/review", json={"refine": True})
        engines = set()
        real = RefinementEngine.analyze

        def record(self, *args, **kwargs):
            engines.add(id(self.native))
            return real(self, *args, **kwargs)

        monkeypatch.setattr(RefinementEngine, "analyze", record)
        app.state.runner.run_job(job)
        assert client.get(f"/api/games/{game}").json()["job"]["status"] == "completed"
        with app.state.sessions() as db:
            tasks = db.scalars(select(ReviewRefinement)).all()
            assert len(tasks) > 1 and len(engines) == 2
            assert all(task.status in {"completed", "budget_limited"} for task in tasks)
            assert db.get(GameReview, game).refinement_plan["completed"] == len(tasks)
            assert {r.ply: r.report for r in db.scalars(select(GameReviewMove))} == original


@pytest.mark.stockfish
def test_cancelled_refinement_reuses_finished_question_and_never_loses_baseline(
    settings, stockfish_path, monkeypatch
):
    settings.stockfish_path = stockfish_path
    settings.review_refinement_depth, settings.review_refinement_time = 16, 0.3
    app = create_app(settings, workers=False)
    with TestClient(app) as client:
        game, job, original = baseline(client, app)
        app.state.settings.review_refinement_positions = 1
        client.post(f"/api/games/{game}/review", json={"refine": True})
        real = RefinementEngine.analyze

        def cancel_after_question(self, *args, **kwargs):
            real(self, *args, **kwargs)
            with app.state.sessions() as db:
                db.get(AnalysisJob, job).cancel_requested = True
                db.commit()
            raise EngineCancelled()

        monkeypatch.setattr(RefinementEngine, "analyze", cancel_after_question)
        app.state.runner.run_job(job)
        assert client.get(f"/api/games/{game}").json()["job"]["status"] == "cancelled"
        with app.state.sessions() as db:
            task = db.scalar(select(ReviewRefinement))
            first_query = task.queries[0]
            assert task.status == "pending" and len(task.queries) == 1
            assert {r.ply: r.report for r in db.scalars(select(GameReviewMove))} == original
        monkeypatch.setattr(RefinementEngine, "analyze", real)
        client.post(f"/api/games/{game}/review", json={})
        app.state.runner.run_job(job)
        with app.state.sessions() as db:
            task = db.scalar(select(ReviewRefinement))
            assert task.status == "completed"
            assert task.queries[0] == first_query
            assert len({q["key"] for q in task.queries}) == len(task.queries)
            assert db.get(GameReview, game).refinement_plan["completed"] == 1


@pytest.mark.stockfish
def test_optional_engine_failure_keeps_completed_review_and_can_retry_explicitly(
    settings, stockfish_path, monkeypatch
):
    settings.stockfish_path = stockfish_path
    app = create_app(settings, workers=False)
    with TestClient(app) as client:
        game, job, _ = baseline(client, app)
        app.state.settings.review_refinement_positions = 1
        client.post(f"/api/games/{game}/review", json={"refine": True})

        def unavailable(*_args, **_kwargs):
            raise EngineUnavailable("Synthetic unavailable engine")

        monkeypatch.setattr(Stockfish, "start", unavailable)
        app.state.runner.run_job(job)
        detail = client.get(f"/api/games/{game}").json()
        assert detail["job"]["status"] == "completed"
        with app.state.sessions() as db:
            assert db.scalar(select(ReviewRefinement)).status == "unavailable"
        assert client.post(f"/api/games/{game}/review", json={}).json()["status"] == "completed"
        assert (
            client.post(f"/api/games/{game}/review", json={"refine": True}).json()["status"]
            == "queued"
        )
        with app.state.sessions() as db:
            assert db.scalar(select(ReviewRefinement)).status == "pending"
