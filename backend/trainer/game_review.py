"""Evidence-backed game coaching. Never writes training decisions or recall history."""

import io

import chess
import chess.pgn
from sqlalchemy import select

from trainer.chess_core import Candidate, Score, evaluation_loss, legal_move, material
from trainer.continuations import replay, settled_delta
from trainer.explanations import replay_line
from trainer.models import AnalysisJob, Game, GameReview, GameReviewMove
from trainer.move_causes import move_causes
from trainer.review_cues import review_cues
from trainer.tactical_patterns import detect_patterns, recognized_patterns

VERSION = "game-review-1"
LABELS = ("Brilliant", "Great", "Best", "Good", "Inaccuracy", "Mistake", "Miss", "Blunder")


def parsed_game(game):
    return chess.pgn.read_game(io.StringIO(game.pgn))


def position(board):
    outcome = board.outcome()
    return {
        "fen": board.fen(),
        "turn": "white" if board.turn else "black",
        "legal_moves": [
            {
                "from_square": chess.square_name(m.from_square),
                "to_square": chess.square_name(m.to_square),
                "promotion": chess.piece_symbol(m.promotion) if m.promotion else None,
                "capture": board.is_capture(m),
            }
            for m in board.legal_moves
        ]
        if outcome is None
        else [],
        "result": outcome.result() if outcome else None,
        "termination": outcome.termination.name.replace("_", " ").lower() if outcome else None,
    }


def numeric(score):
    """Only for category boundaries; mate remains a separate type in all payloads."""
    return score.value if score.kind == "cp" else score.outcome() * 10000


