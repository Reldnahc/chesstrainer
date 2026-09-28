"""Host resources stay bounded while concurrent requests/jobs retain their owners."""

import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from types import SimpleNamespace

import chess
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session
from test_accounts import PGN, signup
from trainer.accounts import COOKIE, Accounts, csrf_token
from trainer.api import create_app
from trainer.exercises import manual_exercise
from trainer.imports import import_games
from trainer.models import AnalysisJob, Game, ProviderImport, SRSState, User, now
from trainer.ownership import account_sessions
from trainer.scheduling import FSRSScheduler


def hosted(settings):
    settings.accounts_enabled = True
    settings.public_origin = "http://testserver"
    settings.session_secure = False
    settings.engine_slots = 2


def seed_accounts(sessions, count):
    # Authentication hashing is covered separately. These identities exercise
    # account count without spending CPU on hundreds of irrelevant passwords.
    with Session(sessions.kw["bind"]) as db:
        identities = [f"account-{index}" for index in range(count)]
        db.add_all(
            User(id=identity, username=identity, password="unused-test-hash", created=0)
            for identity in identities
        )
        db.commit()
    return identities


def headers(settings, owner):
    token = Accounts(settings.database_path).issue(owner)
    return {
        "Cookie": f"{COOKIE}={token}",
        "Origin": settings.public_origin,
        "X-CSRF-Token": csrf_token(token),
    }


def wait_for(predicate):
    deadline = time.monotonic() + 8
    while time.monotonic() < deadline:
        if predicate():
            return
        threading.Event().wait(0.02)
    pytest.fail("Background work did not settle before the deadline")


def forbidden_engine(*_):
    raise AssertionError("Idle accounts, signup and fetch-only jobs must not construct engines")


@pytest.mark.parametrize("count", [0, 250])
def test_idle_accounts_do_not_add_apps_workers_or_retained_scopes(settings, sessions, count):
    hosted(settings)
    identities = seed_accounts(sessions, count)
    app = create_app(settings, engine_factory=forbidden_engine)
    routes = tuple(app.routes)
    with TestClient(app) as client:
        workers = tuple(app.state.runner.threads)
        assert len(workers) == settings.engine_slots + 1
        assert all(thread.is_alive() for thread in workers)
        assert not hasattr(app.state, "tenants")
        assert app.state.workspaces._locks == {}
        for owner in identities[:3]:
            assert client.get("/api/games", headers=headers(settings, owner)).json()["total"] == 0
            assert app.state.workspaces._locks == {}
        signup(client, "new-friend")
        assert client.get("/api/games").json()["total"] == 0
        assert tuple(app.state.runner.threads) == workers
        assert tuple(app.routes) == routes
        assert app.state.workspaces._locks == {}
    assert all(not thread.is_alive() for thread in workers)


