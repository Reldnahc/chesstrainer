import chess
import pytest
from explanation_fixtures import seed_review
from fastapi.testclient import TestClient
from sqlalchemy import select
from trainer.api import create_app
from trainer.explanations import replay_line
from trainer.models import Attempt, EngineAnalysis, ExerciseAnswer, Review, ReviewSession, SRSState


def move(client, session, uci):
    response = client.post(
        f"/api/review/sessions/{session}/move",
        json={"from_square": uci[:2], "to_square": uci[2:4], "promotion": uci[4:] or None},
    )
    assert response.status_code == 200, response.text
    return response.json()


@pytest.mark.parametrize("black", [False, True])
def test_exact_attempt_line_alternative_and_unchanged_review(settings, black):
    settings.stockfish_path = "missing-test-engine"
    app = create_app(settings, workers=False)
    with TestClient(app) as client:
        with app.state.sessions() as db:
            fixture = seed_review(db, settings, black)
        cold = client.post(f"/api/review/{fixture['exercise_id']}/start").json()
        path = f"/api/review/sessions/{cold['session_id']}/explanation"
        assert client.get(path).status_code == 422
        assert client.get(path + "?solution=true").status_code == 422
        failed = move(client, cold["session_id"], fixture["wrong"])
        assert not failed["completed"]
        assert failed["attempt_frame"]["uci"] == fixture["wrong"]
        assert failed["counter_reply"]["uci"] == fixture["reply"]
        assert failed["counter_reply"]["capture"] == "rook"
        assert failed["counter_reply"]["material_change"] == -5
        assert failed["fen"] == cold["fen"]  # The attempt itself stays on the original board.
        assert "frames" not in failed and "answers" not in failed
        with app.state.sessions() as db:
            state = db.get(SRSState, fixture["exercise_id"])
            saved = state.card, state.due, state.reviews, state.lapses
        explained = client.get(path, params={"attempt_id": failed["attempt_id"]}).json()
        assert explained["move_uci"] == fixture["wrong"]
        assert explained["frames"][2]["uci"] == fixture["reply"]
        assert explained["frames"][2]["capture"] == "rook"
        assert "loses 5 points" in explained["summary"]
        assert ("Black" if black else "White") in explained["summary"]
        assert explained["frames"][-1]["material_change"] == -5
        for frame in explained["frames"]:
            assert chess.Board(frame["fen"]).is_valid()
        with app.state.sessions() as db:
            state = db.get(SRSState, fixture["exercise_id"])
            assert (state.card, state.due, state.reviews, state.lapses) == saved
            assert not db.get(ReviewSession, cold["session_id"]).completed
            assert len(db.scalars(select(Attempt)).all()) == 1
    restarted = create_app(settings, workers=False)
    with TestClient(restarted) as client:
        resumed = client.post(f"/api/review/{fixture['exercise_id']}/start").json()
        assert resumed["last_attempt_id"] == failed["attempt_id"]
        assert client.get(path).json()["move_uci"] == fixture["wrong"]
        solved = move(client, cold["session_id"], fixture["alternative"])
        assert solved["grade"] == "acceptable"
        assert "gains 9 points" in solved["explanation_summary"]
        alternative = client.get(path).json()
        assert alternative["move_uci"] == fixture["alternative"]
        assert alternative["frames"][1]["uci"] != fixture["best"]
        assert solved["submitted_san"] == alternative["move_san"]
        with restarted.state.sessions() as db:
            assert len(db.scalars(select(Review)).all()) == 1
            assert db.scalar(select(Review)).rating == "Again"
            assert db.get(SRSState, fixture["exercise_id"]).card == saved[0]


@pytest.mark.parametrize(
    "fen,line,capture,promotion",
    [
        ("4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1", ["e5d6"], "pawn", None),
        ("4k3/8/8/8/3Pp3/8/8/4K3 b - d3 0 1", ["e4d3"], "pawn", None),
        ("4k3/P7/8/8/8/8/8/4K3 w - - 0 1", ["a7a8n"], None, "knight"),
        ("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1", ["e1g1"], None, None),
    ],
)
def test_special_move_commentary(fen, line, capture, promotion):
    frames = replay_line(chess.Board(fen), line)
    assert frames[-1].capture == capture
    if capture:
        assert frames[-1].material_change == 1
        assert len(frames[-1].highlights) == 3
    if promotion:
        assert "promoting to a knight" in frames[-1].annotation
        assert frames[-1].material_change == 2
    if line == ["e1g1"]:
        assert "castles" in frames[-1].annotation
    with pytest.raises(ValueError):
        replay_line(chess.Board(fen), ["a1a1"])


def test_curated_mismatch_no_solution_spoilers_or_engine_claim(settings):
    settings.stockfish_path = "missing-test-engine"
    with TestClient(create_app(settings, workers=False)) as client:
        exercise = client.post(
            "/api/exercises/manual",
            json={
                "fen": chess.STARTING_FEN,
                "moves": ["e2e4"],
                "explanation": "Play e4 to follow this curated line.",
            },
        ).json()["id"]
        cold = client.post(f"/api/review/{exercise}/start").json()
        move(client, cold["session_id"], "d2d4")
        path = f"/api/review/sessions/{cold['session_id']}/explanation"
        result = client.get(path).json()
        assert result["authority"] == "curated"
        assert "not necessarily bad chess" in " ".join(result["notes"])
        assert "e2e4" not in str(result) and "Play e4" not in str(result)
        client.post(f"/api/review/sessions/{cold['session_id']}/reveal")
        solution = client.get(path, params={"solution": True}).json()
        assert solution["move_uci"] == "e2e4"
        assert "Play e4" in " ".join(solution["notes"])


