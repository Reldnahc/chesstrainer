from sqlalchemy import select, update

from trainer.chess_core import Candidate, board_facts, digest, evaluation_loss, position_key
from trainer.models import (
    Decision,
    EngineAnalysis,
    Exercise,
    ExerciseAnswer,
    GameReviewMove,
    SkillEvidence,
    SRSState,
    keep_shared,
)
from trainer.policy import MovePolicy
from trainer.review_reports import saved_report
from trainer.search_limits import DEEP


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
    """Cards on ``decision``'s position leave the practice queue while no decision
    there still backs them, and return when a deeper search does again.

    The card keeps its answers and schedule either way: practice must not drill a
    move the review no longer calls a mistake, nor an answer the review's current
    search no longer supports, but rewriting the card would drop answers graded
    during practice. Cards are found by position, so one shared by the same
    mistake in another game stays in the queue while any decision on its position
    backs it, whichever decision made it.
    """
    rows = db.execute(
        select(SRSState, Exercise)
        .join(Exercise, Exercise.id == SRSState.exercise_id)
        .join(Decision, Decision.id == Exercise.decision_id)
        .where(
            Decision.position_key == decision.position_key,
            Decision.user_id == decision.user_id,
            Exercise.source == "game",
        )
    ).all()
    for state, exercise in rows:
        state.eligible = card_is_backed(db, exercise)


def resync_game_cards(db):
    """Recheck every game card against its position's current decisions, once at
    startup, so cards kept by decisions refreshed before this rule (or by any path
    that does not refresh them) follow it too. No engine work: the decisions'
    saved searches already hold everything the check reads."""
    changed = 0
    rows = db.execute(
        select(SRSState, Exercise)
        .join(Exercise, Exercise.id == SRSState.exercise_id)
        .where(Exercise.source == "game", Exercise.decision_id.is_not(None))
    ).all()
    for state, exercise in rows:
        backed = card_is_backed(db, exercise)
        if state.eligible != backed:
            state.eligible, changed = backed, changed + 1
    db.commit()
    return changed


def card_is_backed(db, exercise):
    """Whether a decision on the game card's position is still a mistake and its
    current search still supports the card's primary answer."""
    made_from = db.get(Decision, exercise.decision_id)
    if made_from is None:
        return True
    decisions = db.scalars(
        select(Decision).where(
            Decision.position_key == made_from.position_key,
            Decision.user_id == exercise.user_id,
            Decision.meaningful.is_(True),
        )
    ).all()
    return any(supports_card(db, decision, exercise) for decision in decisions)


def supports_card(db, decision, exercise):
    """Whether ``decision``'s current search still grades the card's primary answer
    correct or acceptable. The answer is judged inside that one search, never
    against scores from another depth, so a search that does not list it cannot
    vouch for it: the card waits, set aside, until a search that does backs it."""
    primary = db.scalar(
        select(ExerciseAnswer).where(
            ExerciseAnswer.exercise_id == exercise.id, ExerciseAnswer.primary.is_(True)
        )
    )
    if primary is None or primary.analysis_id == decision.before_analysis_id:
        return True
    candidates = [
        Candidate.model_validate(c)
        for c in db.get(EngineAnalysis, decision.before_analysis_id).candidates
    ]
    answer = next((c for c in candidates if c.uci == primary.uci), None)
    if answer is None:
        return False
    grade = MovePolicy.model_validate(exercise.policy).grade(
        candidates[0], answer.uci, answer.score
    )
    return grade in {"correct", "acceptable"}


def reviewed_searches(db, engine, board, move, report):
    before = db.get(EngineAnalysis, report["before_analysis_id"])
    played = db.get(EngineAnalysis, report["played_analysis_id"])
    if played.candidates[0]["uci"] != move.uci():
        # The review read the played move from the root search's MultiPV, the
        # same search (and depth) its best move came from. Decisions need the
        # played move first, so that candidate becomes its own restricted view of
        # the search; a new search at other limits would compare two depths.
        played = restricted_view(db, played, move.uci()) or engine().analyze(
            board, DEEP, root_moves=[move.uci()], multipv=1
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
        before = engine.analyze(board, DEEP)
        played = engine.analyze(board, DEEP, root_moves=[move.uci()], multipv=1)
    return before, played, suspicious
