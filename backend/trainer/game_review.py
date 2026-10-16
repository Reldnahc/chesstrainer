"""Evidence-backed game coaching. Never writes training decisions or recall history."""

import chess

from trainer.chess_core import (
    DECISIVE_CP,
    Candidate,
    Score,
    evaluation_loss,
    legal_move,
    legal_move_options,
    mate_horizon,
)
from trainer.classification_stages import (
    line_findings,
    line_parameters,
    line_rules,
    previous_move,
)
from trainer.config import Settings
from trainer.continuations import replay, settled_delta
from trainer.errors import InvalidInput
from trainer.explanation_types import replay_line
from trainer.game_library import parsed_game
from trainer.opening_book import book_move
from trainer.review_cues import review_cues
from trainer.review_intelligence.difficulty import assess_difficulty
from trainer.review_intelligence.events import describe_move
from trainer.review_sacrifices import (
    has_sacrifice_support,
    is_sacrifice_offer,
    supported_sacrifice,
)
from trainer.review_scores import (
    INACCURACY_CP,
    MISTAKE_CP,
    NEAR_BEST_CP,
    blunder_cp,
    is_decisive_swing,
    is_mistake,
    is_only_good_move,
    is_poor,
    strongest_alternative,
)
from trainer.search_limits import DEEP, SearchLimits, SearchProfile

VERSION = "game-review-1"
# The PGN results that say a side won.
DECISIVE_RESULTS = frozenset({"1-0", "0-1"})


def game_outcome(board):
    """How a game ends here: the board's own outcome, or a threefold repetition or
    fifty-move count that has actually happened. A draw the side to move could
    only claim with its next move does not end the game. Play ends its games by
    this rule, and the final frame of every game review reads it."""
    outcome = board.outcome()
    if outcome is None and board.is_repetition(3):
        return chess.Outcome(chess.Termination.THREEFOLD_REPETITION, None)
    if outcome is None and board.is_fifty_moves():
        return chess.Outcome(chess.Termination.FIFTY_MOVES, None)
    return outcome


def position(board, *, final=False):
    """A frame's board facts. The ``final`` frame of a game also ends on a
    repetition or fifty-move draw that has happened; earlier frames and
    variation positions end only where the board itself does, since a game may
    have continued past an unclaimed repetition."""
    outcome = game_outcome(board) if final else board.outcome()
    return {
        "fen": board.fen(),
        "turn": "white" if board.turn else "black",
        "legal_moves": legal_move_options(board) if outcome is None else [],
        "result": outcome.result() if outcome else None,
        "termination": outcome.termination.name.replace("_", " ").lower() if outcome else None,
    }


def numeric(score):
    """Only for category boundaries; mate remains a separate type in all payloads."""
    return score.value if score.kind == "cp" else score.outcome() * 10000


def blunder_kind(best, actual, rating):
    """The Blunder rule alone, shared with library-wide insights; mover-relative scores."""
    loss = evaluation_loss(best, actual)
    if loss.allows_mate:
        return "mate"
    # An ordinary pawn loss gets gentler wording at low Elo; decisive losses do not.
    decisive = is_decisive_swing(best, actual)
    return "severe" if decisive or (loss.cp or 0) >= blunder_cp(rating) else None


