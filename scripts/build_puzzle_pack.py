"""Build a hash-pinned, offline puzzle pack from the public Lichess puzzle CSV.

Developer tooling only. The application never runs this and never downloads the
dataset. Download lichess_db_puzzle.csv(.zst|.gz) from
https://database.lichess.org/#puzzles (CC0) into ignored data/, then:

    python scripts/build_puzzle_pack.py --input data/lichess-benchmark/lichess_db_puzzle.csv.zst \
        --output backend/trainer/puzzles/starter_pack --count 1000 --version 2026-10-v1

The scan streams the entire file once, keeps an independent seeded reservoir
per rating band, validates every chosen row through the production definition
model and writes a sorted CSV plus manifest.json with its SHA-256. A second run
with the same dataset, options and seed produces the same pack.
"""

import argparse
import csv
import gzip
import hashlib
import io
import json
import random
import sys
from collections import Counter
from contextlib import ExitStack
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from trainer.puzzles.packs import PackError, PackManifest, definition_from_row  # noqa: E402

COLUMNS = [
    "PuzzleId",
    "FEN",
    "Moves",
    "Rating",
    "RatingDeviation",
    "Popularity",
    "NbPlays",
    "Themes",
    "GameUrl",
    "OpeningTags",
]
DEFAULT_BANDS = "400-1000:35,1000-1400:30,1400-1800:20,1800-2400:15"
SAMPLING_VERSION = "band-reservoir-v1"


def parse_bands(text: str) -> list[tuple[int, int, int]]:
    bands = []
    for part in text.split(","):
        span, _, weight = part.strip().partition(":")
        low, _, high = span.partition("-")
        bands.append((int(low), int(high), int(weight or 1)))
    if not bands or any(low >= high or weight < 1 for low, high, weight in bands):
        raise SystemExit("Bands must be low-high:weight with low < high and positive weights")
    return bands