def test_recovery_account_order_cancellation_and_fetch_lane(settings, sessions, monkeypatch):
    hosted(settings)
    alice, bob, disabled = seed_accounts(sessions, 3)
    jobs = {alice: ["alice-first", "alice-next"], bob: ["bob-first"], disabled: ["disabled"]}
    with Session(sessions.kw["bind"]) as db:
        db.get(User, disabled).disabled = True
        for owner, ids in jobs.items():
            for index, job_id in enumerate(ids):
                db.add(
                    AnalysisJob(
                        id=job_id,
                        user_id=owner,
                        kind="game_review",
                        status="running" if index == 0 else "queued",
                        created_at=now() + timedelta(seconds=index),
                    )
                )
        db.add(AnalysisJob(id="local-private", user_id="local", kind="game_review"))
        db.add(AnalysisJob(id="fetch", user_id=alice, kind="sync"))
        db.flush()
        db.add(
            ProviderImport(
                job_id="fetch",
                user_id=alice,
                provider="chesscom",
                username="learner",
                time_class="all",
                months=2,
                max_games=50,
            )
        )
        db.commit()
    entered, release, fetched = threading.Event(), threading.Event(), threading.Event()
    observed = []
    guard = threading.Lock()

    def review(execution, job_id, _engine=None):
        with execution.sessions() as db:
            owner = db.info["user_id"]
            assert db.get(AnalysisJob, job_id).user_id == owner
            assert {job.id for job in db.scalars(select(AnalysisJob))} <= set(
                jobs[owner] + ["fetch"]
            )
        with guard:
            observed.append((job_id, owner))
            if len(observed) == 2:
                entered.set()
        assert release.wait(8)

    def fetch(job_id, scoped_sessions, *_args):
        with scoped_sessions() as db:
            assert db.info["user_id"] == alice
            assert db.get(AnalysisJob, "bob-first") is None
        fetched.set()

    monkeypatch.setattr("trainer.game_review.run_review", review)
    monkeypatch.setattr("trainer.job_execution.fetch_import", fetch)
    app = create_app(
        settings,
        engine_factory=forbidden_engine,
        chesscom_factory=lambda _: SimpleNamespace(close=lambda: None),
    )
    with TestClient(app) as client:
        try:
            assert entered.wait(8)  # Recovery needs no login or workspace request.
            assert {item[0] for item in observed} == {"alice-first", "bob-first"}
            assert fetched.wait(8)  # Fetches proceed while all analysis workers are busy.
            alice_headers = headers(settings, alice)
            assert (
                client.post("/api/jobs/bob-first/cancel", headers=alice_headers).status_code == 404
            )
            assert (
                client.post("/api/jobs/alice-first/cancel", headers=alice_headers).status_code
                == 200
            )
            assert {job["id"] for job in client.get("/api/jobs", headers=alice_headers).json()} == {
                "alice-first",
                "alice-next",
                "fetch",
            }
        finally:
            release.set()

        def settled():
            with Session(sessions.kw["bind"]) as db:
                return all(
                    db.get(AnalysisJob, job_id).status == "completed"
                    for job_id in ("alice-next", "bob-first", "fetch")
                )

        wait_for(settled)
    with Session(sessions.kw["bind"]) as db:
        assert db.get(AnalysisJob, "alice-first").status == "cancelled"
        assert db.get(AnalysisJob, "bob-first").status == "completed"
        assert db.get(AnalysisJob, "fetch").status == "completed"
        assert db.get(AnalysisJob, "disabled").status == "running"
        assert db.get(AnalysisJob, "local-private").status == "queued"
    assert observed[-1] == ("alice-next", alice)
    assert app.state.workspaces._locks == {}


def test_hosted_startup_preserves_disabled_and_local_retirement_state(settings, sessions):
    hosted(settings)
    active, disabled = seed_accounts(sessions, 2)
    with Session(sessions.kw["bind"]) as db:
        db.get(User, disabled).disabled = True
        db.commit()
    exercises = {}
    for owner in (active, disabled, "local"):
        with account_sessions(sessions.kw["bind"], owner)() as db:
            exercise = manual_exercise(
                db, FSRSScheduler(settings), chess.STARTING_FEN, ["e2e4"], "white"
            )
            exercises[owner] = exercise.id
            state = db.get(SRSState, exercise.id)
            state.reviews = 5
            state.card = dict(state.card, last_review=now().isoformat())
            state.due = now() + timedelta(days=settings.retire_after_days + 1)
            db.commit()
    with TestClient(create_app(settings, workers=False, engine_factory=forbidden_engine)):
        pass
    for owner, exercise_id in exercises.items():
        with account_sessions(sessions.kw["bind"], owner)() as db:
            assert (db.get(SRSState, exercise_id).retired_at is not None) == (owner == active)