def classify(report, rating):
    best = Score.model_validate(report["best"]["score"])
    actual = Score.model_validate(report["actual"]["score"])
    loss = evaluation_loss(best, actual)
    cp = loss.cp or 0
    blunder = blunder_kind(best, actual, rating)
    if blunder == "mate":
        return "Blunder", "This move allows a forced checkmate."
    if blunder:
        # Centipawn grading stands; the reason says what actually happened.
        if numeric(actual) >= DECISIVE_CP:
            return (
                "Blunder",
                "This move gives up a large amount of a winning advantage, though the position remains clearly winning.",
            )
        if numeric(best) <= -DECISIVE_CP:
            return "Blunder", "This move makes an already lost position much worse."
        # The review's own bands: winning and lost from three pawns (DECISIVE_CP).
        if numeric(best) >= DECISIVE_CP:
            return "Blunder", "This move gives away a winning advantage."
        if numeric(actual) <= -DECISIVE_CP:
            return "Blunder", "This move turns the position into a lost one."
        return "Blunder", "This move gives up a large part of the position's value."
    # Mate distance is not a centipawn loss. Keeping a slower forced win is
    # still good, but cannot qualify for an exceptional or Best label.
    if (
        best.kind == actual.kind == "mate"
        and best.outcome() == actual.outcome() == 1
        and actual.order_key() < best.order_key()
    ):
        return "Good", "This keeps a forced checkmate, but a faster mate was available."
    # In a position lost to mate either way, being mated sooner is the only way
    # left to give something away.
    if (
        best.kind == actual.kind == "mate"
        and best.outcome() == actual.outcome() == -1
        and actual.order_key() < best.order_key()
    ):
        return "Inaccuracy", "There was a stronger way to keep your position intact."
    # A missed tactic is a Miss only when it costs as much as a Mistake;
    # a smaller gap keeps the ordinary centipawn grade.
    missed = report["opportunity_missed"] and cp >= MISTAKE_CP
    if loss.mate_lost or missed:
        return "Miss", "A concrete tactical opportunity was available and went unused."
    if cp >= MISTAKE_CP:
        return "Mistake", "This move makes a meaningful avoidable concession."
    if cp >= INACCURACY_CP:
        return "Inaccuracy", "There was a stronger way to keep your position intact."
    if report["sacrifice"] and report["legal_count"] > 1:
        return "Brilliant", "You found a sound piece sacrifice with a verified tactical idea."
    # Great is best/near-best AND critical; a sole legal reply is never an achievement.
    if cp <= NEAR_BEST_CP and report["legal_count"] > 1:
        # Only when the runner-up actually loses and this move holds, the one rule
        # the coach's only-move evidence reads; a runner-up that still wins is no
        # reason for Great.
        only_good = is_only_good_move(best, actual, strongest_alternative(report))
        previous = report["previous_score"]
        # Capitalizing needs an opponent error: their previous move was graded a
        # Mistake or worse, not just a different search's score for the position.
        capitalized = (
            previous is not None
            and report.get("previous_mistake") is True
            and (
                (-150 < numeric(Score.model_validate(previous)) < 150 and numeric(actual) >= 200)
                or (numeric(Score.model_validate(previous)) <= -200 and numeric(actual) >= -50)
            )
        )
        if only_good:
            return (
                "Great",
                "You found the only good move; the strongest alternative concedes much more.",
            )
        if capitalized:
            return (
                "Great",
                "You capitalized on the opponent's mistake and changed the course of the game.",
            )
    immediate_mate = best.kind == actual.kind == "mate" and best.value == actual.value == 1
    if report["actual"]["uci"] == report["best"]["uci"]:
        return "Best", "This is the engine's top move."
    if immediate_mate:
        return "Best", "This gives an equally immediate checkmate."
    # A move exactly as strong as the top move (the same mate distance, or the
    # same score) is not merely Good, whose takes say something better existed;
    # that holds for an equally long defence against mate too.
    if best == actual:
        return "Best", "This is as strong as the engine's top move."
    return "Good", "A sound move that keeps the important opportunities intact."


# Bump when the way a saved line is read or shown changes, so saved lines are
# read again: 2 is the shared horizon with lines shown to where they settle,
# 3 settles only where no capture is pending, 4 credits pins the line creates or exploits.
LINE_READING = 4


def without_reading(horizon):
    """Line parameters without the reading version a saved horizon carries."""
    return {key: value for key, value in horizon.items() if key != "reading"}


def line_evidence(board, candidate, analysis_id, first, previous=None, parameters=None):
    """One line's frames and findings, read to the shared horizon (``line_rules``).

    The frames shown stop where the line settles (or at its last scanned ply),
    where every finding and the material claim rest, or at the mate of a forced
    mate, so the line shown and the claims about it look equally far.
    ``horizon`` records the parameters and the reading rule's version, so a line
    read another way is read again.
    """
    parameters = without_reading(parameters or line_parameters())
    rules = line_rules(parameters, annotate=True)
    # One board past the horizon, so the last ply sees the saved next move as the
    # classifier does; the moves shown are limited by rules.shown.
    boards = replay(board, candidate)[: rules.shown_plies + 2]
    delta, end = settled_delta(
        boards, board.turn, max_plies=rules.settle_plies, extra_plies=rules.extension_plies
    )
    gain = delta if first == 1 else -delta if delta is not None else None
    mate = candidate.score.kind == "mate" and candidate.score.outcome() == (1 if first == 1 else -1)
    findings = line_findings(
        boards,
        first,
        analysis_id,
        rules,
        end=end,
        material_supported=gain is not None and gain > 0,
        mate_supported=mate,
        previous=previous,
    )
    findings = lead_order(findings, first)
    return {
        "frames": [f.model_dump() for f in replay_line(board, rules.shown(candidate, end))],
        "findings": [f.model_dump() for f in findings],
        "material_delta": delta,
        "settled": delta is not None,
        "horizon": parameters | {"reading": LINE_READING},
    }


