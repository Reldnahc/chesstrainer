"""A club's own course files, kept beside its database so they survive updates.

A club course with the same id as a built-in course replaces it in Study.
Deleting the club file brings the built-in course back. Deleting a built-in
course hides it for this install until an administrator restores it. Members'
progress is never deleted, so a course that comes back keeps it.
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
# Every (course id, revision) ever saved here and its content fingerprint. Progress
# is keyed by revision, so a revision must never be reused for different content,
# even after its file was replaced or deleted. Not *.json, so it is never a course.
LEDGER = "revisions.ledger"
# Built-in course ids an administrator deleted, as a sorted JSON list. The app
# image cannot change, so this file, beside the club's courses, records them.
HIDDEN = "hidden-built-ins.ledger"


class CourseConflict(Exception):
    """A save that would silently replace something; the message says what."""


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
                except Exception as exc:  # One bad file must never take Study down.
                    message = str(exc) if isinstance(exc, CourseFileError) else f"{name}: {exc}"
                    problems.append({"file": name, "message": message})
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
        return [*self._problems, *self.ledger_problems()]

    def ids(self):
        return {course.id for _, course, _ in self.entries()}

    def revision(self, course_id):
        return next(
            (course.revision for _, course, _ in self.entries() if course.id == course_id), None
        )

    def path_for(self, course_id):
        return next((path for path, course, _ in self.entries() if course.id == course_id), None)

    def _read(self, name, kind, empty):
        """A ledger's saved value; only a missing file means empty.

        Any other failure raises, so a ledger that cannot be read is never
        overwritten by a save that started from nothing.
        """
        path = self.folder / name
        try:
            value = json.loads(path.read_text(encoding="utf-8"))
        except FileNotFoundError:
            return empty
        except (OSError, ValueError) as exc:
            raise CourseFileError(f"{name} cannot be read ({exc}); fix or restore it") from exc
        if not isinstance(value, kind):
            raise CourseFileError(f"{name} is not a JSON {kind.__name__}; fix or restore it")
        return value

    def _ledger(self):
        return self._read(LEDGER, dict, {})

    def ledger_problems(self):
        problems = []
        for name, kind, empty in ((LEDGER, dict, {}), (HIDDEN, list, [])):
            try:
                self._read(name, kind, empty)
            except CourseFileError as exc:
                problems.append({"file": name, "message": str(exc)})
        return problems

    def known_fingerprints(self, course_id):
        """Every fingerprint each revision of this id has had: built-in, installed or saved."""
        known = {revision: {value} for revision, value in self._ledger().get(course_id, {}).items()}
        for course in bundled.BundledCourses().courses(None):
            if course.id == course_id:
                known.setdefault(course.revision, set()).add(fingerprint(course))
        for _, course, _ in self.entries():
            if course.id == course_id:
                known.setdefault(course.revision, set()).add(fingerprint(course))
        return known

    def save(self, data, *, base_revision=None, create=False):
        """Write a course file and return ``(course, topic, revision_changed)``.

        A revision already used for different content gets a new revision, because
        members' progress and snapshots are keyed by revision. ``create`` refuses an
        id that is already installed; ``base_revision`` refuses a save over a course
        that changed since the editor opened it.
        """
        if not isinstance(data, dict):
            raise CourseFileError("A course file must be a JSON object")
        course, topic = course_files.load(data)
        if not SAFE_ID.match(course.id):
            raise CourseFileError(
                "The course id may use only lowercase letters, digits and hyphens"
            )
        with self.lock:
            installed = self.revision(course.id) or next(
                (
                    item.revision
                    for item in bundled.BundledCourses().courses(None)
                    if item.id == course.id
                ),
                None,
            )
            if create and installed is not None:
                raise CourseConflict(
                    f"A course with the id {course.id} already exists. Choose another id."
                )
            if base_revision is not None and installed not in (None, base_revision):
                raise CourseConflict(
                    "This course was saved by someone else after you opened it "
                    f"(now revision {installed}). Reload the editor to see their changes."
                )
            known = self.known_fingerprints(course.id)
            changed_revision = False
            if known.get(course.revision, {fingerprint(course)}) != {fingerprint(course)}:
                data = {**data, "revision": next_revision(course.revision, set(known))}
                course, topic = course_files.load(data)
                changed_revision = True
            text = json.dumps(course_files.dump(course, topic), indent=2, ensure_ascii=False)
            self.folder.mkdir(parents=True, exist_ok=True)
            path = self.path_for(course.id) or self.folder / f"{course.id}.json"
            write_atomically(path, text + "\n")
            ledger = self._ledger()
            ledger.setdefault(course.id, {})[course.revision] = fingerprint(course)
            write_atomically(self.folder / LEDGER, json.dumps(ledger, indent=1, sort_keys=True))
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

    def hidden(self, *, strict=False):
        """Built-in course ids deleted for this install.

        Reading Study shows every built-in course when the list cannot be read
        (``problems()`` names it); ``strict`` raises instead, before a change.
        """
        try:
            value = self._read(HIDDEN, list, [])
        except CourseFileError:
            if strict:
                raise
            return set()
        return {item for item in value if isinstance(item, str)}

    def set_hidden(self, course_id, hidden):
        with self.lock:
            ids = self.hidden(strict=True)
            if (course_id in ids) == hidden:
                return False
            ids = ids | {course_id} if hidden else ids - {course_id}
            self.folder.mkdir(parents=True, exist_ok=True)
            write_atomically(self.folder / HIDDEN, json.dumps(sorted(ids), indent=1) + "\n")
            return True


def write_atomically(path, text):
    temporary = path.with_name(path.name + ".saving")
    temporary.write_text(text, encoding="utf-8", newline="\n")
    os.replace(temporary, path)


def next_revision(previous, taken=()):
    """Today's date, numbered when today's revision is already taken."""
    today = date.today().isoformat()
    candidate, number = today, 1
    while candidate == previous or candidate in taken:
        number += 1
        candidate = f"{today}-{number}"
    return candidate


class InstalledCourses:
    """The built-in courses, with any club course of the same id taking its place."""

    def __init__(self, club):
        self.club = club
        self.lock = threading.Lock()
        self._key = None
        self._courses = ()
        # A deleted club course keeps its last topic, so its saved lessons stay in
        # the same Study section while this server runs.
        self._club_topics = {}

    def courses(self, db):
        """Built-in and club courses, rebuilt only when the club folder or hidden list changes."""
        club = self.club.entries()
        hidden = frozenset(self.club.hidden())
        with self.lock:
            if self._key is None or self._key[0] is not club or self._key[1] != hidden:
                replaced = {course.id for _, course, _ in club} | hidden
                self._club_topics |= {course.id: topic for _, course, topic in club}
                self._courses = tuple(
                    bundled.ordered(
                        [
                            *(
                                course
                                for course in bundled.BundledCourses().courses(db)
                                if course.id not in replaced
                            ),
                            *(course for _, course, _ in club),
                        ]
                    )
                )
                self._key = (club, hidden)
            return self._courses

    def topic(self, course_id):
        for _, course, topic in self.club.entries():
            if course.id == course_id:
                return topic
        return self._club_topics.get(course_id) or bundled.BundledCourses().topic(course_id)

    def built_in_ids(self):
        return {course.id for course in bundled.BundledCourses().courses(None)}

    def hidden_built_ins(self):
        """Deleted built-in courses an administrator can restore, in Study order."""
        hidden = self.club.hidden()
        return [
            {"id": course.id, "title": course.title}
            for course in bundled.ordered(bundled.BundledCourses().courses(None))
            if course.id in hidden
        ]

    def source(self, course_id, revision=None):
        """``club`` only for the revision the club file holds; older revisions are not it."""
        installed = self.club.revision(course_id)
        return "club" if installed is not None and revision in (None, installed) else "built_in"
