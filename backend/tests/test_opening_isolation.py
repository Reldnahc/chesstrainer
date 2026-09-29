"""Account authority and simultaneous HTTP commands for opening recall."""

from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from test_accounts import ORIGIN, signup
from test_opening_journey import catalogue_line, response_json
from trainer.accounts import COOKIE
from trainer.api import create_app
from trainer.models import (
    Attempt,
    Exercise,
    OpeningCard,
    OpeningRecallSnapshot,
    OpeningStudy,
    OpeningStudyMove,
    Review,
    ReviewSession,
    SRSState,
    StudyLessonSession,
)

STUDIES = "/api/opening-studies"


def account_app(settings):
    settings.accounts_enabled = True
    settings.public_origin = ORIGIN["Origin"]
    settings.session_secure = False
    settings.stockfish_path = "missing-opening-account-engine"
    return create_app(settings, workers=False, start_engine=False)


def enrollment():
    line = catalogue_line("e2e4")
    return {
        "source": line.source,
        "source_key": line.source_key,
        "source_version": line.source_version,
        "color": "white",
    }


def open_recall(client, headers):
    due = response_json(client.get("/api/review/queue"))
    assert len(due) == 1
    return response_json(client.post(f"/api/review/{due[0]['exercise_id']}/start", headers=headers))


def test_opening_studies_and_recall_are_private_even_for_the_same_catalogue_line(settings):
    app = account_app(settings)
    with TestClient(app) as client:
        assert client.get(STUDIES).status_code == 401
        alice, alice_token = signup(client, "alice")
        alice_headers = ORIGIN | {"X-CSRF-Token": alice["csrf"]}
        alice_study = response_json(client.post(STUDIES, json=enrollment(), headers=alice_headers))
        alice_recall = open_recall(client, alice_headers)
        alice_path = f"/api/review/sessions/{alice_recall['session_id']}"
        alice_saved = response_json(client.get(alice_path))

        bob, _ = signup(client, "bobby")
        bob_headers = ORIGIN | {"X-CSRF-Token": bob["csrf"]}
        assert response_json(client.get(STUDIES))["items"] == []
        assert response_json(client.get("/api/review/queue")) == []
        assert response_json(client.get("/api/review/count")) == {"due": 0}
        for method, path, payload in (
            ("GET", f"{STUDIES}/{alice_study['id']}", None),
            ("DELETE", f"{STUDIES}/{alice_study['id']}", None),
            ("POST", f"{STUDIES}/{alice_study['id']}/restore", None),
            ("POST", f"{STUDIES}/{alice_study['id']}/practice", {"request_id": "guess"}),
        ):
            response = client.request(method, path, json=payload, headers=bob_headers)
            assert response.status_code == 404, response.text
            assert response.json() == {"detail": "Opening study not found"}
        # Review's existing missing-item contract is 422, identical for absent and foreign IDs.
        for method, path, payload in (
            ("GET", alice_path, None),
            ("GET", alice_path + "/explanation", None),
            ("POST", alice_path + "/move", {"from_square": "e2", "to_square": "e4"}),
            ("POST", alice_path + "/reveal", None),
        ):
            response = client.request(method, path, json=payload, headers=bob_headers)
            assert response.status_code == 422, response.text
            assert response.json() == {"detail": "Review session not found"}
        foreign_start = client.post(
            f"/api/review/{alice_recall['exercise_id']}/start", headers=bob_headers
        )
        assert foreign_start.status_code == 422
        assert foreign_start.json() == {"detail": "Exercise not found"}

        bob_study = response_json(client.post(STUDIES, json=enrollment(), headers=bob_headers))
        bob_recall = open_recall(client, bob_headers)
        assert bob_study["id"] != alice_study["id"]
        assert bob_recall["exercise_id"] != alice_recall["exercise_id"]
        assert bob_recall["session_id"] != alice_recall["session_id"]
        identities = []
        for identity, cold in ((alice, alice_recall), (bob, bob_recall)):
            with app.state.workspaces.sessions(identity["user"]["id"])() as db:
                assert db.scalar(select(func.count()).select_from(OpeningStudy)) == 1
                exercise = db.get(Exercise, cold["exercise_id"])
                identities.append(exercise.identity)
                assert exercise.user_id == identity["user"]["id"]
                assert db.get(OpeningRecallSnapshot, cold["session_id"]).user_id == exercise.user_id
        assert identities[0] == identities[1]  # Shared chess identity, private card and schedule.
        response_json(
            client.post(
                f"/api/review/sessions/{bob_recall['session_id']}/reveal", headers=bob_headers
            )
        )
        assert not response_json(
            client.delete(f"{STUDIES}/{bob_study['id']}", headers=bob_headers)
        )["active"]
        client.cookies.set(COOKIE, alice_token)
        assert response_json(client.get(alice_path)) == alice_saved
        assert response_json(client.get(STUDIES))["items"][0]["active"]
        with app.state.workspaces.sessions(alice["user"]["id"])() as db:
            assert db.scalar(select(func.count()).select_from(Review)) == 0
            assert db.get(SRSState, alice_recall["exercise_id"]).reviews == 0