def open_dataset(stack: ExitStack, path: Path):
    raw = stack.enter_context(path.open("rb"))
    suffix = path.suffix.lower()
    if suffix == ".gz":
        decoded = stack.enter_context(gzip.GzipFile(fileobj=raw, mode="rb"))
    elif suffix == ".zst":
        try:
            import zstandard
        except ImportError as exc:
            raise SystemExit(
                "Zstandard input needs python -m pip install -r "
                "scripts/lichess_benchmark/requirements.txt, or decompress to CSV first"
            ) from exc
        decoded = stack.enter_context(zstandard.ZstdDecompressor().stream_reader(raw))
    elif suffix == ".csv":
        decoded = raw
    else:
        raise SystemExit("Use a .csv, .csv.gz or .csv.zst dataset")
    return stack.enter_context(io.TextIOWrapper(decoded, encoding="utf-8-sig", newline=""))


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True, help="New or empty pack directory")
    parser.add_argument("--id", default="lichess-starter")
    parser.add_argument("--name", default="Lichess starter pack")
    parser.add_argument("--version", required=True)
    parser.add_argument("--count", type=int, default=1000)
    parser.add_argument("--seed", type=int, default=0)
    parser.add_argument("--bands", default=DEFAULT_BANDS, help="low-high:weight,...")
    parser.add_argument("--min-popularity", type=int, default=90)
    parser.add_argument("--min-plays", type=int, default=500)
    parser.add_argument("--max-solution-plies", type=int, default=9)
    parser.add_argument("--max-rating-deviation", type=int, default=90)
    args = parser.parse_args()
    bands = parse_bands(args.bands)
    total_weight = sum(weight for _, _, weight in bands)
    quotas = [max(1, round(args.count * weight / total_weight)) for _, _, weight in bands]
    if any((args.output / name).exists() for name in ("puzzles.csv", "manifest.json")):
        raise SystemExit(f"{args.output} already holds a pack; choose a new directory")

    reservoirs: list[list[dict[str, str]]] = [[] for _ in bands]
    counts = [0] * len(bands)
    generators = [
        random.Random(
            int.from_bytes(
                hashlib.sha256(f"{SAMPLING_VERSION}:{args.seed}:{index}".encode()).digest(), "big"
            )
        )
        for index in range(len(bands))
    ]
    seen = eligible = 0
    with ExitStack() as stack:
        reader = csv.DictReader(open_dataset(stack, args.input), strict=True)
        if not reader.fieldnames or not {"PuzzleId", "FEN", "Moves", "Rating"} <= set(
            reader.fieldnames
        ):
            raise SystemExit("CSV header must contain PuzzleId, FEN, Moves and Rating")
        for row in reader:
            seen += 1
            if seen % 500_000 == 0:
                print(f"scanned {seen:,} rows, {eligible:,} eligible", file=sys.stderr)
            try:
                rating = int(row["Rating"])
                popularity = int(row.get("Popularity") or 0)
                plays = int(row.get("NbPlays") or 0)
                deviation = int(row.get("RatingDeviation") or 0)
            except ValueError:
                continue
            plies = len(row["Moves"].split()) - 1
            if (
                popularity < args.min_popularity
                or plays < args.min_plays
                or deviation > args.max_rating_deviation
                or plies < 1
                or plies > args.max_solution_plies
            ):
                continue
            band = next((i for i, (low, high, _) in enumerate(bands) if low <= rating < high), None)
            if band is None:
                continue
            eligible += 1
            counts[band] += 1
            pool, quota = reservoirs[band], quotas[band]
            if len(pool) < quota:
                pool.append(row)
            else:
                slot = generators[band].randrange(counts[band])
                if slot < quota:
                    pool[slot] = row

    chosen, rejected, keys = [], Counter(), set()
    for pool in reservoirs:
        for row in pool:
            try:
                definition_from_row(row, version=args.version, attribution=args.name)
            except PackError as exc:
                rejected[str(exc).split(":", 1)[-1].strip()] += 1
                continue
            if row["PuzzleId"] in keys:
                continue
            keys.add(row["PuzzleId"])
            chosen.append({column: row.get(column, "") for column in COLUMNS})
    if not chosen:
        raise SystemExit("No eligible puzzles were found; relax the filters")
    chosen.sort(key=lambda row: row["PuzzleId"])

    buffer = io.StringIO(newline="")
    writer = csv.DictWriter(buffer, fieldnames=COLUMNS, lineterminator="\n")
    writer.writeheader()
    writer.writerows(chosen)
    data = buffer.getvalue().encode("utf-8")
    manifest = PackManifest(
        format="lichess-csv-v1",
        id=args.id,
        name=args.name,
        version=args.version,
        license="CC0-1.0",
        attribution="Lichess puzzle database (CC0)",
        url="https://database.lichess.org/#puzzles",
        puzzle_url="https://lichess.org/training/{id}",
        file="puzzles.csv",
        sha256=hashlib.sha256(data).hexdigest(),
        count=len(chosen),
        build={
            "tool": "scripts/build_puzzle_pack.py",
            "sampling": SAMPLING_VERSION,
            "seed": args.seed,
            "input_file": args.input.name,
            "input_sha256": hashlib.sha256(args.input.read_bytes()).hexdigest(),
            "rows_scanned": seen,
            "rows_eligible": eligible,
            "bands": [
                {"min": low, "max": high, "weight": weight, "eligible": count, "chosen": len(pool)}
                for (low, high, weight), count, pool in zip(bands, counts, reservoirs)
            ],
            "filters": {
                "min_popularity": args.min_popularity,
                "min_plays": args.min_plays,
                "max_solution_plies": args.max_solution_plies,
                "max_rating_deviation": args.max_rating_deviation,
            },
            "rejected_rows": dict(rejected),
        },
    )
    args.output.mkdir(parents=True, exist_ok=True)
    (args.output / "puzzles.csv").write_bytes(data)
    (args.output / "manifest.json").write_text(
        json.dumps(manifest.model_dump(mode="json"), indent=2) + "\n", encoding="utf-8"
    )
    themes = Counter(theme for row in chosen for theme in row["Themes"].split())
    print(f"Wrote {len(chosen)} puzzles to {args.output} ({len(data):,} bytes)")
    print("Rejected:", dict(rejected) or "none")
    print("Top themes:", ", ".join(f"{t} {n}" for t, n in themes.most_common(12)))


if __name__ == "__main__":
    main()
