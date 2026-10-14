"""Local authored course providers. Startup and normal reading never acquire content."""

from collections.abc import Iterable
from typing import Protocol

from sqlalchemy.orm import Session

from trainer.errors import NotFound
from trainer.study_lessons.content import CourseDefinition


class CourseProvider(Protocol):
    def courses(self, db: Session) -> Iterable[CourseDefinition]: ...


class CourseProviders:
    """Every installed course, plus the Study topic and source each provider knows for it."""

    def __init__(self, providers=()):
        self.providers = tuple(providers)

    def courses(self, db):
        seen = set()
        for provider in self.providers:
            for item in provider.courses(db):
                # A built definition already replayed its lines; only raw records need it.
                course = (
                    item
                    if isinstance(item, CourseDefinition)
                    else CourseDefinition.model_validate(item)
                )
                identity = (course.id, course.revision)
                if identity in seen:
                    raise ValueError("Duplicate course revision")
                seen.add(identity)
                yield course

    def get(self, db, course_id, revision=None):
        course = next(
            (
                item
                for item in self.courses(db)
                if item.id == course_id and (revision is None or item.revision == revision)
            ),
            None,
        )
        if course is None:
            raise NotFound("Course revision not installed")
        return course

    def topic(self, course_id):
        """The Study section a course belongs to; ``opening`` unless its provider says."""
        for provider in self.providers:
            topic = getattr(provider, "topic", lambda _: None)(course_id)
            if topic:
                return topic
        return "opening"

    def source(self, course_id, revision=None):
        """``club`` for a revision a club file holds, otherwise ``built_in``."""
        for provider in self.providers:
            if hasattr(provider, "source"):
                return provider.source(course_id, revision)
        return "built_in"