# Causal mechanisms the coach prefers to lead with over a generic capture annotation.
LEAD_SKILLS = frozenset(
    {"opponent_threat_recognition", "abandoned_defender", "pin", "fork", "skewer", "double_attack"}
)


def lead_order(findings, first):
    """Findings in the order the coach may lead with them: those starting with the
    move or its reply first, a preferred mechanism ahead of the rest; a later one,
    preferred or not, after them all (an incidental pin later in the line is not
    the reason for this move)."""
    return sorted(findings, key=lambda f: (min(f.plies) > first + 1, f.skill_id not in LEAD_SKILLS))


def move_frames(board, moves, reports, *, result=None, extra=None):
    """The start frame and one frame per move, as game review and Play show them.

    ``reports`` maps ply to its rendered report; ``extra(ply)`` adds fields such
    as a clock. The last frame ends where the game did, on a repetition or
    fifty-move draw that has happened too, whether the game was played here or
    imported, unless ``result`` (an imported game's header) says a side won: a
    repetition nobody claimed before a resignation or a lost clock ends nothing.
    """
    # Only a real win counts: an odd header ("½-½", "1/2", "0-0") ends nothing either.
    decisive = (result or "").strip() in DECISIVE_RESULTS
    board = board.copy()
    frames = [
        position(board)
        | {
            "san": "Start",
            "uci": None,
            "number": board.fullmove_number,
            "actor": None,
            "report": None,
        }
    ]
    for ply, move in enumerate(moves, 1):
        san, number, actor = board.san(move), board.fullmove_number, board.turn
        board.push(move)
        frames.append(
            position(board, final=ply == len(moves) and not decisive)
            | {
                "san": san,
                "uci": move.uci(),
                "number": number,
                "actor": "white" if actor else "black",
                "report": reports.get(ply),
            }
            | (extra(ply) if extra else {})
        )
    return frames


def mate_horizon_limits(settings=None):
    """The deeper search that settles a long mate one search saw and the played
    move's did not: the review refinement's limits, from the host's settings or
    their defaults, so the two never drift apart."""

    def value(name):
        return getattr(settings, name) if settings else Settings.model_fields[name].default

    return SearchLimits(
        depth=value("review_refinement_depth"), time=value("review_refinement_time")
    )


def root_comparison(engine, board, move, limits=None):
    """The root search, its candidates, and the played move's candidate and search."""
    profile = SearchProfile.explicit(limits) if limits else DEEP
    before = engine.analyze(board, profile, multipv=2)
    candidates = [Candidate.model_validate(c) for c in before.candidates]
    actual = next((c for c in candidates if c.uci == move.uci()), None)
    actual_id = before.id
    if actual is None:
        played = engine.analyze(board, profile, root_moves=[move.uci()], multipv=1)
        actual, actual_id = Candidate.model_validate(played.candidates[0]), played.id
    return before, candidates, actual, actual_id


def mated_beyond_horizon(best, actual):
    """One side of the comparison is mated and the other reads only a lost
    centipawn score: every move may be mated beyond one search's horizon."""
    return any(
        seen.outcome() == -1 and mate_horizon(seen, other)
        for seen, other in ((best, actual), (actual, best))
    )


def review_lines(board, best, actual, best_id, actual_id, poor, parameters=None):
    """The played and best lines, both read with the move before, as the classifier does."""
    previous = previous_move(board)
    actual_line = line_evidence(board, actual, actual_id, 2 if poor else 1, previous, parameters)
    if actual.uci == best.uci:
        return actual_line, actual_line
    return actual_line, line_evidence(board, best, best_id, 1, previous, parameters)


def lines_current(report, parameters=None):
    """Whether a saved report's lines were read to the horizon in force now.

    A report without lines (a bare engine-facts fixture) has nothing to re-read.
    """
    horizon = without_reading(parameters or line_parameters()) | {"reading": LINE_READING}
    return all(
        report.get(key) is None or report[key].get("horizon") == horizon
        for key in ("actual_line", "best_line")
    )