def test_requests_and_jobs_share_engine_budget_without_sharing_account_data(
    settings, sessions, monkeypatch
):
    hosted(settings)
    owners = seed_accounts(sessions, 2)
    games = {}
    for owner in owners:
        with account_sessions(sessions.kw["bind"], owner)() as db:
            import_games(db, "fixture", PGN, [], "white", queue_analysis=False)
            games[owner] = db.scalar(select(Game.id))
            db.add(AnalysisJob(id=f"review-{owner}", kind="game_review"))
            db.commit()
    entered, release, guard = threading.Event(), threading.Event(), threading.Lock()
    engines, observed = [], []
    active = peak = 0

    class Engine:
        version = "Stockfish test fixture"
        binary_hash = "fixture"

        def __init__(self, _settings, scoped_sessions):
            self.sessions, self.closed = scoped_sessions, False
            engines.append(self)

        def analyze(self, *_args, **_kwargs):
            nonlocal active, peak
            with self.sessions() as db:
                owner = db.info["user_id"]
                assert db.scalars(select(Game.id)).all() == [games[owner]]
            with guard:
                observed.append(owner)
                active += 1
                peak = max(peak, active)
                if active == settings.engine_slots:
                    entered.set()
            try:
                assert release.wait(8)
                with self.sessions() as db:
                    assert db.info["user_id"] == owner
                return SimpleNamespace(
                    candidates=[{"san": "e4", "score": {"kind": "cp", "value": 25}}]
                )
            finally:
                with guard:
                    active -= 1

        def close(self):
            self.closed = True

    def review(execution, job_id, _engine=None):
        engine = execution.engine_factory(settings, execution.sessions)
        try:
            engine.analyze(None)
        finally:
            engine.close()

    monkeypatch.setattr("trainer.game_review.run_review", review)
    app = create_app(settings, engine_factory=Engine)
    with TestClient(app) as client, ThreadPoolExecutor(max_workers=2) as requests:
        try:
            assert entered.wait(8)
            futures = [
                requests.submit(
                    client.post,
                    f"/api/games/{games[owner]}/analyze",
                    json={},
                    headers=headers(settings, owner),
                )
                for owner in owners
            ]
        finally:
            release.set()
        for future in futures:
            response = future.result(timeout=8)
            assert response.status_code == 200, response.text
            assert response.json()["score"]["value"] == 25
    assert peak == settings.engine_slots == len(engines)
    assert all(engine.closed for engine in engines)
    assert all(observed.count(owner) == 2 for owner in owners)
    assert app.state.workspaces._locks == {}


def test_shutdown_drains_jobs_and_restart_resumes_without_login(settings, sessions, monkeypatch):
    hosted(settings)
    owner = seed_accounts(sessions, 1)[0]
    with account_sessions(sessions.kw["bind"], owner)() as db:
        db.add(AnalysisJob(id="resume-me", kind="game_review"))
        db.commit()
    started = threading.Event()

    def interrupted(execution, job_id, _engine=None):
        with execution.import_lock, execution.sessions() as db:
            db.get(AnalysisJob, job_id).positions_triaged = 3
            db.commit()
        started.set()
        assert execution.runner.stop_event.wait(8)

    monkeypatch.setattr("trainer.game_review.run_review", interrupted)
    app = create_app(settings, engine_factory=forbidden_engine)
    with TestClient(app):
        assert started.wait(8)
    assert all(not thread.is_alive() for thread in app.state.runner.threads)
    assert app.state.workspaces._locks == {}
    with account_sessions(sessions.kw["bind"], owner)() as db:
        job = db.get(AnalysisJob, "resume-me")
        assert job.status == "queued" and job.positions_triaged == 3
    finished = threading.Event()

    def resumed(execution, job_id, _engine=None):
        with execution.sessions() as db:
            assert db.info["user_id"] == owner
        finished.set()

    monkeypatch.setattr("trainer.game_review.run_review", resumed)
    with TestClient(create_app(settings, engine_factory=forbidden_engine)):
        assert finished.wait(8)

        def completed():
            with account_sessions(sessions.kw["bind"], owner)() as db:
                return db.get(AnalysisJob, "resume-me").status == "completed"

        wait_for(completed)
