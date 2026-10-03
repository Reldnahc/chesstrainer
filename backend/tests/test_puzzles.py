"""Puzzle protocol, cold authority, ownership and durable multi-step practice."""

from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import timedelta

import chess
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import func, select
from trainer.accounts import COOKIE
from trainer.api import create_app
from trainer.contracts.puzzles import PuzzleMove
from trainer.models import PuzzleAttempt, PuzzleSession, Review, SkillEvidence, SRSState
from trainer.puzzles.definitions import PuzzleDefinition
from trainer.puzzles.providers import PuzzleProviders
from trainer.puzzles.sessions import command

FEN = "8/4k3/1r6/8/8/2N5/8/4K3 w - - 0 1"
LINE = ("c3d5", "e7d7", "d5b6")


def definition(**changes):
    return PuzzleDefinition.model_validate(
        {
            "key": "p001",
            "version": "test-v1",
            "source": "generic",
            "initial_fen": FEN,
            "orientation": "white",
            "solution": LINE,
            "themes": ["fork"],
            "rating": 1300,
            "provenance": {"attribution": "Original development fixture"},
        }
        | changes
    )


@dataclass
class FixtureProvider:
    definitions: tuple
    id: str = "test-fixtures"
    name: str = "Development fixtures"
    source: str = "generic"

    def catalog(self, db):
        return self.definitions


def app_with(settings, *definitions):
    return create_app(
        settings,
        workers=False,
        start_engine=False,
        puzzle_providers=(FixtureProvider(definitions or (definition(),)),),
    )


def start(client, *, request_id="start", headers=None):
    key = client.get("/api/puzzles/next").json()
    response = client.post(
        "/api/puzzle-sessions", json=key | {"request_id": request_id}, headers=headers
    )
    assert response.status_code == 200, response.text
    return response.json()


def move(client, state, uci, *, request_id=None, headers=None):
    return client.post(
        f"/api/puzzle-sessions/{state['id']}/move",
        json={
            "request_id": request_id or f"move-{state['revision']}",
            "revision": state["revision"],
            "uci": uci,
            "elapsed_ms": 1200,
        },
        headers=headers,
    )


def reveal(client, state, *, headers=None):
    return client.post(
        f"/api/puzzle-sessions/{state['id']}/reveal",
        json={"request_id": "reveal", "revision": state["revision"]},
        headers=headers,
    )


def retained_learning(app):
    with app.state.sessions() as db:
        return {
            model.__tablename__: [
                {column.name: getattr(row, column.name) for column in model.__table__.columns}
                for row in db.scalars(select(model))
            ]
            for model in (Review, SRSState, SkillEvidence)
        }


def test_disabled_starter_pack_leaves_an_honest_empty_library(settings):
    settings.puzzle_starter_pack = False
    with TestClient(create_app(settings, workers=False, start_engine=False)) as client:
        assert client.get("/api/puzzles").json() == {
            "available": 0,
            "sources": [],
            "themes": [],
            "retry_available": 0,
            "solved_puzzles": 0,
            "resume": [],
            "stats": {"solved": 0, "clean": 0, "failed_then_solved": 0, "revealed": 0},
        }
        assert client.get("/api/puzzles/next").json() is None
        assert client.get("/api/puzzles/next?source=games").json() is None
        assert (
            client.post(
                "/api/puzzle-sessions",
                json={"provider_id": "test", "key": "nope", "version": "v1", "request_id": "a"},
            ).status_code
            == 404
        )


