"""Opt-in pinned Maia feasibility measurements; requires pre-acquired checkpoints."""

import argparse
import json
import os
import subprocess
import sys
import threading
from importlib.metadata import version
from pathlib import Path
from queue import Empty, Queue
from time import perf_counter

from review_benchmark.corpus import board_for, load_corpus
from review_benchmark.maia_probe import PINS, Probe, checkpoint, validate_source
from review_benchmark.metrics import machine, peak_rss_bytes, summary


class Replies:
    """Keep a stalled native worker from hanging the developer benchmark."""

    def __init__(self, process):
        self.process = process
        self.lines = Queue()
        self.reader = threading.Thread(target=self.read, daemon=True)
        self.reader.start()

    def read(self):
        try:
            for line in self.process.stdout:
                self.lines.put(line)
        finally:
            self.lines.put(None)

    def next(self):
        try:
            line = self.lines.get(timeout=60)
        except Empty as exc:
            self.process.kill()
            self.process.wait(timeout=5)
            raise TimeoutError("Maia benchmark worker exceeded its 60-second deadline") from exc
        if line is None:
            raise RuntimeError("Maia benchmark worker exited without a response")
        return json.loads(line)


def worker(args):
    probe = Probe(args.checkpoints, args.model, args.threads, args.device)
    print(
        json.dumps(
            {
                "ready": True,
                "load_seconds": probe.loaded_seconds,
                "peak_rss_bytes": peak_rss_bytes(),
            }
        ),
        flush=True,
    )
    for line in sys.stdin:
        item = json.loads(line)
        rows = probe.policy(board_for(item), item["self_elo"], item["opponent_elo"])
        print(json.dumps(rows), flush=True)


def measure(args):
    import chess.engine

    validate_source()
    corpus = load_corpus()
    subprocess_engine = None
    process = None
    start = perf_counter()
    if args.method == "uci":
        command = [
            sys.executable,
            "-m",
            "maia3.uci",
            "--model",
            args.model,
            "--checkpoint-path",
            str(checkpoint(args.checkpoints, args.model)),
            "--device",
            args.device,
            "--no-use-amp",
            "--temperature",
            "0",
            "--use-uci-history",
            "--local-files-only",
        ]
        subprocess_engine = chess.engine.SimpleEngine.popen_uci(
            command,
            timeout=60,
            env=os.environ
            | {"OMP_NUM_THREADS": str(args.threads), "MKL_NUM_THREADS": str(args.threads)},
        )
        handshake = perf_counter() - start
        subprocess_engine.ping()
        loaded = {
            "load_seconds": perf_counter() - start - handshake,
            "handshake_seconds": handshake,
            "peak_rss_bytes": None,
        }
    elif args.method == "isolated":
        command = [
            sys.executable,
            __file__,
            "--worker",
            "--model",
            args.model,
            "--checkpoints",
            str(args.checkpoints),
            "--threads",
            str(args.threads),
            "--device",
            args.device,
        ]
        process = subprocess.Popen(
            command,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            env=os.environ | {"HF_HUB_OFFLINE": "1"},
        )
        replies = Replies(process)
        try:
            loaded = replies.next()
        except Exception:
            process.kill()
            process.wait(timeout=5)
            replies.reader.join(timeout=5)
            for stream in (process.stdin, process.stdout, process.stderr):
                stream.close()
            raise
    else:
        probe = Probe(args.checkpoints, args.model, args.threads, args.device)
        loaded = {"load_seconds": probe.loaded_seconds, "peak_rss_bytes": peak_rss_bytes()}
    startup = perf_counter() - start
    passes = []
    try:
        for _ in range(args.repeats):
            rows = []
            for item in corpus["positions"]:
                board = board_for(item)
                for rating in corpus["ratings"]:
                    opponent = rating + 200
                    start = perf_counter()
                    if subprocess_engine:
                        # Only read PV/rank: cp/WDL are deliberately not evidence here.
                        info = subprocess_engine.analyse(
                            board,
                            chess.engine.Limit(nodes=1),
                            multipv=20,
                            info=chess.engine.INFO_PV,
                            options={"SelfElo": rating, "OppoElo": opponent, "Temperature": "0"},
                        )
                        output = [
                            {"uci": entry["pv"][0].uci(), "probability": None} for entry in info
                        ]
                    elif process:
                        process.stdin.write(
                            json.dumps(item | {"self_elo": rating, "opponent_elo": opponent}) + "\n"
                        )
                        process.stdin.flush()
                        output = replies.next()
                    else:
                        output = getattr(probe, args.method)(board, rating, opponent)
                    rows.append(
                        {
                            "id": item["id"],
                            "self_elo": rating,
                            "opponent_elo": opponent,
                            "seconds": perf_counter() - start,
                            "moves": output,
                        }
                    )
            passes.append({"latency": summary([row["seconds"] for row in rows]), "rows": rows})
    finally:
        if subprocess_engine:
            subprocess_engine.quit()
        if process:
            process.stdin.close()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=5)
            replies.reader.join(timeout=5)
            process.stdout.close()
            process.stderr.close()
    stable = (
        all(
            [row["moves"] for row in p["rows"]] == [row["moves"] for row in passes[0]["rows"]]
            for p in passes[1:]
        )
        if len(passes) > 1
        else None
    )
    gpu_peak = None
    if args.device.startswith("cuda") and args.method in {"direct", "policy"}:
        import torch

        gpu_peak = torch.cuda.max_memory_allocated()
    return {
        "schema": "maia-feasibility-1",
        "provenance": json.loads(PINS.read_text(encoding="utf-8")),
        "runtime": {name: version(name) for name in ("torch", "numpy", "maia3")},
        "machine": machine(),
        "model": args.model,
        "method": args.method,
        "threads": args.threads,
        "device": args.device,
        "startup_seconds": startup,
        "loaded": loaded,
        "passes": passes,
        "repeat_exact": stable,
        "parent_peak_rss_bytes": peak_rss_bytes(),
        "gpu_peak_allocated_bytes": gpu_peak,
        "offline": os.environ.get("HF_HUB_OFFLINE") == "1",
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", choices=["5m", "23m", "79m"], default="5m")
    parser.add_argument("--checkpoints", type=Path, required=True)
    parser.add_argument("--threads", type=int, choices=range(1, 17), default=2)
    parser.add_argument("--device", default="cpu")
    parser.add_argument(
        "--method", choices=["uci", "direct", "policy", "isolated"], default="policy"
    )
    parser.add_argument("--repeats", type=int, choices=range(1, 6), default=2)
    parser.add_argument("--worker", action="store_true", help=argparse.SUPPRESS)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    if args.worker:
        worker(args)
        return
    if args.output and args.output.exists():
        parser.error("Use a new output path for each measurement")
    result = json.dumps(measure(args), indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        with args.output.open("x", encoding="utf-8") as out:
            out.write(result + "\n")
        print(f"Saved {args.output}")
    else:
        print(result)


if __name__ == "__main__":
    main()
