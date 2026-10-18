import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from trainer.api import create_app
from trainer.models import UserPreferences

PATH = "/api/preferences/motion"


@pytest.mark.parametrize("motion", ["still"])
def test_motion_restart_and_independent_coach_updates(settings, motion):
    coach = {"coach_id": "cat-black", "motion": "still"}
    with TestClient(create_app(settings, workers=False, start_engine=False)) as client:
        assert client.get(PATH).json() == {"motion": "system"}
        with client.app.state.sessions() as db:
            assert db.scalar(select(UserPreferences)) is None
        assert client.put(PATH, json={"motion": motion}).json() == {"motion": motion}
        assert client.put("/api/preferences/coach", json=coach).json() == coach
        assert client.get(PATH).json() == {"motion": motion}
        for invalid in ({"motion": "subtle"}, {"motion": "flash"}, {"user_id": "other"}):
            assert client.put(PATH, json=invalid).status_code == 422
    with TestClient(create_app(settings, workers=False, start_engine=False)) as client:
        assert client.get(PATH).json() == {"motion": motion}
        assert client.put(PATH, json={"motion": "natural"}).status_code == 200
        assert client.get("/api/preferences/coach").json() == coach
