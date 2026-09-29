"""Local authored course providers. Startup and normal reading never acquire content."""

from collections.abc import Iterable
from typing import Protocol

from fastapi import HTTPException
from sqlalchemy.orm import Session

from trainer.study_lessons.content import CourseDefinition


class CourseProvider(Protocol):
    def courses(self, db: Session) -> Iterable[CourseDefinition]: ...


class CourseProviders:
    def __init__(self, providers=()):
        self.providers = tuple(providers)

    def courses(self, db):
        seen = set()
        for provider in self.providers:
            for item in provider.courses(db):
                record = item.model_dump() if isinstance(item, CourseDefinition) else item
                course = CourseDefinition.model_validate(record)
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
            raise HTTPException(404, "Course revision not installed")
        return course
