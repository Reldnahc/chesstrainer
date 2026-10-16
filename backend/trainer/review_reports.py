"""Read effective review facts while retaining immutable baseline and investigation records."""

from collections import defaultdict

from sqlalchemy import and_, case, func, select

from trainer.game_review import lines_current, link_previous_scores
from trainer.human_models.evidence import policy_summary
from trainer.human_models.types import HumanEvidence, HumanPolicy
from trainer.models import GameReview, GameReviewMove, HumanAnalysis, ReviewRefinement
from trainer.review_intelligence.refinement_plan import VERSION as REFINEMENT_VERSION


def touch_report(db, row):
    review = db.get(GameReview, row.game_id)
    review.revision += 1
    row.revision = review.revision


def stale_adopted(db, game_id, parameters):
    """Adopted refinement reports, which the review shows over the baseline,
    whose lines were read to another horizon than ``parameters``."""
    return [
        task
        for task in db.scalars(
            select(ReviewRefinement).where(
                ReviewRefinement.game_id == game_id,
                ReviewRefinement.adopted.is_(True),
                ReviewRefinement.status == "completed",
            )
        )
        if task.report and not lines_current(task.report, parameters)
    ]


def _belongs():
    """The refinement row was asked about this exact review move and its searches."""
    base = GameReviewMove.report
    return and_(
        ReviewRefinement.game_id == GameReviewMove.game_id,
        ReviewRefinement.ply == GameReviewMove.ply,
        ReviewRefinement.config["baseline_ids"][0].as_string()
        == base["before_analysis_id"].as_string(),
        ReviewRefinement.config["baseline_ids"][1].as_string()
        == base["played_analysis_id"].as_string(),
    )


def adopted():
    """The one statement of when the review shows a refinement's report over the
    baseline: it belongs to the move, was adopted, completed, and saved a report.

    Every reader of the effective report uses it, in SQL: the game page and
    training through ``reports_for``, library and Insights accuracy through
    ``load_accuracy_scores``.
    """
    refined = ReviewRefinement.report
    return and_(
        _belongs(),
        ReviewRefinement.adopted.is_(True),
        ReviewRefinement.status == "completed",
        # A JSON null is stored as text and an empty object has nothing to show.
        func.json_type(refined) == "object",
        func.json(refined) != "{}",
    )


def reports_for(db, game_id, plies=None):
    """{ply: report} for a game's saved review moves, as the review shows them."""
    statement = (
        select(
            GameReviewMove,
            ReviewRefinement,
            func.coalesce(_belongs(), False),
            func.coalesce(adopted(), False),
        )
        .outerjoin(ReviewRefinement, GameReviewMove.refinement_id == ReviewRefinement.id)
        .where(GameReviewMove.game_id == game_id)
        .order_by(GameReviewMove.ply)
    )
    if plies is not None:
        statement = statement.where(GameReviewMove.ply.in_(plies))
    rows = db.execute(statement).all()
    return {
        row.ply: effective_report(db, row, task, belongs, shown)
        for row, task, belongs, shown in rows
    }, {row.ply: row.revision for row, *_ in rows}


def effective_report(db, row, task, belongs, shown):
    """The report for ``row``; ``belongs`` and ``shown`` come from ``adopted`` above."""
    baseline = row.report
    if not belongs:
        task = None
    report = dict(task.report if shown else baseline)
    if task:
        report["refinement"] = dict(
            version=REFINEMENT_VERSION,
            task_id=task.id,
            status=task.status,
            triggers=task.triggers,
            adopted=task.adopted,
            reason=task.reason,
            baseline_depth=baseline["depth"],
            refined_depth=task.report.get("depth") if task.report else None,
            queries=len(task.queries),
        )
    human = baseline.get("human")
    if human:
        report["human"] = dict(human)
        if report["best"]["uci"] != baseline["best"]["uci"]:
            cached = db.get(HumanAnalysis, row.human_analysis_id) if row.human_analysis_id else None
            if cached:
                report["human"] = HumanEvidence.model_validate(
                    human
                    | policy_summary(
                        HumanPolicy.model_validate(cached.policy),
                        report["actual"]["uci"],
                        report["best"]["uci"],
                    )
                ).model_dump(mode="json")
            else:
                report["human"]["engine_best"] = None
    return report


def load_game_reports(db, game_id):
    reports, revisions = reports_for(db, game_id)
    return link_previous_scores(reports), revisions


def load_accuracy_scores(db, game_ids):
    """One page query, selecting score fragments rather than full tactical witnesses."""
    saved = defaultdict(dict)
    if not game_ids:
        return saved
    base, refined = GameReviewMove.report, ReviewRefinement.report
    shown = adopted()
    statement = select(
        GameReviewMove.game_id,
        GameReviewMove.ply,
        case((shown, refined["white_score"]), else_=base["white_score"]),
        case((shown, refined["best"]["score"]), else_=base["best"]["score"]),
    ).outerjoin(ReviewRefinement, GameReviewMove.refinement_id == ReviewRefinement.id)
    game_ids = list(game_ids)
    # Chunked: a whole library's ids would exceed SQLite's bound-parameter limit.
    for start in range(0, len(game_ids), 500):
        chunk = game_ids[start : start + 500]
        for game_id, ply, white_score, best_score in db.execute(
            statement.where(GameReviewMove.game_id.in_(chunk))
        ):
            saved[game_id][ply] = {"white_score": white_score, "best": {"score": best_score}}
    return saved