def test_multistep_retry_resume_and_no_scheduling_side_effects(settings):
    app = app_with(settings)
    with TestClient(app) as client:
        # Ensure there is a real existing memory state to protect, not only empty tables.
        assert (
            client.post(
                "/api/exercises/manual",
                json={"fen": FEN, "moves": [LINE[0]], "orientation": "white"},
            ).status_code
            == 200
        )
        before = retained_learning(app)
        assert before["srs_states"]
        cold = start(client)
        assert cold["fen"] == FEN
        assert cold["completion"] is None and cold["history"] == cold["playback"] == []
        assert "fork" not in str(cold) and "d5b6" not in str(cold)
        assert cold["current_step"] == 0 and cold["feedback"] is None
        # An untouched start is not progress, even after an illegal input.
        assert client.get("/api/puzzles").json()["resume"] == []
        # An illegal input is not a failed tactical choice and consumes no revision.
        assert move(client, cold, "c3c8").status_code == 422
        assert client.get("/api/puzzles").json()["resume"] == []
        wrong = move(client, cold, "c3a4").json()
        assert client.get("/api/puzzles").json()["resume"][0]["id"] == cold["id"]
        assert wrong["failed"] and wrong["feedback"]["grade"] == "incorrect"
        assert wrong["fen"] == cold["fen"] and wrong["current_step"] == 0
        accepted = move(client, wrong, LINE[0]).json()
        assert [frame["uci"] for frame in accepted["playback"]] == list(LINE[:2])
        assert accepted["current_step"] == 2 and accepted["completion"] is None
        assert LINE[2] not in str(accepted)
        retry_later = move(client, accepted, "d5c3").json()
        assert retry_later["fen"] == accepted["fen"]
        assert retry_later["history"] == accepted["history"]
        session_id = cold["id"]
    # App restart, missing provider and content updates cannot rewrite an existing attempt.
    app = create_app(settings, workers=False, start_engine=False)
    with TestClient(app) as client:
        resumed = client.get(f"/api/puzzle-sessions/{session_id}").json()
        assert resumed["fen"] == accepted["fen"] and resumed["playback"] == []
        assert resumed["failed"] and resumed["feedback"]["grade"] == "incorrect"
        finished = move(client, resumed, LINE[-1]).json()
        assert finished["status"] == "solved" and finished["failed"]
        assert finished["completion"]["themes"] == ["fork"]
        assert [frame["uci"] for frame in finished["completion"]["solution"]] == list(LINE)
        assert client.get("/api/puzzles").json()["stats"] == {
            "solved": 1,
            "clean": 0,
            "failed_then_solved": 1,
            "revealed": 0,
        }
        assert client.get("/api/puzzles").json()["resume"] == []
        assert retained_learning(app) == before
        with app.state.sessions() as db:
            assert db.scalar(select(func.count()).select_from(PuzzleAttempt)) == 4
            assert db.get(PuzzleSession, session_id).first_response_ms == 1200


def test_solved_puzzles_counts_each_installed_puzzle_once(settings):
    app = app_with(settings, definition(), definition(key="p002"))

    def begin(client, key, request_id):
        response = client.post(
            "/api/puzzle-sessions",
            json={
                "provider_id": "test-fixtures",
                "key": key,
                "version": "test-v1",
                "request_id": request_id,
            },
        )
        assert response.status_code == 200, response.text
        return response.json()

    with TestClient(app) as client:
        for attempt in ("first", "repeat"):
            state = begin(client, "p001", attempt)
            for uci in LINE[::2]:
                state = move(client, state, uci).json()
            assert state["status"] == "solved"
        assert reveal(client, begin(client, "p002", "shown")).json()["status"] == "revealed"
        library = client.get("/api/puzzles").json()
        assert library["available"] == 2
        assert library["solved_puzzles"] == 1
        assert library["stats"]["solved"] == 2


def test_reveal_is_idempotent_and_replays_only_remaining_continuation(settings):
    app = app_with(settings)
    with TestClient(app) as client:
        cold = start(client)
        accepted = move(client, cold, LINE[0]).json()
        shown = reveal(client, accepted)
        assert shown.status_code == 200
        result = shown.json()
        assert result["status"] == "revealed" and not result["failed"]
        assert [frame["uci"] for frame in result["playback"]] == [LINE[-1]]
        assert reveal(client, accepted).json() == result
        assert move(client, result, LINE[-1]).status_code == 409
        assert client.get(f"/api/puzzle-sessions/{cold['id']}").json()["playback"] == []
        assert client.get("/api/puzzles").json()["stats"]["revealed"] == 1
        assert retained_learning(app) == {"reviews": [], "srs_states": [], "skill_evidence": []}


