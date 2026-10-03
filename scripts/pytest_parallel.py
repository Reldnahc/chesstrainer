"""Run the backend suite as parallel pytest processes over balanced file groups."""

import argparse
import json
import os
import subprocess
import sys
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TESTS = ROOT / "backend" / "tests"
# Seconds per test file from a serial run. Only balance depends on it, so stale
# or missing entries cost speed, never coverage.
DURATIONS = TESTS / "durations.json"


def weight(path, durations):
    if path.name in durations:
        return durations[path.name]
    return 0.2 * max(1, path.read_text(encoding="utf-8").count("def test_"))


def groups(paths, count):
    """Greedily place the heaviest files first so groups finish together."""
    durations = json.loads(DURATIONS.read_text(encoding="utf-8")) if DURATIONS.exists() else {}
    buckets = [[0.0, []] for _ in range(count)]
    for path in sorted(paths, key=lambda path: (-weight(path, durations), path.name)):
        bucket = min(buckets, key=lambda bucket: bucket[0])
        bucket[0] += weight(path, durations)
        bucket[1].append(path)
    return [sorted(files) for _, files in buckets if files]


def run(index, files, extra, temp):
    command = [
        sys.executable,
        "-m",
        "pytest",
        "-p",
        "no:cacheprovider",
        f"--basetemp={Path(temp) / f'group-{index}'}",
        *extra,
        *(str(path.relative_to(ROOT)) for path in files),
    ]
    started = time.monotonic()
    result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, errors="replace")
    return result.returncode, result.stdout + result.stderr, time.monotonic() - started


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "-n",
        "--processes",
        type=int,
        default=min(8, os.cpu_count() or 1),
        help="Parallel pytest processes (default: CPU count, at most 8)",
    )
    # Every other argument is passed to each pytest process (for example -q or -k).
    args, extra = parser.parse_known_args(argv)
    paths = sorted(TESTS.glob("test_*.py"))
    plan = groups(paths, max(1, args.processes))
    with tempfile.TemporaryDirectory(prefix="pytest-parallel-") as temp:
        with ThreadPoolExecutor(len(plan)) as pool:
            results = list(pool.map(lambda item: run(*item, extra, temp), enumerate(plan)))
    for index, (code, output, seconds) in enumerate(results):
        print(
            f"===== group {index + 1}/{len(plan)}: {len(plan[index])} files, {seconds:.0f}s ====="
        )
        print(output.rstrip())
    codes = [code for code, _, _ in results]
    # Exit code 5 is "no tests collected": fine for one group under -k, never for all.
    failed = any(code not in (0, 5) for code in codes) or all(code == 5 for code in codes)
    print(f"{len(plan)} groups, {'FAILED' if failed else 'passed'}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
