from datetime import timezone
from importlib.metadata import version

from fsrs import Card, Rating, Scheduler


def utc(value):
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


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
            Card.from_dict(state), rating, review_datetime=utc(at), review_duration=response_ms
        )
        return card.to_dict(), card.due, log.to_dict()