def reread_lines(report, board, parameters=None):
    """A saved report's lines read again from its saved candidates, with no search.

    Reports saved before the shared line rule read their lines to another
    horizon; this gives them the current one. ``board`` stands before the move.
    """
    best = Candidate.model_validate(report["best"])
    actual = Candidate.model_validate(report["actual"])
    poor = is_poor(evaluation_loss(best.score, actual.score))
    actual_line, best_line = review_lines(
        board,
        best,
        actual,
        report["before_analysis_id"],
        report["played_analysis_id"],
        poor,
        parameters,
    )
    return report | {
        "actual_line": actual_line,
        "best_line": best_line,
        "opportunity_missed": bool(missed_opportunity(poor, best_line, actual_line)),
    }


def analyze_move(engine, board, move, previous_score=None, *, parameters=None, mate_limits=None):
    mate_limits = mate_limits or mate_horizon_limits()
    before, candidates, actual, actual_id = root_comparison(engine, board, move)
    if mated_beyond_horizon(candidates[0].score, actual.score):
        # Either the played move reads mated while the best defence reads only a
        # lost score, or the best defence reads mated while the played move's
        # restricted search reads only a lost score. The whole comparison is
        # searched deeper at one limit, so a move that only hastens an unavoidable
        # mate is not "allows mate", and a faster-mated move whose search stopped
        # short of its mate is not promoted over the best defence.
        before, candidates, actual, actual_id = root_comparison(engine, board, move, mate_limits)
    best = candidates[0]
    if best.score.outcome() == 1 and mate_horizon(best.score, actual.score):
        # A move that keeps a mate, however long, is no Miss; one that really
        # gives it up for a big lead still is. Searching it deeper tells them apart.
        played = engine.analyze(
            board,
            SearchProfile.explicit(mate_limits),
            root_moves=[move.uci()],
            multipv=1,
        )
        actual, actual_id = Candidate.model_validate(played.candidates[0]), played.id
    loss = evaluation_loss(best.score, actual.score)
    poor = is_poor(loss)
    actual_line, best_line = review_lines(
        board, best, actual, before.id, actual_id, poor, parameters
    )
    after = board.copy(stack=True)
    after.push(move)
    # A sacrifice must really offer a non-pawn piece at a net material cost.
    # Test acceptance explicitly, as well as the unrestricted opponent search.
    sacrifice = None
    alternatives = [c for c in candidates if c.uci != move.uci()]
    # Forcing mate is its own achievement: a sacrifice that is the only searched
    # way to a forced mate stays eligible even when the alternatives keep a big lead.
    forces_mate = actual.score.kind == "mate" and actual.score.outcome() == 1
    only_mate = forces_mate and not any(
        c.score.kind == "mate" and c.score.outcome() == 1 for c in alternatives
    )
    already_winning_without_sacrifice = not only_mate and any(
        numeric(c.score) >= 300 for c in alternatives
    )
    if (
        board.legal_moves.count() > 1
        and not poor
        and numeric(actual.score) >= -50
        and not already_winning_without_sacrifice
    ):
        if has_sacrifice_support(board, actual.score, actual_line):
            captures = [
                m
                for m in after.legal_moves
                if after.is_capture(m) and is_sacrifice_offer(board, move, m)
            ]
            for capture in captures[:2]:
                tested = engine.analyze(after, DEEP, root_moves=[capture.uci()], multipv=1)
                response = Candidate.model_validate(tested.candidates[0])
                if numeric(response.score.negate()) >= -50:
                    sacrifice = {
                        "capture": capture.uci(),
                        "analysis_id": tested.id,
                        "score": response.score.negate().model_dump(),
                    }
                    break
    missed = missed_opportunity(poor, best_line, actual_line)
    return {
        "version": VERSION,
        "engine_version": before.engine_version,
        "depth": min(best.depth, actual.depth),
        "before_analysis_id": before.id,
        "played_analysis_id": actual_id,
        "best": best.model_dump(),
        "actual": actual.model_dump(),
        "second_score": candidates[1].score.model_dump() if len(candidates) > 1 else None,
        "root_candidates": [candidate.model_dump() for candidate in candidates],
        "previous_score": previous_score.model_dump() if previous_score else None,
        "legal_count": board.legal_moves.count(),
        "loss_cp": loss.cp,
        "sacrifice": sacrifice,
        "opportunity_missed": bool(missed),
        "actual_line": actual_line,
        "best_line": best_line,
        "white_score": (actual.score if board.turn else actual.score.negate()).model_dump(),
    }


