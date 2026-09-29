"""Compare releases with a successful ancestor, or request full correctness."""

import json
import os
import re
import subprocess
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = ".github/workflows/docker.yml"
SHA = re.compile(r"(?:[0-9a-f]{40}|[0-9a-f]{64})")


def fetch_runs(repository, token, api_url="https://api.github.com"):
    """The workflow-specific endpoint excludes unrelated successful workflows."""
    if not re.fullmatch(r"[\w.-]+/[\w.-]+", repository) or not token:
        raise ValueError("Missing release repository or token")
    if not api_url.startswith("https://"):
        raise ValueError("The GitHub API must use HTTPS")
    request = Request(
        f"{api_url.rstrip('/')}/repos/{repository}/actions/workflows/docker.yml/runs"
        "?branch=main&status=success&per_page=100",
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {token}",
            "X-GitHub-Api-Version": "2022-11-28",
        },
    )
    with urlopen(request, timeout=15) as response:
        return json.load(response)


def select_base(payload, *, repository, current_run_id, head, root=ROOT):
    """Never use a fork, failed run, current rerun, or non-ancestor as evidence."""
    if not isinstance(payload, dict) or not isinstance(payload.get("workflow_runs"), list):
        raise ValueError("Invalid workflow run response")
    if not SHA.fullmatch(head) or not current_run_id.isdecimal():
        raise ValueError("Missing checked-out release identity")
    candidates = []
    for run in payload["workflow_runs"]:
        if not isinstance(run, dict):
            continue
        run_id = run.get("id")
        sha = run.get("head_sha")
        source = run.get("head_repository")
        path = run.get("path")
        if (
            type(run_id) is not int
            or run_id <= 0
            or str(run_id) == current_run_id
            or not isinstance(sha, str)
            or not SHA.fullmatch(sha)
            or not isinstance(source, dict)
            or str(source.get("full_name", "")).lower() != repository.lower()
            or run.get("head_branch") != "main"
            or run.get("event") not in {"push", "workflow_dispatch"}
            or run.get("status") != "completed"
            or run.get("conclusion") != "success"
            or not isinstance(path, str)
            or path.split("@", 1)[0] != WORKFLOW
        ):
            continue
        candidates.append((run_id, sha))
    # API order normally starts with the newest run; use run IDs explicitly so
    # reruns or an unexpected response order cannot pick a newer non-ancestor.
    for _, sha in sorted(candidates, reverse=True):
        result = subprocess.run(
            ["git", "merge-base", "--is-ancestor", sha, head],
            cwd=root,
            capture_output=True,
            check=False,
        )
        if result.returncode == 0:
            return sha
    return None


def release_plan(*, full=False):
    if full:
        return {"base": "", "full": True, "reason": "Full correctness requested."}
    try:
        repository = os.environ.get("GITHUB_REPOSITORY", "")
        payload = fetch_runs(
            repository,
            os.environ.get("GH_TOKEN", ""),
            os.environ.get("GITHUB_API_URL", "https://api.github.com"),
        )
        base = select_base(
            payload,
            repository=repository,
            current_run_id=os.environ.get("GITHUB_RUN_ID", ""),
            head=os.environ.get("GITHUB_SHA", ""),
        )
    except (OSError, ValueError, TypeError):
        base = None
    if base:
        return {
            "base": base,
            "full": False,
            "reason": f"Checking cumulative changes since successful main release {base}.",
        }
    return {
        "base": "",
        "full": True,
        "reason": "No verified successful release ancestor is available; running full correctness.",
    }


def main():
    plan = release_plan(full=os.environ.get("CI_FULL") == "true")
    if output := os.environ.get("GITHUB_OUTPUT"):
        with Path(output).open("a", encoding="utf-8") as stream:
            stream.write(f"base={plan['base']}\nfull={str(plan['full']).lower()}\n")
    if summary := os.environ.get("GITHUB_STEP_SUMMARY"):
        with Path(summary).open("a", encoding="utf-8") as stream:
            stream.write(f"## Release baseline\n\n{plan['reason']}\n")
    print(json.dumps(plan))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
