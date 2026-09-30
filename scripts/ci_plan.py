"""Select correctness checks from changed paths, falling back to full coverage."""

import argparse
import json
import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SUITES = {
    "local": "playwright.config.ts",
    "accounts": "playwright.accounts.config.ts",
    "coach-studio": "playwright.coach.config.ts",
    "intelligence-lab": "playwright.intelligence.config.ts",
    "audio-studio": "playwright.audio.config.ts",
}
API_SUITES = {"local", "accounts"}
# Intelligence regressions execute Python fixtures without starting an API server.
PYTHON_SUITES = API_SUITES | {"intelligence-lab"}
# The frontend build enforces these same exclusions against Vite's resolved
# standalone dependencies, including nested CSS imports.
STYLE_BOUNDARIES = json.loads(
    (ROOT / "frontend/scripts/style-boundaries.json").read_text(encoding="utf-8")
)
APPLICATION_CSS = {f"frontend/{path}" for path in STYLE_BOUNDARIES["applicationOnly"]}
APPLICATION_AND_INTELLIGENCE_CSS = {
    f"frontend/{path}" for path in STYLE_BOUNDARIES["applicationAndIntelligence"]
}
# These application modules are outside the standalone coach entrypoint and test
# imports. Keep additions explicit: unclassified source still runs every suite.
APPLICATION_FRONTEND_FILES = {
    "frontend/src/AccountGate.tsx",
    "frontend/src/App.tsx",
    "frontend/src/ContinuationMoves.tsx",
    "frontend/src/EmptyState.tsx",
    "frontend/src/EvaluationGraph.tsx",
    "frontend/src/EvidenceDialog.tsx",
    "frontend/src/GameHistory.tsx",
    "frontend/src/GameReview.tsx",
    "frontend/src/GameSync.tsx",
    "frontend/src/Home.tsx",
    "frontend/src/Import.tsx",
    "frontend/src/ImportControls.tsx",
    "frontend/src/Link.tsx",
    "frontend/src/LoadState.tsx",
    "frontend/src/MotionSettings.tsx",
    "frontend/src/MoveBadge.tsx",
    "frontend/src/MovePlaybackControls.tsx",
    "frontend/src/MoveStatus.tsx",
    "frontend/src/Notice.tsx",
    "frontend/src/Onboarding.tsx",
    "frontend/src/PageTitle.tsx",
    "frontend/src/Pagination.tsx",
    "frontend/src/PreferenceStatus.tsx",
    "frontend/src/ProviderImport.tsx",
    "frontend/src/ProviderUsernameField.tsx",
    "frontend/src/ResumeLink.tsx",
    "frontend/src/ReturnButton.tsx",
    "frontend/src/Review.tsx",
    "frontend/src/ReviewExplanation.tsx",
    "frontend/src/ReviewWorkspace.tsx",
    "frontend/src/SectionNavigation.tsx",
    "frontend/src/Settings.tsx",
    "frontend/src/StatList.tsx",
    "frontend/src/TurnIndicator.tsx",
    "frontend/src/Weaknesses.tsx",
    "frontend/src/main.tsx",
    "frontend/src/navigation.ts",
}
APPLICATION_AND_AUDIO_FRONTEND_FILES = {
    "frontend/src/SourceLine.tsx",
    "frontend/src/source-line.css",
    "frontend/src/disclosure.css",
}
APPLICATION_FRONTEND_PREFIXES = (
    "frontend/src/study/",
    "frontend/src/srsReview/",
    "frontend/src/gameReview/",
)
SHARED_FILES = {
    "backend/trainer/api.py",
    "backend/trainer/config.py",
    "backend/tests/fixtures/api_contract.json",
    "frontend/src/api.ts",
    "frontend/src/api.generated.ts",
}
SHARED_PREFIXES = (
    ".github/",
    "scripts/",
    "frontend/scripts/",
    "backend/trainer/contracts/",
    "backend/trainer/routes/",
)
DOC_EXTENSIONS = {".md", ".rst", ".txt", ".adoc", ".png", ".jpg", ".jpeg", ".svg", ".webp"}