def test_request_replay_conflicts_and_competing_tabs(settings):
    app = app_with(settings)
    with TestClient(app) as client:
        cold = start(client)
        assert start(client)["id"] == cold["id"]
        changed_start = client.get("/api/puzzles/next").json() | {
            "request_id": "start",
            "version": "other",
        }
        assert client.post("/api/puzzle-sessions", json=changed_start).status_code == 409
        wrong = move(client, cold, "c3a4", request_id="same")
        assert wrong.status_code == 200
        assert move(client, cold, "c3a4", request_id="same").json() == wrong.json()
        assert move(client, cold, LINE[0], request_id="same").status_code == 409
        # Two simultaneous tabs use the same current revision: exactly one can advance.
        state = wrong.json()
        with ThreadPoolExecutor(max_workers=2) as executor:
            responses = list(
                executor.map(
                    lambda token: move(client, state, LINE[0], request_id=token), ["tab-a", "tab-b"]
                )
            )
        assert sorted(response.status_code for response in responses) == [200, 409]
        state = next(response.json() for response in responses if response.status_code == 200)
        solved = move(client, state, LINE[-1]).json()
        assert solved["status"] == "solved"
        # Retrying an older acknowledged command returns that command's original response.
        assert move(client, cold, "c3a4", request_id="same").json() == wrong.json()
        assert client.get(f"/api/puzzle-sessions/{cold['id']}").json()["status"] == "solved"
        assert reveal(client, state).status_code == 409
        with app.state.sessions() as db:
            assert db.scalar(select(func.count()).select_from(PuzzleSession)) == 1
            assert db.scalar(select(func.count()).select_from(PuzzleAttempt)) == 3


def test_simultaneous_duplicate_request_commits_once(settings):
    app = app_with(settings)
    with TestClient(app) as client:
        state = start(client)
        with ThreadPoolExecutor(max_workers=2) as executor:
            responses = list(executor.map(lambda _: move(client, state, LINE[0]), range(2)))
        assert all(response.status_code == 200 for response in responses)
        assert responses[0].json() == responses[1].json()
        with app.state.sessions() as db:
            assert db.scalar(select(func.count()).select_from(PuzzleAttempt)) == 1
            assert db.get(PuzzleSession, state["id"]).current_step == 2


def test_conditional_revision_write_rejects_stale_database_session(settings):
    from fastapi import HTTPException

    app = app_with(settings)
    with TestClient(app) as client:
        state = start(client)
        with app.state.sessions() as first, app.state.sessions() as second:
            stale = second.get(PuzzleSession, state["id"])
            request = PuzzleMove(request_id="first", revision=0, uci=LINE[0])
            command(first, state["id"], request)
            assert stale.revision == 0
            with pytest.raises(HTTPException) as raised:
                command(second, state["id"], request.model_copy(update={"request_id": "second"}))
            assert raised.value.status_code == 409
        assert client.get(f"/api/puzzle-sessions/{state['id']}").json()["current_step"] == 2


def test_resumed_feedback_matches_revision_even_if_clock_moves_backwards(settings):
    app = app_with(settings)
    with TestClient(app) as client:
        state = start(client)
        state = move(client, state, "c3a4").json()
        state = move(client, state, LINE[0]).json()
        with app.state.sessions() as db:
            latest = db.scalar(select(PuzzleAttempt).where(PuzzleAttempt.grade == "correct"))
            latest.created_at -= timedelta(days=1)
            db.commit()
        resumed = client.get(f"/api/puzzle-sessions/{state['id']}").json()
        assert resumed["feedback"] == state["feedback"]
        assert resumed["revision"] == state["revision"]


