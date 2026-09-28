"""Measure the existing deep review unchanged, using a disposable database."""

from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from tempfile import TemporaryDirectory
from time import perf_counter

from trainer.chess_core import digest, legal_move
from trainer.config import Settings
from trainer.db import database, migrate
from trainer.engine import Stockfish
from trainer.game_review import analyze_move, classify

from .corpus import board_for
from .metrics import machine, peak_rss_bytes, summary


def evidence_signature(report):
    """Compare candidate chess output and depth, excluding database-generated IDs."""
    return digest({key: report[key] for key in ("best", "actual", "white_score", "loss_cp")})


def run(corpus, executable, workers=1, repeats=2):
    with TemporaryDirectory(prefix="fieldwork-review-benchmark-") as folder:
        settings = Settings(
            _env_file=None,
            stockfish_path=str(Path(executable).resolve()),
            database_path=Path(folder) / "benchmark.sqlite3",
        )
        database_engine, sessions = database(settings.database_path)
        migrate(database_engine)
        engines = [Stockfish(settings, sessions) for _ in range(workers)]
        startup = perf_counter()
        try:
            for engine in engines:
                engine.start()
            startup = perf_counter() - startup
            passes = []

            def lane(index):
                engine = engines[index]
                output = []
                for item in corpus["positions"][index::workers]:
                    board = board_for(item)
                    start = perf_counter()
                    report = analyze_move(engine, board, legal_move(board, item["played"]))
                    output.append(
                        {
                            "id": item["id"],
                            "seconds": perf_counter() - start,
                            "signature": evidence_signature(report),
                            "qualities": {
                                str(rating): classify(report, rating)[0]
                                for rating in corpus["ratings"]
                            },
                            "report": report,
                        }
                    )
                return output

            for _ in range(repeats):
                start = perf_counter()
                with ThreadPoolExecutor(max_workers=workers) as pool:
                    rows = sorted(
                        (row for batch in pool.map(lane, range(workers)) for row in batch),
                        key=lambda row: row["id"],
                    )
                passes.append(
                    {
                        "wall_seconds": perf_counter() - start,
                        "latency": summary([row["seconds"] for row in rows]),
                        "rows": rows,
                    }
                )
            return {
                "schema": "review-benchmark-1",
                "mode": "baseline-stockfish",
                "machine": machine(),
                "corpus_version": corpus["version"],
                "corpus_digest": digest(corpus),
                "workers": workers,
                "engine": engines[0].version,
                "binary_sha256": engines[0].binary_hash,
                "limits": {
                    key: getattr(settings, key)
                    for key in (
                        "deep_depth",
                        "deep_time",
                        "deep_nodes",
                        "stockfish_threads",
                        "stockfish_hash_mb",
                    )
                },
                "startup_seconds": startup,
                "passes": passes,
                "cache_hits": sum(engine.hits for engine in engines),
                "cache_misses": sum(engine.misses for engine in engines),
                "cached_output_equal": all(
                    [row["signature"] for row in entry["rows"]]
                    == [row["signature"] for row in passes[0]["rows"]]
                    for entry in passes[1:]
                )
                if repeats > 1
                else None,
                "python_peak_rss_bytes": peak_rss_bytes(),
                "memory_scope": "Python peak RSS only; native Stockfish is a separate process",
            }
        finally:
            for engine in engines:
                engine.close()
            database_engine.dispose()
