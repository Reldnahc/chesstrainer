import csv

import pytest
from trainer.classification_quality import evaluate_annotations, export_sample


def sample_report():
    return {
        "results": [
            {
                "decision_id": "one",
                "game_id": "game",
                "findings": [{"skill_id": "fork"}, {"skill_id": "missed_material_gain"}],
                "evidence": {
                    "fen": "fixture",
                    "user_move": {"uci": "e2e4"},
                    "evidence_ids": ["a", "b"],
                    "best_candidates": [{"pv": ["d2d4"]}],
                    "played_candidate": {"pv": ["e2e4"]},
                },
            },
            {
                "decision_id": "two",
                "game_id": "game",
                "findings": [],
                "evidence": {
                    "fen": "fixture",
                    "user_move": {"uci": "e2e4"},
                    "evidence_ids": ["c", "d"],
                    "best_candidates": [{"pv": ["d2d4"]}],
                    "played_candidate": {"pv": ["e2e4"]},
                },
            },
        ]
    }


def test_export_is_unlabelled_and_metrics_require_independent_labels(tmp_path):
    path = tmp_path / "sample.csv"
    report = sample_report()
    assert export_sample(report, path, 60) == 2
    assert evaluate_annotations(report, path)["reviewed_decisions"] == 0
    with path.open(newline="", encoding="utf-8") as source:
        rows = list(csv.DictReader(source))
    assert len({r["split"] for r in rows}) == 1  # Game-level split.
    for row in rows:
        row["fully_labeled"] = "yes"
        row["expected_mechanisms"] = "pin" if row["decision_id"] == "two" else ""
        row["expected_outcomes"] = "missed_material_gain" if row["decision_id"] == "one" else ""
    with path.open("w", newline="", encoding="utf-8") as target:
        writer = csv.DictWriter(target, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    result = evaluate_annotations(report, path)
    assert result["reviewed_decisions"] == 2
    assert result["metrics"]["outcomes"]["precision"] == 1
    assert result["metrics"]["mechanisms"] == {
        "tp": 0,
        "fp": 1,
        "fn": 1,
        "decisions": 2,
        "precision": 0.0,
        "recall": 0.0,
    }
    report["results"][0]["evidence"]["evidence_ids"] = ["new", "b"]
    with pytest.raises(ValueError, match="Evidence changed"):
        evaluate_annotations(report, path)
