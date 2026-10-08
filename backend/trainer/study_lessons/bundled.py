"""Reviewed, locally shipped teaching content; never downloaded during study."""

from functools import cache

from trainer.study_lessons.content import CourseDefinition


@cache
def _courses():
    from trainer.study_lessons.courses.italian import course as italian_white
    from trainer.study_lessons.courses.italian_black import course as italian_black
    from trainer.study_lessons.courses.kings_gambit import course as kings_gambit
    from trainer.study_lessons.courses.tactics import course as tactics

    return tuple(
        CourseDefinition.model_validate(record.model_dump())
        for record in (italian_white(), italian_black(), kings_gambit(), tactics())
    )


class BundledCourses:
    def courses(self, db):
        # Return independent objects so a consumer cannot mutate the cached source.
        return tuple(course.model_copy(deep=True) for course in _courses())


def bundled_providers():
    return (BundledCourses(),)
