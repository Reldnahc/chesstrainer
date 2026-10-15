"""Removing a product feature must not erase or reschedule learning history."""

import sqlite3

from explanation_fixtures import seed_review
from fastapi.testclient import TestClient
from trainer.api import create_app
from trainer.exercises import enroll
from trainer.models import Exercise, ReviewSession, SRSState, now
from trainer.scheduling import FSRSScheduler


def snapshot(path):
    with sqlite3.connect(path) as db:
        tables = [
            row[0]
            for row in db.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
            )
        ]
        return {table: rows(db, table) for table in tables}


# Requests record account presence, which is not learning history.
PRESENCE = {"last_seen_at", "away_since"}


def rows(db, table):
    columns = [row[1] for row in db.execute(f'PRAGMA table_info("{table}")')]
    kept = ", ".join(f'"{column}"' for column in columns if column not in PRESENCE)
    return db.execute(f'SELECT {kept} FROM "{table}" ORDER BY rowid').fetchall()


def test_repertoire_removal_preserves_history_and_excludes_stale_sessions(settings):
    settings.stockfish_path = "missing-test-engine"
    app = create_app(settings, workers=False)
    with TestClient(app):
        with app.state.sessions() as db:
            game = seed_review(db, settings)
            scheduler = FSRSScheduler(settings)
            cards = []
            for fen in (
                "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
                "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2",
            ):
                # Cards the removed repertoire training left behind.
                card = Exercise(
                    identity=fen,
                    source="repertoire",
                    fen=fen,
                    orientation="white",
                    explanation="A continuation from your curated repertoire.",
                    policy={"authority": "repertoire", "version": "1"},
                )
                db.add(card)
                db.flush()
                enroll(db, card, scheduler)
                cards.append(card)
            card_ids = {card.id for card in cards}
            # An unfinished recall saved before repertoires were archived.
            stale = ReviewSession(exercise_id=cards[0].id)
            db.add(stale)
            db.flush()
            session = {"session_id": stale.id}
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
