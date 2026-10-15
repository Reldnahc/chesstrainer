"""Evidence-backed game coaching. Never writes training decisions or recall history."""

import chess

from trainer.chess_core import (
    Candidate,
    Score,
    evaluation_loss,
    legal_move,
    legal_move_options,
)
from trainer.classification_stages import REVIEW_RULES, line_findings
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
    is_poor,
    strongest_alternative,
)

VERSION = "game-review-1"


def play_outcome(board):
    """How a Play game ends here: the board's own outcome, or a threefold repetition
    or fifty-move count that has actually happened. A draw the side to move could
    only claim with its next move does not end the game."""
    outcome = board.outcome()
    if outcome is None and board.is_repetition(3):
        return chess.Outcome(chess.Termination.THREEFOLD_REPETITION, None)
    if outcome is None and board.is_fifty_moves():
        return chess.Outcome(chess.Termination.FIFTY_MOVES, None)
    return outcome


def position(board, *, play_end=False):
    """A frame's board facts; ``play_end`` ends it where Play ends a game."""
    outcome = play_outcome(board) if play_end else board.outcome()
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
    decisive = numeric(best) >= -50 and numeric(actual) <= -200
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
        return "Blunder", "This move gives away a decisive advantage or allows a severe loss."
    # Mate distance is not a centipawn loss. Keeping a slower forced win is
    # still good, but cannot qualify for an exceptional or Best label.
    if (
        best.kind == actual.kind == "mate"
        and best.outcome() == actual.outcome() == 1
        and actual.order_key() < best.order_key()
    ):
        return "Good", "This keeps a forced checkmate, but a faster mate was available."
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
        second = strongest_alternative(report)
        only_good = (
            second is not None
            and (
                evaluation_loss(best, second).allows_mate
                or evaluation_loss(best, second).mate_lost
                or (evaluation_loss(best, second).cp or 0) >= 150
            )
            and numeric(actual) >= -50
        )
        previous = report["previous_score"]
        capitalized = previous is not None and (
            (-150 < numeric(Score.model_validate(previous)) < 150 and numeric(actual) >= 200)
            or (numeric(Score.model_validate(previous)) <= -200 and numeric(actual) >= -50)
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
    return "Good", "A sound move that keeps the important opportunities intact."


def line_evidence(board, candidate, analysis_id, first, previous=None):
    boards = replay(board, candidate)
    delta, end = settled_delta(boards, board.turn, max_plies=REVIEW_RULES.settle_plies)
    gain = delta if first == 1 else -delta if delta is not None else None
    mate = candidate.score.kind == "mate" and candidate.score.outcome() == (1 if first == 1 else -1)
    findings = line_findings(
        boards,
        first,
        analysis_id,
        REVIEW_RULES,
        end=end,
        material_supported=gain is not None and gain > 0,
        mate_supported=mate,
        previous=previous,
    )
    # Prefer an actual causal mechanism over a generic capture annotation.
    preferred = {"opponent_threat_recognition", "abandoned_defender", "pin", "fork", "skewer"}
    findings.sort(key=lambda f: f.skill_id not in preferred)
    return {
        "frames": [f.model_dump() for f in replay_line(board, candidate.pv[:32])],
        "findings": [f.model_dump() for f in findings],
        "material_delta": delta,
        "settled": delta is not None,
    }


def move_frames(board, moves, reports, *, play_end=False, extra=None):
    """The start frame and one frame per move, as game review and Play show them.

    ``reports`` maps ply to its rendered report; ``extra(ply)`` adds fields such
    as a clock. Play also ends a game on a repetition or fifty-move draw that has
    happened, so it asks for its last frame to end where the game did.
    """
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
            position(board, play_end=play_end and ply == len(moves))
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


def analyze_move(engine, board, move, previous_score=None):
    before = engine.analyze(board, deep=True, multipv=2)
    candidates = [Candidate.model_validate(c) for c in before.candidates]
    best = candidates[0]
    actual = next((c for c in candidates if c.uci == move.uci()), None)
    actual_id = before.id
    if actual is None:
        played = engine.analyze(board, deep=True, root_moves=[move.uci()], multipv=1)
        actual, actual_id = Candidate.model_validate(played.candidates[0]), played.id
    loss = evaluation_loss(best.score, actual.score)
    poor = is_poor(loss)
    previous = None
    if board.move_stack:
        earlier = board.copy(stack=True)
        preceding = earlier.pop()
        previous = {"fen": earlier.fen(), "uci": preceding.uci()}
    actual_line = line_evidence(board, actual, actual_id, 2 if poor else 1, previous)
    best_line = actual_line if actual.uci == best.uci else line_evidence(board, best, before.id, 1)
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
                tested = engine.analyze(after, deep=True, root_moves=[capture.uci()], multipv=1)
                response = Candidate.model_validate(tested.candidates[0])
                if numeric(response.score.negate()) >= -50:
                    sacrifice = {
                        "capture": capture.uci(),
                        "analysis_id": tested.id,
                        "score": response.score.negate().model_dump(),
                    }
                    break
    best_delta, actual_delta = best_line["material_delta"], actual_line["material_delta"]
    missed = (
        poor
        and best_delta is not None
        and actual_delta is not None
        and (best_delta >= 1 and best_delta - actual_delta >= 1 and bool(best_line["findings"]))
    )
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
    """A saved report without derived presentation, as older Play rows stored it."""
    return {key: value for key, value in report.items() if key not in PRESENTATION_KEYS}


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
            previous = Score.model_validate(before["best"]["score"]).negate()
            report = report | {"previous_score": previous.model_dump()}
        linked[ply] = report
    return linked


def review_move(
    engine, human_models, sessions, parsed, board, *, fallback_rating, previous_score=None
):
    """One move's saved review evidence: the engine report with its Maia evidence.

    ``board`` stands after the move. Variation analysis and Play build a single
    move's report here, then render it with ``public_report``. Without a saved
    ``previous_score`` the position before the move is searched for it.
    """
    board = board.copy(stack=True)
    move = board.pop()
    if previous_score is None and board.move_stack:
        previous = board.copy(stack=True)
        previous.pop()
        result = engine.analyze(previous, deep=True, multipv=2)
        previous_score = Score.model_validate(result.candidates[0]["score"]).negate()
    report = analyze_move(engine, board, move, previous_score)
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
        "immediate_recapture": frames[3] if len(frames) > 3 and frames[3]["capture"] else None,
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
