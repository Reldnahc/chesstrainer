"""Positive-only benchmark contracts; all chess positions here are synthetic."""

import json
from pathlib import Path

import chess
import pytest
from trainer import tactical_patterns
from trainer.local_classifier import LocalClassifier

from scripts.lichess_benchmark import cli, runner
from scripts.lichess_benchmark.dataset import PuzzleRow, sample_dataset
from scripts.lichess_benchmark.detector import detect_line, matches
from scripts.lichess_benchmark.positions import reconstruct
from scripts.lichess_benchmark.reports import LIMITATIONS, Metrics, summaries
from scripts.lichess_benchmark.themes import BY_THEME, select_mappings

FIXTURE = Path(__file__).parent / "fixtures" / "lichess_synthetic.csv"


def row_for(fen, moves, theme="fork"):
    return PuzzleRow(2, {"PuzzleId": "SYN", "FEN": fen, "Moves": moves, "Themes": theme})


def fixture_rows():
    sample = sample_dataset(FIXTURE, select_mappings(["fork", "skewer", "promotion"]), 100, 0)
    return {row.puzzle_id: row for rows in sample.rows.values() for row in rows}


@pytest.mark.parametrize(
    "puzzle,theme",
    [
        ("SYN-FORK", "fork"),
        ("SYN-SKEWER", "skewer"),
        ("SYN-PROMOTION", "promotion"),
        ("SYN-PROMOTION", "underPromotion"),
    ],
)
def test_real_production_detector_positive_witnesses(puzzle, theme):
    row = fixture_rows()[puzzle]
    result = runner.evaluate(row, BY_THEME[theme])
    assert result["status"] == "detected"
    assert result["initial_episode_detected"]
    assert result["expected_fieldwork_motif"] in result["detected_motifs"]
    assert result["witnesses"]
    for witness in result["witnesses"]:
        assert witness["finding"]["actor"] == "white"
        assert witness["finding"]["rule_id"].endswith(":" + LocalClassifier.version)
        assert witness["source"] == "lichess_supplied_line_not_native_analysis"
        assert witness["finding"]["moves"] == [
            result["solution_moves"][ply - 1] for ply in witness["solution_plies"]
        ]


def test_shared_detector_called_without_full_classifier_or_settings(monkeypatch):
    original = tactical_patterns.detect_patterns
    calls = []

    def spy(boards, first, end, analysis_id, direction, **kwargs):
        calls.append((boards[0].fen(), first, end, direction, kwargs))
        return original(boards, first, end, analysis_id, direction, **kwargs)

    def forbidden(*args, **kwargs):
        raise AssertionError("Full classification or host configuration must not run")

    monkeypatch.setattr(tactical_patterns, "detect_patterns", spy)
    monkeypatch.setattr(LocalClassifier, "classify", forbidden)
    monkeypatch.setattr("trainer.config.Settings", forbidden)
    result = runner.evaluate(fixture_rows()["SYN-FORK"], BY_THEME["fork"])
    assert result["status"] == "detected"
    assert len(calls) == 2  # Two solver decisions; no opponent/setup-side calls.
    assert all(
        first == 1 and direction == "missed_opportunity" and kwargs["max_tactic_plies"] == 8
        for _, first, _, direction, kwargs in calls
    )
    assert result["windows"][0]["observed_material_delta"] == 5
    assert result["windows"][0]["production_endpoint"]["material_delta"] is None


def test_both_solver_colors_and_correct_global_witness_coordinates():
    row = fixture_rows()["SYN-FORK"]
    mirrored = row_for(
        chess.Board(row.fields["FEN"]).mirror().fen(),
        " ".join(
            chess.Move(
                chess.square_mirror(m.from_square),
                chess.square_mirror(m.to_square),
                promotion=m.promotion,
            ).uci()
            for m in map(chess.Move.from_uci, row.fields["Moves"].split())
        ),
    )
    result = runner.evaluate(mirrored, BY_THEME["fork"])
    assert result["status"] == "detected" and result["solver"] == "black"
    assert all(w["finding"]["actor"] == "black" for w in result["witnesses"])
    fork = next(w for w in result["witnesses"] if w["finding"]["skill_id"] == "fork")
    assert fork["solution_plies"] == [1, 3]


