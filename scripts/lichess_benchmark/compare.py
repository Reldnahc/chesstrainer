"""Replay frozen samples through raw upstream recognition and Fieldwork admission.

Related upstream-generated positive tags measure compatibility, not independent
precision. Missing tags never become negatives. No scores/engine calls invented.
Run: python -m scripts.lichess_benchmark.compare --samples ... --output ...
"""

import argparse
import hashlib
import json
from dataclasses import asdict
from pathlib import Path
from time import monotonic

from trainer.lichess_patterns import recognize

from .dataset import PuzzleRow
from .detector import detector_metadata
from .positions import ReconstructionError, reconstruct
from .reports import LIMITATIONS, Metrics, display, summaries
from .runner import evaluate, write_json
from .themes import BY_THEME, MAPPING_VERSION


def raw_result(row, theme):
    try:
        line = reconstruct(row)
    except ReconstructionError as exc:
        return {"status": "skipped", "reason": exc.reason, "detail": str(exc)}
    result = recognize(line.boards, 1, len(line.boards) - 1, row.puzzle_id)
    return {
        "status": "detected" if theme in result.themes else "missed",
        "reason": None if theme in result.themes else "upstream_predicate_false",
        "initial_episode_detected": False,  # Not measured for whole-line predicates.
        "themes": result.themes,
        "witnesses": [asdict(w) for w in result.witnesses],
        "context_skips": result.skipped,
    }


def markdown(report):
    lines = [
        "# Frozen-sample Lichess reuse comparison",
        "",
        "Positive-tag agreement only. Raw upstream results partly measure compatibility "
        "with a related label generator, NOT independent precision or full mistake recall.",
        "Fieldwork admission uses observed puzzle-line outcomes, not Stockfish scores.",
        "",
        f"Samples SHA256: {report['samples_sha256']}",
        f"Rule version: {report['detector']['rule_version']}",
        "",
        "| Theme | Mapping | Sampled | Replayed | Baseline | Raw upstream | Fieldwork admission |",
        "|---|---|---:|---:|---:|---:|---:|",
    ]
    for row in report["mappings"]:
        m = row["metrics"]
        lines.append(
            f"| {row['theme']} | {row['relationship']} | {m['current']['sampled']} | "
            f"{m['current']['reconstructed']} | "
            f"{display(m['baseline']['positive_agreement_pct'])} | "
            f"{display(m['upstream']['positive_agreement_pct'])} | "
            f"{display(m['current']['positive_agreement_pct'])} |"
        )
    lines += ["", "## Interpretation", ""]
    lines += [f"- {note}" for note in report["limitations"]]
    lines += [
        "",
        "Each metric divides detections by reconstructed sampled positives; skip and "
        "disagreement counts, exact/approximate macro/micro summaries and initial-episode "
        "results for Fieldwork are in report.json. Raw upstream has no initial-episode metric.",
        "comparisons.jsonl preserves baseline and current records plus raw upstream witnesses. "
        "failures.jsonl contains every incidence missed or skipped by either current path. "
        "Unexpected detector errors fail the run instead of disappearing into skips.",
    ]
    return "\n".join(lines) + "\n"


