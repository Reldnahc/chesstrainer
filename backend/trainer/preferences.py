"""Account preferences in the existing database, including the reserved local user."""

from typing import get_args

from sqlalchemy import select, update

from trainer.contracts.preferences import (
    AudioPreferences,
    CoachId,
    CoachMotion,
    CoachPreferences,
    MotionPreference,
    MotionPreferences,
)
from trainer.models import UserPreferences

RETIRED_COACH_REPLACEMENTS: dict[str, CoachId] = {
    "dog-sunny": "dog-puppy",
    "cat-tabby": "cat-kitten",
    "cat-calico": "cat-kitten",
}


def coach_preferences(db):
    saved = db.scalar(select(UserPreferences))
    if saved is None:
        return CoachPreferences()
    # A removed coach or a database opened by an older release stays usable.
    # Reads never overwrite the user's saved choice with the temporary fallback.
    coach_id = RETIRED_COACH_REPLACEMENTS.get(saved.coach_id, saved.coach_id)
    motion = "natural" if saved.coach_motion == "subtle" else saved.coach_motion
    return CoachPreferences(
        coach_id=coach_id if coach_id in get_args(CoachId) else "classic",
        motion=motion if motion in get_args(CoachMotion) else "system",
    )


def save_coach_preferences(db, value: CoachPreferences):
    _save_preferences(db, coach_id=value.coach_id, coach_motion=value.motion)
    return value


def motion_preferences(db):
    saved = db.scalar(select(UserPreferences))
    motion = saved.interface_motion if saved else "system"
    return MotionPreferences(motion=motion if motion in get_args(MotionPreference) else "system")


def save_motion_preferences(db, value: MotionPreferences):
    _save_preferences(db, interface_motion=value.motion)
    return value


def audio_preferences(db):
    saved = db.scalar(select(UserPreferences))
    if saved is None:
        return AudioPreferences()
    return AudioPreferences(
        enabled=saved.audio_enabled,
        volume=saved.audio_volume,
        board=saved.audio_board,
        practice=saved.audio_practice,
        review=saved.audio_review,
    )


def save_audio_preferences(db, value: AudioPreferences):
    _save_preferences(db, **{f"audio_{key}": item for key, item in value.model_dump().items()})
    return value


def _save_preferences(db, **values):
    # Serialize the first insert as well as later updates across concurrent devices.
    # SQLite's busy timeout handles this short, engine-free transaction.
    owner = db.info["user_id"]
    changed = db.execute(update(UserPreferences).values(**values)).rowcount
    if not changed:
        db.add(UserPreferences(user_id=owner, **values))
    db.commit()
