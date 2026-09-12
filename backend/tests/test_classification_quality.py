import csv
import json

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


def write_rows(path, rows):
    with path.open("w", newline="", encoding="utf-8") as target:
        writer = csv.DictWriter(target, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)


def test_blind_export_hides_predictions_and_query_names(tmp_path):
    report = sample_report()
    report["results"][0]["evidence"]["probes"] = [
        {
            "kind": "relative_pin",
            "query_key": "secret-hypothesis",
            "root_analysis_id": "a",
            "at_ply": 1,
            "analysis_id": "probe",
            "fen": "fixture",
            "candidate": {"uci": "e7e5", "pv": ["e7e5"]},
            "config": {"root_moves": ["e7e5"]},
        }
    ]
    path = tmp_path / "blind.csv"
    export_sample(report, path, blind=True)
    text = path.read_text(encoding="utf-8")
    assert "predicted_" not in text and "stratum" not in text
    assert "relative_pin" not in text and "secret-hypothesis" not in text
    with path.open(newline="", encoding="utf-8") as source:
        rows = list(csv.DictReader(source))
    assert all(row["review_protocol"] == "blinded" and not row["fully_labeled"] for row in rows)
    assert json.loads(next(row for row in rows if row["decision_id"] == "one")["verified_probes"])[
        0
    ]["root_moves"] == ["e7e5"]
    with pytest.raises(FileExistsError):
        export_sample(report, path, blind=True)


def test_assistant_annotations_are_separate_and_fingerprinted(tmp_path):
    report = sample_report()
    path = tmp_path / "blind.csv"
    export_sample(report, path, blind=True)
    with path.open(newline="", encoding="utf-8") as source:
        rows = list(csv.DictReader(source))
    for row in rows:
        if row["decision_id"] == "one":
            row.update(
                fully_labeled="yes",
                expected_outcomes="missed_material_gain",
                expected_mechanisms="fork",
                reviewer_kind="assistant",
                reviewer_id="Fixture reviewer",
            )
        else:
            row.update(fully_labeled="no", notes="Uncertain; do not infer a negative label.")
    write_rows(path, rows)
    with pytest.raises(ValueError, match="Do not mix"):
        evaluate_annotations(report, path)
    evaluated = evaluate_annotations(report, path, reviewer_kind="assistant")
    assert evaluated["reviewed_decisions"] == 1 and evaluated["reviewer_kind"] == "assistant"
    assert evaluated["protocols"] == {"blinded": 1}
    assert evaluated["labels"]["fork"]["precision"] == 1
    assert "not independent human" in evaluated["note"]
    report["results"][0]["evidence"]["best_candidates"][0]["pv"] = ["g1f3"]
    with pytest.raises(ValueError, match="Evidence changed"):
        evaluate_annotations(report, path, reviewer_kind="assistant")


def test_assistant_identity_is_required_and_unknown_labels_fail(tmp_path):
    report = sample_report()
    path = tmp_path / "blind.csv"
    export_sample(report, path, blind=True)
    with path.open(newline="", encoding="utf-8") as source:
        rows = list(csv.DictReader(source))
    rows[0]["fully_labeled"] = "yes"
    write_rows(path, rows)
    with pytest.raises(ValueError, match="reviewer ID"):
        evaluate_annotations(report, path, reviewer_kind="assistant")
    rows[0]["expected_mechanisms"] = "invented_skill"
    write_rows(path, rows)
    with pytest.raises(ValueError, match="Unknown mechanisms"):
        evaluate_annotations(report, path, reviewer_kind="assistant", reviewer_id="Fixture")
