"""Authored-content validation, teaching authority and durable lesson command edges."""

from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass

import chess
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import func, select
from study_lesson_fixtures import connected_course
from trainer.accounts import COOKIE
from trainer.api import create_app
from trainer.errors import NotFound
from trainer.models import StudyLessonCommand, StudyLessonProgress
from trainer.study_lessons.content import CourseDefinition

BASE = "/api/study/lesson-sessions"


@dataclass
class Provider:
    content: tuple

    def courses(self, db):
        return self.content


def tiny(*, fen=chess.STARTING_FEN, uci="e2e4", color="white", revision="v1"):
    return CourseDefinition.model_validate(
        {
            "id": "tiny",
            "revision": revision,
            "title": "One authored decision",
            "learner_color": color,
            "attributions": [{"text": "Original test"}],
            "chapters": [
                {
                    "id": "chapter",
                    "title": "Guided",
                    "entry_step": "decision",
                    "steps": [
                        {
                            "id": "decision",
                            "title": "Play the lesson move",
                            "kind": "decision",
                            "position": {"initial_fen": fen},
                            "hint": "Use the taught move.",
                            "choices": [{"uci": uci, "next_step": None}],
                        }
                    ],
                }
            ],
        }
    )


def app_with(settings, course=None, provider=None):
    return create_app(
        settings,
        workers=False,
        start_engine=False,
        lesson_providers=(provider or Provider((course or tiny(),)),),
    )


def begin(client, course=None, request_id="start", headers=None):
    course = course or tiny()
    response = client.post(
        BASE,
        headers=headers,
        json={
            "request_id": request_id,
            "course_id": course.id,
            "course_revision": course.revision,
            "chapter_id": course.chapters[0].id,
        },
    )
    assert response.status_code == 200, response.text
    return response.json()


def post(client, state, action, request_id=None, headers=None, **kwargs):
    return client.post(
        f"{BASE}/{state['id']}/command",
        headers=headers,
        json={
            "request_id": request_id or f"{action}-{state['revision']}",
            "revision": state["revision"],
            "action": action,
            **kwargs,
        },
    )


@pytest.mark.parametrize(
    "problem",
    ["illegal_move", "wrong_turn", "missing_target", "unreachable", "cycle", "unsafe_url"],
)
def test_rejects_incoherent_authored_courses(problem):
    record = connected_course().model_dump(mode="json")
    chapter = record["chapters"][0]
    steps = {step["id"]: step for step in chapter["steps"]}
    if problem == "illegal_move":
        steps["center"]["moves"] = ["e2e5"]
    elif problem == "wrong_turn":
        record["learner_color"] = "black"
    elif problem == "missing_target":
        steps["develop"]["choices"][0]["next_step"] = "missing"
    elif problem == "unreachable":
        chapter["steps"].append({"id": "unused", "kind": "explanation", "title": "Unused"})
    elif problem == "cycle":
        steps["welcome"]["next_step"] = "welcome"
    elif problem == "unsafe_url":
        record["attributions"][0]["url"] = "javascript:alert(1)"
    with pytest.raises(ValidationError):
        CourseDefinition.model_validate(record)


def test_commands_are_revisioned_idempotent_and_completion_is_monotonic(settings):
    app = app_with(settings)
    with TestClient(app) as client:
        state = begin(client)
        assert begin(client)["id"] == state["id"]
        assert post(client, state, "continue").status_code == 409
        assert post(client, state, "move", uci="e2e5").status_code == 422
        with ThreadPoolExecutor(max_workers=2) as executor:
            results = list(
                executor.map(lambda _: post(client, state, "move", uci="e2e4"), range(2))
            )
        assert [response.status_code for response in results] == [200, 200]
        assert results[0].json() == results[1].json()
        assert post(client, state, "move", uci="d2d4").status_code == 409
        state = results[0].json()
        state = post(client, state, "continue").json()
        with app.state.sessions() as db:
            progress = db.scalar(select(StudyLessonProgress))
            completed_at = progress.completed_at
            assert completed_at is not None
            assert progress.attempted_steps == progress.viewed_steps == ["decision"]
        state = post(client, state, "back").json()
        assert state["status"] == "active"
        state = post(client, state, "continue").json()
        assert state["status"] == "completed"
        with app.state.sessions() as db:
            assert db.scalar(select(StudyLessonProgress)).completed_at == completed_at
            assert db.scalar(select(func.count()).select_from(StudyLessonProgress)) == 1
            assert db.scalar(select(func.count()).select_from(StudyLessonCommand)) == 4


