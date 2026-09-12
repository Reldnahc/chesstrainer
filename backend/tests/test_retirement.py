from datetime import datetime, timedelta, timezone

import chess
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from trainer import reviews
from trainer.api import create_app
from trainer.models import Review, ReviewSession, SRSState
from trainer.retirement import retire_if_ready
from trainer.scheduling import utc


@pytest.mark.parametrize("days,retired", [(99, False), (100, False), (100.001, True), (163, True)])
def test_strict_interval_boundary_and_permanence(settings, days, retired):
    at = datetime(2026, 1, 1, tzinfo=timezone.utc)
    state = SRSState(
        exercise_id="fixture",
        card={"last_review": at.isoformat()},
        due=at + timedelta(days=days),
        reviews=5,
        lapses=0,
    )
    assert retire_if_ready(state, settings, at) is retired
    if retired:
        assert state.retired_interval_days == pytest.approx(days)
        settings.retire_after_days = 36500
        assert not retire_if_ready(state, settings)
        assert state.retired_at == at
    else:
        assert state.retired_at is None


def test_api_retires_successful_recall_and_never_requeues(settings, monkeypatch):
    clock = [datetime(2030, 1, 1, tzinfo=timezone.utc)]
    monkeypatch.setattr(reviews, "now", lambda: clock[0])
    settings.stockfish_path = "missing-test-engine"
    payload = {"fen": chess.STARTING_FEN, "moves": ["e2e4"]}
    app = create_app(settings, workers=False)
    with TestClient(app) as client:
        exercise = client.post("/api/exercises/manual", json=payload).json()["id"]
        for index in range(8):
            cold = client.post(f"/api/review/{exercise}/start").json()
            with app.state.sessions() as db:
                db.get(ReviewSession, cold["session_id"]).started_at = clock[0]
                db.commit()
            clock[0] += timedelta(seconds=5)
            endpoint = f"/api/review/sessions/{cold['session_id']}/move"
            result = client.post(endpoint, json={"from_square": "e2", "to_square": "e4"}).json()
            assert result["completed"]
            if result["retired"]:
                break
            clock[0] = datetime.fromisoformat(result["next_due"])
        assert result["retired"] and result["next_due"] is None
        assert result["retired_interval_days"] > 100
        # A duplicate response does not change the retirement or create a review.
        assert client.post(endpoint, json={"from_square": "e2", "to_square": "e4"}).json()[
            "retired"
        ]
        with app.state.sessions() as db:
            state = db.get(SRSState, exercise)
            saved = state.card, state.reviews, utc(state.due), utc(state.retired_at)
            assert len(db.scalars(select(Review)).all()) == index + 1
        assert client.get("/api/review/queue").json() == []
    clock[0] += timedelta(days=1000)
    restarted = create_app(settings, workers=False)
    with TestClient(restarted) as client:
        assert client.get("/api/review/queue").json() == []
        assert client.post(f"/api/review/{exercise}/start").status_code == 422
        assert client.post("/api/exercises/manual", json=payload).json()["id"] == exercise
        with restarted.state.sessions() as db:
            state = db.get(SRSState, exercise)
            assert (state.card, state.reviews, utc(state.due), utc(state.retired_at)) == saved
        assert client.get("/api/review/queue").json() == []


def test_startup_retires_existing_long_interval_and_blocks_unfinished_session(settings):
    settings.stockfish_path = "missing-test-engine"
    app = create_app(settings, workers=False)
    with TestClient(app) as client:
        exercise = client.post(
            "/api/exercises/manual", json={"fen": chess.STARTING_FEN, "moves": ["e2e4"]}
        ).json()["id"]
        cold = client.post(f"/api/review/{exercise}/start").json()
        with app.state.sessions() as db:
            state = db.get(SRSState, exercise)
            # Already overdue: remaining time is negative, but its saved interval is long.
            at = datetime(2020, 1, 1, tzinfo=timezone.utc)
            state.card = state.card | {"last_review": at.isoformat()}
            state.due, state.reviews = at + timedelta(days=150), 5
            db.commit()
            saved = state.card, utc(state.due), state.reviews
    restarted = create_app(settings, workers=False)
    with TestClient(restarted) as client:
        assert client.get("/api/review/queue").json() == []
        endpoint = f"/api/review/sessions/{cold['session_id']}"
        assert client.post(endpoint + "/reveal").status_code == 422
        assert (
            client.post(
                endpoint + "/move", json={"from_square": "e2", "to_square": "e4"}
            ).status_code
            == 422
        )
        with restarted.state.sessions() as db:
            state = db.get(SRSState, exercise)
            assert state.retired_at is not None and state.retired_interval_days == 150
            assert (state.card, utc(state.due), state.reviews) == saved
            assert db.get(ReviewSession, cold["session_id"]) is not None
