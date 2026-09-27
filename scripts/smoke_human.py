"""Exercise native Stockfish + Maia and restart reuse without network access.

Run in a disposable image with --network none and the verified model mounted
read-only at HUMAN_MODEL_PATH. No production database or accounts are touched.
"""

import json
from pathlib import Path
from tempfile import TemporaryDirectory

from fastapi.testclient import TestClient
from trainer.api import create_app
from trainer.config import Settings
from trainer.human_models.preset import verify_checkpoint, verify_source


def main():
    with TemporaryDirectory(prefix="fieldwork-human-smoke-") as temporary:
        settings = Settings(
            _env_file=None,
            database_path=Path(temporary) / "smoke.sqlite3",
            public_origin="",
            accounts_enabled=False,
            deep_depth=10,
            deep_time=0.1,
        )
        verify_checkpoint(settings.human_model_path)
        verify_source()
        app = create_app(settings, workers=False)
        with TestClient(app) as client:
            assert client.get("/api/human-model").json()["status"] == "unchecked"
            pgn = '[White "Smoke"]\n[Black "Fixture"]\n[WhiteElo "700"]\n[BlackElo "1800"]\n[Site "https://chess.com"]\n[Event "Live Rapid"]\n\n1. f3 e5 2. g4 Qh4# 0-1'
            client.post(
                "/api/imports",
                files={"file": ("smoke.pgn", pgn)},
                data={"side": "white", "analyze": "false"},
            ).raise_for_status()
            game = client.get("/api/games").json()["items"][0]["id"]
            job = client.post(f"/api/games/{game}/review", json={}).json()["job_id"]
            app.state.runner.run_job(job)
            original = client.get(f"/api/games/{game}").json()
            assert original["job"]["status"] == "completed", original["job"]
            for frame in original["frames"][1:]:
                human = frame["report"]["human"]
                assert human["status"] == "available", human
                assert human["played"]["probability"] is not None
                assert human["domain"]["alignment"] == "shifted"
                practical = frame["report"]["practical"]
                assert practical["version"] == "practical-2"
                assert frame["report"]["intelligence"]["version"] == "move-events-1"
                assert practical["played_naturalness"] != "unknown"
                assert practical["confidence"] == "limited"
                assert human["conditioning"]["self_rating"] == (
                    700 if frame["actor"] == "white" else 1800
                )
            assert client.get("/api/human-model").json()["status"] == "ready"
        # Reopening and changing coach use persisted facts with no native startup.
        settings.stockfish_path = "deliberately-unavailable"
        restarted = create_app(settings, workers=False, start_engine=False)
        with TestClient(restarted) as client:
            assert client.post(f"/api/games/{game}/review", json={}).json()["status"] == "completed"
            client.put(
                "/api/preferences/coach", json={"coach_id": "dog-collie", "motion": "still"}
            ).raise_for_status()
            assert client.get(f"/api/games/{game}").json() == original
            assert not restarted.state.human_models.provider._workers
        print(
            json.dumps(
                {
                    "native_review": "passed",
                    "human_policy": "passed",
                    "restart_cache": "passed",
                    "coach_independence": "passed",
                }
            )
        )


if __name__ == "__main__":
    main()
