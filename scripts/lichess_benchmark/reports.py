"""Positive-only metrics. Absent Lichess themes are NEVER negative ground truth."""

from collections import Counter
from dataclasses import dataclass, field

LIMITATIONS = [
    "Positive theme agreement only: absent tags are not negative ground truth. "
    "No precision, specificity or false-positive rate is estimated.",
    "Lichess tags are automated and player-refined external labels, not infallible human gold. "
    "Fieldwork now reuses the pinned Lichess tagger: this is partly generator compatibility, "
    "not an independent validation of the reused rules.",
    "This tests the shared line-pattern detector, not full mistake-classifier recall. "
    "No alternative-move scores or native defensive searches are available from this CSV.",
    "Visible material gains can be unsettled; terminal mate is verified by legal replay. "
    "Outcome support is a benchmark adapter assumption, not an engine evaluation.",
    "Any-solver-episode agreement differs from attributing a theme to the first move. "
    "Initial-episode agreement is reported separately.",
    "Curated puzzle agreement does not establish real-game precision, psychological cause, "
    "strategic diagnosis or learning improvement. Stratified blinded human review remains separate.",
]


def percentage(numerator: int, denominator: int) -> float | None:
    return round(100 * numerator / denominator, 3) if denominator else None


@dataclass
class Metrics:
    candidates: int = 0
    sampled: int = 0
    reconstructed: int = 0
    detected: int = 0
    initial_episode_detected: int = 0
    skipped: int = 0
    disagreements: int = 0
    skip_reasons: Counter = field(default_factory=Counter)
    miss_reasons: Counter = field(default_factory=Counter)

    def observe(self, result: dict):
        self.sampled += 1
        if result["status"] == "skipped":
            self.skipped += 1
            self.skip_reasons[result["reason"]] += 1
        else:
            self.reconstructed += 1
            if result["status"] == "detected":
                self.detected += 1
                self.initial_episode_detected += result["initial_episode_detected"]
            elif result["status"] == "missed":
                self.disagreements += 1
                self.miss_reasons[result["reason"]] += 1
            else:
                raise ValueError(
                    "Detector errors cannot be folded into completed benchmark metrics"
                )

    def payload(self) -> dict:
        assert self.sampled == self.reconstructed + self.skipped
        assert self.reconstructed == self.detected + self.disagreements
        return {
            "candidates": self.candidates,
            "sampled": self.sampled,
            "reconstructed": self.reconstructed,
            "detected": self.detected,
            "initial_episode_detected": self.initial_episode_detected,
            "skipped": self.skipped,
            "disagreements": self.disagreements,
            "positive_agreement_pct": percentage(self.detected, self.reconstructed),
            "initial_episode_agreement_pct": percentage(
                self.initial_episode_detected, self.reconstructed
            ),
            "reconstruction_pct": percentage(self.reconstructed, self.sampled),
            "sample_detection_pct_including_skips": percentage(self.detected, self.sampled),
            "skip_reasons": dict(sorted(self.skip_reasons.items())),
            "miss_reasons": dict(sorted(self.miss_reasons.items())),
        }


def summaries(rows: list[dict]) -> dict:
    # A multi-tag puzzle contributes multiple theme-puzzle incidences. Never
    # disguise this pooled denominator as unique-puzzle accuracy.
    result = {}
    for relationship in ("exact", "approximate"):
        values = [
            row["metrics"]
            for row in rows
            if row["selected"] and row["relationship"] == relationship
        ]
        usable = [value for value in values if value["reconstructed"]]
        denominator = sum(value["reconstructed"] for value in usable)
        result[relationship] = {
            "unit": "theme-puzzle incidence; overlapping puzzles may be counted more than once",
            "motifs_with_reconstructed_samples": len(usable),
            "motifs_without_reconstructed_samples": len(values) - len(usable),
            "reconstructed": denominator,
            "detected": sum(value["detected"] for value in usable),
            "micro_positive_agreement_pct": percentage(
                sum(value["detected"] for value in usable), denominator
            ),
            "macro_positive_agreement_pct": round(
                sum(100 * value["detected"] / value["reconstructed"] for value in usable)
                / len(usable),
                3,
            )
            if usable
            else None,
        }
    return result


def display(value) -> str:
    return "n/a" if value is None else f"{value:.2f}%"


def markdown(report: dict) -> str:
    lines = [
        "# Lichess positive-theme benchmark",
        "",
        f"Status: {report['status']}. Rule version: {report['detector']['rule_version']}.",
        f"Input: {report['input']['name']} ({report['input']['rows_seen']:,} CSV rows).",
        f"Input SHA256: {report['input']['sha256']}",
        f"Seed: {report['configuration']['seed']}; requested per theme: "
        f"{report['configuration']['samples_per_motif']}.",
        "",
        "Agreement = detected / successfully reconstructed sampled positives. Valid short or "
        "unsettled lines that do not emit a witness remain disagreements. Skips are shown, "
        "not replenished. These are not precision or false-positive measurements.",
        "",
    ]
    for relation, title in (
        ("exact", "Exact event mappings"),
        ("approximate", "Approximate mappings"),
    ):
        lines += [
            f"## {title}",
            "",
            "| Theme -> skill | Candidates | Sampled | Replayed | Detected | Agreement | "
            "Initial episode | Skipped | Missed |",
            "|---|---:|---:|---:|---:|---:|---:|---:|---:|",
        ]
        for row in report["mappings"]:
            if row["relationship"] != relation or not row["selected"]:
                continue
            m = row["metrics"]
            lines.append(
                f"| {row['theme']} -> {row['skill']} | {m['candidates']} | "
                f"{m['sampled']} | {m['reconstructed']} | {m['detected']} | "
                f"{display(m['positive_agreement_pct'])} | "
                f"{display(m['initial_episode_agreement_pct'])} | "
                f"{m['skipped']} | {m['disagreements']} |"
            )
        summary = report["summaries"][relation]
        lines += [
            "",
            f"Macro: {display(summary['macro_positive_agreement_pct'])}; "
            f"micro: {display(summary['micro_positive_agreement_pct'])}. "
            f"{summary['motifs_without_reconstructed_samples']} selected themes have no "
            "reconstructed samples and are excluded from macro averaging. "
            "Micro pools theme-puzzle incidences, not unique puzzles.",
            "",
        ]
    lines += [
        "## Mapping semantics and eligibility",
        "",
        "| Theme | Fieldwork skill | Relationship | Selected | Candidates | Semantics |",
        "|---|---|---|---|---:|---|",
    ]
    for row in report["mappings"]:
        lines.append(
            f"| {row['theme']} | {row['skill'] or '-'} | {row['relationship']} | "
            f"{row['selected']} | {row['metrics']['candidates']} | {row['semantics']} |"
        )
    lines += [
        "",
        "Unsupported mappings have no agreement metric. Eligible but unselected "
        "mappings are counted during the scan but not evaluated.",
        "",
        "## Files and interpretation",
        "",
        "- report.json: configuration, file/source fingerprints, mappings, counts and summaries.",
        "- samples.jsonl: every sampled theme-puzzle incidence, including witness/context data.",
        "- failures.jsonl: every missed or skipped positive, with the same reproducible context.",
        "",
        "Witness plies are relative to the solver line (first solver move = 1); "
        "dataset Moves token numbers are one larger because token 1 is the setup move.",
        "",
        "## Limits",
        "",
    ]
    lines.extend(f"- {note}" for note in report["limitations"])
    return "\n".join(lines) + "\n"
