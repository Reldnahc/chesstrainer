"""Verify a puzzle pack's solutions with bounded native Stockfish.

Developer tooling; the application never runs this. For every solver decision in
every puzzle it asks Stockfish two questions at the same root and limit, the way
the review pipeline compares a played move with the best move:

1. Is the solution move as good as the engine's best move (within --tolerance-cp)?
2. Is every other move clearly worse (by at least --margin-cp, or mate versus
   no mate)? The player accepts only the pinned solution, so a second equally
   good move would wrongly mark a solver as failed.

After the final solver move the position must be clearly won for the solver
(--payoff-cp or mate). Opponent replies are not graded. A puzzle passes when
every check passes; warnings record a slower alternative mate or a position with
one legal move. The engine, limits, pack hash and every score are written to the
output directory so the run is reproducible and inspectable.

    python scripts/verify_puzzle_pack.py --pack backend/trainer/puzzles/starter_pack \
        --output data/puzzle-verification/starter-2026-10-v1

Stockfish comes from --stockfish, STOCKFISH_PATH or the local .tools build.
"""

import argparse
import csv
import hashlib
import io
import json
import os
import shutil
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import chess
import chess.engine

ROOT = Path(__file__).resolve().parents[1]
MATE_SCORE = 100_000
VERIFIER_VERSION = "solution-uniqueness-v1"


def find_stockfish(explicit: str | None) -> str:
    candidates = [
        explicit,
        os.environ.get("STOCKFISH_PATH"),
        shutil.which("stockfish"),
        str(ROOT / ".tools/stockfish/stockfish-windows-x86-64-avx2.exe"),
    ]
    for candidate in candidates:
        if candidate and Path(candidate).is_file():
            return str(Path(candidate).resolve())  # CreateProcess needs an absolute path
        if candidate and shutil.which(candidate):
            return candidate
    raise SystemExit("Stockfish not found; pass --stockfish or set STOCKFISH_PATH")


def pov_score(info, turn: chess.Color) -> int:
    return info["score"].pov(turn).score(mate_score=MATE_SCORE)


def is_mate(score: int) -> bool:
    return abs(score) >= MATE_SCORE - 1000


def describe(score: int) -> str:
    if score >= MATE_SCORE - 1000:
        return f"#{MATE_SCORE - score}"
    if score <= -MATE_SCORE + 1000:
        return f"#-{MATE_SCORE + score}"
    return f"{score:+d}"


