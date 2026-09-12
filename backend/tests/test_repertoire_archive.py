"""Removing a product feature must not erase or reschedule learning history."""

import sqlite3

from explanation_fixtures import seed_review
from fastapi.testclient import TestClient
from sqlalchemy import select
from trainer.api import create_app
from trainer.exercises import import_repertoire
from trainer.models import Exercise, SRSState, now
from trainer.reviews import start_review, submit_move
from trainer.scheduling import FSRSScheduler


def snapshot(path):
    with sqlite3.connect(path) as db:
        tables = [
            row[0]
            for row in db.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
            )
        ]
        return {
            table: db.execute(f'SELECT * FROM "{table}" ORDER BY rowid').fetchall()
            for table in tables
        }


def test_repertoire_removal_preserves_history_and_excludes_stale_sessions(settings):
    settings.stockfish_path = "missing-test-engine"
    app = create_app(settings, workers=False)
    with TestClient(app):
        with app.state.sessions() as db:
            game = seed_review(db, settings)
            scheduler = FSRSScheduler(settings)
            imported = import_repertoire(
                db, scheduler, "Archived opening", "1. e4 e5 2. Nf3 Nc6 *", True
            )
            cards = db.scalars(
                select(Exercise).where(Exercise.repertoire_id == imported["id"])
            ).all()
            card_ids = {card.id for card in cards}
            session = start_review(db, cards[0].id)
            result = submit_move(db, session["session_id"], "g1f3", None, scheduler, settings)
            assert not result["completed"]  # Saved failed recall with an unfinished retry.
            retired = db.get(SRSState, cards[1].id)
            retired.retired_at, retired.retired_interval_days = now(), 101
            db.commit()
    before = snapshot(settings.database_path)
    for _ in range(2):
        with TestClient(create_app(settings, workers=False)) as client:
            queued = {row["exercise_id"] for row in client.get("/api/review/queue").json()}
            assert not queued & card_ids
            assert game["exercise_id"] in queued
            assert client.get("/api/repertoires").status_code == 410
            assert client.post("/api/repertoires").status_code == 410
            for card_id in card_ids:
                assert client.post(f"/api/review/{card_id}/start").status_code == 410
            path = f"/api/review/sessions/{session['session_id']}"
            assert (
                client.post(
                    path + "/move", json={"from_square": "e2", "to_square": "e4"}
                ).status_code
                == 410
            )
            assert client.post(path + "/reveal").status_code == 410
        assert snapshot(settings.database_path) == before
