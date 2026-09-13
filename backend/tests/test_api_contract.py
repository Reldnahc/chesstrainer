"""Protect public HTTP contracts and per-application ownership during router extraction."""

import json
from pathlib import Path

import chess
from fastapi.testclient import TestClient
from pydantic import SecretStr
from trainer.api import create_app


def test_documented_api_contract_matches_pre_refactor_snapshot(settings):
    settings.stockfish_path = "missing-contract-test-engine"
    expected = json.loads(
        (Path(__file__).parent / "fixtures" / "api_contract.json").read_text(encoding="utf-8")
    )
    with TestClient(create_app(settings, workers=False)) as client:
        actual = client.get("/openapi.json").json()
        # Static SPA delivery is conditional on a production build. API paths,
        # validation schemas, methods, operation IDs and response models are not.
        actual["paths"] = {
            path: value for path, value in actual["paths"].items() if path.startswith("/api/")
        }
        assert actual == expected


def test_router_resources_and_access_controls_belong_to_each_app(settings, tmp_path):
    first = settings.model_copy(
        update={
            "database_path": tmp_path / "first.sqlite3",
            "target_rating": 1000,
            "lan_access_token": SecretStr("first-token"),
            "stockfish_path": "missing-first-engine",
        }
    )
    second = settings.model_copy(
        update={
            "database_path": tmp_path / "second.sqlite3",
            "target_rating": 1800,
            "lan_access_token": SecretStr("second-token"),
            "stockfish_path": "missing-second-engine",
        }
    )
    with (
        TestClient(create_app(first, workers=False)) as left,
        TestClient(create_app(second, workers=False)) as right,
    ):
        left.headers["authorization"] = "Bearer first-token"
        right.headers["authorization"] = "Bearer second-token"
        assert left.get("/api/settings").json()["target_rating"] == 1000
        assert right.get("/api/settings").json()["target_rating"] == 1800
        assert "missing-first-engine" in left.get("/api/health").json()["engine_error"]
        assert "missing-second-engine" in right.get("/api/health").json()["engine_error"]
        assert (
            left.get("/api/settings", headers={"authorization": "Bearer second-token"}).status_code
            == 401
        )
        assert (
            left.post(
                "/api/exercises/manual", json={"fen": chess.STARTING_FEN, "moves": ["e2e4"]}
            ).status_code
            == 200
        )
        assert left.get("/api/stats").json() == {"exercises": 1, "reviews": 0}
        assert right.get("/api/stats").json() == {"exercises": 0, "reviews": 0}
