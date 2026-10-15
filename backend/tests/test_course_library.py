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
        assert client.delete(f"{FILES}/vienna-gambit").json()["built_in_restored"]
        assert listed(client)["vienna-gambit"]["title"].startswith("Vienna Gambit")
        assert client.delete(f"{FILES}/sample").json() == {
            "id": "sample",
            "built_in_restored": False,
            "hidden": False,
        }
        assert client.delete(f"{FILES}/sample").status_code == 404


def test_deleting_a_built_in_course_hides_it_until_restored(settings):
    with app_client(settings) as client:
        view = client.get(f"{LIBRARY}/vienna-gambit").json()
        started = client.post(
            "/api/study/lesson-sessions",
            json={
                "course_id": "vienna-gambit",
                "course_revision": view["revision"],
                "chapter_id": view["chapters"][0]["id"],
                "request_id": "start-1",
            },
        )
        assert started.status_code == 200
        assert [row["course_id"] for row in client.get(LIBRARY).json()["resume"]] == [
            "vienna-gambit"
        ]

        assert client.delete(f"{FILES}/vienna-gambit").json() == {
            "id": "vienna-gambit",
            "built_in_restored": False,
            "hidden": True,
        }
        hidden = settings.database_path.parent / "courses" / "hidden-built-ins.ledger"
        assert json.loads(hidden.read_text(encoding="utf-8")) == ["vienna-gambit"]
        library = client.get(LIBRARY).json()
        assert "vienna-gambit" not in listed(client)
        # The learner's session is kept but leaves Lessons with its course.
        assert library["resume"] == []
        assert library["hidden_built_ins"] == [{"id": "vienna-gambit", "title": view["title"]}]
        assert client.delete(f"{FILES}/vienna-gambit").status_code == 404

        # A club course with the hidden id still shows; deleting it keeps the built-in hidden.
        vienna = client.get(f"{LIBRARY}/vienna-gambit/file").json()
        vienna["title"] = "Our Vienna"
        assert save(client, vienna).status_code == 200
        assert listed(client)["vienna-gambit"]["title"] == "Our Vienna"
        assert not client.delete(f"{FILES}/vienna-gambit").json()["built_in_restored"]
        assert "vienna-gambit" not in listed(client)

        restored = client.post(f"{FILES}/vienna-gambit/restore")
        assert restored.json() == {"id": "vienna-gambit", "title": view["title"]}
        library = client.get(LIBRARY).json()
        assert listed(client)["vienna-gambit"]["source"] == "built_in"
        assert library["hidden_built_ins"] == []
        assert [row["course_id"] for row in library["resume"]] == ["vienna-gambit"]
        assert client.post(f"{FILES}/vienna-gambit/restore").status_code == 404
        assert client.delete(f"{FILES}/no-such-course").status_code == 404


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
        assert client.delete(f"{FILES}/vienna-gambit", headers=headers).status_code == 403
        assert client.post(f"{FILES}/vienna-gambit/restore", headers=headers).status_code == 403
        assert "hidden_built_ins" not in library or library["hidden_built_ins"] == []

        admin = client.post(
            "/api/auth/login",
            json={"username": "admin", "password": "testing-password"},
            headers=origin,
        ).json()
        headers = origin | {"X-CSRF-Token": admin["csrf"]}
        assert client.get(LIBRARY).json()["can_manage"]
        assert save(client, sample(), headers).status_code == 200
        assert client.delete(f"{FILES}/sample", headers=headers).status_code == 200


def test_editor_check_reports_boards_and_the_first_problem(settings):
    with app_client(settings) as client:
        good = client.post(f"{FILES}/check", content=json.dumps(sample())).json()
        assert good["error"] is None
        push = good["steps"]["start/push"]
        assert push["position"] == "" and push["end_fen"].startswith("rnbqkbnr/pppp1ppp/8/4p3/4P3")
        assert good["steps"]["start/watch"]["position"] == "e4 e5"

        broken = sample()
        broken["chapters"][0]["steps"][2]["next"] = "missing"
        result = client.post(f"{FILES}/check", content=json.dumps(broken)).json()
        assert "missing" in result["error"] and "start/watch" in result["steps"]


def test_editor_position_records_moves_with_server_legality(settings):
    with app_client(settings) as client:
        after = client.post(
            f"{FILES}/position",
            json={"moves": "e4 e5", "move": {"from_square": "g1", "to_square": "f3"}},
        ).json()
        assert after["moves"] == "e4 e5 Nf3" and after["san"] == "Nf3"
        assert after["turn"] == "black" and after["legal_moves"]
        illegal = client.post(
            f"{FILES}/position", json={"move": {"from_square": "e2", "to_square": "e5"}}
        )
        assert illegal.status_code == 422


def test_editor_check_keeps_boards_while_a_step_is_unfinished(settings):
    unfinished = sample()
    unfinished["chapters"][0]["steps"][1]["move"] = ""
    with app_client(settings) as client:
        result = client.post(f"{FILES}/check", content=json.dumps(unfinished)).json()
        assert result["error"] == "Chapter start, step push needs the learner's move"
        assert result["steps"]["start/watch"]["position"] == ""
        assert save(client, unfinished).status_code == 422