def compare(samples: Path, output: Path, progress=None):
    if output.exists():
        raise ValueError(f"Output directory exists; choose a NEW path: {output}")
    if not samples.is_file():
        raise ValueError(f"Samples file not found: {samples}")
    baseline_path = samples.with_name("report.json")
    baseline = json.loads(baseline_path.read_text(encoding="utf-8"))
    if baseline.get("status") != "complete":
        raise ValueError("A completed baseline report.json must accompany samples")
    source_mappings = {m["theme"]: m for m in baseline["mappings"] if m["selected"]}
    if not source_mappings or any(
        t not in BY_THEME or not BY_THEME[t].eligible for t in source_mappings
    ):
        raise ValueError("Baseline selects unsupported or unknown themes")
    counters = {
        t: {
            name: Metrics(candidates=m["metrics"]["candidates"])
            for name in ("baseline", "upstream", "current")
        }
        for t, m in source_mappings.items()
    }
    report = {
        "status": "incomplete",
        "comparison_schema_version": "1",
        "mapping_version": MAPPING_VERSION,
        "detector": detector_metadata(),
        "baseline": baseline,
        "limitations": LIMITATIONS,
        "comparison_source_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
    }
    output.mkdir(parents=True, exist_ok=False)
    write_json(output / "report.json", report)
    fingerprint = hashlib.sha256()
    started = monotonic()
    total = 0
    try:
        with (
            samples.open("rb") as source,
            (output / "comparisons.jsonl").open("x", encoding="utf-8", newline="\n") as records,
            (output / "failures.jsonl").open("x", encoding="utf-8", newline="\n") as failures,
        ):
            for number, encoded in enumerate(source, 1):
                fingerprint.update(encoded)
                previous = json.loads(encoded)
                theme = previous["expected_theme"]
                if theme not in counters:
                    raise ValueError(f"Sample {number} has an unselected theme: {theme}")
                fields = previous["original_fields"]
                if theme not in fields.get("Themes", "").split():
                    raise ValueError(f"Sample {number} lacks its expected positive tag")
                row = PuzzleRow(
                    record_number=previous["csv_record_number"],
                    fields=fields,
                    problem="column_count_mismatch"
                    if previous.get("reason") == "column_count_mismatch"
                    else None,
                    extra_fields=tuple(previous.get("extra_fields", [])),
                )
                item = {"expected_theme": theme, "baseline": previous}
                try:
                    item["upstream"] = raw_result(row, theme)
                    item["current"] = evaluate(row, BY_THEME[theme])
                except Exception as exc:
                    item["detector_error"] = {"type": type(exc).__name__, "detail": str(exc)}
                    failures.write(json.dumps(item, sort_keys=True) + "\n")
                    raise
                for name, metric in counters[theme].items():
                    metric.observe(item[name])
                serialized = json.dumps(item, sort_keys=True) + "\n"
                records.write(serialized)
                if any(item[name]["status"] != "detected" for name in ("upstream", "current")):
                    failures.write(serialized)
                total += 1
                if progress and total % 500 == 0:
                    progress(f"Compared {total:,} frozen theme-puzzle incidences")
        report["mappings"] = []
        for theme, values in sorted(counters.items()):
            if values["baseline"].sampled != source_mappings[theme]["metrics"]["sampled"]:
                raise ValueError(f"Sample count differs from baseline report for {theme}")
            payloads = {name: m.payload() for name, m in values.items()}
            for key in ("initial_episode_detected", "initial_episode_agreement_pct"):
                payloads["upstream"].pop(key)
            report["mappings"].append(
                BY_THEME[theme].payload() | {"selected": True, "metrics": payloads}
            )
        report["summaries"] = {
            name: summaries([row | {"metrics": row["metrics"][name]} for row in report["mappings"]])
            for name in ("baseline", "upstream", "current")
        }
        report.update(
            status="complete",
            samples_sha256=fingerprint.hexdigest(),
            incidences=total,
            seconds=round(monotonic() - started, 3),
        )
        write_json(output / "report.json", report)
        (output / "report.md").write_text(markdown(report), encoding="utf-8", newline="\n")
    except Exception as exc:
        report.update(status="failed", error={"type": type(exc).__name__, "detail": str(exc)})
        write_json(output / "report.json", report)
        raise
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--samples", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    try:
        result = compare(args.samples, args.output, lambda message: print(message, flush=True))
    except (ValueError, OSError, KeyError) as exc:
        parser.exit(2, f"Comparison failed: {exc}\n")
    print(f"Completed {result['incidences']:,} incidences in {result['seconds']} seconds")
    print(args.output / "report.md")


if __name__ == "__main__":
    main()
