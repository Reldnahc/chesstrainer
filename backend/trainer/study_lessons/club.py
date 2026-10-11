"""A club's own course files, kept beside its database so they survive updates.

A club course with the same id as a built-in course replaces it in Study.
Deleting the club file brings the built-in course back. Members who started an
earlier revision keep their own snapshot either way.
"""

import json
import os
import re
import threading
from datetime import date
from pathlib import Path

from trainer.study_lessons import bundled, course_files
from trainer.study_lessons.course_files import CourseFileError
from trainer.study_lessons.queries import fingerprint

SAFE_ID = re.compile(r"^[a-z0-9][a-z0-9-]{0,99}$")


def courses_folder(settings):
    configured = getattr(settings, "courses_path", None)
    return Path(configured) if configured else Path(settings.database_path).parent / "courses"


class ClubCourses:
    """Reads ``*.json`` course files from one folder, rereading only when it changes."""

    def __init__(self, folder):
        self.folder = Path(folder)
        self.lock = threading.RLock()
        self._stamp = None
        self._entries = ()
        self._problems = ()

    def _scan(self):
        if not self.folder.is_dir():
            return ()
        return tuple(
            (path.name, path.stat().st_mtime_ns, path.stat().st_size)
            for path in sorted(self.folder.glob("*.json"))
        )

    def refresh(self):
        with self.lock:
            stamp = self._scan()
            if stamp == self._stamp:
                return
            entries, problems, seen = [], [], {}
            for name, *_ in stamp:
                path = self.folder / name
                try:
                    course, topic = bundled.read_course_file(path)
                except CourseFileError as exc:
                    problems.append({"file": name, "message": str(exc)})
                    continue
                if course.id in seen:
                    problems.append(
                        {
                            "file": name,
                            "message": f"{name}: {seen[course.id]} already uses id {course.id}",
                        }
                    )
                    continue
                seen[course.id] = name
                entries.append((path, course, topic))
            self._stamp, self._entries, self._problems = stamp, tuple(entries), tuple(problems)

    def entries(self):
        self.refresh()
        return self._entries

    def problems(self):
        self.refresh()
        return list(self._problems)

    def ids(self):
        return {course.id for _, course, _ in self.entries()}

    def path_for(self, course_id):
        return next((path for path, course, _ in self.entries() if course.id == course_id), None)

    def save(self, data, installed):
        """Write a course file. ``installed`` maps id to the course Study offers now.

        A changed course that keeps an installed revision gets a new revision, because
        members' progress and snapshots are keyed by revision.
        """
        if not isinstance(data, dict):
            raise CourseFileError("A course file must be a JSON object")
        course, topic = course_files.load(data)
        if not SAFE_ID.match(course.id):
            raise CourseFileError(
                "The course id may use only lowercase letters, digits and hyphens"
            )
        with self.lock:
            current = installed.get(course.id)
            changed_revision = False
            if (
                current is not None
                and current.revision == course.revision
                and fingerprint(current) != fingerprint(course)
            ):
                data = {**data, "revision": next_revision(course.revision)}
                course, topic = course_files.load(data)
                changed_revision = True
            text = json.dumps(course_files.dump(course, topic), indent=2, ensure_ascii=False)
            self.folder.mkdir(parents=True, exist_ok=True)
            path = self.path_for(course.id) or self.folder / f"{course.id}.json"
            temporary = path.with_suffix(".json.saving")
            temporary.write_text(text + "\n", encoding="utf-8", newline="\n")
            os.replace(temporary, path)
            self._stamp = None
        return course, topic, changed_revision

    def delete(self, course_id):
        with self.lock:
            path = self.path_for(course_id)
            if path is None:
                return False
            path.unlink()
            self._stamp = None
            return True


def next_revision(previous):
    today = date.today().isoformat()
    if previous != today and not previous.startswith(today + "-"):
        return today
    suffix = previous.removeprefix(today).removeprefix("-")
    return f"{today}-{int(suffix) + 1 if suffix.isdigit() else 2}"


class InstalledCourses:
    """The built-in courses, with any club course of the same id taking its place."""

    def __init__(self, club):
        self.club = club

    def courses(self, db):
        club = self.club.entries()
        replaced = {course.id for _, course, _ in club}
        bundled.restore_built_in_topics()
        for _, course, topic in club:
            bundled.remember_topic(course.id, topic)
        return tuple(
            bundled.ordered(
                [
                    *(
                        course
                        for course in bundled.BundledCourses().courses(db)
                        if course.id not in replaced
                    ),
                    *(course.model_copy(deep=True) for _, course, _ in club),
                ]
            )
        )

    def source(self, course_id):
        return "club" if course_id in self.club.ids() else "built_in"
