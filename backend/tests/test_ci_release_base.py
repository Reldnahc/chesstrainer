"""Release selection must carry unverified changes across failed or cancelled runs."""

import io
import json
import subprocess
from urllib.error import URLError

import pytest

from scripts import ci_release_base

REPOSITORY = "owner/project"


@pytest.fixture(autouse=True)
def isolate_release_environment(monkeypatch):
    for name in (
        "CI_FULL",
        "GH_TOKEN",
        "GITHUB_API_URL",
        "GITHUB_OUTPUT",
        "GITHUB_STEP_SUMMARY",
        "GITHUB_REPOSITORY",
        "GITHUB_RUN_ID",
        "GITHUB_SHA",
    ):
        monkeypatch.delenv(name, raising=False)


@pytest.fixture
def history(tmp_path):
    def git(*args):
        return subprocess.run(
            ["git", *args], cwd=tmp_path, check=True, capture_output=True, text=True
        ).stdout.strip()

    def commit(name, content):
        (tmp_path / name).write_text(content, encoding="utf-8")
        git("add", ".")
        git(
            "-c",
            "user.name=CI Test",
            "-c",
            "user.email=ci@example.invalid",
            "-c",
            "commit.gpgsign=false",
            "commit",
            "-qm",
            "fixture",
        )
        return git("rev-parse", "HEAD")

    git("init", "-q", "-b", "main")
    base = commit("app.ts", "released\n")
    failed = commit("app.ts", "not yet verified\n")
    head = commit("README.md", "documentation only follow-up\n")
    git("checkout", "-q", "-b", "divergent", base)
    unrelated = commit("another.ts", "different branch\n")
    git("checkout", "-q", "main")
    return {"root": tmp_path, "base": base, "failed": failed, "head": head, "other": unrelated}


def run(sha, run_id=1, **overrides):
    return {
        "id": run_id,
        "head_sha": sha,
        "head_repository": {"full_name": REPOSITORY},
        "head_branch": "main",
        "event": "push",
        "status": "completed",
        "conclusion": "success",
        "path": ci_release_base.WORKFLOW,
        **overrides,
    }


def select(history, runs, current_run_id="100"):
    return ci_release_base.select_base(
        {"workflow_runs": runs},
        repository=REPOSITORY,
        current_run_id=current_run_id,
        head=history["head"],
        root=history["root"],
    )


@pytest.mark.parametrize("conclusion", ["failure", "cancelled", "skipped", "timed_out", None])
def test_followup_retains_runtime_changes_from_unsuccessful_release(history, conclusion):
    base = select(
        history,
        [run(history["failed"], 2, conclusion=conclusion), run(history["base"])],
    )
    assert base == history["base"]
    paths = subprocess.run(
        ["git", "diff", "--name-only", base, history["head"], "--"],
        cwd=history["root"],
        check=True,
        capture_output=True,
        text=True,
    ).stdout.splitlines()
    assert set(paths) == {"app.ts", "README.md"}


def test_newest_successful_ancestor_is_chosen_regardless_of_response_order(history):
    assert select(history, [run(history["base"]), run(history["failed"], 2)]) == history["failed"]


def test_newer_non_ancestor_and_unavailable_commit_do_not_hide_verified_ancestor(history):
    assert (
        select(
            history,
            [run("f" * 40, 4), run(history["other"], 3), run(history["base"])],
        )
        == history["base"]
    )


@pytest.mark.parametrize(
    "overrides",
    [
        {"id": "12"},
        {"id": True},
        {"id": -1},
        {"head_repository": {"full_name": "fork/project"}},
        {"head_repository": None},
        {"head_branch": "feature"},
        {"head_branch": None},
        {"event": "pull_request"},
        {"status": "in_progress"},
        {"path": ".github/workflows/test.yml"},
        {"head_sha": "main"},
        {"head_sha": "--help"},
        {"head_sha": "a" * 41},
        {"head_sha": None},
    ],
)
def test_untrusted_or_incomplete_run_metadata_cannot_supply_baseline(history, overrides):
    assert select(history, [run(history["failed"], 2, **overrides)]) is None


