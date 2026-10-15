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
def _built_in():
    """``(course, topic)`` for every built-in file in Study order, validated once per process.

    These are the cached originals: read them here, and hand consumers copies.
    """
    loaded = [read_course_file(path) for path in sorted(BUILT_IN.glob("*.json"))]
    courses = {course.id: (course, topic) for course, topic in loaded}
    return tuple(courses[course.id] for course in ordered(course for course, _ in loaded))


def built_in_courses():
    """The cached built-in courses for read-only use inside the course providers."""
    return tuple(course for course, _ in _built_in())


class BundledCourses:
    def courses(self, db):
        # Independent copies, so a consumer cannot change the cached source.
        return tuple(course.model_copy(deep=True) for course in built_in_courses())

    def find(self, db, course_id, revision=None):
        """One course, copied, without copying the rest."""
        return next(
            (
                course.model_copy(deep=True)
                for course in built_in_courses()
                if course.id == course_id and revision in (None, course.revision)
            ),
            None,
        )

    def topic(self, course_id):
        """Each course file names its Study section; presentation only, outside the content hash."""
        return next((topic for course, topic in _built_in() if course.id == course_id), None)

    def source(self, course_id, revision=None):
        return "built_in"
