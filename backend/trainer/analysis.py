from sqlalchemy import func, select, update

from trainer.chess_core import Candidate, board_facts, digest, evaluation_loss, position_key
from trainer.models import (
    Decision,
    EngineAnalysis,
    Exercise,
    GameReviewMove,
    SkillEvidence,
    SRSState,
    keep_shared,
)
from trainer.policy import MovePolicy
from trainer.review_reports import saved_report


def analyze_decision(db, engine, settings, game, ply, board, move):
    """Save one learner decision; ``engine`` is a zero-argument engine getter.

    A finished game review already searched this position at deep limits, so its
    saved analyses are reused and Stockfish only runs for unreviewed moves.
    """
    existing = db.scalar(select(Decision).where(Decision.game_id == game.id, Decision.ply == ply))
    reviewed = db.get(GameReviewMove, (game.id, ply))
    # The report the review shows, so an adopted deeper search reaches training.
    report = saved_report(db, reviewed) if reviewed is not None else None
    if existing and (report is None or report["before_analysis_id"] == existing.before_analysis_id):
        return existing
    if report is not None:
        before, played, deep = reviewed_searches(db, engine, board, move, report)
    else:
        before, played, deep = triaged_searches(engine(), settings, board, move)
    best = Candidate.model_validate(before.candidates[0])
    actual = Candidate.model_validate(played.candidates[0])
    loss = evaluation_loss(best.score, actual.score)
    meaningful = MovePolicy.from_settings(settings).meaningful(best.score, actual.score)
    # A deeper search adopted after the decision was saved (a later refinement)
    # replaces its searches in place, so its exercise and labels follow it.
    decision = existing or Decision(
        game_id=game.id,
        ply=ply,
        fen=board.fen(),
        position_key=position_key(board),
        learner_color=board.turn,
        move_uci=move.uci(),
        move_san=board.san(move),
    )
    decision.before_analysis_id = before.id
    decision.played_analysis_id = played.id
    decision.loss_cp = loss.cp
    decision.mate_lost = loss.mate_lost
    decision.allows_mate = loss.allows_mate
    decision.meaningful = meaningful
    decision.deep = deep
    decision.facts = board_facts(board, move, actual.pv)
    if existing and not meaningful:
        # No longer a mistake: its labels stop counting as weakness evidence.
        db.execute(
            update(SkillEvidence)
            .where(SkillEvidence.decision_id == existing.id)
            .values(active=False)
        )
    if existing:
        sync_card_eligibility(db, existing)
    db.add(decision)
    db.commit()
    return decision


def sync_card_eligibility(db, decision):
    """A card made from ``decision`` leaves the practice queue while the decision
    is no longer a mistake, and returns when a deeper search makes it one again.

    The card keeps its answers and schedule either way: practice must not drill a
    move the review now calls Good or Best, but rewriting the card would drop
    answers graded during practice. Cards are found by position, so one shared by
    the same mistake in another game stays in the queue while any decision on its
    position is meaningful, whichever decision made it.
    """
    cards = db.scalars(
        select(SRSState)
        .join(Exercise, Exercise.id == SRSState.exercise_id)
        .join(Decision, Decision.id == Exercise.decision_id)
        .where(Decision.position_key == decision.position_key, Exercise.source == "game")
    ).all()
    if not cards:
        return
    eligible = decision.meaningful or bool(
        db.scalar(
            select(func.count())
            .select_from(Decision)
            .where(
                Decision.position_key == decision.position_key,
                Decision.meaningful.is_(True),
                Decision.id != decision.id,
            )
        )
    )
    for state in cards:
        state.eligible = eligible


def reviewed_searches(db, engine, board, move, report):
    before = db.get(EngineAnalysis, report["before_analysis_id"])
    played = db.get(EngineAnalysis, report["played_analysis_id"])
    if played.candidates[0]["uci"] != move.uci():
        # The review read the played move from the root search's MultiPV, the
        # same search (and depth) its best move came from. Decisions need the
        # played move first, so that candidate becomes its own restricted view of
        # the search; a new search at other limits would compare two depths.
        played = restricted_view(db, played, move.uci()) or engine().analyze(
            board, deep=True, root_moves=[move.uci()], multipv=1
        )
    return before, played, True


def restricted_view(db, analysis, uci):
    """``analysis`` restricted to its own candidate for ``uci``, saved once as an
    analysis of its own: the same search, limits and engine, with that move first.
    None when the search has no line for the move."""
    candidate = next((c for c in analysis.candidates if c["uci"] == uci), None)
    if candidate is None:
        return None
    key = digest({"restricted_view": analysis.id, "root_moves": [uci]})
    existing = db.scalar(select(EngineAnalysis).where(EngineAnalysis.cache_key == key))
    if existing is not None:
        return existing
    # The shared-cache insert: two jobs building the view at once keep one row.
    db.execute(
        keep_shared(
            EngineAnalysis,
            key,
            fen=analysis.fen,
            engine_version=analysis.engine_version,
            config=analysis.config | {"multipv": 1, "root_moves": [uci], "view_of": analysis.id},
            candidates=[candidate],
        )
    )
    return db.scalar(select(EngineAnalysis).where(EngineAnalysis.cache_key == key))


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
