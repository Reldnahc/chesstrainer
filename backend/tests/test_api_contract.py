"""Verify the local/hosted HTTP schemas and historical response shapes."""

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from trainer.api import create_app


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


def test_evidence_shows_historical_findings_of_any_shape(settings, sessions):
    from lesson_fixtures import seed_lesson
    from sqlalchemy import select
    from trainer.models import ClassificationRun, SkillEvidence

    with sessions() as db:
        seed_lesson(db, settings, count=1, skills=["fork"])
        evidence = db.scalar(select(SkillEvidence))
        run = db.get(ClassificationRun, evidence.classification_run_id)
        # A run saved by an older rule version, with a finding today's model rejects.
        run.response = run.response | {"findings": [{"skill_id": "fork", "legacy": True}]}
        db.commit()
        decision_id = evidence.decision_id
    settings.stockfish_path = "missing-contract-test-engine"
    with TestClient(create_app(settings, workers=False, start_engine=False)) as client:
        response = client.get(f"/api/evidence/{decision_id}")
        assert response.status_code == 200, response.text
        (classification,) = response.json()["classifications"]
        assert classification["findings"] == [{"skill_id": "fork", "legacy": True}]