class Verifier:
    def __init__(self, engine_path, *, depth, threads, hash_mb, tolerance, margin, payoff):
        self.engine_path = engine_path
        self.limit = chess.engine.Limit(depth=depth)
        self.options = {"Threads": threads, "Hash": hash_mb}
        self.tolerance, self.margin, self.payoff = tolerance, margin, payoff
        self.local = threading.local()

    def engine(self) -> chess.engine.SimpleEngine:
        engine = getattr(self.local, "engine", None)
        if engine is None:
            engine = chess.engine.SimpleEngine.popen_uci(self.engine_path)
            engine.configure(self.options)
            self.local.engine = engine
        return engine

    def close(self):
        engine = getattr(self.local, "engine", None)
        if engine is not None:
            engine.quit()
            self.local.engine = None

    def analyse(self, board, *, multipv=1, root_moves=None):
        infos = self.engine().analyse(
            board, self.limit, multipv=multipv, root_moves=root_moves, game=object()
        )
        return [info for info in infos if info.get("pv")]

    def verify(self, row: dict[str, str]) -> dict:
        moves = row["Moves"].split()
        board = chess.Board(row["FEN"])
        board.push_uci(moves[0])
        solver = board.turn
        solution = moves[1:]
        decisions, failures, warnings = [], [], []
        for index, uci in enumerate(solution):
            move = chess.Move.from_uci(uci)
            if board.turn == solver:
                decision = self.verify_decision(board, move, index)
                decisions.append(decision)
                failures.extend(decision["failures"])
                warnings.extend(decision["warnings"])
            board.push(move)
        if board.turn != solver:
            # The line ends on the solver's move; the opponent is to move here.
            if board.is_checkmate():
                payoff = {"score": MATE_SCORE, "display": "#0", "checkmate": True}
            else:
                infos = self.analyse(board)
                score = pov_score(infos[0], solver) if infos else 0
                payoff = {"score": score, "display": describe(score), "checkmate": False}
                if score < self.payoff and score < MATE_SCORE - 1000:
                    failures.append(f"final position only {describe(score)} for the solver")
        else:
            payoff = None
            failures.append("line does not end on a solver move")
        return {
            "puzzle_id": row["PuzzleId"],
            "rating": row.get("Rating"),
            "themes": row.get("Themes", "").split(),
            "solver": "white" if solver else "black",
            "solution": solution,
            "decisions": decisions,
            "payoff": payoff,
            "warnings": warnings,
            "failures": failures,
            "passed": not failures,
        }

    def verify_decision(self, board: chess.Board, move: chess.Move, index: int) -> dict:
        turn = board.turn
        legal = list(board.legal_moves)
        failures, warnings = [], []
        if move not in legal:
            return {
                "ply": index,
                "move": move.uci(),
                "failures": ["solution move is illegal"],
                "warnings": [],
            }
        candidates = self.analyse(board, multipv=2)
        # Score the solution from the same search as its rivals when it is among them;
        # a separate restricted search only when the engine did not rank it in the top two.
        ranked = next((info for info in candidates if info["pv"][0] == move), None)
        solution_info = [ranked] if ranked else self.analyse(board, root_moves=[move])
        solution_score = pov_score(solution_info[0], turn) if solution_info else None
        best = max((pov_score(info, turn) for info in candidates), default=None)
        alternatives = [
            (info["pv"][0].uci(), pov_score(info, turn))
            for info in candidates
            if info["pv"][0] != move
        ]
        result = {
            "ply": index,
            "move": move.uci(),
            "san": board.san(move),
            "solution": describe(solution_score) if solution_score is not None else None,
            "best": describe(best) if best is not None else None,
            "alternative": None,
            "legal_moves": len(legal),
            "failures": failures,
            "warnings": warnings,
        }
        if solution_score is None or best is None:
            failures.append(f"ply {index}: engine returned no line")
            return result
        if solution_score < best - self.tolerance and not (
            is_mate(solution_score) and is_mate(best) and solution_score > 0
        ):
            failures.append(
                f"ply {index}: {result['san']} scores {describe(solution_score)} but the best move "
                f"scores {describe(best)}"
            )
        if len(legal) == 1:
            warnings.append(f"ply {index}: only one legal move")
        elif alternatives:
            alt_uci, alt_score = max(alternatives, key=lambda item: item[1])
            result["alternative"] = {
                "move": alt_uci,
                "san": board.san(chess.Move.from_uci(alt_uci)),
                "score": describe(alt_score),
            }
            both_mate = is_mate(solution_score) and solution_score > 0 and is_mate(alt_score)
            if both_mate and alt_score > 0:
                if alt_score >= solution_score:
                    failures.append(
                        f"ply {index}: {result['alternative']['san']} also mates in "
                        f"{MATE_SCORE - alt_score}"
                    )
                else:
                    warnings.append(
                        f"ply {index}: {result['alternative']['san']} mates more slowly "
                        f"({describe(alt_score)})"
                    )
            elif solution_score - alt_score < self.margin:
                failures.append(
                    f"ply {index}: {result['alternative']['san']} scores {describe(alt_score)}, "
                    f"within {self.margin} of the solution's {describe(solution_score)}"
                )
        else:
            # MultiPV returned a single line for a position with several legal moves.
            warnings.append(f"ply {index}: engine reported no alternative line")
        return result


def read_pack(directory: Path):
    manifest = json.loads((directory / "manifest.json").read_text(encoding="utf-8"))
    data = (directory / manifest["file"]).read_bytes()
    digest = hashlib.sha256(data).hexdigest()
    if digest != manifest["sha256"]:
        raise SystemExit("Pack CSV does not match the manifest hash; refusing to verify it")
    rows = list(csv.DictReader(data.decode("utf-8-sig").splitlines()))
    return manifest, rows