@pytest.mark.parametrize("invalid", ["missing_csrf", "wrong_csrf", "wrong_origin"])
def test_opening_mutations_require_the_accounts_csrf_authority(settings, invalid):
    app = account_app(settings)
    with TestClient(app) as client:
        alice, _ = signup(client, "alice")
        headers = ORIGIN | {"X-CSRF-Token": alice["csrf"]}
        study = response_json(client.post(STUDIES, json=enrollment(), headers=headers))
        cold = open_recall(client, headers)
        path = f"/api/review/sessions/{cold['session_id']}"
        saved = response_json(client.get(path))
        rejected_headers = dict(headers)
        if invalid == "missing_csrf":
            rejected_headers.pop("X-CSRF-Token")
        elif invalid == "wrong_csrf":
            rejected_headers["X-CSRF-Token"] = "another-session-token"
        else:
            rejected_headers["Origin"] = "https://other.example.test"
        for method, url, payload in (
            ("POST", STUDIES, enrollment()),
            ("DELETE", f"{STUDIES}/{study['id']}", None),
            ("POST", f"{STUDIES}/{study['id']}/restore", None),
            ("POST", f"{STUDIES}/{study['id']}/practice", {"request_id": "csrf"}),
            ("POST", f"/api/review/{cold['exercise_id']}/start", None),
            ("POST", path + "/move", {"from_square": "e2", "to_square": "e4"}),
            ("POST", path + "/reveal", None),
        ):
            response = client.request(method, url, json=payload, headers=rejected_headers)
            assert response.status_code == 403, response.text
        assert response_json(client.get(path)) == saved
        assert response_json(client.get(STUDIES))["items"][0]["active"]
        with app.state.workspaces.sessions(alice["user"]["id"])() as db:
            for model in (Attempt, Review, StudyLessonSession):
                assert db.scalar(select(func.count()).select_from(model)) == 0
            assert db.scalar(select(func.count()).select_from(OpeningStudy)) == 1


def concurrent_pair(action):
    ready = Barrier(2)

    def perform(_):
        ready.wait(timeout=10)
        return action()

    with ThreadPoolExecutor(max_workers=2) as executor:
        return [response_json(response) for response in executor.map(perform, range(2))]


def test_concurrent_enrollment_start_and_success_commit_each_owned_unit_once(settings):
    app = account_app(settings)
    with TestClient(app) as client:
        alice, _ = signup(client, "alice")
        headers = ORIGIN | {"X-CSRF-Token": alice["csrf"]}
        enrolled = concurrent_pair(lambda: client.post(STUDIES, json=enrollment(), headers=headers))
        assert enrolled[0] == enrolled[1]
        exercise = response_json(client.get("/api/review/queue"))[0]["exercise_id"]
        started = concurrent_pair(
            lambda: client.post(f"/api/review/{exercise}/start", headers=headers)
        )
        assert started[0]["session_id"] == started[1]["session_id"]
        session = started[0]["session_id"]
        completed = concurrent_pair(
            lambda: client.post(
                f"/api/review/sessions/{session}/move",
                json={"from_square": "e2", "to_square": "e4"},
                headers=headers,
            )
        )
        assert all(result["completed"] for result in completed)
        assert {result["grade"] for result in completed} == {"correct", "already_recorded"}
        assert completed[0]["fen"] == completed[1]["fen"]
        with app.state.workspaces.sessions(alice["user"]["id"])() as db:
            for model in (
                OpeningStudy,
                OpeningStudyMove,
                OpeningCard,
                Exercise,
                SRSState,
                ReviewSession,
                OpeningRecallSnapshot,
                Review,
                Attempt,
            ):
                assert db.scalar(select(func.count()).select_from(model)) == 1, model.__name__
            state = db.get(SRSState, exercise)
            assert state.reviews == 1 and state.lapses == 0
        assert response_json(client.get("/api/review/count")) == {"due": 0}
