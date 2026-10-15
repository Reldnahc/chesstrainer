from datetime import datetime
from importlib.metadata import version

from fsrs import Card, Rating, Scheduler, State

# Everything the app reads from a saved FSRS card goes through these, so the
# py-fsrs serialization stays inside this module.


def card_phase(card: dict) -> str:
    """ "learning", "review" or "relearning", from py-fsrs's own State."""
    return State(card["state"]).name.lower()


def last_reviewed(card: dict) -> datetime | None:
    value = card.get("last_review")
    return None if value is None else datetime.fromisoformat(value)


def is_lapse(rating) -> bool:
    return rating == Rating.Again


def behavior_rating(failed: bool, revealed: bool, response_ms: int, slow_seconds: float):
    if failed or revealed:
        return Rating.Again
    return Rating.Hard if response_ms > slow_seconds * 1000 else Rating.Good


class FSRSScheduler:
    def __init__(self, settings):
        self.scheduler = Scheduler(
            desired_retention=settings.desired_retention, enable_fuzzing=False
        )
        self.version = f"fsrs-{version('fsrs')}"

    def initial(self):
        card = Card()
        return card.to_dict(), card.due

    def review(self, state: dict, rating, at, response_ms: int):
        card, log = self.scheduler.review_card(
            Card.from_dict(state), rating, review_datetime=at, review_duration=response_ms
        )
        return card.to_dict(), card.due, log.to_dict()
