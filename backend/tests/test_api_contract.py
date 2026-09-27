"""Verify local/hosted HTTP schemas, response validation and application ownership."""

import json
from pathlib import Path

import chess
import pytest
from fastapi.exceptions import ResponseValidationError
from fastapi.testclient import TestClient
from pydantic import SecretStr
from trainer.api import create_app
from trainer.models import AnalysisJob


@pytest.mark.parametrize("hosted", [False, True])
def test_documented_api_contract_matches_checked_in_schema(settings, hosted):
    settings.stockfish_path = "missing-contract-test-engine"
    settings.accounts_enabled = hosted
    settings.public_origin = "https://contract.invalid" if hosted else ""
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
        actual["info"]["title"] = "Fieldwork API"
        if not hosted:
            expected["paths"] = {
                path: value
                for path, value in expected["paths"].items()
                if not path.startswith("/api/auth/") or path == "/api/auth/me"
            }
            expected["components"]["schemas"] = {
                name: expected["components"]["schemas"][name]
                for name in actual["components"]["schemas"]
            }
        assert actual == expected


def test_every_success_response_has_a_concrete_contract(settings):
    settings.accounts_enabled = True
    settings.public_origin = "https://contract.invalid"
    schema = create_app(settings, workers=False, start_engine=False).openapi()
    for path, methods in schema["paths"].items():
        if not path.startswith("/api/"):
            continue
        for method, operation in methods.items():
            for status, response in operation["responses"].items():
                if status.startswith("2"):
                    body = response["content"]["application/json"]["schema"]
                    assert body, (method, path, status)
                    item = body.get("items", body)
                    assert "$ref" in item or item.get("properties"), (method, path, body)


def test_incompatible_response_payload_is_rejected(settings):
    app = create_app(settings, workers=False, start_engine=False)
    with TestClient(app) as client:
        with app.state.sessions() as db:
            db.add(AnalysisJob(kind="training"))
            db.commit()
        app.state.runner.activity = lambda job_id: {
            "games": {"active": "not a count", "pending": 0},
            "classifications": {"active": 0, "pending": 0},
        }
        with pytest.raises(ResponseValidationError) as failure:
            client.get("/api/jobs")
        assert any(
            error["loc"][-3:] == ("activity", "games", "active") for error in failure.value.errors()
        )


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
        TestClient(create_app(second, workers=False, start_engine=False)) as right,
    ):
        left.headers["authorization"] = "Bearer first-token"
        right.headers["authorization"] = "Bearer second-token"
        assert left.get("/api/settings").json()["target_rating"] == 1000
        assert right.get("/api/settings").json()["target_rating"] == 1800
        assert left.get("/api/health").json()["engine_status"] == "unavailable"
        assert right.get("/api/health").json()["engine_status"] == "unchecked"
        assert right.get("/api/health").json()["engine_error"] is None
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