def test_later_episode_is_separate_from_initial_attribution():
    row = row_for("r7/8/2k5/1N6/8/8/8/6K1 b - - 0 1", "c6d7 g1h2 d7e8 b5c7 e8d7 c7a8")
    result = runner.evaluate(row, BY_THEME["fork"])
    assert result["status"] == "detected"
    assert not result["initial_episode_detected"]
    fork = next(w for w in result["witnesses"] if w["finding"]["skill_id"] == "fork")
    assert fork["solution_plies"] == [3, 5]
    assert fork["window_start_solution_ply"] == 3


@pytest.mark.parametrize(
    "queen,moves,theme,skill",
    [
        ("7q/8/8", "f8e8 e2h5", "doubleCheck", "double_attack"),
        ("8/8/5q2", "f8e8 e2f3", "discoveredCheck", "discovered_attack"),
    ],
)
def test_check_theme_subtypes_use_production_witness_roles(queen, moves, theme, skill):
    fen = f"5k2/8/8/{queen}/4B3/4R1K1 b - - 0 1"
    result = runner.evaluate(row_for(fen, moves, theme), BY_THEME[theme])
    assert result["status"] == "detected"
    assert skill in result["detected_motifs"]


def test_nonchecking_double_attack_cannot_earn_double_check_agreement():
    row = row_for("q4k2/8/2n5/8/B7/8/8/R5K1 b - - 0 1", "f8g8 a4b5 c6d4 a1a8", "doubleCheck")
    result = runner.evaluate(row, BY_THEME["doubleCheck"])
    assert "double_attack" in result["detected_motifs"]
    assert result["status"] == "missed"


def test_queen_promotion_cannot_earn_underpromotion_agreement():
    row = row_for("8/P3k3/8/8/8/8/8/4K3 b - - 0 1", "e7e8 a7a8q", "underPromotion")
    result = runner.evaluate(row, BY_THEME["underPromotion"])
    assert "promotion_awareness" in result["detected_motifs"]
    assert result["status"] == "missed"


def test_hanging_theme_only_credits_the_initial_solver_capture():
    row = row_for("5k2/8/8/8/8/8/q7/R5K1 b - - 0 1", "f8g8 g1h1 g8f7 a1a2", "hangingPiece")
    detection = detect_line(reconstruct(row))
    assert any(w.finding.skill_id == "missed_tactical_capture" for w in detection.witnesses)
    assert not any(matches(BY_THEME["hangingPiece"], w) for w in detection.witnesses)


def test_valid_short_lines_are_misses_not_filtered_out():
    row = fixture_rows()["SYN-MISS"]
    result = runner.evaluate(row, BY_THEME["fork"])
    assert result["status"] == "missed"
    assert result["reason"] == "no_visible_material_gain_or_terminal_mate"
    assert result["solution_san"] == ["e5"]


def test_metrics_and_semantic_group_averages_use_positive_denominators():
    first = Metrics(candidates=10)
    for status in ("detected", "missed", "skipped"):
        first.observe({"status": status, "reason": "fixture", "initial_episode_detected": True})
    second = Metrics(candidates=2)
    second.observe({"status": "detected", "reason": None, "initial_episode_detected": False})
    one, two = first.payload(), second.payload()
    assert one["reconstructed"] == 2 and one["positive_agreement_pct"] == 50
    assert one["sample_detection_pct_including_skips"] == 33.333
    totals = summaries(
        [
            {"relationship": "approximate", "selected": True, "metrics": value}
            for value in (one, two, Metrics().payload())
        ]
    )
    assert totals["approximate"]["micro_positive_agreement_pct"] == 66.667
    assert totals["approximate"]["macro_positive_agreement_pct"] == 75
    assert totals["approximate"]["motifs_without_reconstructed_samples"] == 1
    assert totals["exact"]["micro_positive_agreement_pct"] is None
    assert "precision" not in one and "false_positives" not in one
    assert any("absent tags are not negative" in note for note in LIMITATIONS)


