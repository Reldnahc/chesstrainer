"""One projection for detail/polling; all derived layers share the same generation."""

from dataclasses import dataclass

from trainer.game_library import DEFAULT_RATING, mover_rating
from trainer.game_review import public_report
from trainer.recent_cache import RecentCache
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


# The latest presentation per game, stamped with (review revision, rating, completed).
# Every saved or adopted report bumps the revision, so a poll that finds nothing new
# reuses the last presentation instead of re-rendering the whole game.
_presented = RecentCache(64)


def presented_review(db, game, parsed, review, *, completed):
    """The game's saved reports and their presentation, rendered once per review revision."""

    rating = review.rating if review else DEFAULT_RATING
    # One entry per game: a new revision replaces the last presentation rather
    # than keeping every superseded one while a review saves ply after ply.
    stamp = (review.revision if review else 0, rating, completed)
    cached = _presented.get(game.id)
    if cached is not None and cached[0] == stamp:
        return cached[1]
    saved, revisions = load_game_reports(db, game.id)
    reports, context = present_game(parsed, saved, rating, completed=completed)
    presented = PresentedReview(saved, revisions, reports, context)
    _presented.put(game.id, (stamp, presented))
    return presented
