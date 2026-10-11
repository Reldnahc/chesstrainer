"""Club course files: anyone exports, administrators import, edit and delete."""

import json

from fastapi.testclient import TestClient
from test_course_files import sample
from trainer.accounts import Accounts
from trainer.api import create_app

LIBRARY = "/api/study/courses"
FILES = "/api/study/course-files"


def app_client(settings):
    return TestClient(create_app(settings, workers=False, start_engine=False))


def save(client, data, headers=None):
    return client.post(FILES, content=json.dumps(data), headers=headers or {})


def listed(client):
    return {course["id"]: course for course in client.get(LIBRARY).json()["courses"]}


def test_local_install_imports_exports_replaces_and_deletes(settings):
    with app_client(settings) as client:
        library = client.get(LIBRARY).json()
        assert library["can_manage"] and library["problems"] == []
        assert listed(client)["vienna-gambit"]["source"] == "built_in"

        saved = save(client, sample()).json()
        assert saved == {
            "id": "sample",
            "revision": "1",
            "title": "Sample",
            "revision_changed": False,
        }
        assert (settings.database_path.parent / "courses" / "sample.json").is_file()
        assert listed(client)["sample"]["source"] == "club"

        exported = client.get(f"{LIBRARY}/sample/file")
        assert exported.headers["content-disposition"] == 'attachment; filename="sample.json"'
        assert exported.json()["chapters"][0]["steps"][1]["move"] == "e4"

        # Changing an installed revision's content gives it a new revision.
        changed = sample()
        changed["chapters"][0]["steps"][0]["text"] = "Changed."
        resaved = save(client, changed).json()
        assert resaved["revision_changed"] and resaved["revision"] != "1"
        assert listed(client)["sample"]["revision"] == resaved["revision"]
        # Saving identical content keeps the revision.
        assert not save(client, client.get(f"{LIBRARY}/sample/file").json()).json()[
            "revision_changed"
        ]

        # A club course with a built-in id replaces it until it is deleted.
        vienna = client.get(f"{LIBRARY}/vienna-gambit/file").json()
        vienna["title"] = "Our Vienna"
        replaced = save(client, vienna).json()
        assert replaced["revision_changed"]
        courses = listed(client)
        assert courses["vienna-gambit"]["title"] == "Our Vienna"
        assert courses["vienna-gambit"]["source"] == "club"
        assert client.delete(f"{FILES}/vienna-gambit").status_code == 204
        assert listed(client)["vienna-gambit"]["title"].startswith("Vienna Gambit")
        assert client.delete(f"{FILES}/vienna-gambit").status_code == 404


def test_bad_files_are_refused_or_reported(settings):
    with app_client(settings) as client:
        broken = sample()
        broken["chapters"][0]["steps"][1]["move"] = "e5"
        response = save(client, broken)
        assert response.status_code == 422
        assert "e5 is not a legal move" in response.json()["detail"]
        assert save(client, sample(id="../escape")).status_code == 422
        assert client.post(FILES, content=b"{not json").status_code == 422

        folder = settings.database_path.parent / "courses"
        folder.mkdir(exist_ok=True)
        (folder / "dropped.json").write_text(json.dumps(broken), encoding="utf-8")
        library = client.get(LIBRARY).json()
        assert [problem["file"] for problem in library["problems"]] == ["dropped.json"]
        assert "sample" not in listed(client)


def test_only_administrators_change_courses(settings):
    settings.public_origin = "http://testserver"
    settings.accounts_enabled = True
    settings.session_secure = False
    origin = {"Origin": settings.public_origin}
    with app_client(settings) as client:
        Accounts(settings.database_path).create("admin", "testing-password", admin=True)
        member = client.post(
            "/api/auth/signup",
            json={"username": "member", "password": "testing-password"},
            headers=origin,
        ).json()
        headers = origin | {"X-CSRF-Token": member["csrf"]}
        library = client.get(LIBRARY).json()
        assert not library["can_manage"]
        assert client.get(f"{LIBRARY}/vienna-gambit/file").status_code == 200
        assert save(client, sample(), headers).status_code == 403
        assert client.delete(f"{FILES}/sample", headers=headers).status_code == 403

        admin = client.post(
            "/api/auth/login",
            json={"username": "admin", "password": "testing-password"},
            headers=origin,
        ).json()
        headers = origin | {"X-CSRF-Token": admin["csrf"]}
        assert client.get(LIBRARY).json()["can_manage"]
        assert save(client, sample(), headers).status_code == 200
        assert client.delete(f"{FILES}/sample", headers=headers).status_code == 204
