"""Reviewed, locally shipped teaching content; never downloaded during study."""

from functools import cache

from trainer.study_lessons.content import CourseDefinition

# Study lists these under Skills. Every other course, including installed
# providers and test fixtures, is an opening course. The topic is presentation
# only and stays outside course content, so it never changes a content hash.
SKILL_COURSES = frozenset({"tactics-foundations", "chess-fundamentals"})


def course_topic(course_id):
    return "skills" if course_id in SKILL_COURSES else "opening"


@cache
def _courses():
    from trainer.study_lessons.courses.fundamentals import course as fundamentals
    from trainer.study_lessons.courses.italian import course as italian_white
    from trainer.study_lessons.courses.italian_black import course as italian_black
    from trainer.study_lessons.courses.kings_gambit import course as kings_gambit
    from trainer.study_lessons.courses.tactics import course as tactics

    return tuple(
        CourseDefinition.model_validate(record.model_dump())
        for record in (
            italian_white(),
            italian_black(),
            kings_gambit(),
            fundamentals(),
            tactics(),
        )
    )


class BundledCourses:
    def courses(self, db):
        # Return independent objects so a consumer cannot mutate the cached source.
        return tuple(course.model_copy(deep=True) for course in _courses())


def bundled_providers():
    return (BundledCourses(),)
