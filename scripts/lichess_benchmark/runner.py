"""Offline orchestration and durable, inspectable benchmark artifacts."""

import hashlib
import json
import platform
from collections import Counter
from pathlib import Path
from time import monotonic

from . import ADAPTER_VERSION
from .dataset import SAMPLING_VERSION, PuzzleRow, sample_dataset
from .detector import detect_line, detector_metadata, matches
from .positions import ReconstructionError, reconstruct
from .reports import LIMITATIONS, Metrics, markdown, summaries
from .themes import MAPPING_VERSION, MAPPINGS, ThemeMapping


def record_context(row: PuzzleRow, mapping: ThemeMapping) -> dict:
    moves = row.fields.get("Moves", "").split()
    return {
        "puzzle_id": row.puzzle_id,
        "csv_record_number": row.record_number,
        "initial_fen": row.fields.get("FEN", ""),
        "dataset_moves": moves,
        "setup_move": moves[0] if moves else None,
        "solution_moves": moves[1:],
        "lichess_themes": list(row.themes),
        "expected_theme": mapping.theme,
        "expected_fieldwork_motif": mapping.skill,
        "relationship": mapping.relationship,
        "original_fields": row.fields,
        "extra_fields": list(row.extra_fields),
        "detected_motifs": [],
        "witnesses": [],
        "windows": [],
        "initial_episode_detected": False,
    }


def evaluate(row: PuzzleRow, mapping: ThemeMapping) -> dict:
    result = record_context(row, mapping)
    try:
        line = reconstruct(row)
    except ReconstructionError as exc:
        return result | {"status": "skipped", "reason": exc.reason, "detail": str(exc)}
    detection = detect_line(line)
    expected = [w for w in detection.witnesses if matches(mapping, w)]
    supported = any(w["material_supported"] or w["mate_supported"] for w in detection.windows)
    return result | {
        "status": "detected" if expected else "missed",
        "reason": None
        if expected
        else (
            "expected_witness_not_emitted"
            if supported
            else "no_visible_material_gain_or_terminal_mate"
        ),
        "solver": "white" if line.solver else "black",
        "solver_fen": line.boards[0].fen(),
        "setup_san": line.setup_san,
        "solution_san": line.solution_san,
        "detected_motifs": sorted({w.finding.skill_id for w in detection.witnesses}),
        "witnesses": [w.payload() for w in detection.witnesses],
        "windows": detection.windows,
        "initial_episode_detected": any(w.offset == 0 for w in expected),
    }


def write_json(path: Path, value):
    path.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def run_benchmark(
    input_path: Path,
    output_dir: Path,
    mappings: tuple[ThemeMapping, ...],
    count: int = 200,
    seed: int = 0,
    progress=None,
) -> dict:
    if output_dir.exists():
        raise ValueError(f"Output directory exists; choose a NEW path: {output_dir}")
    started = monotonic()
    sample = sample_dataset(input_path, mappings, count, seed, progress)
    output_dir.mkdir(parents=True, exist_ok=False)
    selected = {mapping.theme for mapping in mappings}
    counters = {
        mapping.theme: Metrics(candidates=sample.theme_counts[mapping.theme])
        for mapping in MAPPINGS
    }
    report = {
        "status": "incomplete",
        "report_schema_version": "1",
        "adapter_version": ADAPTER_VERSION,
        "mapping_version": MAPPING_VERSION,
        "sampling_version": SAMPLING_VERSION,
        "python_version": platform.python_version(),
        "configuration": {"themes": sorted(selected), "samples_per_motif": count, "seed": seed},
        "input": {
            "name": input_path.name,
            "sha256": sample.input_sha256,
            "bytes": sample.input_bytes,
            "rows_seen": sample.rows_seen,
            "malformed_rows": sample.malformed_rows,
            "malformed_without_assignable_themes": sample.malformed_without_themes,
            "theme_counts": dict(sorted(sample.theme_counts.items())),
        },
        "benchmark_source_sha256": {
            p.name: hashlib.sha256(p.read_bytes()).hexdigest()
            for p in sorted(Path(__file__).parent.glob("*.py"))
        },
        "detector": detector_metadata(),
        "limitations": LIMITATIONS,
        "sampling_unit": "CSV row per theme, sampled before chess/outcome validation",
    }
    report_path = output_dir / "report.json"
    write_json(report_path, report)
    try:
        diagnostics = Counter()
        with (
            (output_dir / "samples.jsonl").open("x", encoding="utf-8", newline="\n") as all_rows,
            (output_dir / "failures.jsonl").open("x", encoding="utf-8", newline="\n") as failures,
        ):
            for mapping in mappings:
                for row in sample.rows[mapping.theme]:
                    try:
                        result = evaluate(row, mapping)
                    except Exception as exc:
                        # A programming error must not disappear into skips or inflate recall.
                        result = record_context(row, mapping) | {
                            "status": "detector_error",
                            "reason": type(exc).__name__,
                            "detail": str(exc),
                        }
                        failures.write(json.dumps(result, sort_keys=True) + "\n")
                        all_rows.write(json.dumps(result, sort_keys=True) + "\n")
                        raise
                    encoded = json.dumps(result, sort_keys=True) + "\n"
                    all_rows.write(encoded)
                    if result["status"] != "detected":
                        failures.write(encoded)
                    counters[mapping.theme].observe(result)
                    if result["windows"]:
                        diagnostics["reconstructed_incidences"] += 1
                        diagnostics["with_unsettled_supported_window"] += any(
                            w["material_supported"]
                            and w["production_endpoint"]["material_delta"] is None
                            for w in result["windows"]
                        )
                        diagnostics["without_visible_outcome_support"] += not any(
                            w["material_supported"] or w["mate_supported"]
                            for w in result["windows"]
                        )
                if progress:
                    progress(
                        f"Evaluated {mapping.theme}: {len(sample.rows[mapping.theme])} samples"
                    )
        report["mappings"] = [
            mapping.payload()
            | {"selected": mapping.theme in selected, "metrics": counters[mapping.theme].payload()}
            for mapping in MAPPINGS
        ]
        report["summaries"] = summaries(report["mappings"])
        report["adapter_diagnostics"] = dict(diagnostics)
        report["seconds"] = round(monotonic() - started, 3)
        report["status"] = "complete"
        (output_dir / "report.md").write_text(markdown(report), encoding="utf-8", newline="\n")
        write_json(report_path, report)
    except Exception as exc:
        report["status"] = "failed"
        report["error"] = {"type": type(exc).__name__, "detail": str(exc)}
        write_json(report_path, report)
        raise
    return report
