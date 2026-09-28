"""One projection for detail/polling; all derived layers share the same generation."""

from trainer.game_library import pgn_rating
from trainer.game_review import public_report
from trainer.review_intelligence.context import move_contexts
from trainer.review_intelligence.game_context import game_context


def present_game(parsed, saved, rating, *, completed=False):
    contexts = move_contexts(parsed) if saved else {}
    starting = parsed.board().turn
    reports = {
        ply: public_report(
            report,
            pgn_rating(parsed, starting if ply % 2 else not starting) or rating,
            context=contexts[ply],
        )
        for ply, report in saved.items()
        if ply in contexts
    }
    return reports, game_context(parsed, reports, completed=completed)
