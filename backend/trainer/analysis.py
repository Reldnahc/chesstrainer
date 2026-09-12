from sqlalchemy import select

from trainer.chess_core import Candidate, board_facts, evaluation_loss, position_key
from trainer.models import Decision
from trainer.policy import MovePolicy


def analyze_decision(db, engine, settings, game, ply, board, move):
    existing = db.scalar(select(Decision).where(Decision.game_id == game.id, Decision.ply == ply))
    if existing:
        return existing
    policy = MovePolicy.from_settings(settings)
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
        meaningful=policy.meaningful(best.score, actual.score),
        deep=suspicious,
        facts=board_facts(board, move, actual.pv),
    )
    db.add(decision)
    db.commit()
    return decision