def missed_opportunity(poor, best_line, actual_line):
    """A poor move passed up a line that wins material with a named idea."""
    best_delta, actual_delta = best_line["material_delta"], actual_line["material_delta"]
    return (
        poor
        and best_delta is not None
        and actual_delta is not None
        and (best_delta >= 1 and best_delta - actual_delta >= 1 and bool(best_line["findings"]))
    )


def promote_stronger_played(report):
    """A played move outside the MultiPV gets its own restricted search. When
    that search scores it above the reported best, it is the best move found,
    so every displayed derivative (grade, best move, missed ideas) uses it."""
    if report["actual"]["uci"] == report["best"]["uci"]:
        return report
    best = Score.model_validate(report["best"]["score"])
    actual = Score.model_validate(report["actual"]["score"])
    if actual.order_key() <= best.order_key():
        return report
    # A centipawn score against a best move that is mated is a horizon
    # difference, not a stronger move: the restricted search stopped short of
    # the mate. Saved rows from before the deeper re-search still hold such pairs.
    if best.outcome() == -1 and actual.kind == "cp":
        return report
    return report | {
        "best": report["actual"],
        "best_line": report["actual_line"],
        "loss_cp": 0,
        "opportunity_missed": False,
    }


# The report fields review polling sends for each newly saved ply. Board
# positions were sent once with the game, so witness lines and legal moves stay out.
PROGRESS_KEYS = (
    "label",
    "engine_label",
    "opening",
    "reason",
    "coach",
    "best",
    "actual",
    "white_score",
    "depth",
    "engine_version",
    "board_cues",
    "human",
    "practical",
    "refinement",
    "intelligence",
    "immediate_reply",
    "immediate_recapture",
)
# Keys public_report derives from a saved engine report. Saved reports keep only
# engine facts, so a later rule change reaches every saved review and Play game.
PRESENTATION_KEYS = frozenset(
    {
        "immediate_reply",
        "immediate_recapture",
        "practical",
        "intelligence",
        "label",
        "engine_label",
        "opening",
        "reason",
        "coach",
        "board_cues",
    }
)


def engine_facts(report):
    """A saved report without derived presentation, as older Play rows stored it,
    with the root search's own best move where an older rendering had already
    swapped the played move in for it."""
    return unpromoted({key: value for key, value in report.items() if key not in PRESENTATION_KEYS})


def unpromoted(report):
    """The raw comparison of a report saved after promote_stronger_played had
    swapped its best move for the played one (Play rows from before reports were
    saved as engine facts). analyze_move always names the root search's first
    candidate as best, so a best move equal to the played move while the root's
    first candidate differs is such a swap; that candidate, its line replayed from
    the saved position, and the loss against it restore the comparison, so the
    previous-score link and the Great rule read it as for every other row."""
    roots = report.get("root_candidates") or []
    best, actual = report.get("best"), report.get("actual")
    frames = (report.get("actual_line") or {}).get("frames") or []
    if (
        not (roots and best and actual and frames)
        or best["uci"] != actual["uci"]
        or roots[0]["uci"] == actual["uci"]
    ):
        return report
    root_best = Candidate.model_validate(roots[0])
    loss = evaluation_loss(root_best.score, Score.model_validate(actual["score"]))
    best_line = line_evidence(
        chess.Board(frames[0]["fen"]),
        root_best,
        report["before_analysis_id"],
        1,
        parameters=report["actual_line"].get("horizon"),
    )
    return report | {
        "best": root_best.model_dump(),
        "best_line": best_line,
        "loss_cp": loss.cp,
        "opportunity_missed": bool(
            missed_opportunity(is_poor(loss), best_line, report["actual_line"])
        ),
    }


def link_previous_scores(reports: dict) -> dict:
    """Each report's previous score from the report before it, when that one is saved.

    Great and recovery comparisons then use the same generation as the scores shown,
    the one rule for saved reviews and Play.
    """
    linked = {}
    for ply in sorted(reports):
        report = reports[ply]
        before = reports.get(ply - 1)
        if before is not None:
            opponent_best = Score.model_validate(before["best"]["score"])
            report = report | {"previous_score": opponent_best.negate().model_dump()}
            if "actual" in before:
                # Whether the opponent's move was itself a Mistake or worse.
                opponent_played = Score.model_validate(before["actual"]["score"])
                loss = evaluation_loss(opponent_best, opponent_played)
                report["previous_mistake"] = is_mistake(loss)
        linked[ply] = report
    return linked


