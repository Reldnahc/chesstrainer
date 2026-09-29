"""Castling notation is semantic at runtime; authored revisions remain immutable."""

import chess
import pytest
from fastapi.testclient import TestClient
from test_study_lessons import BASE, app_with, begin, post, tiny
from trainer.contracts.study_lessons import LessonCommand
from trainer.models import StudyLessonSession
from trainer.study_lessons.content import CourseDefinition, Position
from trainer.study_lessons.player import initial_state, transition
from trainer.study_lessons.queries import fingerprint


@pytest.mark.parametrize("color", ["white", "black"])
@pytest.mark.parametrize("side", ["king", "queen"])
@pytest.mark.parametrize("kind", ["decision", "rehearsal"])
@pytest.mark.parametrize(
    ("authored_alias", "submitted_alias"), [(False, False), (True, False), (False, True)]
)
def test_castling_notations_share_grading_without_rewriting_course(
    settings, color, side, kind, authored_alias, submitted_alias
):
    rank = "1" if color == "white" else "8"
    canonical = f"e{rank}{'g' if side == 'king' else 'c'}{rank}"
    alias = f"e{rank}{'h' if side == 'king' else 'a'}{rank}"
    authored = alias if authored_alias else canonical
    submitted = alias if submitted_alias else canonical
    fen = f"r3k2r/8/8/8/8/8/8/R3K2R {'w' if color == 'white' else 'b'} KQkq - 0 1"
    record = tiny(fen=fen, uci=authored, color=color).model_dump(mode="json")
    chapter = record["chapters"][0]
    if kind == "rehearsal":
        record["lines"] = [
            {
                "id": "castle",
                "title": "Castle",
                "position": {"initial_fen": fen},
                "moves": [authored],
            }
        ]
        chapter["steps"] = [
            {
                "id": "decision",
                "kind": "rehearsal",
                "title": "Castle",
                "position": {"initial_fen": fen},
                "line_id": "castle",
                "next_step": "after",
            }
        ]
    else:
        chapter["steps"][0]["choices"][0]["next_step"] = "after"
    chapter["steps"].append(
        {
            "id": "after",
            "kind": "explanation",
            "title": "After castling",
            "position": {"initial_fen": fen, "moves": [authored]},
        }
    )
    course = CourseDefinition.model_validate(record)
    snapshot = course.model_dump(mode="json")
    original_hash = fingerprint(course)
    expected = chess.Board(fen)
    expected.push_uci(canonical)
    app = app_with(settings, course)
    with TestClient(app) as client:
        state = begin(client, course)
        assert {
            "from_square": f"e{rank}",
            "to_square": canonical[2:4],
            "promotion": None,
            "capture": False,
        } in state["legal_moves"]
        response = post(client, state, "move", uci=submitted)
        assert response.status_code == 200, response.text
        state = response.json()
        assert state["feedback"]["kind"] == "correct"
        assert not state["failed"] and not state["assisted"]
        assert state["fen"] == expected.fen()
        assert [frame["uci"] for frame in state["playback"]] == [canonical]
        assert state["history"] == state["playback"]
        with app.state.sessions() as db:
            saved = db.get(StudyLessonSession, state["id"])
            assert saved.snapshot == snapshot
            assert saved.content_hash == original_hash
            assert saved.state["position"]["moves"] == [authored]
        state = post(client, state, "back").json()
        revealed = post(client, state, "show_move").json()
        assert revealed["assisted"] and not revealed["failed"]
        assert [frame["uci"] for frame in revealed["playback"]] == [canonical]
        advanced = post(client, revealed, "continue").json()
        assert advanced["step"]["id"] == "after"
        reloaded = client.get(f"{BASE}/{state['id']}").json()
        assert reloaded["history"] == revealed["history"]
        assert reloaded["fen"] == expected.fen()
        assert fingerprint(course) == original_hash


@pytest.mark.parametrize("uci", ["0000", "e1g1q", "e1h1q"])
def test_castling_normalization_does_not_admit_invalid_moves(settings, uci):
    fen = "4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1"
    with pytest.raises(ValueError):
        Position(initial_fen=fen, moves=(uci,))
    source = tiny(fen=fen, uci="e1g1")
    with TestClient(app_with(settings, source)) as client:
        state = begin(client, source)
        rejected = post(client, state, "move", uci=uci)
        assert rejected.status_code == 422
        assert client.get(f"{BASE}/{state['id']}").json() == state


@pytest.mark.parametrize("uci", ["e1h1", "e1g1"])
def test_saved_distinct_castling_spellings_keep_their_exact_choice(uci):
    record = tiny(fen="4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1", uci="e1h1").model_dump(mode="json")
    record["chapters"][0]["steps"][0]["choices"] = [
        {"uci": candidate, "next_step": None, "feedback": candidate}
        for candidate in ("e1h1", "e1g1")
    ]
    source = CourseDefinition.model_validate(record)
    chapter = source.chapters[0]
    state, playback = transition(
        source,
        chapter,
        initial_state(source, chapter),
        LessonCommand(request_id="castle", revision=0, action="move", uci=uci),
    )
    assert state["feedback"] == {"kind": "correct", "text": uci}
    assert state["position"]["moves"] == [uci]
    assert playback[0]["uci"] == "e1g1"
