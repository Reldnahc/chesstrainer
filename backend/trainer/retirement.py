"""Application retirement policy, separate from FSRS's memory scheduling."""

from datetime import datetime, timedelta

from sqlalchemy import select

from trainer.models import SRSState, User, now
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


def retire_existing(db, settings, *, enabled_accounts_only=False):
    count = 0
    query = select(SRSState).where(SRSState.retired_at.is_(None), SRSState.reviews > 0)
    if enabled_accounts_only:
        query = query.join(User, User.id == SRSState.user_id).where(User.disabled.is_(False))
    for state in db.scalars(query):
        count += retire_if_ready(state, settings)
    db.commit()
    return count


def require_active_review(db, exercise_id):
    if db.get(SRSState, exercise_id).retired_at is not None:
        raise ValueError("This position is retired and will no longer appear in reviews.")
