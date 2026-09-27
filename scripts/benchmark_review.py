"""Reproducible synthetic review benchmarks; no network or model download."""

import argparse
import json
from pathlib import Path

from review_benchmark.corpus import CORPUS_PATH, load_corpus


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--corpus", type=Path, default=CORPUS_PATH)
    parser.add_argument("--stockfish", type=Path)
    parser.add_argument("--workers", type=int, choices=range(1, 5), default=1)
    parser.add_argument("--repeats", type=int, choices=range(1, 11), default=2)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    if args.output and args.output.exists():
        parser.error("Output already exists; choose a new measurement file")
    corpus = load_corpus(args.corpus)
    if args.stockfish:
        from review_benchmark.stockfish import run

        result = run(corpus, args.stockfish, args.workers, args.repeats)
    else:
        result = corpus
    encoded = json.dumps(result, indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        with args.output.open("x", encoding="utf-8") as target:
            target.write(encoded + "\n")
        print(f"Saved {args.output}")
    else:
        print(encoded)


if __name__ == "__main__":
    main()
