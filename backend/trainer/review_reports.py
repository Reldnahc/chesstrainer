"""Read effective review facts while retaining immutable baseline and investigation records."""

from collections import defaultdict

from sqlalchemy import and_, case, select

from trainer.chess_core import Score
from trainer.human_models.evidence import policy_summary
from trainer.human_models.types import HumanEvidence, HumanPolicy
from trainer.models import GameReview, GameReviewMove, HumanAnalysis, ReviewRefinement


def touch_report(db, row):
    review = db.get(GameReview, row.game_id)
    review.revision += 1
    row.revision = review.revision


def effective_report(db, row, task):
    baseline = row.report
    if task and (
        (task.game_id, task.ply) != (row.game_id, row.ply)
        or task.config["baseline_ids"]
        != [baseline["before_analysis_id"], baseline["played_analysis_id"]]
    ):
        task = None
    report = dict(
        task.report
        if task and task.adopted and task.status == "completed" and task.report
        else baseline
    )
    if task:
        report["refinement"] = dict(
            version="refinement-1",
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
    rows = db.execute(
        select(GameReviewMove, ReviewRefinement)
        .outerjoin(ReviewRefinement, GameReviewMove.refinement_id == ReviewRefinement.id)
        .where(GameReviewMove.game_id == game_id)
        .order_by(GameReviewMove.ply)
    ).all()
    reports = {}
    previous = None
    for row, task in rows:
        report = effective_report(db, row, task)
        # Great/recovery comparisons must use the same generation as displayed scores.
        report["previous_score"] = previous.model_dump() if previous else None
        previous = Score.model_validate(report["best"]["score"]).negate()
        reports[row.ply] = report
    return reports, {row.ply: row.revision for row, _ in rows}


def load_accuracy_scores(db, game_ids):
    """One page query, selecting score fragments rather than full tactical witnesses."""
    saved = defaultdict(dict)
    if not game_ids:
        return saved
    base, refined = GameReviewMove.report, ReviewRefinement.report
    adopted = and_(
        ReviewRefinement.adopted.is_(True),
        ReviewRefinement.status == "completed",
        ReviewRefinement.game_id == GameReviewMove.game_id,
        ReviewRefinement.ply == GameReviewMove.ply,
        ReviewRefinement.config["baseline_ids"][0].as_string()
        == base["before_analysis_id"].as_string(),
        ReviewRefinement.config["baseline_ids"][1].as_string()
        == base["played_analysis_id"].as_string(),
        refined.is_not(None),
    )
    rows = db.execute(
        select(
            GameReviewMove.game_id,
            GameReviewMove.ply,
            case((adopted, refined["white_score"]), else_=base["white_score"]),
            case((adopted, refined["best"]["score"]), else_=base["best"]["score"]),
        )
        .outerjoin(ReviewRefinement, GameReviewMove.refinement_id == ReviewRefinement.id)
        .where(GameReviewMove.game_id.in_(game_ids))
    )
    for game_id, ply, white_score, best_score in rows:
        saved[game_id][ply] = {"white_score": white_score, "best": {"score": best_score}}
    return saved
