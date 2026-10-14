"""One projection for detail/polling; all derived layers share the same generation."""

import threading
from collections import OrderedDict
from dataclasses import dataclass

from trainer.game_library import DEFAULT_RATING, mover_rating
from trainer.game_review import public_report
from trainer.review_intelligence.context import move_contexts
from trainer.review_intelligence.game_context import game_context
from trainer.review_reports import load_game_reports


def present_game(parsed, saved, rating, *, completed=False):
    contexts = move_contexts(parsed) if saved else {}
    starting = parsed.board().turn
    reports = {
        ply: public_report(
            report,
            mover_rating(parsed, starting if ply % 2 else not starting, rating),
            context=contexts[ply],
        )
        for ply, report in saved.items()
        if ply in contexts
    }
    return reports, game_context(parsed, reports, completed=completed)


@dataclass(frozen=True)
class PresentedReview:
    saved: dict
    revisions: dict
    reports: dict
    context: object


# Presentations by (game, review revision, rating, completed). Every saved or
# adopted report bumps the review's revision, so a poll that finds nothing new
# reuses the last presentation instead of re-rendering the whole game.
_presented: OrderedDict = OrderedDict()
_presented_lock = threading.Lock()
PRESENTED_KEPT = 64


def presented_review(db, game, parsed, review, *, completed):
    """The game's saved reports and their presentation, rendered once per review revision."""

    rating = review.rating if review else DEFAULT_RATING
    key = (game.id, review.revision if review else 0, rating, completed)
    with _presented_lock:
        cached = _presented.get(key)
        if cached is not None:
            _presented.move_to_end(key)
            return cached
    saved, revisions = load_game_reports(db, game.id)
    reports, context = present_game(parsed, saved, rating, completed=completed)
    presented = PresentedReview(saved, revisions, reports, context)
    with _presented_lock:
        _presented[key] = presented
        while len(_presented) > PRESENTED_KEPT:
            _presented.popitem(last=False)
    return presented
