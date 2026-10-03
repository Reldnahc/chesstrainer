"""Run locally the checks CI would select for this branch and working tree."""

import argparse
import os
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from scripts import ci_plan  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "frontend"
NPX = "npx.cmd" if os.name == "nt" else "npx"
NPM = "npm.cmd" if os.name == "nt" else "npm"
# These suites serve the built application; the studios use their own dev servers.
BUILT_SUITES = {"local", "accounts"}


def working_tree_paths():
    """Uncommitted and untracked paths, so the check covers what is about to be committed."""
    changed = subprocess.run(
        ["git", "diff", "--name-only", "-z", "HEAD", "--"],
        cwd=ROOT,
        capture_output=True,
        check=True,
    ).stdout
    untracked = subprocess.run(
        ["git", "ls-files", "--others", "--exclude-standard", "-z"],
        cwd=ROOT,
        capture_output=True,
        check=True,
    ).stdout
    return [path.decode() for path in (changed + untracked).split(b"\0") if path]


def step(name, command, cwd=ROOT):
    started = time.monotonic()
    result = subprocess.run(command, cwd=cwd, capture_output=True, text=True, errors="replace")
    return name, result.returncode, result.stdout + result.stderr, time.monotonic() - started


def report(results):
    failed = False
    for name, code, output, seconds in results:
        print(f"===== {name}: {'passed' if code == 0 else 'FAILED'} in {seconds:.0f}s =====")
        if code:
            print(output.rstrip()[-6000:])
        failed |= code != 0
    return failed


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--base", default="main", help="Branch or commit to compare (default: main)"
    )
    parser.add_argument("--full", action="store_true", help="Run every check")
    parser.add_argument("--dry-run", action="store_true", help="Print the selection only")
    parser.add_argument(
        "--project",
        choices=["desktop", "mobile"],
        help="Run one browser viewport only (CI always runs both)",
    )
    args = parser.parse_args(argv)
    paths = sorted(set(ci_plan.changed_paths(args.base, "HEAD") + working_tree_paths()))
    plan = ci_plan.select_checks(paths, full=args.full)
    selected = [key for key in ("backend", "build") if plan[key]] + plan["suites"]
    print(f"{len(paths)} changed paths: {', '.join(selected) or 'nothing to run'}")
    for reason in plan["reasons"]:
        print(f"- {reason}")
    if args.dry_run or not selected:
        return 0

    started = time.monotonic()
    first = []
    if plan["backend"]:
        lint = ["backend", "scripts", "migrations"]
        first.append(step("ruff", [sys.executable, "-m", "ruff", "check", *lint]))
        first.append(step("format", [sys.executable, "-m", "ruff", "format", "--check", *lint]))
        first.append(step("backend", [sys.executable, "scripts/pytest_parallel.py", "-q"]))
    if plan["build"]:
        # The full build also gates the suites that serve frontend/dist.
        if BUILT_SUITES & set(plan["suites"]):
            first.append(step("build", [NPM, "run", "build"], FRONTEND))
        else:
            first.append(step("types", [NPM, "run", "test:types"], FRONTEND))
    failed = report(first)

    projects = ["--project", args.project] if args.project else []
    suites = [(suite, ci_plan.SUITES[suite]) for suite in plan["suites"]]
    # Each suite owns its port, so different suites run side by side.
    with ThreadPoolExecutor(max(1, len(suites))) as pool:
        browser = list(
            pool.map(
                lambda item: step(
                    item[0],
                    [NPX, "playwright", "test", "--config", item[1], "--reporter=line", *projects],
                    FRONTEND,
                ),
                suites,
            )
        )
    failed |= report(browser)
    print(
        f"{'FAILED' if failed else 'All selected checks passed'} in {time.monotonic() - started:.0f}s"
    )
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
