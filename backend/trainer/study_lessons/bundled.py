"""Reviewed, locally shipped teaching content; never downloaded during study."""

import json
from functools import cache
from pathlib import Path

from trainer.study_lessons import course_files

BUILT_IN = Path(__file__).parent / "courses"
# Study lists the built-in courses in this order; any others follow by title.
ORDER = (
    "italian-foundations",
    "italian-black-foundations",
    "kings-gambit-foundations",
    "sicilian-dragon",
    "vienna-gambit",
    "chess-fundamentals",
    "tactics-foundations",
)

# Each course file names its Study section. The topic is presentation only and
# stays outside course content, so it never changes a content hash.
_topics = {}


def course_topic(course_id):
    _courses()
    return _topics.get(course_id, "opening")


def remember_topic(course_id, topic):
    _topics[course_id] = topic


def read_course_file(path):
    """``(course, topic)`` for one JSON course file; problems name the file."""
    try:
        data = json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise course_files.CourseFileError(f"{Path(path).name}: {exc}") from exc
    try:
        return course_files.load(data)
    except course_files.CourseFileError as exc:
        raise course_files.CourseFileError(f"{Path(path).name}: {exc}") from exc


def ordered(courses):
    rank = {course_id: index for index, course_id in enumerate(ORDER)}
    return sorted(courses, key=lambda course: (rank.get(course.id, len(rank)), course.title))


@cache
def _courses():
    loaded = []
    for path in sorted(BUILT_IN.glob("*.json")):
        course, topic = read_course_file(path)
        remember_topic(course.id, topic)
        loaded.append(course)
    return tuple(ordered(loaded))


class BundledCourses:
    def courses(self, db):
        # Return independent objects so a consumer cannot mutate the cached source.
        return tuple(course.model_copy(deep=True) for course in _courses())


def bundled_providers():
    return (BundledCourses(),)