def summarize(results, *, manifest, args, engine_id, elapsed, stockfish):
    failed = [r for r in results if not r["passed"]]
    warned = [r for r in results if r["passed"] and r["warnings"]]
    return {
        "verifier": VERIFIER_VERSION,
        "pack": {
            "id": manifest["id"],
            "version": manifest["version"],
            "sha256": manifest["sha256"],
            "count": manifest["count"],
        },
        "engine": {
            "id": engine_id,
            "path": stockfish,
            "depth": args.depth,
            "threads": args.threads,
            "hash_mb": args.hash,
        },
        "thresholds": {
            "tolerance_cp": args.tolerance_cp,
            "margin_cp": args.margin_cp,
            "payoff_cp": args.payoff_cp,
        },
        "verified": len(results),
        "passed": len(results) - len(failed),
        "failed": len(failed),
        "passed_with_warnings": len(warned),
        "failed_ids": sorted(r["puzzle_id"] for r in failed),
        "elapsed_seconds": round(elapsed, 1),
    }


def record(pack: Path, manifest: dict, summary: dict, results: list, *, prune: bool) -> dict:
    """Write the evidence into manifest.json; with prune, drop failed rows and re-pin the CSV."""
    if summary["verified"] != manifest["count"]:
        raise SystemExit("Record only a complete run; use --resume to finish it first")
    failed = {r["puzzle_id"] for r in results if not r["passed"]}
    entry = {
        "verifier": summary["verifier"],
        "verified_at": time.strftime("%Y-%m-%d", time.gmtime()),
        "verified_sha256": manifest["sha256"],
        "engine": summary["engine"]["id"],
        "depth": summary["engine"]["depth"],
        "thresholds": summary["thresholds"],
        "verified": summary["verified"],
        "passed": summary["passed"],
        "failed": sorted(failed),
        "passed_with_warnings": summary["passed_with_warnings"],
        "removed": [],
    }
    if prune and failed:
        path = pack / manifest["file"]
        text = path.read_bytes().decode("utf-8-sig")
        reader = csv.DictReader(io.StringIO(text, newline=""))
        kept = [row for row in reader if row["PuzzleId"] not in failed]
        buffer = io.StringIO(newline="")
        writer = csv.DictWriter(buffer, fieldnames=reader.fieldnames, lineterminator="\n")
        writer.writeheader()
        writer.writerows(kept)
        data = buffer.getvalue().encode("utf-8")
        path.write_bytes(data)
        manifest["sha256"] = hashlib.sha256(data).hexdigest()
        manifest["count"] = len(kept)
        entry["removed"] = sorted(failed)
    manifest["verification"] = entry
    (pack / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return entry


def render(summary, failed_results):
    lines = [
        f"# Puzzle pack verification · {summary['pack']['id']} {summary['pack']['version']}",
        "",
        f"Engine {summary['engine']['id']}, depth {summary['engine']['depth']}, "
        f"{summary['engine']['threads']} threads. Solution within {summary['thresholds']['tolerance_cp']} cp of best; "
        f"alternatives at least {summary['thresholds']['margin_cp']} cp worse; final payoff at least "
        f"{summary['thresholds']['payoff_cp']} cp or mate.",
        "",
        f"- Verified: {summary['verified']} of {summary['pack']['count']}",
        f"- Passed: {summary['passed']} (with warnings: {summary['passed_with_warnings']})",
        f"- Failed: {summary['failed']}",
        "",
    ]
    if failed_results:
        lines += ["| Puzzle | Rating | Reason |", "|---|---|---|"]
        for result in failed_results:
            lines.append(
                f"| {result['puzzle_id']} | {result['rating']} | {'; '.join(result['failures'])} |"
            )
    lines.append("")
    lines.append(
        "Passing means Stockfish agrees, at this bounded depth, that each solver move is the only "
        "clearly best move and the line wins. It does not grade pedagogical value or theme labels."
    )
    return "\n".join(lines) + "\n"


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--pack", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--stockfish")
    parser.add_argument("--depth", type=int, default=18)
    parser.add_argument("--threads", type=int, default=4, help="Threads per engine")
    parser.add_argument("--hash", type=int, default=256, help="Hash MB per engine")
    parser.add_argument("--workers", type=int, default=4, help="Parallel engines")
    parser.add_argument("--tolerance-cp", type=int, default=50)
    parser.add_argument("--margin-cp", type=int, default=100)
    parser.add_argument("--payoff-cp", type=int, default=150)
    parser.add_argument("--limit", type=int, help="Verify only the first N puzzles")
    parser.add_argument("--resume", action="store_true", help="Keep results already in --output")
    parser.add_argument(
        "--record", action="store_true", help="Write the summary into the pack's manifest.json"
    )
    parser.add_argument(
        "--prune",
        action="store_true",
        help="With --record: remove failed puzzles from the CSV and re-pin its hash and count",
    )
    args = parser.parse_args()
    stockfish = find_stockfish(args.stockfish)
    manifest, rows = read_pack(args.pack)
    if args.limit:
        rows = rows[: args.limit]
    args.output.mkdir(parents=True, exist_ok=True)
    results_path = args.output / "results.jsonl"
    done = {}
    if results_path.exists():
        if not args.resume:
            raise SystemExit(
                f"{args.output} already holds results; pass --resume or choose a new directory"
            )
        for line in results_path.read_text(encoding="utf-8").splitlines():
            if line.strip():
                saved = json.loads(line)
                done[saved["puzzle_id"]] = saved
    pending = [row for row in rows if row["PuzzleId"] not in done]
    verifier = Verifier(
        stockfish,
        depth=args.depth,
        threads=args.threads,
        hash_mb=args.hash,
        tolerance=args.tolerance_cp,
        margin=args.margin_cp,
        payoff=args.payoff_cp,
    )
    probe = chess.engine.SimpleEngine.popen_uci(stockfish)
    engine_id = probe.id.get("name", "unknown")
    probe.quit()
    started = time.perf_counter()
    lock = threading.Lock()
    completed = 0
    with results_path.open("a", encoding="utf-8") as sink:

        def work(row):
            nonlocal completed
            try:
                result = verifier.verify(row)
            except Exception as exc:  # Preserve the failing row; never silently skip it.
                result = {
                    "puzzle_id": row["PuzzleId"],
                    "rating": row.get("Rating"),
                    "themes": row.get("Themes", "").split(),
                    "failures": [f"verifier error: {type(exc).__name__}: {exc}"],
                    "warnings": [],
                    "passed": False,
                }
            with lock:
                sink.write(json.dumps(result) + "\n")
                sink.flush()
                done[result["puzzle_id"]] = result
                completed += 1
                if completed % 50 == 0 or completed == len(pending):
                    print(
                        f"{completed}/{len(pending)} verified, {time.perf_counter() - started:.0f}s",
                        file=sys.stderr,
                    )
            return result

        with ThreadPoolExecutor(max_workers=args.workers) as pool:
            try:
                list(pool.map(work, pending))
            finally:
                list(pool.map(lambda _: verifier.close(), range(args.workers)))
    results = [done[row["PuzzleId"]] for row in rows if row["PuzzleId"] in done]
    summary = summarize(
        results,
        manifest=manifest,
        args=args,
        engine_id=engine_id,
        elapsed=time.perf_counter() - started,
        stockfish=stockfish,
    )
    failed = [r for r in results if not r["passed"]]
    (args.output / "report.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    (args.output / "report.md").write_text(render(summary, failed), encoding="utf-8")
    print(json.dumps({k: v for k, v in summary.items() if k != "failed_ids"}, indent=1))
    for result in failed:
        print(result["puzzle_id"], "|", "; ".join(result["failures"]))
    if args.record:
        entry = record(args.pack, manifest, summary, results, prune=args.prune)
        print(
            f"Recorded verification in {args.pack / 'manifest.json'}; removed {len(entry['removed'])}"
        )
        return 0
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
