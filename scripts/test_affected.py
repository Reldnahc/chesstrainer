"""Run locally the checks CI would select for this branch and working tree."""

import argparse
import os
import subprocess
import sys
import tempfile
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
# Local runs spread the application suite over the machine's cores the way CI spreads
# it over matrix shards. Each worker owns an application server and database.
LOCAL_WORKERS = max(4, (os.cpu_count() or 4) // 2)


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


def step(name, command, cwd=ROOT, env=None):
    started = time.monotonic()
    result = subprocess.run(
        command,
        cwd=cwd,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        errors="replace",
    )
    return name, result.returncode, result.stdout, time.monotonic() - started


def chain(*steps):
    """Run steps in order, stopping at the first failure, and return every result."""
    results = []
    for name, command, *rest in steps:
        results.append(step(name, command, *rest))
        if results[-1][1]:
            break
    return results


def migrations():
    """Upgrade a throwaway database and compare it with the models, never data/trainer.sqlite3."""
    with tempfile.TemporaryDirectory() as folder:
        env = {**os.environ, "DATABASE_PATH": str(Path(folder) / "migrations.sqlite3")}
        alembic = [sys.executable, "-m", "alembic"]
        _, code, output, seconds = step("migrations", [*alembic, "upgrade", "head"], env=env)
        if code == 0:
            _, code, more, extra = step("migrations", [*alembic, "check"], env=env)
            output, seconds = output + more, seconds + extra
        return "migrations", code, output, seconds


def static_checks(pool):
    """The backend job's contract, migration and voice-bank checks, run beside everything else."""
    return [
        pool.submit(
            step, "contract", [sys.executable, "scripts/export_api_contract.py", "--check"]
        ),
        pool.submit(migrations),
        pool.submit(
            step,
            "voice bank",
            [sys.executable, "-B", "-S", "scripts/prepare_coach_voice_bank.py", "--check"],
        ),
    ]


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
    projects = ["--project", args.project] if args.project else []

    def browser(suite):
        env = os.environ.copy()
        if suite == "local":
            env.setdefault("PLAYWRIGHT_WORKERS", str(LOCAL_WORKERS))
        command = [NPX, "playwright", "test", "--config", ci_plan.SUITES[suite]]
        return step(suite, [*command, "--reporter=line", *projects], FRONTEND, env)

    # The build comes first and alone: it gates the suites that serve frontend/dist,
    # and starved of cores beside everything else it takes several times as long.
    failed = False
    if any(suite in BUILT_SUITES for suite in plan["suites"]):
        failed = report([step("build", [NPM, "run", "build"], FRONTEND)])
    elif plan["build"]:
        failed = report([step("types", [NPM, "run", "test:types"], FRONTEND)])
    suites = [s for s in plan["suites"] if not (failed and s in BUILT_SUITES)]

    # Then the backend tests, every browser suite and the static checks run at once:
    # they share no ports or databases, and each browser worker owns its server.
    pool = ThreadPoolExecutor(10)
    jobs = []
    if plan["backend"]:
        lint = ["backend", "scripts", "migrations"]
        jobs.append(
            pool.submit(
                chain,
                ("ruff", [sys.executable, "-m", "ruff", "check", *lint]),
                ("format", [sys.executable, "-m", "ruff", "format", "--check", *lint]),
                ("backend", [sys.executable, "scripts/pytest_parallel.py", "-q"]),
            )
        )
    jobs += [pool.submit(lambda suite=suite: [browser(suite)]) for suite in suites]
    statics = static_checks(pool) if plan["backend"] else []
    failed |= report([result for job in jobs for result in job.result()])
    failed |= report([future.result() for future in statics])
    pool.shutdown()
    print(
        f"{'FAILED' if failed else 'All selected checks passed'} in {time.monotonic() - started:.0f}s"
    )
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