def test_current_run_is_excluded_when_it_is_rerun(history):
    assert select(history, [run(history["head"], 100), run(history["base"])]) == history["base"]


def test_prior_successful_manual_release_on_main_can_supply_baseline(history):
    assert (
        select(
            history,
            [
                run(
                    history["base"],
                    event="workflow_dispatch",
                    path=ci_release_base.WORKFLOW + "@refs/heads/main",
                )
            ],
        )
        == history["base"]
    )


@pytest.mark.parametrize("payload", [None, [], {}, {"workflow_runs": None}])
def test_malformed_api_response_is_rejected(payload):
    with pytest.raises(ValueError):
        ci_release_base.select_base(
            payload, repository=REPOSITORY, current_run_id="100", head="a" * 40
        )


def test_fetch_is_scoped_to_successful_main_release_workflow_runs(monkeypatch):
    def request(request, *, timeout):
        assert request.full_url == (
            "https://api.github.com/repos/owner/project/actions/workflows/docker.yml/runs"
            "?branch=main&status=success&per_page=100"
        )
        assert request.get_header("Authorization") == "Bearer test-token"
        assert timeout == 15
        return io.BytesIO(b'{"workflow_runs": []}')

    monkeypatch.setattr(ci_release_base, "urlopen", request)
    assert ci_release_base.fetch_runs(REPOSITORY, "test-token") == {"workflow_runs": []}


@pytest.mark.parametrize(
    "failure",
    [URLError("offline"), TimeoutError("timed out"), ValueError("invalid JSON"), OSError("git")],
)
def test_unavailable_release_evidence_requests_full_checks(monkeypatch, failure):
    def unavailable(*args):
        raise failure

    monkeypatch.setattr(ci_release_base, "fetch_runs", unavailable)
    plan = ci_release_base.release_plan()
    assert plan["full"] is True and plan["base"] == ""


def test_manual_full_does_not_depend_on_api_or_git(monkeypatch):
    def unexpected(*args):
        pytest.fail("A full release must not depend on API availability")

    monkeypatch.setattr(ci_release_base, "fetch_runs", unexpected)
    assert ci_release_base.release_plan(full=True)["full"] is True


def test_successful_lookup_writes_the_base_and_selection_outputs(
    history, monkeypatch, tmp_path, capsys
):
    monkeypatch.setenv("GITHUB_REPOSITORY", REPOSITORY)
    monkeypatch.setenv("GITHUB_RUN_ID", "100")
    monkeypatch.setenv("GITHUB_SHA", history["head"])
    monkeypatch.setattr(
        ci_release_base,
        "fetch_runs",
        lambda *args: {"workflow_runs": [run(history["base"])]},
    )
    original = ci_release_base.select_base
    monkeypatch.setattr(
        ci_release_base,
        "select_base",
        lambda *args, **kwargs: original(*args, **kwargs, root=history["root"]),
    )
    output = tmp_path / "output"
    summary = tmp_path / "summary"
    monkeypatch.setenv("GITHUB_OUTPUT", str(output))
    monkeypatch.setenv("GITHUB_STEP_SUMMARY", str(summary))
    assert ci_release_base.main() == 0
    plan = json.loads(capsys.readouterr().out)
    assert plan["base"] == history["base"] and plan["full"] is False
    assert output.read_text() == f"base={history['base']}\nfull=false\n"
    assert history["base"] in summary.read_text()


def test_missing_successful_baseline_writes_explicit_full_fallback(monkeypatch, tmp_path):
    monkeypatch.setattr(ci_release_base, "fetch_runs", lambda *args: {"workflow_runs": []})
    monkeypatch.setenv("GITHUB_SHA", "a" * 40)
    monkeypatch.setenv("GITHUB_RUN_ID", "100")
    output = tmp_path / "output"
    monkeypatch.setenv("GITHUB_OUTPUT", str(output))
    assert ci_release_base.main() == 0
    assert output.read_text() == "base=\nfull=true\n"