def test_a_revision_is_never_reused_for_different_content(settings):
    with app_client(settings) as client:
        exported = client.get(f"{LIBRARY}/italian-foundations/file").json()
        first = {**exported, "title": "First club version"}
        assert save(client, first).json()["revision_changed"]
        # The same stale export again, changed differently: still a new revision.
        second = {**exported, "title": "Second club version"}
        saved = save(client, second).json()
        assert saved["revision_changed"] and saved["revision"] != exported["revision"]
        assert client.delete(f"{FILES}/italian-foundations").status_code == 200
        # Even after the club file is deleted, its revisions stay taken.
        third = client.get(f"{LIBRARY}/italian-foundations/file").json()
        third = {**third, "revision": saved["revision"], "title": "Third"}
        assert save(client, third).json()["revision"] != saved["revision"]


def test_editor_saves_refuse_to_replace_courses_by_accident(settings):
    with app_client(settings) as client:
        conflict = client.post(
            f"{FILES}?create=true", content=json.dumps(sample(id="vienna-gambit"))
        )
        assert conflict.status_code == 409 and "already exists" in conflict.json()["detail"]
        assert client.post(f"{FILES}?create=true", content=json.dumps(sample())).status_code == 200
        changed = sample()
        changed["title"] = "Changed elsewhere"
        assert save(client, changed).status_code == 200
        stale = client.post(f"{FILES}?base_revision=1", content=json.dumps(sample()))
        assert stale.status_code == 409 and "after you opened it" in stale.json()["detail"]


def test_a_broken_club_file_never_takes_study_down(settings):
    folder = settings.database_path.parent / "courses"
    folder.mkdir(parents=True)
    broken = sample(id="broken")
    broken["chapters"][0]["steps"][0]["fen"] = "rnbqkbnr/pppp"
    (folder / "broken.json").write_text(json.dumps(broken), encoding="utf-8")
    with app_client(settings) as client:
        library = client.get(LIBRARY).json()
        assert "vienna-gambit" in {course["id"] for course in library["courses"]}
        assert "cannot be read" in library["problems"][0]["message"]
        check = client.post(f"{FILES}/check", content=json.dumps(broken)).json()
        assert "cannot be read" in check["error"]


def test_empty_eco_round_trips_and_steps_report_their_starting_fen(settings):
    data = sample()
    data["lines"][0]["eco"] = ""
    example = sample()
    fen = "8/8/8/4k3/8/8/4P3/4K3 w - - 0 1"
    example["chapters"][0]["steps"] = [
        {"id": "intro", "title": "Intro", "fen": fen, "position": "", "show": "e4"}
    ]
    with app_client(settings) as client:
        assert save(client, data).status_code == 200
        check = client.post(f"{FILES}/check", content=json.dumps(example)).json()
        assert check["error"] is None
        assert check["steps"]["start/intro"]["initial_fen"] == fen
        assert check["steps"]["start/intro"]["end_position"] == "e4"


def test_an_unreadable_revision_ledger_is_reported_and_never_overwritten(settings):
    folder = settings.database_path.parent / "courses"
    with app_client(settings) as client:
        assert save(client, sample()).status_code == 200
        ledger = folder / "revisions.ledger"
        ledger.write_text("{not json", encoding="utf-8")
        library = client.get(LIBRARY).json()
        assert any(problem["file"] == "revisions.ledger" for problem in library["problems"])
        changed = sample()
        changed["title"] = "Changed"
        refused = save(client, changed)
        assert refused.status_code == 422 and "revisions.ledger" in refused.json()["detail"]
        assert ledger.read_text(encoding="utf-8") == "{not json"


def test_an_unreadable_hidden_list_refuses_deletes_without_a_server_error(settings):
    folder = settings.database_path.parent / "courses"
    with app_client(settings) as client:
        folder.mkdir(parents=True, exist_ok=True)
        hidden = folder / "hidden-built-ins.ledger"
        hidden.write_text("{not json", encoding="utf-8")
        refused = client.delete(f"{FILES}/vienna-gambit")
        assert refused.status_code == 422 and "hidden-built-ins.ledger" in refused.json()["detail"]
        assert hidden.read_text(encoding="utf-8") == "{not json"


def test_a_club_course_keeps_its_topic_after_a_restart_before_any_listing(settings):
    with app_client(settings) as client:
        assert save(client, {**sample(), "topic": "skills"}).status_code == 200
        started = client.post(
            "/api/study/lesson-sessions",
            json={
                "request_id": "topic",
                "course_id": "sample",
                "course_revision": "1",
                "chapter_id": sample()["chapters"][0]["id"],
            },
        ).json()
    # A restarted server answers the session before anything lists the courses.
    with app_client(settings) as client:
        session = client.get(f"/api/study/lesson-sessions/{started['id']}").json()
        assert session["course_topic"] == "skills"


def test_lesson_fingerprint_encoding_is_pinned():
    # Saved with lesson progress: changing the JSON encoding would orphan it.
    from trainer.study_lessons.queries import fingerprint

    class Course:
        def model_dump(self, mode):
            return {"id": "course", "chapters": [{"id": "one", "steps": [1, 2]}]}

    assert fingerprint(Course()) == (
        "6876bd65eb65d4ba9e9f4ab39d95ecaf5c226b8cd765cb533b9bbba4f10706c7"
    )