def browser_matrix(suites):
    """Keep every viewport and shard explicit so job results can gate the release."""
    return {
        "include": [
            {
                "suite": suite,
                "config": SUITES[suite],
                "project": project,
                "shard": shard,
                "api": suite in API_SUITES,
                "python": suite in PYTHON_SUITES,
            }
            for suite in suites
            for project in ("desktop", "mobile")
            for shard in (("1/2", "2/2") if suite in {"local", "coach-studio"} else ("1/1",))
        ]
    }


def _documentation(path):
    # Do not skip Markdown under production directories: vendors and runtime data
    # can package it. Notices and licenses also participate in the source offer.
    name = path.rsplit("/", 1)[-1].lower()
    if name.startswith(("license", "notice", "copying")):
        return False
    if path.startswith("docs/"):
        return Path(path).suffix.lower() in DOC_EXTENSIONS
    return "/" not in path and Path(path).suffix.lower() in {".md", ".rst", ".adoc"}


def select_checks(paths, full=False):
    """Return the union of required checks; unrecognized paths always select all."""
    backend = build = docker = False
    suites = set()
    reasons = []

    def reason(message):
        if message not in reasons:
            reasons.append(message)

    if full:
        backend = build = docker = True
        suites.update(SUITES)
        reason("Full correctness requested.")
    else:
        for path in paths:
            # Git paths are repo-relative POSIX names. Reject ambiguous input,
            # including traversal that might otherwise resemble documentation.
            if (
                not path
                or "\\" in path
                or path.startswith("/")
                or any(part in {".", "..", ""} for part in path.split("/"))
            ):
                backend = build = docker = True
                suites.update(SUITES)
                reason("Unrecognized paths require full correctness.")
            elif path in SHARED_FILES or path.startswith(SHARED_PREFIXES):
                backend = build = docker = True
                suites.update(SUITES)
                reason("Shared API, workflow, or build tooling changed.")
            elif _documentation(path):
                reason("Documentation paths do not require heavy checks.")
            elif path.startswith("backend/") or path.startswith("migrations/"):
                backend = build = True
                docker |= not path.startswith("backend/tests/")
                # Python fixture imports cross test modules and production code.
                suites.update(PYTHON_SUITES)
                reason("Backend changes require Python and dependent browser checks.")
            elif path in APPLICATION_CSS:
                build = docker = True
                suites.update(API_SUITES)
                reason("Application-only styles require application and account browser checks.")
            elif path in APPLICATION_AND_INTELLIGENCE_CSS:
                build = docker = True
                suites.update(PYTHON_SUITES)
                reason("Board styles require application and intelligence browser checks.")
            elif path.startswith(
                ("frontend/audio-studio/", "frontend/audio-tests/", "frontend/src/audio/studio/")
            ) or path in {"frontend/playwright.audio.config.ts", "frontend/vite.audio.config.ts"}:
                build = True
                suites.add("audio-studio")
                reason("Audio studio changes require its browser suite and the build.")
            elif (
                path.startswith("frontend/src/audio/")
                or path in APPLICATION_AND_AUDIO_FRONTEND_FILES
            ):
                build = docker = True
                suites.update(PYTHON_SUITES | {"audio-studio"})
                reason("Shared audio changes require application, intelligence and audio checks.")
            elif (
                path in APPLICATION_FRONTEND_FILES
                or (
                    path.startswith(APPLICATION_FRONTEND_PREFIXES)
                    and path.endswith((".ts", ".tsx"))
                    and path != "frontend/src/gameReview/types.ts"
                )
                or path.startswith("frontend/public/")
            ):
                # The standalone entrypoints disable publicDir. CSS exclusions
                # are separately declared and enforced by the frontend build.
                build = docker = True
                suites.update(PYTHON_SUITES)
                reason("Application frontend changes require application and intelligence checks.")
            elif path.startswith("frontend/src/"):
                build = docker = True
                suites.update(SUITES)
                reason("Shared or unclassified frontend source requires all browser suites.")
            elif path.startswith(("frontend/coach-studio/", "frontend/studio-tests/")) or (
                path == "frontend/playwright.coach.config.ts"
            ):
                build = True
                suites.add("coach-studio")
                reason("Coach studio changes require its browser suite and the build.")
            elif path.startswith(
                ("frontend/intelligence-lab/", "frontend/intelligence-tests/")
            ) or (path == "frontend/playwright.intelligence.config.ts"):
                build = True
                suites.add("intelligence-lab")
                reason("Intelligence lab changes require its browser suite and the build.")
            elif path in {
                "frontend/tests/accounts.spec.ts",
                "frontend/playwright.accounts.config.ts",
            }:
                build = True
                suites.add("accounts")
                reason("Account browser changes require the accounts suite and the build.")
            elif path.startswith("frontend/tests/") or path == "frontend/playwright.config.ts":
                build = True
                suites.update(PYTHON_SUITES)
                reason("Shared browser tests and fixtures require their dependent suites.")
            elif path.startswith("frontend/type-tests/"):
                build = True
                reason("Type regressions run in the frontend build.")
            else:
                # Includes dependencies, TypeScript/Vite settings, Docker inputs,
                # new directories and future runtime/configuration file types.
                backend = build = docker = True
                suites.update(SUITES)
                reason("Unrecognized or shared configuration paths require full correctness.")

    if not reasons:
        reason("No changed paths.")
    ordered_suites = [suite for suite in SUITES if suite in suites]
    return {
        "backend": backend,
        "build": build,
        "docker": docker,
        "browser": bool(ordered_suites),
        "suites": ordered_suites,
        "matrix": browser_matrix(ordered_suites),
        "reasons": reasons,
    }


