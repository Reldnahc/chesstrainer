"""The fundamentals course is listed as a skills course, apart from the opening courses."""

from fastapi.testclient import TestClient
from test_italian_course import COURSE_IDS, installed_course, start
from test_opening_journey import response_json
from trainer.api import create_app

COURSE_ID = "chess-fundamentals"


def test_skill_courses_are_listed_apart_from_the_opening_courses(settings):
    # The topic is presentation only, so it never enters the pinned content hashes.
    tactics = installed_course("tactics-foundations")
    with TestClient(create_app(settings, workers=False, start_engine=False)) as client:
        library = response_json(client.get("/api/study/courses"))
        assert {item["id"]: item["topic"] for item in library["courses"]} == {
            **dict.fromkeys(COURSE_IDS, "opening"),
            "tactics-foundations": "skills",
            COURSE_ID: "skills",
        }
        for course_id, topic in ((COURSE_ID, "skills"), (COURSE_IDS[0], "opening")):
            assert response_json(client.get(f"/api/study/courses/{course_id}"))["topic"] == topic
        session = start(client, tactics, tactics.chapters[0])
        assert session["course_topic"] == "skills"
        resume = response_json(client.get("/api/study/courses"))["resume"]
        assert [(row["id"], row["course_topic"]) for row in resume] == [(session["id"], "skills")]
