"""Opening study enrollment, recall and practice through the production HTTP boundary."""

from copy import deepcopy

import chess
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from study_lesson_fixtures import MAIN, BrowserLessonProvider
from trainer.api import create_app
from trainer.models import Exercise, Review, SRSState
from trainer.opening_studies import catalogue
from trainer.opening_studies.sources import course_key
from trainer.scheduling import FSRSScheduler

STUDIES = "/api/opening-studies"
LESSONS = "/api/study/lesson-sessions"


def response_json(response):
    assert response.status_code == 200, response.text
    return response.json()


def app_for(settings, *, with_course=True):
    settings.stockfish_path = "missing-opening-journey-engine"
    provider = BrowserLessonProvider()
    if with_course:
        provider.install("local", "connected")
    return create_app(settings, workers=False, start_engine=False, lesson_providers=(provider,))


def catalogue_line(*moves):
    return next(line for line in catalogue.lines() if line.moves == list(moves))


def enroll_catalogue(client, *moves, color="white"):
    line = catalogue_line(*moves)
    preview = response_json(client.get(f"/api/openings/catalog/{line.source_key}"))
    assert [frame["uci"] for frame in preview["frames"]] == list(moves)
    return response_json(
        client.post(
            STUDIES,
            json={
                "source": line.source,
                "source_key": line.source_key,
                "source_version": line.source_version,
                "color": color,
            },
        )
    )


def enroll_course(client, line_id="fixture-main"):
    return client.post(
        STUDIES,
        json={
            "source": "course_line",
            "source_key": course_key("connected", line_id),
            "source_version": "fixture-v1",
            "course_id": "connected",
            "line_id": line_id,
            "color": "white",
        },
    )


def exercise_at(app, *moves):
    board = chess.Board()
    for move in moves:
        board.push_uci(move)
    with app.state.sessions() as db:
        return db.scalar(
            select(Exercise.id).where(Exercise.source == "opening", Exercise.fen == board.fen())
        )


def start(client, exercise_id):
    assert exercise_id is not None
    return response_json(client.post(f"/api/review/{exercise_id}/start"))


def submit(client, session_id, uci):
    return response_json(
        client.post(
            f"/api/review/sessions/{session_id}/move",
            json={"from_square": uci[:2], "to_square": uci[2:4]},
        )
    )


def lesson_move(client, state, uci):
    return response_json(
        client.post(
            f"{LESSONS}/{state['id']}/command",
            json={
                "request_id": f"journey-{state['revision']}-{uci}",
                "revision": state["revision"],
                "action": "move",
                "uci": uci,
            },
        )
    )


def scheduler_rows(app):
    with app.state.sessions() as db:
        return {
            model.__tablename__: {
                row.exercise_id if model is SRSState else row.id: {
                    column.name: deepcopy(getattr(row, column.name))
                    for column in model.__table__.columns
                }
                for row in db.scalars(select(model))
            }
            for model in (Review, SRSState)
        }


def reject_scheduling(*_args, **_kwargs):
    pytest.fail("A stale recall or dedicated practice must not invoke FSRS")


def answers(feedback):
    return {answer["uci"] for answer in feedback["answers"]}


def test_catalogue_and_course_union_in_due_but_practice_keeps_its_line(settings, monkeypatch):
    app = app_for(settings)
    with TestClient(app) as client:
        vienna = enroll_catalogue(client, "e2e4", "e7e5", "b1c3")
        course = response_json(enroll_course(client))
        assert response_json(enroll_course(client))["id"] == course["id"]
        assert enroll_course(client, "example-only").status_code == 422
        assert course["source"] == "course_line" and course["source_version"] == "fixture-v1"
        assert course["line"]["moves"] == list(MAIN)
        target = exercise_at(app, "e2e4", "e7e5")
        due = response_json(client.get("/api/review/queue"))
        assert sum(item["exercise_id"] == target for item in due) == 1
        cold = start(client, target)
        assert set(cold["opening"]["names"]) == {vienna["name"], course["name"]}
        assert cold["opening"]["prompt"] == "Play your studied move."
        assert not any(
            cold.get(key) for key in ("answers", "continuations", "candidates", "feedback", "facts")
        )
        assert {move["from_square"] + move["to_square"] for move in cold["legal_moves"]} >= {
            "g1f3",
            "b1c3",
            "d2d4",
        }
        failed = submit(client, cold["session_id"], "d2d4")
        assert failed["grade"] == "failure" and not failed["completed"]
        assert "stud" in failed["message"].lower()
        solved = submit(client, cold["session_id"], "b1c3")
        assert solved["completed"] and solved["grade"] in {"correct", "acceptable"}
        assert answers(solved) == {"g1f3", "b1c3"}
        with app.state.sessions() as db:
            state = db.get(SRSState, target)
            assert state.reviews == 1 and state.lapses == 1
        before = scheduler_rows(app)
        monkeypatch.setattr(FSRSScheduler, "review", reject_scheduling)
        practice = response_json(
            client.post(f"{STUDIES}/{course['id']}/practice", json={"request_id": "practice"})
        )
        assert practice["step"]["kind"] == "rehearsal"
        practice = lesson_move(client, practice, "e2e4")
        assert [frame["uci"] for frame in practice["history"]] == ["e2e4", "e7e5"]
        wrong = lesson_move(client, practice, "b1c3")
        assert wrong["feedback"]["kind"] == "incorrect" and wrong["fen"] == practice["fen"]
        practice = lesson_move(client, wrong, "g1f3")
        practice = lesson_move(client, practice, "f1c4")
        assert practice["step"]["phase"] == "complete"
        practice = response_json(
            client.post(
                f"{LESSONS}/{practice['id']}/command",
                json={
                    "request_id": "practice-complete",
                    "revision": practice["revision"],
                    "action": "continue",
                },
            )
        )
        assert practice["status"] == "completed"
        assert scheduler_rows(app) == before