def changed_paths(base, head, root=ROOT, *, deleted_only=False, symlinks_only=False):
    """Diff verified commits, representing renames as deletion plus addition."""
    commits = []
    for revision in (base, head):
        commit = subprocess.run(
            ["git", "rev-parse", "--verify", "--end-of-options", f"{revision}^{{commit}}"],
            cwd=root,
            check=True,
            capture_output=True,
            text=True,
        ).stdout.strip()
        if not re.fullmatch(r"[0-9a-f]{40,64}", commit):
            raise ValueError("Git did not resolve a commit")
        commits.append(commit)
    flags = ["--diff-filter=D"] if deleted_only else []
    output = subprocess.run(
        [
            "git",
            "diff",
            "--raw" if symlinks_only else "--name-only",
            "--no-renames",
            "-z",
            *flags,
            *commits,
            "--",
        ],
        cwd=root,
        check=True,
        capture_output=True,
    ).stdout
    records = output.split(b"\0")
    if records.pop():
        raise ValueError("Git returned an unterminated changed path")
    if symlinks_only:
        # --raw -z --no-renames emits alternating metadata and path records.
        # Read the destination mode from Git, since Windows can check symlinks
        # out as regular files and a filesystem check would miss them.
        symlinks = []
        for metadata, name in zip(records[::2], records[1::2], strict=True):
            mode = re.fullmatch(rb":[0-7]{6} ([0-7]{6}) [0-9a-f]+ [0-9a-f]+ [A-Z][0-9]*", metadata)
            if mode is None:
                raise ValueError("Git returned malformed changed-path metadata")
            if mode[1] == b"120000":
                symlinks.append(name)
        records = symlinks
    return [name.decode("utf-8", errors="surrogateescape") for name in records]


