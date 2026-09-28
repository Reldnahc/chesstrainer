"""Account preferences in the existing database, including the reserved local user."""

from typing import get_args

from sqlalchemy import select, update

from trainer.contracts.preferences import CoachId, CoachMotion, CoachPreferences
from trainer.models import UserPreferences


def coach_preferences(db):
    saved = db.scalar(select(UserPreferences))
    if saved is None:
        return CoachPreferences()
    # A removed coach or a database opened by an older release stays usable.
    # Reads never overwrite the user's saved choice with the temporary fallback.
    motion = "natural" if saved.coach_motion == "subtle" else saved.coach_motion
    return CoachPreferences(
        coach_id=saved.coach_id if saved.coach_id in get_args(CoachId) else "classic",
        motion=motion if motion in get_args(CoachMotion) else "system",
    )


def save_coach_preferences(db, value: CoachPreferences):
    # Serialize the first insert as well as later updates across concurrent devices.
    # SQLite's busy timeout handles this short, engine-free transaction.
    owner = db.info["user_id"]
    changed = db.execute(
        update(UserPreferences).values(coach_id=value.coach_id, coach_motion=value.motion)
    ).rowcount
    if not changed:
        db.add(UserPreferences(user_id=owner, coach_id=value.coach_id, coach_motion=value.motion))
    db.commit()
    return value
