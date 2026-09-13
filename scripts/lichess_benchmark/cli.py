"""Developer-only positive-theme agreement benchmark; offline once data is local."""

import argparse
import json
import sys
from pathlib import Path

from .runner import run_benchmark
from .themes import MAPPINGS, select_mappings


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, help="Local CSV, CSV.gz or CSV.zst dataset")
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("data/lichess-benchmark/results"),
        help="New output directory (existing directories are never overwritten)",
    )
    parser.add_argument(
        "--motifs",
        nargs="+",
        metavar="LICHESS_THEME",
        help="Eligible Lichess theme names; defaults to all eligible mappings",
    )
    parser.add_argument("--samples-per-motif", type=int, default=200)
    parser.add_argument("--seed", type=int, default=0)
    parser.add_argument("--list-mappings", action="store_true")
    args = parser.parse_args(argv)
    if args.list_mappings:
        print(json.dumps([mapping.payload() for mapping in MAPPINGS], indent=2))
        return 0
    if args.input is None:
        parser.error("--input is required unless using --list-mappings")

    def progress(value):
        text = f"Scanned {value:,} rows" if isinstance(value, int) else value
        print(text, file=sys.stderr, flush=True)

    try:
        report = run_benchmark(
            args.input,
            args.output,
            select_mappings(args.motifs),
            args.samples_per_motif,
            args.seed,
            progress,
        )
    except Exception as exc:
        print(f"Benchmark failed: {exc}", file=sys.stderr)
        return 1
    print(f"Complete: {args.output / 'report.md'}")
    print("Positive theme agreement only; missing tags are not negatives.")
    if not any(row["metrics"]["reconstructed"] for row in report["mappings"]):
        print(
            "No reconstructed selected positives; no agreement estimate is available.",
            file=sys.stderr,
        )
        return 2
    return 0
