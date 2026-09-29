"""Reviewed, locally shipped teaching content; never downloaded during study."""

from functools import cache

from trainer.study_lessons.content import CourseDefinition


@cache
def _italian():
    from trainer.study_lessons.courses.italian import course

    record = course()
    return CourseDefinition.model_validate(
        record.model_dump() if isinstance(record, CourseDefinition) else record
    )


class BundledCourses:
    def courses(self, db):
        # Return independent objects so a consumer cannot mutate the cached source.
        return (_italian().model_copy(deep=True),)


def bundled_providers():
    return (BundledCourses(),)
