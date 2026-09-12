"""Human-labeling export and explicit reviewed-subset metrics; no inferred gold labels."""

import csv
import hashlib
import json
from collections import Counter, defaultdict

from trainer.coverage import MECHANISM_SKILLS
from trainer.diagnosis_types import OUTCOME_SKILLS

FIELDS = [
    "decision_id",
    "game_id",
    "split",
    "stratum",
    "fen",
    "user_move",
    "evidence_ids",
    "best_pv",
    "actual_pv",
    "best_score",
    "actual_score",
    "predicted_outcomes",
    "predicted_mechanisms",
    "expected_outcomes",
    "expected_mechanisms",
    "fully_labeled",
    "notes",
]


def predicted(row):
    return {f["skill_id"] for f in row["findings"]}


def export_sample(report, path, size=60):
    if size < 1:
        raise ValueError("Sample size must be positive")
    frequencies = Counter(
        skill for row in report["results"] for skill in predicted(row) & MECHANISM_SKILLS
    )
    buckets = defaultdict(list)
    for row in report["results"]:
        labels = predicted(row)
        motifs = labels & MECHANISM_SKILLS
        stratum = (
            min(motifs, key=lambda skill: (frequencies[skill], skill))
            if motifs
            else "outcome_only"
            if labels & OUTCOME_SKILLS
            else "unclassified"
        )
        buckets[stratum].append(row)
    for rows in buckets.values():
        rows.sort(key=lambda row: hashlib.sha256(row["decision_id"].encode()).hexdigest())
    selected = []
    # Sample rare motifs alongside common outcomes and abstentions. Report metrics
    # apply to this stratified subset, not an unweighted population estimate.
    while buckets and len(selected) < size:
        for stratum in sorted(buckets):
            row = buckets[stratum].pop(0)
            selected.append((stratum, row))
            if not buckets[stratum]:
                del buckets[stratum]
            if len(selected) == size:
                break
    with path.open("x", newline="", encoding="utf-8") as output:
        writer = csv.DictWriter(output, fieldnames=FIELDS)
        writer.writeheader()
        for stratum, row in selected:
            payload, labels = row["evidence"], predicted(row)
            writer.writerow(
                {
                    "decision_id": row["decision_id"],
                    "game_id": row["game_id"],
                    # All positions from a game stay on one side of the split.
                    "split": "holdout"
                    if int(hashlib.sha256(row["game_id"].encode()).hexdigest()[:8], 16) % 5 == 0
                    else "development",
                    "stratum": stratum,
                    "fen": payload["fen"],
                    "user_move": payload["user_move"]["uci"],
                    "evidence_ids": json.dumps(payload["evidence_ids"]),
                    "best_pv": " ".join(payload["best_candidates"][0]["pv"]),
                    "actual_pv": " ".join(payload["played_candidate"]["pv"]),
                    "best_score": json.dumps(payload["best_candidates"][0].get("score")),
                    "actual_score": json.dumps(payload["played_candidate"].get("score")),
                    "predicted_outcomes": ";".join(sorted(labels & OUTCOME_SKILLS)),
                    "predicted_mechanisms": ";".join(sorted(labels & MECHANISM_SKILLS)),
                }
            )
    return len(selected)


def evaluate_annotations(report, path):
    results = {r["decision_id"]: r for r in report["results"]}
    groups = defaultdict(lambda: Counter(tp=0, fp=0, fn=0, decisions=0))
    seen = set()
    with path.open(newline="", encoding="utf-8-sig") as source:
        for annotation in csv.DictReader(source):
            marker = annotation["fully_labeled"].strip().lower()
            if marker not in {"", "yes", "no"}:
                raise ValueError("fully_labeled must be yes, no, or blank")
            if marker != "yes":
                continue
            decision_id = annotation["decision_id"]
            if decision_id not in results or decision_id in seen:
                raise ValueError("Annotation contains an unknown or duplicate decision")
            seen.add(decision_id)
            row = results[decision_id]
            if json.loads(annotation["evidence_ids"]) != row["evidence"]["evidence_ids"]:
                raise ValueError(
                    "Evidence changed since this sample was exported; review a fresh sample"
                )
            labels = predicted(row)
            for field, allowed in (("outcomes", OUTCOME_SKILLS), ("mechanisms", MECHANISM_SKILLS)):
                expected = {
                    s.strip() for s in annotation[f"expected_{field}"].split(";") if s.strip()
                }
                if not expected <= allowed:
                    raise ValueError(f"Unknown {field} in human annotation")
                actual = labels & allowed
                split = (
                    "holdout"
                    if int(hashlib.sha256(row["game_id"].encode()).hexdigest()[:8], 16) % 5 == 0
                    else "development"
                )
                for group in (field, f"{split}_{field}"):
                    groups[group].update(
                        tp=len(expected & actual),
                        fp=len(actual - expected),
                        fn=len(expected - actual),
                        decisions=1,
                    )
    metrics = {}
    for key, count in groups.items():
        tp, fp, fn = count["tp"], count["fp"], count["fn"]
        metrics[key] = dict(count) | {
            "precision": tp / (tp + fp) if tp + fp else None,
            "recall": tp / (tp + fn) if tp + fn else None,
        }
    return {
        "reviewed_decisions": len(seen),
        "metrics": metrics,
        "note": "Only fully human-labeled rows count. Stratified sample metrics are not population accuracy. Empty denominators remain unknown.",
    }