def test_rejects_other_sessions_and_corrupt_pv(settings):
    settings.stockfish_path = "missing-test-engine"
    app = create_app(settings, workers=False)
    with TestClient(app) as client:
        with app.state.sessions() as db:
            fixture = seed_review(db, settings)
        cold = client.post(f"/api/review/{fixture['exercise_id']}/start").json()
        failed = move(client, cold["session_id"], fixture["wrong"])
        other_id = client.post(
            "/api/exercises/manual", json={"fen": chess.STARTING_FEN, "moves": ["e2e4"]}
        ).json()["id"]
        other = client.post(f"/api/review/{other_id}/start").json()
        assert (
            client.get(
                f"/api/review/sessions/{other['session_id']}/explanation",
                params={"attempt_id": failed["attempt_id"]},
            ).status_code
            == 422
        )
        with app.state.sessions() as db:
            answer = db.get(ExerciseAnswer, (fixture["exercise_id"], fixture["wrong"]))
            analysis = db.get(EngineAnalysis, answer.analysis_id)
            analysis.candidates = [analysis.candidates[0] | {"pv": [fixture["wrong"], "a1a8"]}]
            db.commit()
        assert (
            client.get(f"/api/review/sessions/{cold['session_id']}/explanation").status_code == 422
        )


@pytest.mark.parametrize("black", [False, True])
def test_mate_scores_use_the_learner_perspective(settings, black):
    settings.stockfish_path = "missing-test-engine"
    app = create_app(settings, workers=False)
    with TestClient(app) as client:
        with app.state.sessions() as db:
            fixture = seed_review(db, settings, black)
            answer = db.get(ExerciseAnswer, (fixture["exercise_id"], fixture["wrong"]))
            analysis = db.get(EngineAnalysis, answer.analysis_id)
            analysis.candidates = [
                analysis.candidates[0] | {"score": {"kind": "mate", "value": -2}}
            ]
            db.commit()
        cold = client.post(f"/api/review/{fixture['exercise_id']}/start").json()
        move(client, cold["session_id"], fixture["wrong"])
        result = client.get(f"/api/review/sessions/{cold['session_id']}/explanation").json()
        assert f"forced mate for {'White' if black else 'Black'}" in result["summary"]
    frames = replay_line(chess.Board(), ["f2f3", "e7e5", "g2g4", "d8h4"])
    assert "This is checkmate" in frames[-1].annotation


@pytest.mark.parametrize(
    "fen,uci",
    [
        (chess.STARTING_FEN, "e2e4"),
        ("4k3/8/8/8/3Pp3/8/8/4K3 b - d3 0 1", "e4d3"),
        ("4k3/P7/8/8/8/8/8/4K3 w - - 0 1", "a7a8n"),
        ("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1", "e1g1"),
    ],
)
def test_reveal_applies_answer_without_engine_and_records_once(settings, fen, uci):
    settings.stockfish_path = "missing-test-engine"
    app = create_app(settings, workers=False)
    with TestClient(app) as client:
        exercise = client.post("/api/exercises/manual", json={"fen": fen, "moves": [uci]}).json()[
            "id"
        ]
        cold = client.post(f"/api/review/{exercise}/start").json()
        endpoint = f"/api/review/sessions/{cold['session_id']}/reveal"
        board = chess.Board(fen)
        board.push_uci(uci)
        for _ in range(2):
            result = client.post(endpoint)
            assert result.status_code == 200, result.text
            result = result.json()
            assert result["fen"] == board.fen()
            assert result["reveal_frame"]["fen"] == result["fen"]
            assert result["reveal_frame"]["uci"] == uci
            assert {uci[:2], uci[2:4]} <= set(result["reveal_frame"]["highlights"])
        with app.state.sessions() as db:
            reviews = db.scalars(select(Review)).all()
            assert len(reviews) == 1
            assert reviews[0].rating == "Again" and reviews[0].revealed
            assert db.get(SRSState, exercise).reviews == 1


@pytest.mark.parametrize("black", [False, True])
def test_reveal_after_failed_engine_move_plays_primary_answer(settings, black):
    settings.stockfish_path = "missing-test-engine"
    app = create_app(settings, workers=False)
    with TestClient(app) as client:
        with app.state.sessions() as db:
            fixture = seed_review(db, settings, black)
        cold = client.post(f"/api/review/{fixture['exercise_id']}/start").json()
        move(client, cold["session_id"], fixture["wrong"])
        result = client.post(f"/api/review/sessions/{cold['session_id']}/reveal").json()
        expected = chess.Board(cold["fen"])
        expected.push_uci(fixture["best"])
        assert result["fen"] == expected.fen()
        assert result["reveal_frame"]["uci"] == fixture["best"]
        explanation = client.get(
            f"/api/review/sessions/{cold['session_id']}/explanation?solution=true"
        ).json()
        assert explanation["frames"][1]["fen"] == result["fen"]
        with app.state.sessions() as db:
            assert len(db.scalars(select(Review)).all()) == 1
            assert db.get(SRSState, fixture["exercise_id"]).reviews == 1