def write_outputs(plan):
    output_path = os.environ.get("GITHUB_OUTPUT")
    if output_path:
        outputs = {key: plan[key] for key in ("backend", "build", "docker", "browser", "suites")}
        outputs["browser_matrix"] = plan["matrix"]
        with Path(output_path).open("a", encoding="utf-8") as stream:
            for key, value in outputs.items():
                stream.write(f"{key}={json.dumps(value, separators=(',', ':'))}\n")
    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary_path:
        selected = [key for key in ("backend", "build", "docker") if plan[key]]
        selected.extend(plan["suites"])
        with Path(summary_path).open("a", encoding="utf-8") as stream:
            stream.write("## Correctness selection\n\n")
            stream.write(f"Checks: {', '.join(selected) or 'documentation only / no changes'}.\n\n")
            for message in plan["reasons"]:
                stream.write(f"- {message}\n")


def check_results(results, skip_docker=False):
    """Reject failed or accidentally skipped selected jobs at the stable CI gate."""
    if not isinstance(results, dict):
        return ["CI_RESULTS must be a JSON object."]
    changes = results.get("changes")
    if not isinstance(changes, dict) or changes.get("result") != "success":
        return ["The changes job did not succeed."]
    outputs = changes.get("outputs")
    if not isinstance(outputs, dict):
        return ["The changes job did not produce selection outputs."]
    errors = []
    jobs = {
        "build": "frontend-build",
        "backend": "backend",
        "browser": "browser",
        "docker": "docker-install",
    }
    for output, job in jobs.items():
        selected = outputs.get(output)
        if selected not in ("true", "false"):
            errors.append(f"The changes job produced an invalid {output} selection.")
            continue
        required = selected == "true" and not (output == "docker" and skip_docker)
        result = results.get(job)
        status = result.get("result") if isinstance(result, dict) else None
        allowed = ("success",) if required else ("success", "skipped")
        if status not in allowed:
            errors.append(
                f"{job}: expected {'success' if required else 'success or skipped'}, got {status!r}."
            )
    return errors


def _check_results_from_environment():
    try:
        results = json.loads(os.environ.get("CI_RESULTS", ""))
    except json.JSONDecodeError:
        errors = ["CI_RESULTS is missing or invalid JSON."]
    else:
        errors = check_results(results, skip_docker=os.environ.get("CI_SKIP_DOCKER") == "true")
    if errors:
        print("Correctness gate failed:\n" + "\n".join(errors), file=sys.stderr)
        return 1
    print("All selected correctness checks passed.")
    return 0


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", help="Base commit for the changed-path comparison")
    parser.add_argument("--head", default="HEAD", help="Checked-out commit to verify")
    parser.add_argument("--full", action="store_true", help="Run all checks regardless of paths")
    parser.add_argument("--paths", nargs="*", help="Explicit repo-relative changed paths")
    parser.add_argument(
        "--check-results", action="store_true", help="Validate CI_RESULTS at the final gate"
    )
    args = parser.parse_args(argv)
    if args.check_results:
        return _check_results_from_environment()
    fallback = None
    paths = args.paths
    if not args.full and paths is None:
        if not args.base:
            fallback = "No base commit was supplied; running full correctness."
        else:
            try:
                paths = changed_paths(args.base, args.head)
                # Docker COPY requires README.md and the docs tree. Preserve
                # docs-only edits, but fail broad for removed/renamed inputs or
                # symlinks, which the source archive rejects during the build.
                deleted = changed_paths(args.base, args.head, deleted_only=True)
                if any(_documentation(path) for path in deleted):
                    fallback = (
                        "Documentation was removed or renamed; verifying required build inputs."
                    )
                elif any(
                    _documentation(path)
                    for path in changed_paths(args.base, args.head, symlinks_only=True)
                ):
                    fallback = "Documentation symlinks changed; verifying supported build inputs."
            except (OSError, subprocess.CalledProcessError, ValueError):
                fallback = "Changed paths could not be determined; running full correctness."
    plan = select_checks(paths or [], full=args.full or fallback is not None)
    if fallback:
        plan["reasons"].insert(0, fallback)
    write_outputs(plan)
    print(json.dumps(plan, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
