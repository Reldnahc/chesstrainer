"""Application retirement policy, separate from FSRS's memory scheduling."""

from datetime import datetime, timedelta

from sqlalchemy import select

from trainer.models import SRSState, now
from trainer.scheduling import utc


def retire_if_ready(state, settings, retired_at=None):
    if state.retired_at is not None or not state.reviews:
        return False
    last_review = state.card.get("last_review")
    if last_review is None:
        return False
    # Compare the scheduled interval, never card age or remaining time until due.
    interval = utc(state.due) - utc(datetime.fromisoformat(last_review))
    if interval <= timedelta(days=settings.retire_after_days):
        return False
    state.retired_at = retired_at or now()
    state.retired_interval_days = interval.total_seconds() / 86400
    return True


def retire_existing(db, settings):
    count = 0
    for state in db.scalars(
        select(SRSState).where(SRSState.retired_at.is_(None), SRSState.reviews > 0)
    ):
        count += retire_if_ready(state, settings)
    db.commit()
    return count


def require_active_review(db, exercise_id, lesson_item_id=None):
    # Explicit study inside a saved lesson remains available; it never schedules FSRS.
    if lesson_item_id is None and db.get(SRSState, exercise_id).retired_at is not None:
        raise ValueError("This position is retired and will no longer appear in reviews.")
