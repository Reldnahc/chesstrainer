import copy
from datetime import timedelta

import pytest
from explanation_fixtures import seed_review
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from trainer.api import create_app
from trainer.classification import classify_decision
from trainer.local_classifier import LocalClassifier
from trainer.models import Attempt, Decision, EngineAnalysis, Review, ReviewSession, SRSState, now


def seed_classified(db, settings, key="practice"):
    fixture = seed_review(db, settings, key=key)
    decision = db.scalar(select(Decision).order_by(Decision.created_at.desc()))
    for analysis_id, line in (
        (decision.before_analysis_id, [fixture["best"], "g8f7", "a5a1", "f7e6"]),
        (
            decision.played_analysis_id,
            [fixture["wrong"], fixture["reply"], "f1e2", "g8f7", "e2d3", "f7e6"],
        ),
    ):
        analysis = db.get(EngineAnalysis, analysis_id)
        candidates = copy.deepcopy(analysis.candidates)
        candidates[0]["pv"] = line
        analysis.candidates = candidates
    db.commit()
    assert classify_decision(db, decision, LocalClassifier(settings), settings)
    return fixture


@pytest.mark.parametrize("outcome", ["correct", "retry", "reveal"])
def test_focus_never_changes_fsrs_and_survives_reload(settings, outcome):
    settings.stockfish_path = "missing-test-engine"
    app = create_app(settings, workers=False)
    with TestClient(app) as client:
        with app.state.sessions() as db:
            fixture = seed_classified(db, settings)
            state = db.get(SRSState, fixture["exercise_id"])
            state.due = now() + timedelta(days=10)
            db.commit()
            db.refresh(state)
            original = (
                copy.deepcopy(state.card),
                state.due,
                state.reviews,
                state.lapses,
                state.retired_at,
            )
        assert client.get("/api/review/queue").json() == []
        assert len(client.get("/api/practice/queue?skill_id=material_loss").json()) == 1
        start = f"/api/review/{fixture['exercise_id']}/start?focus_skill_id=material_loss"
        cold = client.post(start).json()
        assert cold["practice_only"] and "answers" not in cold and "skill_id" not in cold
        session_id = cold["session_id"]
        if outcome == "retry":
            wrong = fixture["wrong"]
            response = client.post(
                f"/api/review/sessions/{session_id}/move",
                json={"from_square": wrong[:2], "to_square": wrong[2:]},
            ).json()
            assert not response["completed"] and response["practice_only"]
            with app.state.sessions() as db:
                old_session = db.get(ReviewSession, session_id)
                old_session.response_ms = None  # An unfinished pre-migration session.
                old_session.started_at = now() - timedelta(seconds=30)
                db.commit()
            assert (
                client.get("/api/review/queue").json() == []
            )  # Focus retries never enter due reviews.
            assert client.post(start).json()["session_id"] == session_id
        if outcome == "reveal":
            result = client.post(f"/api/review/sessions/{session_id}/reveal").json()
        else:
            best = fixture["best"]
            result = client.post(
                f"/api/review/sessions/{session_id}/move",
                json={"from_square": best[:2], "to_square": best[2:]},
            ).json()
        assert result["completed"] and result["practice_only"] and result["next_due"] is None
        explanation = client.get(
            f"/api/review/sessions/{session_id}/explanation?solution=true"
        ).json()
        assert explanation["findings"] and all(
            f["analysis_id"] == explanation["analysis_id"] for f in explanation["findings"]
        )
    with TestClient(create_app(settings, workers=False)) as client:
        with client.app.state.sessions() as db:
            state = db.get(SRSState, fixture["exercise_id"])
            assert (
                state.card,
                state.due,
                state.reviews,
                state.lapses,
                state.retired_at,
            ) == original
            assert db.scalar(select(func.count()).select_from(Review)) == 0
            session = db.get(ReviewSession, session_id)
            assert session.completed and session.mode == "focus"
            assert session.response_ms is not None and session.completed_at is not None
            if outcome == "retry":
                assert session.response_ms < 30_000  # Preserves the earlier raw first attempt.
            assert session.failed == (outcome != "correct")
            assert (
                db.scalar(select(func.count()).select_from(Attempt))
                == {"correct": 1, "retry": 2, "reveal": 0}[outcome]
            )
        assert (
            client.post(
                f"/api/review/{fixture['exercise_id']}/start?focus_skill_id=fake"
            ).status_code
            == 422
        )
        assert (
            client.post(
                f"/api/review/{fixture['exercise_id']}/start?focus_skill_id=pin"
            ).status_code
            == 422
        )
        ordinary = client.post(f"/api/review/{fixture['exercise_id']}/start").json()
        assert not ordinary["practice_only"] and ordinary["session_id"] != session_id


def test_coverage_separates_outcomes_patterns_and_pending(settings):
    settings.stockfish_path = "missing-test-engine"
    with TestClient(create_app(settings, workers=False)) as client:
        with client.app.state.sessions() as db:
            seed_classified(db, settings)
            seed_review(db, settings, black=True)
        report = client.get("/api/weaknesses").json()
        assert report["coverage"] == {
            "total": 2,
            "labeled": 1,
            "outcomes": 1,
            "mechanisms": 1,
            "outcome_only": 0,
            "unclassified": 1,
            "pending": 1,
            "abstention_reasons": {},
        }
        assert any(s["kind"] == "outcome" for s in report["skills"])
        assert any(s["kind"] == "mechanism" for s in report["skills"])