@pytest.mark.parametrize(
    ("black", "fen", "uci"),
    [
        (False, "4k3/P7/8/8/8/8/8/4K3 w - - 0 1", "a7a8n"),
        (True, "4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1", "e1c1"),
    ],
)
def test_guided_special_moves_for_both_learner_colors(settings, black, fen, uci):
    if black:
        fen = chess.Board(fen).mirror().fen()
        move = chess.Move.from_uci(uci)
        uci = chess.Move(
            chess.square_mirror(move.from_square),
            chess.square_mirror(move.to_square),
            promotion=move.promotion,
        ).uci()
    source = tiny(fen=fen, uci=uci, color="black" if black else "white")
    with TestClient(app_with(settings, source)) as client:
        state = begin(client, source)
        correct = post(client, state, "move", uci=uci)
        assert correct.status_code == 200, correct.text
        result = correct.json()
        board = chess.Board(fen)
        board.push_uci(uci)
        assert result["fen"] == board.fen()
        assert result["feedback"]["kind"] == "correct"
        assert post(client, result, "continue").json()["status"] == "completed"


def test_rehearsal_auto_reply_before_first_learner_move_and_no_hints(settings):
    record = tiny(color="white").model_dump(mode="json")
    record["learner_color"] = "black"
    record["lines"] = [{"id": "line", "title": "A line", "moves": ["e2e4", "e7e5", "g1f3", "b8c6"]}]
    record["chapters"][0]["steps"] = [
        {
            "id": "decision",
            "kind": "rehearsal",
            "line_id": "line",
            "title": "Rehearsal",
            "text": "The hidden answer is e5",
            "annotations": {"squares": ["e5"]},
        }
    ]
    source = CourseDefinition.model_validate(record)
    with TestClient(app_with(settings, source)) as client:
        state = begin(client, source)
        assert [frame["uci"] for frame in state["history"]] == ["e2e4"]
        assert [frame["uci"] for frame in state["playback"]] == ["e2e4"]
        assert "hint" not in state["actions"] and "e5" not in state["step"]["text"]
        assert state["step"]["annotations"] == {"squares": [], "arrows": []}
        assert client.get(f"{BASE}/{state['id']}").json()["playback"] == []
        state = post(client, state, "show_move").json()
        assert [frame["uci"] for frame in state["playback"]] == ["e7e5", "g1f3"]
        state = post(client, state, "move", uci="b8c6").json()
        assert state["assisted"] and state["step"]["phase"] == "complete"


@pytest.mark.parametrize("entry", ["branch", "reset"])
def test_entering_rehearsal_preserves_automatic_reply_playback(settings, entry):
    record = tiny().model_dump(mode="json")
    record["learner_color"] = "black"
    record["lines"] = [{"id": "line", "title": "A line", "moves": ["d2d4", "d7d5"]}]
    start = {"id": "decision", "title": "Enter rehearsal"}
    if entry == "branch":
        start.update(kind="branch", branch_start="recall")
    else:
        start.update(kind="explanation", position={"moves": ["e2e4"]}, next_step="recall")
    record["chapters"][0]["steps"] = [
        start,
        {"id": "recall", "kind": "rehearsal", "line_id": "line", "title": "Rehearsal"},
    ]
    source = CourseDefinition.model_validate(record)
    with TestClient(app_with(settings, source)) as client:
        original = begin(client, source)
        action = "enter_branch" if entry == "branch" else "continue"
        response = post(client, original, action)
        assert response.status_code == 200, response.text
        state = response.json()
        assert [frame["uci"] for frame in state["playback"]] == ["d2d4"]
        assert state["playback"] == state["history"]
        assert state["playback"][0]["before_fen"] == chess.STARTING_FEN
        assert state["playback"][-1]["after_fen"] == state["fen"]
        resumed = client.get(f"{BASE}/{state['id']}").json()
        assert resumed["fen"] == state["fen"] and resumed["playback"] == []
        restored = post(client, resumed, "return_branch" if entry == "branch" else "back").json()
        assert restored["history"] == original["history"]
        assert restored["step"] == original["step"]
        replayed = post(client, restored, action).json()
        assert replayed["playback"] == state["playback"]
        completed = post(client, replayed, "move", uci="d7d5").json()
        assert completed["step"]["phase"] == "complete"
        assert completed["feedback"]["kind"] == "correct"


