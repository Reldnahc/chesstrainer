"""Finite nominations from baseline facts only; refined outputs never nominate themselves."""

from trainer.chess_core import Score, digest, evaluation_loss
from trainer.review_intelligence.difficulty import assess_difficulty

VERSION = "refinement-1"


def settings_key(settings):
    return {
        key: getattr(settings, key)
        for key in (
            "review_refinement_positions",
            "review_refinement_queries",
            "review_refinement_depth",
            "review_refinement_time",
            "review_refinement_multipv",
            "stockfish_threads",
            "stockfish_hash_mb",
        )
    }


def nominate(report):
    best = Score.model_validate(report["best"]["score"])
    loss = evaluation_loss(
        best,
        Score.model_validate(report["actual"]["score"]),
    )
    practical = assess_difficulty(report)
    triggers = []
    if loss.allows_mate or loss.mate_lost:
        triggers.append((1000, "mate_transition"))
    if (loss.cp or 0) >= 150:
        triggers.append((800 + min(loss.cp, 500) / 10, "large_concession"))
    if report.get("sacrifice"):
        triggers.append((780, "verify_sacrifice"))
    if practical.components.only_good_move_at_depth:
        triggers.append((760, "narrow_resource"))
    if (
        not (loss.mate_lost or loss.allows_mate)
        and not (best.kind == "mate" and best.value == 1)
        and (loss.cp or 0) <= 20
        and report.get("second_score") is not None
    ):
        gap = evaluation_loss(best, Score.model_validate(report["second_score"]))
        if (gap.cp or 0) >= 120 or gap.mate_lost or gap.allows_mate:
            triggers.append((740, "critical_alternative"))
    if practical.best_naturalness == "unusual":
        triggers.append((700, "human_disagreement"))
    if (loss.cp or 0) >= 100 and not report["actual_line"]["findings"]:
        triggers.append((680, "unexplained_concession"))
    if loss.cp is not None and any(
        abs(loss.cp - boundary) <= 10 for boundary in (50, 100, 200, 300)
    ):
        triggers.append((500, "grade_boundary"))
    if report.get("opportunity_missed"):
        triggers.append((720, "verify_opportunity"))
    return sorted(triggers, reverse=True)


def selection(reports, settings):
    choices = []
    for ply, report in reports.items():
        reasons = nominate(report)
        if reasons:
            choices.append((reasons[0][0], ply, [reason for _, reason in reasons]))
    choices.sort(key=lambda row: (-row[0], row[1]))
    return [(ply, reasons) for _, ply, reasons in choices[: settings.review_refinement_positions]]


def plan_key(reports, settings):
    return digest(
        {
            "version": VERSION,
            "settings": settings_key(settings),
            "baseline": {
                ply: [
                    report["before_analysis_id"],
                    report["played_analysis_id"],
                    (report.get("human") or {}).get("evidence_id"),
                    (report.get("human") or {}).get("configuration_key"),
                ]
                for ply, report in reports.items()
            },
        }
    )
