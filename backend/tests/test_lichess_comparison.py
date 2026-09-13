"""Frozen comparisons use synthetic data and never need network, engines or a DB."""

import json

import pytest
from test_lichess_benchmark import FIXTURE

from scripts.lichess_benchmark import compare as comparison
from scripts.lichess_benchmark.runner import run_benchmark
from scripts.lichess_benchmark.themes import select_mappings


def baseline(tmp_path):
    destination = tmp_path / "baseline"
    run_benchmark(FIXTURE, destination, select_mappings(["fork", "promotion"]), 20)
    return destination / "samples.jsonl"


def test_frozen_comparison_preserves_samples_and_exports_witnesses(tmp_path):
    samples = baseline(tmp_path)
    content = samples.read_bytes()
    report = comparison.compare(samples, tmp_path / "comparison")
    assert samples.read_bytes() == content
    assert report["status"] == "complete"
    assert report["detector"]["upstream_commit"].startswith("8d9faff6")
    for suffix in ("lichess_patterns", "lichess_witnesses", "verified_patterns"):
        assert f"trainer.{suffix}" in report["detector"]["source_sha256"]
    records = [
        json.loads(line)
        for line in (tmp_path / "comparison" / "comparisons.jsonl").read_text().splitlines()
    ]
    assert report["incidences"] == len(records)
    detected = next(r for r in records if r["upstream"]["status"] == "detected")
    assert detected["upstream"]["witnesses"]
    assert detected["baseline"]["initial_fen"]
    assert detected["current"]["witnesses"]
    for row in report["mappings"]:
        m = row["metrics"]["upstream"]
        assert m["sampled"] == m["reconstructed"] + m["skipped"]
        assert m["detected"] + m["disagreements"] == m["reconstructed"]
        assert "initial_episode_agreement_pct" not in m
    text = (tmp_path / "comparison" / "report.md").read_text()
    assert "NOT independent precision" in text
    assert "absent tags are not negative ground truth" in text
    with pytest.raises(ValueError, match="NEW path"):
        comparison.compare(samples, tmp_path / "comparison")


def test_misses_export_actual_context_without_negative_tag_inference(tmp_path, monkeypatch):
    samples = baseline(tmp_path)
    original = comparison.raw_result

    def miss(row, theme):
        item = original(row, theme)
        return (
            item | {"status": "missed", "reason": "test_detector_abstention"}
            if item["status"] != "skipped"
            else item
        )

    monkeypatch.setattr(comparison, "raw_result", miss)
    report = comparison.compare(samples, tmp_path / "comparison")
    failures = (tmp_path / "comparison" / "failures.jsonl").read_text().splitlines()
    assert len(failures) == report["incidences"]
    for encoded in failures:
        item = json.loads(encoded)
        assert item["baseline"]["solution_moves"]
        assert item["baseline"]["lichess_themes"]


@pytest.mark.parametrize("corruption", ["unknown_theme", "missing_tag", "truncated"])
def test_corrupt_sample_reports_fail_instead_of_inflating_agreement(tmp_path, corruption):
    samples = baseline(tmp_path)
    rows = [json.loads(line) for line in samples.read_text().splitlines()]
    if corruption == "unknown_theme":
        rows[0]["expected_theme"] = "unrecognized"
    elif corruption == "missing_tag":
        rows[0]["original_fields"]["Themes"] = ""
    else:
        rows.pop()
    samples.write_text("".join(json.dumps(r) + "\n" for r in rows))
    with pytest.raises(ValueError):
        comparison.compare(samples, tmp_path / "comparison")
    failed = json.loads((tmp_path / "comparison" / "report.json").read_text())
    assert failed["status"] == "failed"


def test_unexpected_detector_bug_fails_and_keeps_reproduction(tmp_path, monkeypatch):
    samples = baseline(tmp_path)

    def broken(*args):
        raise RuntimeError("test detector crash")

    monkeypatch.setattr(comparison, "raw_result", broken)
    with pytest.raises(RuntimeError, match="test detector crash"):
        comparison.compare(samples, tmp_path / "comparison")
    item = json.loads((tmp_path / "comparison" / "failures.jsonl").read_text())
    assert item["baseline"]["initial_fen"]
    assert item["detector_error"]["type"] == "RuntimeError"


@pytest.mark.parametrize("extra", [[], ["unexpected"]])
def test_malformed_csv_context_remains_a_skip(tmp_path, extra):
    samples = baseline(tmp_path)
    rows = [json.loads(line) for line in samples.read_text().splitlines()]
    rows[0].update(status="skipped", reason="column_count_mismatch", extra_fields=extra)
    samples.write_text("".join(json.dumps(r) + "\n" for r in rows))
    comparison.compare(samples, tmp_path / "comparison")
    first = json.loads((tmp_path / "comparison" / "comparisons.jsonl").read_text().splitlines()[0])
    for name in ("baseline", "current", "upstream"):
        assert first[name]["status"] == "skipped"
        assert first[name]["reason"] == "column_count_mismatch"