@pytest.mark.parametrize("outcome", ["solve", "reveal"])
def test_puzzles_preserve_existing_reviews_and_weakness_evidence(settings, outcome):
    from test_focused_practice import seed_classified

    app = app_with(settings)
    with TestClient(app) as client:
        with app.state.sessions() as db:
            fixture = seed_classified(db, settings)
        cold_review = client.post(f"/api/review/{fixture['exercise_id']}/start").json()
        client.post(f"/api/review/sessions/{cold_review['session_id']}/reveal")
        before = retained_learning(app)
        assert all(before.values())
        state = move(client, start(client), "c3a4").json()
        state = move(client, state, LINE[0]).json()
        if outcome == "solve":
            assert move(client, state, LINE[-1]).json()["status"] == "solved"
        else:
            assert reveal(client, state).json()["status"] == "revealed"
        assert retained_learning(app) == before


@pytest.mark.parametrize("black", [False, True])
@pytest.mark.parametrize(
    ("fen", "line"),
    [
        (FEN, LINE),
        ("4k3/P7/8/8/8/8/8/4K3 w - - 0 1", ("a7a8n",)),
        ("4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2", ("e5d6",)),
        ("4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1", ("e1g1",)),
    ],
)
def test_both_colors_special_moves(settings, black, fen, line):
    if black:
        fen = chess.Board(fen).mirror().fen()
        line = tuple(
            chess.Move(
                chess.square_mirror(chess.Move.from_uci(uci).from_square),
                chess.square_mirror(chess.Move.from_uci(uci).to_square),
                promotion=chess.Move.from_uci(uci).promotion,
            ).uci()
            for uci in line
        )
    fixture = definition(initial_fen=fen, solution=line, orientation="black" if black else "white")
    with TestClient(app_with(settings, fixture)) as client:
        state = start(client)
        for uci in line[::2]:
            response = move(client, state, uci)
            assert response.status_code == 200, response.text
            state = response.json()
        board = chess.Board(fen)
        for uci in line:
            board.push_uci(uci)
        assert state["fen"] == board.fen()
        assert state["status"] == "solved"
        assert client.get("/api/puzzles").json()["stats"]["clean"] == 1


@pytest.mark.parametrize("black", [False, True])
@pytest.mark.parametrize("submit_alias", [False, True])
@pytest.mark.parametrize(
    ("aliases", "canonical"),
    [
        (("e1h1", "e8a8", "a1b1"), ("e1g1", "e8c8", "a1b1")),
        (("e1a1", "e8h8", "h1g1"), ("e1c1", "e8g8", "h1g1")),
    ],
)
def test_castling_aliases_use_canonical_solution_and_playback(
    settings, black, submit_alias, aliases, canonical
):
    fen = "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1"
    if black:
        fen = chess.Board(fen).mirror().fen()

        def mirror(line):
            return tuple(
                chess.Move(
                    chess.square_mirror(chess.Move.from_uci(uci).from_square),
                    chess.square_mirror(chess.Move.from_uci(uci).to_square),
                ).uci()
                for uci in line
            )

        aliases, canonical = mirror(aliases), mirror(canonical)
    fixture = definition(
        initial_fen=fen, solution=aliases, orientation="black" if black else "white"
    )
    assert fixture.solution == canonical
    app = app_with(settings, fixture)
    with TestClient(app) as client:
        state = start(client)
        with app.state.sessions() as db:
            assert db.get(PuzzleSession, state["id"]).snapshot["solution"] == list(canonical)
        response = move(client, state, aliases[0] if submit_alias else canonical[0])
        assert response.status_code == 200, response.text
        state = response.json()
        assert state["feedback"]["grade"] == "correct" and not state["failed"]
        assert [frame["uci"] for frame in state["playback"]] == list(canonical[:2])
        state = move(client, state, canonical[-1]).json()
        assert state["status"] == "solved" and not state["failed"]
        assert [frame["uci"] for frame in state["completion"]["solution"]] == list(canonical)
        assert client.get("/api/puzzles").json()["stats"]["clean"] == 1


