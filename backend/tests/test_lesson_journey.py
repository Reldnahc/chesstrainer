"""The connected framework checkpoint runs through real HTTP/session persistence."""

import chess
from fastapi.testclient import TestClient
from sqlalchemy import select
from study_lesson_fixtures import GAME, MAIN, BrowserLessonProvider, connected_course
from trainer.api import create_app
from trainer.models import AnalysisJob, Review, SkillEvidence, SRSState

BASE = "/api/study/lesson-sessions"


def fen(moves):
    board = chess.Board()
    for uci in moves:
        board.push_uci(uci)
    return board.fen()


def command(client, state, action, **values):
    response = client.post(
        f"{BASE}/{state['id']}/command",
        json={
            "request_id": f"journey-{state['revision']}-{action}",
            "revision": state["revision"],
            "action": action,
        }
        | values,
    )
    assert response.status_code == 200, response.text
    return response.json()


def begin(client, key="connected", request="journey-start"):
    response = client.post(
        BASE,
        json={
            "course_id": key,
            "course_revision": "fixture-v1",
            "chapter_id": "connected",
            "request_id": request,
        },
    )
    assert response.status_code == 200, response.text
    return response.json()


def learning(app):
    with app.state.sessions() as db:
        return {
            model.__tablename__: [
                {column.name: getattr(row, column.name) for column in model.__table__.columns}
                for row in db.scalars(select(model))
            ]
            for model in (Review, SRSState, SkillEvidence, AnalysisJob)
        }


def app_with(settings, provider=None):
    settings.stockfish_path = "missing-lesson-journey-engine"
    if provider is None:
        provider = BrowserLessonProvider()
        provider.install("local", "connected")
    return create_app(settings, workers=False, start_engine=False, lesson_providers=(provider,))


def test_connected_chapter_back_branch_source_game_rehearsal_and_restart(settings):
    app = app_with(settings)
    with TestClient(app) as client:
        # Protect a real saved recall state as well as preventing new ordinary reviews.
        response = client.post(
            "/api/exercises/manual", json={"fen": chess.STARTING_FEN, "moves": ["e2e4"]}
        )
        assert response.status_code == 200
        before = learning(app)
        state = begin(client)
        assert state["step"]["id"] == "welcome" and state["fen"] == chess.STARTING_FEN
        state = command(client, state, "continue")
        assert state["step"]["id"] == "center"
        state = command(client, state, "continue")
        assert state["step"]["phase"] == "complete"
        assert [frame["uci"] for frame in state["playback"]] == list(MAIN[:2])
        state = command(client, state, "back")
        assert state["step"]["phase"] == "ready" and state["fen"] == chess.STARTING_FEN
        state = command(client, state, "continue")
        state = command(client, state, "continue")
        assert state["step"]["id"] == "develop"
        state = command(client, state, "hint")
        assert state["feedback"]["kind"] == "hint" and state["assisted"]
        state = command(client, state, "move", uci="d2d4")
        assert state["feedback"]["kind"] == "incorrect" and state["fen"] == fen(MAIN[:2])
        state = command(client, state, "move", uci="g1f3")
        assert state["fen"] == fen(MAIN[:3])
        state = command(client, state, "continue")
        assert state["step"]["id"] == "opponent-choice"
        anchor = state
        state = command(client, state, "enter_branch")
        state = command(client, state, "continue")
        assert state["branch"] is not None
        assert state["fen"] == fen((*MAIN[:3], "d7d6", "f1c4"))
        session_id = state["id"]
    # Resume inside a branch with the authored provider absent. The snapshot is authoritative.
    empty = BrowserLessonProvider()
    app = app_with(settings, empty)
    with TestClient(app) as client:
        resumed = client.get(f"{BASE}/{session_id}").json()
        assert resumed["fen"] == state["fen"] and resumed["history"] == state["history"]
        assert resumed["branch"] == state["branch"] and resumed["playback"] == []
        state = command(client, resumed, "continue")
        assert state["step"]["id"] == "quiet-explanation"
        state = command(client, state, "return_branch")
        assert state["branch"] is None
        assert state["fen"] == anchor["fen"] and state["history"] == anchor["history"]
        assert state["step"] == anchor["step"] and state["feedback"] == anchor["feedback"]
        state = command(client, state, "continue")
        state = command(client, state, "continue")
        assert state["fen"] == fen(MAIN)
        state = command(client, state, "continue")
        assert state["step"]["id"] == "example"
        excerpt = state
        state = command(client, state, "open_game")
        state = command(client, state, "game_seek", ply=0)
        assert state["fen"] == chess.STARTING_FEN and state["game"]["ply"] == 0
        state = command(client, state, "game_seek", ply=7)
        assert state["fen"] == fen(GAME[:7])
        assert state["game"]["note"]["text"] == "The c3-pawn supports d4."
        state = command(client, state, "close_game")
        assert state["fen"] == excerpt["fen"] and state["history"] == excerpt["history"]
        state = command(client, state, "continue")
        assert [frame["uci"] for frame in state["playback"]] == list(GAME[5:7])
        state = command(client, state, "continue")
        assert state["step"]["kind"] == "rehearsal" and state["fen"] == chess.STARTING_FEN
        assert state["step"]["annotations"] == {"squares": [], "arrows": []}
        assert not any(key in state for key in ("choices", "solution", "line", "chapters"))
        assert state["history"] == [] and len(state["legal_moves"]) == 20
        assert "Nf3" not in state["step"]["text"]
        state = command(client, state, "move", uci="e2e4")
        resumed = client.get(f"{BASE}/{session_id}").json()
        assert resumed["fen"] == fen(MAIN[:2]) and resumed["revision"] == state["revision"]
        assert resumed["playback"] == []
        state = command(client, resumed, "show_move")
        assert state["feedback"]["kind"] == "revealed" and state["fen"] == fen(MAIN[:4])
        state = command(client, state, "move", uci="f1c4")
        state = command(client, state, "continue")
        assert state["status"] == "completed" and state["assisted"] and state["failed"]
        state = command(client, state, "back")
        state = command(client, state, "continue")
        assert state["status"] == "completed"
        assert learning(app) == before


def test_accepted_alternative_uses_its_own_history_and_terminal_target(settings):
    with TestClient(app_with(settings)) as client:
        state = begin(client)
        for _ in range(3):
            state = command(client, state, "continue")
        state = command(client, state, "move", uci="b1c3")
        assert state["fen"] == fen((*MAIN[:2], "b1c3"))
        state = command(client, state, "continue")
        assert state["step"]["id"] == "other-knight"
        assert [frame["uci"] for frame in state["history"]] == [*MAIN[:2], "b1c3"]
        assert state["playback"] == []
        state = command(client, state, "continue")
        assert state["status"] == "completed"


def test_same_revision_cannot_silently_change_saved_chapter(settings):
    provider = BrowserLessonProvider()
    provider.install("local", "connected")
    with TestClient(app_with(settings, provider)) as client:
        first = begin(client)
        changed = connected_course().model_dump(mode="json")
        changed["chapters"][0]["steps"][0]["text"] = (
            "Changed content with an invalid reused revision."
        )
        # Providers may change outside the process; normal provider validation cannot
        # know account progress. Starting must compare the pinned revision hash.
        provider._accounts["local"]["connected"] = changed
        result = client.post(
            BASE,
            json={
                "course_id": "connected",
                "course_revision": "fixture-v1",
                "chapter_id": "connected",
                "request_id": "start-changed-content",
            },
        )
        assert result.status_code == 409
        saved = client.get(f"{BASE}/{first['id']}").json()
        assert saved["step"] == first["step"]
