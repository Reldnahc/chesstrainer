from datetime import datetime, timedelta, timezone

import chess
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from trainer import reviews
from trainer.api import create_app
from trainer.models import Review, ReviewSession, SRSState
from trainer.scheduling import utc


@pytest.mark.parametrize("outcome", ["correct", "failed_then_solved", "revealed"])
def test_restart_preserves_schedule_until_due(settings, monkeypatch, outcome):
    clock = [datetime(2026, 9, 12, 12, tzinfo=timezone.utc)]
    monkeypatch.setattr(reviews, "now", lambda: clock[0])
    settings.stockfish_path = "missing-test-engine"
    app = create_app(settings, workers=False)
    with TestClient(app) as client:
        exercise = client.post(
            "/api/exercises/manual", json={"fen": chess.STARTING_FEN, "moves": ["e2e4"]}
        ).json()["id"]
        cold = client.post(f"/api/review/{exercise}/start").json()
        with app.state.sessions() as db:
            db.get(ReviewSession, cold["session_id"]).started_at = clock[0]
            db.commit()
        assert cold["review_reason"] == "new"
        path = f"/api/review/sessions/{cold['session_id']}"
        if outcome == "revealed":
            result = client.post(path + "/reveal").json()
        else:
            if outcome == "failed_then_solved":
                client.post(path + "/move", json={"from_square": "d2", "to_square": "d4"})
            result = client.post(
                path + "/move", json={"from_square": "e2", "to_square": "e4"}
            ).json()
        assert result["completed"]
        due = datetime.fromisoformat(result["next_due"])
        assert due > clock[0]
        assert client.get("/api/review/queue").json() == []
        with app.state.sessions() as db:
            saved_card = db.get(SRSState, exercise).card

    restarted = create_app(settings, workers=False)
    with TestClient(restarted) as client:
        clock[0] = due - timedelta(microseconds=1)
        assert client.get("/api/review/queue").json() == []
        with restarted.state.sessions() as db:
            state = db.get(SRSState, exercise)
            assert state.card == saved_card
            assert utc(state.due) == due
            assert state.reviews == 1
            assert db.scalar(select(Review)).rating == ("Good" if outcome == "correct" else "Again")
        clock[0] = due
        assert client.get("/api/review/queue").json()[0]["exercise_id"] == exercise
        cold = client.post(f"/api/review/{exercise}/start").json()
        assert cold["session_id"] != path.split("/")[-1]
        assert cold["review_reason"] == "learning"
        assert cold["previous_reviews"] == 1


def test_restart_avoids_last_completed_card_but_resumes_unfinished(settings, monkeypatch):
    clock = [datetime(2026, 9, 12, 12, tzinfo=timezone.utc)]
    monkeypatch.setattr(reviews, "now", lambda: clock[0])
    settings.stockfish_path = "missing-test-engine"
    with TestClient(create_app(settings, workers=False)) as client:
        ids = [
            client.post(
                "/api/exercises/manual", json={"fen": chess.STARTING_FEN, "moves": [move]}
            ).json()["id"]
            for move in ["e2e4", "d2d4"]
        ]
        cold = client.post(f"/api/review/{ids[0]}/start").json()
        result = client.post(
            f"/api/review/sessions/{cold['session_id']}/move",
            json={"from_square": "e2", "to_square": "e4"},
        ).json()
        clock[0] = datetime.fromisoformat(result["next_due"]) + timedelta(days=1)
    with TestClient(create_app(settings, workers=False)) as client:
        assert [r["exercise_id"] for r in client.get("/api/review/queue").json()] == ids[::-1]
        # An explicit practice request is allowed, and must survive another restart.
        opened = client.post(f"/api/review/{ids[0]}/start").json()
    with TestClient(create_app(settings, workers=False)) as client:
        assert client.get("/api/review/queue").json()[0]["exercise_id"] == ids[0]
        resumed = client.post(f"/api/review/{ids[0]}/start").json()
        assert resumed["session_id"] == opened["session_id"]
        assert resumed["review_reason"] == "resume"


def test_successive_due_recalls_expand_intervals_across_restarts(settings, monkeypatch):
    """Exercise the API + persisted FSRS card, not just the scheduling library."""
    settings.retire_after_days = 36500  # Isolate interval growth from retirement policy.
    clock = [datetime(2030, 1, 1, tzinfo=timezone.utc)]
    monkeypatch.setattr(reviews, "now", lambda: clock[0])
    settings.stockfish_path = "missing-test-engine"
    with TestClient(create_app(settings, workers=False)) as client:
        exercise = client.post(
            "/api/exercises/manual", json={"fen": chess.STARTING_FEN, "moves": ["e2e4"]}
        ).json()["id"]
    intervals = []
    due = clock[0]
    for index in range(6):
        app = create_app(settings, workers=False)
        with TestClient(app) as client:
            if index:
                clock[0] = due - timedelta(seconds=1)
                assert client.get("/api/review/queue").json() == []
            clock[0] = due
            assert client.get("/api/review/queue").json()[0]["exercise_id"] == exercise
            cold = client.post(f"/api/review/{exercise}/start").json()
            with app.state.sessions() as db:
                db.get(ReviewSession, cold["session_id"]).started_at = clock[0]
                db.commit()
            clock[0] += timedelta(seconds=5)
            result = client.post(
                f"/api/review/sessions/{cold['session_id']}/move",
                json={"from_square": "e2", "to_square": "e4"},
            ).json()
            assert result["completed"]
            due = datetime.fromisoformat(result["next_due"])
            intervals.append(due - clock[0])
            with app.state.sessions() as db:
                assert db.get(SRSState, exercise).reviews == index + 1
                assert all(r.rating == "Good" for r in db.scalars(select(Review)))
    assert intervals[0] == timedelta(minutes=10)
    assert all(later > earlier for earlier, later in zip(intervals, intervals[1:]))
    assert intervals[-1] > timedelta(days=90)

    # A lapse on an established card returns it to a short relearning interval.
    app = create_app(settings, workers=False)
    with TestClient(app) as client:
        clock[0] = due
        cold = client.post(f"/api/review/{exercise}/start").json()
        result = client.post(f"/api/review/sessions/{cold['session_id']}/reveal").json()
        assert datetime.fromisoformat(result["next_due"]) - clock[0] < timedelta(days=1)
        with app.state.sessions() as db:
            assert db.get(SRSState, exercise).lapses == 1
