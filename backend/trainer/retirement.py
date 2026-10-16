"""Application retirement policy, separate from FSRS's memory scheduling."""

from datetime import timedelta

from sqlalchemy import select

from trainer.analysis import card_is_backed
from trainer.errors import InvalidInput
from trainer.models import Exercise, OpeningCard, SRSState, User, now
from trainer.scheduling import last_reviewed


def retire_if_ready(state, settings, retired_at=None):
    if state.retired_at is not None or not state.reviews:
        return False
    last_review = last_reviewed(state.card)
    if last_review is None:
        return False
    # Compare the scheduled interval, never card age or remaining time until due.
    interval = state.due - last_review
    if interval <= timedelta(days=settings.retire_after_days):
        return False
    state.retired_at = retired_at or now()
    state.retired_interval_days = interval.total_seconds() / 86400
    return True


def retire_existing(db, settings, *, enabled_accounts_only=False):
    count = 0
    # Opening cards under a retirement guard keep their schedule.
    query = (
        select(SRSState)
        .outerjoin(OpeningCard, OpeningCard.exercise_id == SRSState.exercise_id)
        .where(
            SRSState.retired_at.is_(None),
            SRSState.reviews > 0,
            OpeningCard.retirement_guard_revision.is_(None),
        )
    )
    if enabled_accounts_only:
        query = query.join(User, User.id == SRSState.user_id).where(User.disabled.is_(False))
    for state in db.scalars(query):
        count += retire_if_ready(state, settings)
    db.flush()
    return count


def require_active_review(db, exercise_id):
    state = db.get(SRSState, exercise_id)
    if state.retired_at is not None:
        raise InvalidInput("This position is retired and will no longer appear in reviews.")
    exercise = db.get(Exercise, exercise_id)
    # A game card set aside because its game's review no longer backs it is refused.
    if exercise.source == "game" and not state.eligible and not _backed(db, exercise):
        raise InvalidInput(
            "This position no longer matches its game's review, so it has left the queue."
        )
    if exercise.source == "opening":
        card = db.get(OpeningCard, exercise_id)
        if card is None or not card.active or not state.eligible:
            raise InvalidInput(
                "This opening study is inactive. Restore a contributing study to review it."
            )


def _backed(db, exercise):
    return exercise.decision_id is None or card_is_backed(db, exercise)