def test_source_game_prefix_annotations_and_inspection_reload(settings):
    record = tiny().model_dump(mode="json")
    record["games"] = [
        {
            "id": "game",
            "title": "Game with prefix",
            "position": {"moves": ["e2e4", "e7e5"]},
            "moves": ["g1f3", "b8c6", "f1c4"],
            "attributions": [{"text": "Original"}],
            "annotations": [
                {"ply": 2, "text": "Black defended e5.", "annotations": {"squares": ["c6"]}}
            ],
        }
    ]
    record["chapters"][0]["steps"] = [
        {
            "id": "decision",
            "kind": "game_excerpt",
            "title": "Excerpt",
            "game_id": "game",
            "from_ply": 1,
            "to_ply": 3,
            "position": {"moves": ["e2e4", "e7e5", "g1f3"]},
        }
    ]
    source = CourseDefinition.model_validate(record)
    with TestClient(app_with(settings, source)) as client:
        original = begin(client, source)
        state = post(client, original, "open_game").json()
        assert state["game"]["ply"] == 3 and state["game"]["total_plies"] == 5
        state = post(client, state, "game_seek", ply=0).json()
        assert state["fen"] == chess.STARTING_FEN and state["history"] == []
        state = post(client, state, "game_seek", ply=4).json()
        assert state["game"]["note"]["text"] == "Black defended e5."
        assert state["step"]["annotations"] == {"squares": [], "arrows": []}
        assert len(state["history"]) == 4
        session_id = state["id"]
    with TestClient(create_app(settings, workers=False, start_engine=False)) as client:
        state = client.get(f"{BASE}/{session_id}").json()
        assert state["game"]["ply"] == 4 and state["playback"] == []
        state = post(client, state, "close_game").json()
        assert state["history"] == original["history"] and state["step"] == original["step"]
        assert state["game"] is None


def test_account_isolation_and_owned_commands(settings):
    settings.public_origin = "http://testserver"
    settings.accounts_enabled = True
    settings.session_secure = False
    app = app_with(settings)
    with TestClient(app) as client:

        def signup(username):
            response = client.post(
                "/api/auth/signup",
                headers={"Origin": "http://testserver"},
                json={"username": username, "password": "testing-password"},
            )
            assert response.status_code == 201
            return (
                {"Origin": "http://testserver", "X-CSRF-Token": response.json()["csrf"]},
                client.cookies.get(COOKIE),
                response.json()["user"]["id"],
            )

        alice_headers, alice_cookie, _ = signup("alice")
        alice = begin(client, headers=alice_headers)
        bob_headers, _, bob_id = signup("bobby")
        assert client.get(f"{BASE}/{alice['id']}").status_code == 404
        assert post(client, alice, "show_move", headers=bob_headers).status_code == 404
        assert client.get("/api/study/courses").json()["resume"] == []
        with app.state.workspaces.open(bob_id) as workspace, workspace.sessions() as db:
            db.add(
                StudyLessonCommand(
                    session_id=alice["id"], request_id="foreign", request={}, response={}
                )
            )
            with pytest.raises(NotFound, match="Referenced item"):
                db.flush()
        bob = begin(client, headers=bob_headers)
        assert bob["id"] != alice["id"]
        bob = post(client, bob, "show_move", headers=bob_headers).json()
        post(client, bob, "continue", headers=bob_headers)
        client.cookies.set(COOKIE, alice_cookie)
        assert client.get("/api/study/courses").json()["courses"][0]["completed_chapters"] == 0
        assert client.get(f"{BASE}/{alice['id']}").json() == alice


def test_new_course_revision_does_not_inherit_old_completion(settings):
    provider = Provider((tiny(),))
    app = app_with(settings, provider=provider)
    with TestClient(app) as client:
        original = begin(client)
        original = post(client, original, "move", uci="e2e4").json()
        original = post(client, original, "continue").json()
        assert client.get("/api/study/courses").json()["courses"][0]["completed_chapters"] == 1
        updated = tiny(revision="v2", uci="d2d4")
        provider.content = (updated,)
        catalogue = client.get("/api/study/courses").json()
        assert catalogue["courses"][0]["revision"] == "v2"
        assert catalogue["courses"][0]["completed_chapters"] == 0
        current = begin(client, updated, request_id="start-v2")
        assert current["course_revision"] == "v2" and current["status"] == "active"
        old = client.get(f"{BASE}/{original['id']}").json()
        assert old["course_revision"] == "v1" and old["status"] == "completed"
        assert client.get("/api/study/courses/tiny?revision=v1").json()["chapters"][0]["completed"]
        with app.state.sessions() as db:
            assert db.scalar(select(func.count()).select_from(StudyLessonProgress)) == 2