def test_legacy_castling_snapshot_and_invalid_move_commands(settings):
    fixture = definition(initial_fen="4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1", solution=("e1g1",))
    app = app_with(settings, fixture)
    with TestClient(app) as client:
        state = start(client)
        with app.state.sessions() as db:
            session = db.get(PuzzleSession, state["id"])
            session.snapshot = session.snapshot | {"solution": ["e1h1"]}
            db.commit()
        for invalid in ("0000", "e1h1junk", "e1g1q", "e1e3"):
            assert move(client, state, invalid).status_code == 422
        assert client.get(f"/api/puzzle-sessions/{state['id']}").json() == state
        state = move(client, state, "e1g1").json()
        assert state["status"] == "solved" and not state["failed"]
        assert [frame["uci"] for frame in state["completion"]["solution"]] == ["e1g1"]


@pytest.mark.parametrize(
    "changes",
    [
        {"initial_fen": "not a fen"},
        {"initial_fen": "8/8/8/8/8/8/8/8 w - - 0 1"},
        {"orientation": "black"},
        {"solution": []},
        {"solution": ["c3d5", "e7d7"]},
        {"solution": ["c3c8"]},
        {"solution": ["0000"]},
        {
            "initial_fen": "4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1",
            "solution": ["e1g1q"],
        },
        {"source": "games", "solution": ["c3d5"]},
        {"provenance": {"attribution": "unsafe", "url": "javascript:alert(1)"}},
    ],
)
def test_invalid_provider_records_rejected(changes):
    with pytest.raises(ValidationError):
        definition(**changes)


def test_provider_boundary_rejects_duplicates_and_mismatched_source(sessions):
    provider = FixtureProvider((definition(), definition()))
    with pytest.raises(ValueError, match="Duplicate"):
        PuzzleProviders((provider, provider))
    with sessions() as db, pytest.raises(ValueError, match="Inconsistent"):
        list(PuzzleProviders((provider,)).catalog(db))
    with sessions() as db, pytest.raises(ValueError, match="Inconsistent"):
        list(PuzzleProviders((FixtureProvider((definition(source="games"),)),)).catalog(db))


def test_account_isolation_private_history_and_snapshot(settings):
    settings.accounts_enabled = True
    settings.public_origin = "http://testserver"
    settings.session_secure = False
    app = app_with(settings)
    origin = {"Origin": "http://testserver"}
    with TestClient(app) as client:

        def signup(name):
            response = client.post(
                "/api/auth/signup",
                headers=origin,
                json={"username": name, "password": "testing-password"},
            )
            assert response.status_code == 201
            return origin | {"X-CSRF-Token": response.json()["csrf"]}, client.cookies.get(COOKIE)

        alice_headers, alice_cookie = signup("alice")
        cold = start(client, headers=alice_headers)
        bob_headers, _ = signup("bobby")
        bob_id = client.get("/api/auth/me").json()["user"]["id"]
        assert client.get("/api/puzzles").json()["resume"] == []
        assert client.get(f"/api/puzzle-sessions/{cold['id']}").status_code == 404
        assert move(client, cold, LINE[0], headers=bob_headers).status_code == 404
        assert reveal(client, cold, headers=bob_headers).status_code == 404
        with app.state.workspaces.open(bob_id) as workspace, workspace.sessions() as db:
            db.add(
                PuzzleAttempt(
                    session_id=cold["id"],
                    request_id="foreign",
                    request={},
                    step=0,
                    uci=LINE[0],
                    grade="correct",
                    elapsed_ms=1,
                    response={},
                )
            )
            with pytest.raises(ValueError, match="Referenced item"):
                db.flush()
        bob = start(client, headers=bob_headers)
        assert bob["id"] != cold["id"]  # same create token is private to each account
        reveal(client, bob, headers=bob_headers)
        client.cookies.set(COOKIE, alice_cookie)
        assert client.get("/api/puzzles").json()["stats"]["revealed"] == 0
        assert client.get(f"/api/puzzle-sessions/{cold['id']}").json() == cold