def classify(report, rating):
    best = Score.model_validate(report["best"]["score"])
    actual = Score.model_validate(report["actual"]["score"])
    loss = evaluation_loss(best, actual)
    cp = loss.cp or 0
    if loss.allows_mate:
        return "Blunder", "This move allows a forced checkmate."
    # An ordinary pawn loss gets gentler wording at low Elo; decisive losses do not.
    decisive = numeric(best) >= -50 and numeric(actual) <= -200
    blunder_cp = 300 if rating < 1200 else 200
    if decisive or cp >= blunder_cp:
        return "Blunder", "This move gives away a decisive advantage or allows a severe loss."
    missed = report["opportunity_missed"]
    if loss.mate_lost or missed:
        return "Miss", "A concrete tactical opportunity was available and went unused."
    if cp >= 100:
        return "Mistake", "This move makes a meaningful avoidable concession."
    if cp >= 50:
        return "Inaccuracy", "There was a stronger way to keep your position intact."
    if report["sacrifice"]:
        return "Brilliant", "You found a sound piece sacrifice with a verified tactical idea."
    # Great is best/near-best AND critical; a sole legal reply is never an achievement.
    if cp <= 20 and report["legal_count"] > 1:
        second = report["second_score"]
        only_good = (
            second is not None
            and (
                evaluation_loss(best, Score.model_validate(second)).allows_mate
                or evaluation_loss(best, Score.model_validate(second)).mate_lost
                or (evaluation_loss(best, Score.model_validate(second)).cp or 0) >= 150
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
    if report["actual"]["uci"] == report["best"]["uci"] or cp <= 10:
        return "Best", "This is one of the strongest moves in the position."
    return "Good", "A sound move that keeps the important opportunities intact."


def line_evidence(board, candidate, analysis_id, first, previous=None):
    boards = replay(board, candidate)
    delta, end = settled_delta(boards, board.turn, max_plies=32)
    direction = "missed_opportunity" if first == 1 else "allowed_opponent_tactic"
    gain = delta if first == 1 else -delta if delta is not None else None
    mate = candidate.score.kind == "mate" and candidate.score.outcome() == (1 if first == 1 else -1)
    findings = detect_patterns(
        boards,
        first,
        end,
        analysis_id,
        direction,
        material_supported=gain is not None and gain > 0,
        mate_supported=mate,
    )
    detailed = {f.skill_id for f in findings}
    findings.extend(
        f
        for f in recognized_patterns(
            boards,
            first,
            min(16, len(boards) - 1),
            analysis_id,
            direction,
        )
        if f.skill_id not in detailed
    )
    if first == 2 and gain is not None and gain > 0:
        findings = move_causes(boards, analysis_id, previous) + findings
    # Prefer an actual causal mechanism over a generic capture annotation.
    preferred = {"opponent_threat_recognition", "abandoned_defender", "pin", "fork", "skewer"}
    findings.sort(key=lambda f: f.skill_id not in preferred)
    return {
        "frames": [f.model_dump() for f in replay_line(board, candidate.pv[:32])],
        "findings": [f.model_dump() for f in findings],
        "material_delta": delta,
        "settled": delta is not None,
    }


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
    poor = loss.mate_lost or loss.allows_mate or (loss.cp or 0) >= 50
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
    already_winning_without_sacrifice = any(numeric(c.score) >= 300 for c in alternatives)
    if not poor and numeric(actual.score) >= -50 and not already_winning_without_sacrifice:
        tactical = actual_line["findings"] or actual.score.outcome() == 1
        if tactical:
            baseline = material(board, board.turn) - material(board, not board.turn)
            captures = [
                m
                for m in after.legal_moves
                if after.is_capture(m)
                and after.piece_at(m.to_square)
                and after.piece_at(m.to_square).piece_type not in {chess.PAWN, chess.KING}
            ]
            for capture in captures[:2]:
                accepted = after.copy(stack=True)
                accepted.push(capture)
                balance = material(accepted, board.turn) - material(accepted, not board.turn)
                # Exclude ordinary equal trades, including recapture of the mover.
                if balance >= baseline:
                    continue
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
        "previous_score": previous_score.model_dump() if previous_score else None,
        "legal_count": board.legal_moves.count(),
        "loss_cp": loss.cp,
        "sacrifice": sacrifice,
        "opportunity_missed": bool(missed),
        "actual_line": actual_line,
        "best_line": best_line,
        "white_score": (actual.score if board.turn else actual.score.negate()).model_dump(),
    }


def public_report(report, rating):
    label, reason = classify(report, rating)
    findings = report["actual_line"]["findings"]
    coach = findings[0]["explanation"] if findings else reason
    if not findings and len(report["actual_line"]["frames"]) > 2:
        reply = report["actual_line"]["frames"][2]
        if label in {"Mistake", "Miss", "Blunder", "Inaccuracy"}:
            coach = reason + " " + reply["annotation"]
    return report | {
        "label": label,
        "reason": reason,
        "coach": coach,
        "board_cues": review_cues(
            report["actual_line"], mistake=label in {"Mistake", "Miss", "Blunder", "Inaccuracy"}
        ),
    }


def run_review(runner, job_id, engine_override=None):
    with runner.sessions() as db:
        review = db.scalar(select(GameReview).where(GameReview.job_id == job_id))
        game = db.get(Game, review.game_id)
        parsed = parsed_game(game)
        moves = list(parsed.mainline_moves())
    engine = engine_override or runner.engine_factory(runner.settings, runner.sessions)
    try:
        board = parsed.board()
        previous = None
        for ply, move in enumerate(moves, 1):
            if runner.cancelled(job_id):
                break
            with runner.sessions() as db:
                saved = db.get(GameReviewMove, (game.id, ply))
                report = saved.report if saved else None
            if report is None:
                report = analyze_move(engine, board, move, previous)
                with runner.import_lock, runner.sessions() as db:
                    db.add(GameReviewMove(game_id=game.id, ply=ply, report=report))
                    db.commit()
            previous = Score.model_validate(report["best"]["score"]).negate()
            board.push(move)
            with runner.sessions() as db:
                job = db.get(AnalysisJob, job_id)
                job.positions_triaged = ply
                job.games_processed = int(ply == len(moves))
                db.commit()
    finally:
        if not engine_override:
            engine.close()


def branch_board(game, ply, moves):
    parsed = parsed_game(game)
    mainline = list(parsed.mainline_moves())
    if ply > len(mainline):
        raise ValueError("Move number is outside this game")
    board = parsed.board()
    for move in mainline[:ply]:
        board.push(move)
    for uci in moves:
        if board.is_game_over():
            raise ValueError("This variation has already ended")
        board.push(legal_move(board, uci))
    return board
