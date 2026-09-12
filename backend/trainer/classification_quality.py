"""Blinded offline assessment with explicit human/assistant reviewer provenance."""

import csv
import hashlib
import json
from collections import Counter, defaultdict

from trainer.chess_core import digest
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
    "evidence_fingerprint",
    "previous_move",
    "verified_probes",
    "best_pv",
    "actual_pv",
    "best_score",
    "actual_score",
    "predicted_outcomes",
    "predicted_mechanisms",
    "expected_outcomes",
    "expected_mechanisms",
    "fully_labeled",
    "reviewer_kind",
    "reviewer_id",
    "review_protocol",
    "reviewed_at",
    "notes",
]


def predicted(row):
    return {f["skill_id"] for f in row["findings"]}


def export_sample(report, path, size=60, *, blind=False):
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
    if blind:
        selected.sort(
            key=lambda item: hashlib.sha256(
                ("blind-order:" + item[1]["decision_id"]).encode()
            ).hexdigest()
        )
    fields = [
        f
        for f in FIELDS
        if not blind or f not in {"stratum", "predicted_outcomes", "predicted_mechanisms"}
    ]
    with path.open("x", newline="", encoding="utf-8") as output:
        writer = csv.DictWriter(output, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        for stratum, row in selected:
            payload, labels = row["evidence"], predicted(row)
            best_pv = payload["best_candidates"][0]["pv"]
            actual_pv = payload["played_candidate"]["pv"]
            if any(p["kind"] == "tail" for p in payload.get("probes", [])):
                from trainer.chess_core import Candidate, valid_board
                from trainer.continuations import extended_line

                best_pv = extended_line(
                    valid_board(payload["fen"]),
                    Candidate.model_validate(payload["best_candidates"][0]),
                    payload["evidence_ids"][0],
                    payload["probes"],
                )[0].pv
                actual_pv = extended_line(
                    valid_board(payload["fen"]),
                    Candidate.model_validate(payload["played_candidate"]),
                    payload["evidence_ids"][1],
                    payload["probes"],
                )[0].pv
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
                    "evidence_fingerprint": digest(payload),
                    "previous_move": json.dumps(payload.get("previous_move")),
                    # Query names would leak the suspected pattern. Only the raw
                    # verified position, move constraints and continuation belong here.
                    "verified_probes": json.dumps(
                        [
                            {
                                k: p[k]
                                for k in (
                                    "root_analysis_id",
                                    "at_ply",
                                    "analysis_id",
                                    "fen",
                                    "candidate",
                                )
                            }
                            | {"root_moves": p["config"].get("root_moves")}
                            for p in payload.get("probes", [])
                        ]
                    ),
                    "best_pv": " ".join(best_pv),
                    "actual_pv": " ".join(actual_pv),
                    "best_score": json.dumps(payload["best_candidates"][0].get("score")),
                    "actual_score": json.dumps(payload["played_candidate"].get("score")),
                    "predicted_outcomes": ";".join(sorted(labels & OUTCOME_SKILLS)),
                    "predicted_mechanisms": ";".join(sorted(labels & MECHANISM_SKILLS)),
                    "review_protocol": "blinded" if blind else "visible_predictions",
                }
            )
    return len(selected)


def evaluate_annotations(report, path, *, reviewer_kind="human", reviewer_id=None):
    if reviewer_kind not in {"human", "assistant"}:
        raise ValueError("Reviewer kind must be human or assistant")
    results = {r["decision_id"]: r for r in report["results"]}
    groups = defaultdict(lambda: Counter(tp=0, fp=0, fn=0, decisions=0))
    seen = set()
    label_counts = defaultdict(lambda: Counter(tp=0, fp=0, fn=0))
    protocols = Counter()
    reviewers = set()
    with path.open(newline="", encoding="utf-8-sig") as source:
        for annotation in csv.DictReader(source):
            marker = annotation["fully_labeled"].strip().lower()
            if marker not in {"", "yes", "no"}:
                raise ValueError("fully_labeled must be yes, no, or blank")
            if marker != "yes":
                continue
            kind = annotation.get("reviewer_kind", "").strip() or reviewer_kind
            if kind != reviewer_kind:
                raise ValueError("Do not mix human and assistant annotations in one evaluation")
            identity = annotation.get("reviewer_id", "").strip() or reviewer_id
            if reviewer_kind == "assistant" and not identity:
                raise ValueError("Assistant annotations require a reviewer ID")
            if identity:
                reviewers.add(identity)
            protocols[annotation.get("review_protocol", "unknown")] += 1
            decision_id = annotation["decision_id"]
            if decision_id not in results or decision_id in seen:
                raise ValueError("Annotation contains an unknown or duplicate decision")
            seen.add(decision_id)
            row = results[decision_id]
            if json.loads(annotation["evidence_ids"]) != row["evidence"]["evidence_ids"] or (
                annotation.get("evidence_fingerprint")
                and annotation["evidence_fingerprint"] != digest(row["evidence"])
            ):
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
                for skill in expected | actual:
                    label_counts[skill].update(
                        tp=int(skill in expected & actual),
                        fp=int(skill in actual - expected),
                        fn=int(skill in expected - actual),
                    )
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
        "reviewer_kind": reviewer_kind,
        "reviewer_ids": sorted(reviewers),
        "protocols": dict(protocols),
        "metrics": metrics,
        "labels": {
            skill: dict(c)
            | {
                "precision": c["tp"] / (c["tp"] + c["fp"]) if c["tp"] + c["fp"] else None,
                "recall": c["tp"] / (c["tp"] + c["fn"]) if c["tp"] + c["fn"] else None,
            }
            for skill, c in sorted(label_counts.items())
        },
        "note": (
            "Agreement with assistant annotations; this is not independent human ground truth. "
            if reviewer_kind == "assistant"
            else "Only explicitly completed human annotations count. "
        )
        + "Uncertain/incomplete rows are excluded. Stratified subset metrics are not population accuracy; empty denominators remain unknown.",
    }
