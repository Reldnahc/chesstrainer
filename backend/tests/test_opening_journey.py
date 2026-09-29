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


def test_removed_answer_still_grades_saved_session_after_restart_without_scheduling(
    settings, monkeypatch
):
    app = app_for(settings)
    with TestClient(app) as client:
        vienna = enroll_catalogue(client, "e2e4", "e7e5", "b1c3")
        course = response_json(enroll_course(client))
        target = exercise_at(app, "e2e4", "e7e5")
        old = start(client, target)
        response_json(client.delete(f"{STUDIES}/{vienna['id']}"))
        current = start(client, target)
        assert current["session_id"] != old["session_id"]
        assert current["opening"]["names"] == [course["name"]]
        before = scheduler_rows(app)

    monkeypatch.setattr(FSRSScheduler, "review", reject_scheduling)
    restarted = app_for(settings, with_course=False)
    with TestClient(restarted) as client:
        saved = response_json(client.get(f"/api/review/sessions/{old['session_id']}"))
        assert saved["opening"] == old["opening"] and saved["non_scheduling_reason"]
        assert start(client, target)["session_id"] == current["session_id"]
        result = submit(client, old["session_id"], "b1c3")
        assert result["grade"] in {"correct", "acceptable"} and result["completed"]
        assert answers(result) == {"g1f3", "b1c3"}
        assert result["scheduling_status"] == "content_changed"
        assert result["non_scheduling_reason"]
        assert "schedule" in result["message"].lower()
        assert scheduler_rows(restarted) == before
        saved = response_json(client.get(f"/api/review/sessions/{old['session_id']}"))
        assert saved["completed"] and answers(saved["feedback"]) == {"g1f3", "b1c3"}


@pytest.mark.parametrize("change", ["answer_change_and_restore", "deactivate_and_restore"])
def test_restored_content_never_revalidates_an_old_attempt(settings, monkeypatch, change):
    app = app_for(settings)
    with TestClient(app) as client:
        original = enroll_catalogue(client, "e2e4")
        target = exercise_at(app)
        solved = submit(client, start(client, target)["session_id"], "e2e4")
        assert solved["completed"]
        old = start(client, target)
        original_schedule = scheduler_rows(app)
        if change == "answer_change_and_restore":
            extra = enroll_catalogue(client, "d2d4")
            # Adding an answer preserves the future schedule. The now-stale open
            # attempt must not force this position back into the automatic queue.
            assert scheduler_rows(app) == original_schedule
            assert response_json(client.get("/api/review/queue")) == []
            response_json(client.delete(f"{STUDIES}/{extra['id']}"))
        else:
            response_json(client.delete(f"{STUDIES}/{original['id']}"))
            assert response_json(client.get("/api/review/queue")) == []
            response_json(client.post(f"{STUDIES}/{original['id']}/restore"))
            assert scheduler_rows(app) == original_schedule
        before = scheduler_rows(app)
        current = start(client, target)
        assert current["session_id"] != old["session_id"]
        assert current["opening"]["revision"] > old["opening"]["revision"]
        assert current["opening"]["names"] == old["opening"]["names"]

    monkeypatch.setattr(FSRSScheduler, "review", reject_scheduling)
    restarted = app_for(settings, with_course=False)
    with TestClient(restarted) as client:
        resumed = response_json(client.get(f"/api/review/sessions/{old['session_id']}"))
        assert resumed["non_scheduling_reason"] and resumed["opening"] == old["opening"]
        revealed = response_json(client.post(f"/api/review/sessions/{old['session_id']}/reveal"))
        assert revealed["completed"] and revealed["grade"] == "revealed"
        assert answers(revealed) == {"e2e4"}
        assert revealed["scheduling_status"] == "content_changed"
        assert revealed["non_scheduling_reason"]
        assert scheduler_rows(restarted) == before
        assert start(client, target)["session_id"] == current["session_id"]


def test_first_failure_stays_recorded_when_study_is_disabled_before_reveal(settings, monkeypatch):
    app = app_for(settings)
    with TestClient(app) as client:
        study = enroll_catalogue(client, "e2e4")
        target = exercise_at(app)
        cold = start(client, target)
        failed = submit(client, cold["session_id"], "d2d4")
        assert failed["grade"] == "failure" and not failed["completed"]
        response_json(client.delete(f"{STUDIES}/{study['id']}"))
        before = scheduler_rows(app)
        assert len(before["reviews"]) == 1
        assert before["srs_states"][target]["reviews"] == 1
        assert before["srs_states"][target]["lapses"] == 1
        monkeypatch.setattr(FSRSScheduler, "review", reject_scheduling)
        shown = response_json(client.post(f"/api/review/sessions/{cold['session_id']}/reveal"))
        assert shown["scheduling_status"] == "previously_recorded"
        assert shown["non_scheduling_reason"] and answers(shown) == {"e2e4"}
        after = scheduler_rows(app)
        assert after["srs_states"] == before["srs_states"]
        assert after["reviews"].keys() == before["reviews"].keys()
        # Recording that the learner eventually revealed is existing review metadata;
        # the original rating, timing and scheduler evidence must remain untouched.
        old_review = next(iter(before["reviews"].values()))
        new_review = next(iter(after["reviews"].values()))
        assert {key: value for key, value in new_review.items() if key != "revealed"} == {
            key: value for key, value in old_review.items() if key != "revealed"
        }