def review_move(
    engine,
    human_models,
    sessions,
    parsed,
    board,
    *,
    fallback_rating,
    previous_score=None,
    parameters=None,
    mate_limits=None,
):
    """One move's saved review evidence: the engine report with its Maia evidence.

    ``board`` stands after the move. Variation analysis and Play build a single
    move's report here, then render it with ``public_report``. Without a saved
    ``previous_score`` the position before the move is searched for it, and that
    search also says whether the opponent's move was a Mistake or worse.
    """
    board = board.copy(stack=True)
    move = board.pop()
    opponent_best = None
    if previous_score is None and board.move_stack:
        previous = board.copy(stack=True)
        previous.pop()
        result = engine.analyze(previous, DEEP, multipv=2)
        opponent_best = Score.model_validate(result.candidates[0]["score"])
        previous_score = opponent_best.negate()
    report = analyze_move(
        engine, board, move, previous_score, parameters=parameters, mate_limits=mate_limits
    )
    if opponent_best is not None:
        # Whether the opponent's move was itself a Mistake or worse, by the same
        # threshold saved reviews link, so a variation move can be the capitalizing
        # Great too. The opponent's move reached this position, whose best score
        # stands in for that move's own search (one ply apart, so a borderline
        # loss can read differently from a saved review).
        opponent_played = Score.model_validate(report["best"]["score"]).negate()
        report["previous_mistake"] = is_mistake(evaluation_loss(opponent_best, opponent_played))
    report["human"] = human_models.evidence(
        sessions, parsed, board, move.uci(), report["best"]["uci"], fallback_rating
    )
    return report


def public_report(report, rating, *, context=None):
    # Apply current evidence admission to saved reports too. Keep engine facts
    # untouched in storage; all displayed derivatives share the corrected offer.
    if report.get("sacrifice") and not supported_sacrifice(report):
        report = report | {"sacrifice": None}
    report = promote_stronger_played(report)
    label, reason = classify(report, rating)
    engine_label = label
    findings = report["actual_line"]["findings"]
    coach = findings[0]["explanation"] if findings else reason
    if not findings and len(report["actual_line"]["frames"]) > 2:
        reply = report["actual_line"]["frames"][2]
        if label in {"Mistake", "Miss", "Blunder", "Inaccuracy"}:
            coach = reason + " " + reply["annotation"]
    # Recognition belongs to presentation, so saved reviews and interactive
    # branches use the same current book without rewriting engine evidence.
    frames = report["actual_line"]["frames"]
    opening = book_move(frames[0]["fen"], report["actual"]["uci"]) if frames else None
    if opening:
        label, reason = "Book", "This move is part of a recognized opening line."
        coach = f"This follows {opening['name']} ({opening['eco']})." if opening["name"] else reason
    practical = assess_difficulty(report)
    return report | {
        "immediate_reply": frames[2] if len(frames) > 2 else None,
        # Straight back: the mover's next move captures on the square the reply took on.
        "immediate_recapture": frames[3]
        if len(frames) > 3
        and frames[2]["capture"]
        and frames[3]["capture"]
        and frames[3]["uci"][2:4] == frames[2]["uci"][2:4]
        else None,
        "practical": practical.model_dump(mode="json"),
        "intelligence": describe_move(report, practical, context).model_dump(mode="json"),
        "label": label,
        "engine_label": engine_label,
        "opening": opening,
        "reason": reason,
        "coach": coach,
        "board_cues": review_cues(
            report["actual_line"],
            mistake=engine_label in {"Mistake", "Miss", "Blunder", "Inaccuracy"},
        ),
    }


def branch_board(game, ply, moves):
    parsed = parsed_game(game)
    mainline = list(parsed.mainline_moves())
    if ply > len(mainline):
        raise InvalidInput("Move number is outside this game")
    board = parsed.board()
    for move in mainline[:ply]:
        board.push(move)
    for uci in moves:
        if board.is_game_over():
            raise InvalidInput("This variation has already ended")
        board.push(legal_move(board, uci))
    return board
