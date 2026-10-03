from sqlalchemy import select

from trainer.chess_core import Candidate, board_facts, evaluation_loss, position_key
from trainer.models import Decision, EngineAnalysis, GameReviewMove
from trainer.policy import MovePolicy


def analyze_decision(db, engine, settings, game, ply, board, move):
    """Save one learner decision; ``engine`` is a zero-argument engine getter.

    A finished game review already searched this position at deep limits, so its
    saved analyses are reused and Stockfish only runs for unreviewed moves.
    """
    existing = db.scalar(select(Decision).where(Decision.game_id == game.id, Decision.ply == ply))
    if existing:
        return existing
    reviewed = db.get(GameReviewMove, (game.id, ply))
    if reviewed is not None:
        before, played, deep = reviewed_searches(db, engine, board, move, reviewed.report)
    else:
        before, played, deep = triaged_searches(engine(), settings, board, move)
    best = Candidate.model_validate(before.candidates[0])
    actual = Candidate.model_validate(played.candidates[0])
    loss = evaluation_loss(best.score, actual.score)
    decision = Decision(
        game_id=game.id,
        ply=ply,
        fen=board.fen(),
        position_key=position_key(board),
        learner_color=board.turn,
        move_uci=move.uci(),
        move_san=board.san(move),
        before_analysis_id=before.id,
        played_analysis_id=played.id,
        loss_cp=loss.cp,
        mate_lost=loss.mate_lost,
        allows_mate=loss.allows_mate,
        meaningful=MovePolicy.from_settings(settings).meaningful(best.score, actual.score),
        deep=deep,
        facts=board_facts(board, move, actual.pv),
    )
    db.add(decision)
    db.commit()
    return decision


def reviewed_searches(db, engine, board, move, report):
    before = db.get(EngineAnalysis, report["before_analysis_id"])
    played = db.get(EngineAnalysis, report["played_analysis_id"])
    if played.candidates[0]["uci"] != move.uci():
        # The review read a second-choice move from the root search; decisions
        # need the played move first, so search it at the review's own limits.
        played = engine().analyze(board, deep=True, root_moves=[move.uci()], multipv=1)
    return before, played, True


def triaged_searches(engine, settings, board, move):
    before = engine.analyze(board)
    # Search the actual move at the SAME root and learner perspective. This avoids
    # child-position sign mistakes and compares moves under identical analysis limits.
    played = engine.analyze(board, root_moves=[move.uci()], multipv=1)
    best = Candidate.model_validate(before.candidates[0])
    actual = Candidate.model_validate(played.candidates[0])
    loss = evaluation_loss(best.score, actual.score)
    suspicious = (
        loss.mate_lost
        or loss.allows_mate
        or (loss.cp is not None and loss.cp >= settings.mistake_threshold_cp * 0.7)
    )
    if suspicious:
        before = engine.analyze(board, deep=True)
        played = engine.analyze(board, deep=True, root_moves=[move.uci()], multipv=1)
    return before, played, suspicious
