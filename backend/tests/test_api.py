import chess
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from trainer.api import create_app
from trainer.models import Review


def test_api_cold_review_and_restart(settings):
    settings.stockfish_path = "missing-stockfish-test"
    app = create_app(settings, workers=False)
    with TestClient(app) as client:
        assert not client.get("/api/health").json()["engine_available"]
        assert "STOCKFISH_PATH" in client.get("/api/health").json()["engine_error"]
        public = client.get("/api/settings").json()
        assert "openai_api_key" not in public and "lan_access_token" not in public
        exercise = client.post(
            "/api/exercises/manual", json={"fen": chess.STARTING_FEN, "moves": ["e2e4"]}
        ).json()["id"]
        cold = client.post(f"/api/review/{exercise}/start").json()
        assert "answers" not in cold
        assert len(cold["legal_moves"]) == 20
        assert {move["from_square"] for move in cold["legal_moves"]} <= {
            "a2",
            "b2",
            "c2",
            "d2",
            "e2",
            "f2",
            "g2",
            "h2",
            "b1",
            "g1",
        }
        # All legal destinations are visible, including moves the curated card rejects.
        assert {
            "from_square": "d2",
            "to_square": "d4",
            "promotion": None,
            "capture": False,
        } in cold["legal_moves"]
        url = f"/api/review/sessions/{cold['session_id']}/move"
        assert client.post(url, json={"from_square": "e2", "to_square": "e5"}).status_code == 422
        wrong = client.post(url, json={"from_square": "d2", "to_square": "d4"}).json()
        assert not wrong["completed"] and "answers" not in wrong
        correct = client.post(url, json={"from_square": "e2", "to_square": "e4"}).json()
        assert correct["completed"]
        client.post(url, json={"from_square": "e2", "to_square": "e4"})
        with app.state.sessions() as db:
            assert db.scalar(select(func.count()).select_from(Review)) == 1
    with TestClient(create_app(settings, workers=False)) as client:
        assert client.get("/api/stats").json() == {"exercises": 1, "reviews": 1}


@pytest.mark.parametrize(
    "fen,expected,absent,capture,promotions",
    [
        ("k3r3/8/8/8/8/8/4R3/4K3 w - - 0 1", "e2e8", "e2d2", True, {None}),
        ("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1", "e1g1", "e1e3", False, {None}),
        ("4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1", "e5d6", "e5e7", True, {None}),
        ("4k3/P7/8/8/8/8/8/4K3 w - - 0 1", "a7a8n", "a7b8", False, {"q", "r", "b", "n"}),
        ("4k3/8/8/8/8/8/p7/4K3 b - - 0 1", "a2a1n", "e1e2", False, {"q", "r", "b", "n"}),
    ],
)
def test_cold_legal_moves_preserve_special_rules(
    settings, fen, expected, absent, capture, promotions
):
    settings.stockfish_path = "missing-stockfish-test"
    with TestClient(create_app(settings, workers=False)) as client:
        exercise = client.post(
            "/api/exercises/manual", json={"fen": fen, "moves": [expected]}
        ).json()["id"]
        cold = client.post(f"/api/review/{exercise}/start").json()
        moves = cold["legal_moves"]
        assert not any(m["from_square"] + m["to_square"] == absent for m in moves)
        selected = [m for m in moves if m["from_square"] + m["to_square"] == expected[:4]]
        assert {m["promotion"] for m in selected} == promotions
        assert all(m["capture"] == capture for m in selected)
        assert all(set(m) == {"from_square", "to_square", "promotion", "capture"} for m in moves)
        assert client.get("/api/stats").json()["reviews"] == 0


def test_token_and_origin(settings):
    from pydantic import SecretStr

    settings.stockfish_path = "missing-stockfish-test"
    settings.lan_access_token = SecretStr("test-token")
    with TestClient(create_app(settings, workers=False)) as client:
        assert client.get("/api/settings").status_code == 401
        headers = {"authorization": "Bearer test-token"}
        assert client.get("/api/settings", headers=headers).status_code == 200
        assert (
            client.post(
                "/api/course/rebuild", headers=headers | {"origin": "https://hostile.example"}
            ).status_code
            == 403
        )


def test_local_mode_answers_lan_hosts_only(settings):
    settings.stockfish_path = "missing-stockfish-test"
    settings.allowed_hosts = "Chess.Example.net, nas-two"
    with TestClient(create_app(settings, workers=False)) as client:
        for host in (
            "localhost",
            "127.0.0.1:8000",
            "[::1]:8000",
            "192.168.1.12:8000",
            "nas",
            "nas.local",
            "office.lan",
            "chess.example.net",
        ):
            assert client.get("/api/health", headers={"host": host}).status_code == 200, host
        # A public name re-pointed at this server (DNS rebinding) is refused outright.
        response = client.get("/api/health", headers={"host": "attacker.example"})
        assert response.status_code == 403 and "ALLOWED_HOSTS" in response.json()["detail"]
        rebound = {"host": "attacker.example", "origin": "http://attacker.example"}
        assert client.post("/api/course/rebuild", headers=rebound).status_code == 403