def test_reports_and_disagreement_corpus_are_reproducible(tmp_path):
    left, right = tmp_path / "left", tmp_path / "right"
    configs = select_mappings(["fork", "skewer"])
    report = runner.run_benchmark(FIXTURE, left, configs, 100, 17)
    again = runner.run_benchmark(FIXTURE, right, configs, 100, 17)
    assert report["mappings"] == again["mappings"]
    assert (left / "samples.jsonl").read_bytes() == (right / "samples.jsonl").read_bytes()
    failures = [json.loads(line) for line in (left / "failures.jsonl").read_text().splitlines()]
    assert {row["puzzle_id"] for row in failures} == {"SYN-MISS", "SYN-BAD"}
    assert {row["status"] for row in failures} == {"missed", "skipped"}
    assert all(
        {
            "initial_fen",
            "dataset_moves",
            "solution_moves",
            "lichess_themes",
            "expected_fieldwork_motif",
            "detected_motifs",
            "witnesses",
            "reason",
            "csv_record_number",
            "windows",
        }
        <= row.keys()
        for row in failures
    )
    fork = next(row for row in report["mappings"] if row["theme"] == "fork")["metrics"]
    assert (
        fork["candidates"],
        fork["sampled"],
        fork["reconstructed"],
        fork["detected"],
        fork["skipped"],
        fork["disagreements"],
    ) == (3, 3, 2, 1, 1, 1)
    unsupported = next(row for row in report["mappings"] if row["theme"] == "trappedPiece")
    assert unsupported["metrics"]["candidates"] == 1
    assert unsupported["metrics"]["positive_agreement_pct"] is None
    assert "Unsupported mappings have no agreement metric" in (left / "report.md").read_text()
    assert "not precision" in (left / "report.md").read_text()
    assert report["status"] == "complete"
    assert report["detector"]["engine_scores_supplied"] is False
    assert len(report["detector"]["source_sha256"]) >= 6
    with pytest.raises(ValueError, match="NEW path"):
        runner.run_benchmark(FIXTURE, left, configs)


def test_detector_errors_preserve_context_and_fail_the_run(tmp_path, monkeypatch):
    def broken(line):
        raise RuntimeError("synthetic detector error")

    monkeypatch.setattr(runner, "detect_line", broken)
    output = tmp_path / "failure"
    with pytest.raises(RuntimeError, match="synthetic detector"):
        runner.run_benchmark(FIXTURE, output, select_mappings(["skewer"]), 10, 0)
    report = json.loads((output / "report.json").read_text())
    assert report["status"] == "failed"
    assert "summaries" not in report
    failure = json.loads((output / "failures.jsonl").read_text())
    assert failure["puzzle_id"] == "SYN-SKEWER"
    assert failure["status"] == "detector_error"
    assert not (output / "report.md").exists()


def test_cli_listing_failure_empty_selection_and_success(tmp_path, capsys):
    assert cli.main(["--list-mappings"]) == 0
    assert any(
        row["theme"] == "trappedPiece" and not row["eligible"]
        for row in json.loads(capsys.readouterr().out)
    )
    assert (
        cli.main(
            [
                "--input",
                str(FIXTURE),
                "--motifs",
                "trappedPiece",
                "--output",
                str(tmp_path / "invalid"),
            ]
        )
        == 1
    )
    assert not (tmp_path / "invalid").exists()
    assert (
        cli.main(
            [
                "--input",
                str(FIXTURE),
                "--motifs",
                "doubleCheck",
                "--output",
                str(tmp_path / "empty"),
            ]
        )
        == 2
    )
    assert (
        cli.main(
            [
                "--input",
                str(FIXTURE),
                "--motifs",
                "fork",
                "--output",
                str(tmp_path / "success"),
                "--seed",
                "7",
                "--samples-per-motif",
                "20",
            ]
        )
        == 0
    )
