"""Changed-path optimization must preserve dependent checks and fail closed."""

import json
import subprocess

import pytest

from scripts import ci_plan

ALL_SUITES = ["local", "accounts", "coach-studio", "intelligence-lab", "audio-studio"]
APPLICATION_SUITES = ["local", "accounts", "intelligence-lab"]
PYTHON_SUITES = ["local", "accounts", "intelligence-lab", "audio-studio"]
AUDIO_CONSUMER_SUITES = ["local", "accounts", "intelligence-lab", "audio-studio"]
VOICE_STUDIO_SUITES = ["coach-studio", "audio-studio"]


@pytest.fixture(autouse=True)
def isolate_github_environment(monkeypatch):
    for key in ("GITHUB_OUTPUT", "GITHUB_STEP_SUMMARY", "CI_RESULTS", "CI_SKIP_DOCKER"):
        monkeypatch.delenv(key, raising=False)


def assert_selection(plan, *, backend=False, build=False, docker=False, suites=()):
    assert plan["backend"] is backend
    assert plan["build"] is build
    assert plan["docker"] is docker
    assert plan["suites"] == list(suites)
    assert plan["browser"] is bool(suites)
    assert {entry["suite"] for entry in plan["matrix"]["include"]} == set(suites)


@pytest.mark.parametrize(
    "path",
    ["README.md", "AGENTS.md", "docs/TESTING.md", "docs/example-diagram.png"],
)
def test_documentation_skips_heavy_checks(path):
    assert_selection(ci_plan.select_checks([path]))


@pytest.mark.parametrize(
    "path",
    [
        ".github/workflows/test.yml",
        "scripts/ci_plan.py",
        "scripts/source_archive.mjs",
        "pyproject.toml",
        "requirements.lock",
        "requirements-human-cpu.lock",
        "alembic.ini",
        "Dockerfile",
        ".dockerignore",
        "compose.yaml",
        "LICENSE",
        "NOTICE.md",
        "frontend/package.json",
        "frontend/package-lock.json",
        "frontend/tsconfig.browser-tests.json",
        "frontend/vite.config.ts",
        "frontend/scripts/api-types.mjs",
        "frontend/scripts/style-boundaries.json",
        "frontend/scripts/style-boundaries.mjs",
        "backend/trainer/contracts/games.py",
        "backend/trainer/routes/games.py",
        "backend/trainer/api.py",
        "backend/trainer/config.py",
        "backend/tests/fixtures/api_contract.json",
        "frontend/src/api.ts",
        "frontend/src/api.generated.ts",
        "future-runtime/worker.py",
        "docs/future-executable.py",
        "docs/LICENSE.md",
        "../README.md",
        "/README.md",
        "docs/../README.md",
        "docs\\README.md",
        "",
    ],
)
def test_shared_unknown_and_ambiguous_paths_run_everything(path):
    assert_selection(
        ci_plan.select_checks([path]), backend=True, build=True, docker=True, suites=ALL_SUITES
    )


@pytest.mark.parametrize(
    "path",
    [
        "backend/trainer/game_review.py",
        "migrations/versions/new.py",
        "backend/trainer/_vendor/x/README.md",
    ],
)
def test_backend_runtime_checks_python_dependent_suites_and_container(path):
    assert_selection(
        ci_plan.select_checks([path]), backend=True, build=True, docker=True, suites=PYTHON_SUITES
    )


@pytest.mark.parametrize(
    "path",
    [
        "backend/tests/browser_app.py",
        "backend/tests/review_human_fixtures.py",
        "backend/tests/test_patterns_v3.py",
        "backend/tests/fixtures/review.json",
    ],
)
def test_backend_fixtures_and_transitive_imports_include_intelligence_and_audio(path):
    assert_selection(ci_plan.select_checks([path]), backend=True, build=True, suites=PYTHON_SUITES)


@pytest.mark.parametrize(
    "path",
    sorted(ci_plan.APPLICATION_FRONTEND_FILES)
    + [
        "frontend/src/study/StudyScreen.tsx",
        "frontend/src/study/puzzleApi.ts",
        "frontend/src/srsReview/useReviewSession.ts",
        "frontend/src/gameReview/useGameReviewSession.ts",
        "frontend/public/icon.svg",
    ],
)
def test_audited_application_frontend_paths_skip_coach_but_retain_other_browsers(path):
    if path in ci_plan.APPLICATION_FRONTEND_FILES:
        assert (ci_plan.ROOT / path).is_file()
    assert_selection(
        ci_plan.select_checks([path]), build=True, docker=True, suites=APPLICATION_SUITES
    )


@pytest.mark.parametrize(
    "path",
    [
        "frontend/src/coach/model.ts",
        "frontend/src/coach/idleCoordinator.ts",
        "frontend/src/dialogue/characters/robot.ts",
        "frontend/src/dialogue/gameIntent.ts",
        "frontend/src/ReviewCoach.tsx",
        "frontend/src/motion.ts",
        "frontend/src/useReducedMotion.ts",
        "frontend/src/useSavedPreferences.ts",
        "frontend/src/foundation.css",
        "frontend/src/coach-presentation.css",
        "frontend/src/interface-motion.css",
        "frontend/src/coach/coach.css",
        "frontend/src/srsReview/future.css",
        "frontend/src/gameReview/future.css",
        "frontend/src/gameReview/types.ts",
        "frontend/src/Board.tsx",
        "frontend/src/MotionProvider.tsx",
        "frontend/src/MoveSymbol.tsx",
        "frontend/src/reviewMotion.ts",
        "frontend/src/evaluation.ts",
        "frontend/src/MotionSelect.tsx",
        "frontend/src/EvaluationScore.tsx",
        "frontend/src/motion-select.css",
        "frontend/src/Button.tsx",
        "frontend/src/ActionLink.tsx",
        "frontend/src/action-controls.css",
        "frontend/src/ChoiceGroup.tsx",
        "frontend/src/choice-group.css",
        "frontend/src/coach/ArtworkRig.tsx",
        "frontend/src/dialogue/DialogueText.tsx",
        "frontend/src/useModalDialog.ts",
        "frontend/src/README.md",
    ],
)
def test_shared_frontend_runtime_runs_every_browser_suite_and_container(path):
    assert_selection(ci_plan.select_checks([path]), build=True, docker=True, suites=ALL_SUITES)


@pytest.mark.parametrize(
    "path",
    [
        "frontend/src/FutureSharedComponent.tsx",
        "frontend/src/futureSharedHelper.ts",
        "frontend/src/Notice.tsx",
        "frontend/src/notice.css",
        "frontend/src/new-feature/feature.ts",
        "frontend/src/study/runtime.json",
        "frontend/src/study/StudyScreen.tsx.css",
    ],
)
def test_unclassified_frontend_source_falls_back_to_every_browser_suite(path):
    assert_selection(ci_plan.select_checks([path]), build=True, docker=True, suites=ALL_SUITES)


@pytest.mark.parametrize(
    "path",
    [
        "frontend/src/audio/AudioProvider.tsx",
        "frontend/src/audio/AudioMuteButton.tsx",
        "frontend/src/audio/AudioSettings.tsx",
    ],
)
def test_shared_audio_retains_application_consumers_without_coach_artwork(path):
    assert_selection(
        ci_plan.select_checks([path]), build=True, docker=True, suites=AUDIO_CONSUMER_SUITES
    )


@pytest.mark.parametrize(
    "path",
    [
        *sorted(ci_plan.ALL_AUDIO_CONSUMER_FILES),
        "frontend/src/audio/assets/move.wav",
        "frontend/src/audio/assets/NOTICE.md",
    ],
)
def test_shared_player_dependencies_keep_both_studios_and_application_consumers(path):
    assert_selection(ci_plan.select_checks([path]), build=True, docker=True, suites=ALL_SUITES)


@pytest.mark.parametrize(
    "path",
    [
        *sorted(ci_plan.CAST_AUTHORING_FILES),
        *sorted(ci_plan.SHARED_VOICE_STUDIO_FILES),
        "frontend/src/audio/speech/cast-auditions/design-plan.json",
        "frontend/src/audio/speech/cast-auditions/manifest.json",
        "frontend/src/audio/speech/cast-auditions/tracks.json",
        "frontend/src/audio/speech/cast-auditions/recordings/cat-kitten/soft.mp3",
        "frontend/src/audio/speech/cast-auditions/recordings/cat-kitten/soft.provenance.json",
        "frontend/src/audio/speech/cast-auditions/alignment/cat-kitten-soft.json",
    ],
)
def test_cast_authoring_and_shared_studio_playback_only_select_their_consumers(path):
    plan = ci_plan.select_checks(["docs/AUDIO.md", path])
    assert_selection(plan, build=True, suites=VOICE_STUDIO_SUITES)
    assert all(entry["api"] is False for entry in plan["matrix"]["include"])
    assert all(
        entry["python"] is (entry["suite"] == "audio-studio") for entry in plan["matrix"]["include"]
    )
    assert_selection(
        ci_plan.select_checks([path, "frontend/src/settings.css"]),
        build=True,
        docker=True,
        suites=["local", "accounts", "coach-studio", "audio-studio"],
    )


def test_cast_only_selection_cannot_hide_changed_production_or_shared_dependencies():
    audition = "frontend/src/audio/speech/cast-auditions/manifest.json"
    assert_selection(
        ci_plan.select_checks([audition, "frontend/src/audio/speech/bank/manifest.json"]),
        backend=True,
        build=True,
        docker=True,
        suites=ALL_SUITES,
    )
    assert_selection(
        ci_plan.select_checks([audition, "scripts/record_coach_speech.mjs"]),
        backend=True,
        build=True,
        docker=True,
        suites=ALL_SUITES,
    )
    assert_selection(
        ci_plan.select_checks([audition, "frontend/src/board.css"]),
        build=True,
        docker=True,
        suites=ALL_SUITES,
    )


@pytest.mark.parametrize(
    "path",
    [
        "frontend/src/audio/speech/bank/manifest.json",
        "frontend/src/audio/speech/bank/tracks.json",
        "frontend/src/audio/speech/bank/recordings/walter/sound-sacrifice.mp3",
        "frontend/src/audio/speech/bank/recordings/walter/sound-sacrifice.json",
        "frontend/src/audio/speech/bank/alignment/sound-sacrifice.json",
        "frontend/src/audio/speech/recording-plan.json",
        "frontend/src/audio/speech/voiceBank.ts",
    ],
)
def test_speech_sources_and_artifacts_require_offline_backend_verification(path):
    assert_selection(
        ci_plan.select_checks([path]),
        backend=True,
        build=True,
        docker=True,
        suites=AUDIO_CONSUMER_SUITES,
    )
    assert_selection(
        ci_plan.select_checks(["docs/AUDIO.md", "frontend/src/settings.css", path]),
        backend=True,
        build=True,
        docker=True,
        suites=AUDIO_CONSUMER_SUITES,
    )


@pytest.mark.parametrize(
    "path",
    [
        "frontend/src/gameReview/HumanInsight.tsx",
    ],
)
def test_shared_speech_presentation_keeps_audio_checks_with_application_styles(path):
    assert (ci_plan.ROOT / path).is_file()
    assert_selection(
        ci_plan.select_checks([path]), build=True, docker=True, suites=AUDIO_CONSUMER_SUITES
    )
    assert_selection(
        ci_plan.select_checks([*ci_plan.APPLICATION_CSS, path]),
        build=True,
        docker=True,
        suites=AUDIO_CONSUMER_SUITES,
    )


@pytest.mark.parametrize("path", ["frontend/src/AccountGate.tsx", "frontend/src/Settings.tsx"])
def test_account_and_settings_keep_existing_checks_and_shared_audio_adds_its_suite(path):
    assert_selection(
        ci_plan.select_checks([path]), build=True, docker=True, suites=APPLICATION_SUITES
    )
    assert_selection(
        ci_plan.select_checks([path, "frontend/src/audio/AudioProvider.tsx"]),
        build=True,
        docker=True,
        suites=AUDIO_CONSUMER_SUITES,
    )


@pytest.mark.parametrize(
    "path",
    [
        "frontend/src/Button.tsx",
        "frontend/src/action-controls.css",
        "frontend/src/ChoiceGroup.tsx",
        "frontend/src/choice-group.css",
        "frontend/src/foundation.css",
        "frontend/src/interface-motion.css",
        "frontend/src/useSavedPreferences.ts",
        "frontend/src/MotionProvider.tsx",
    ],
)
def test_audio_only_paths_cannot_hide_changed_shared_dependencies(path):
    assert_selection(
        ci_plan.select_checks(["frontend/src/audio/studio/AudioStudio.tsx", path]),
        build=True,
        docker=True,
        suites=ALL_SUITES,
    )


@pytest.mark.parametrize(
    ("path", "suite"),
    [
        ("frontend/coach-studio/main.tsx", "coach-studio"),
        ("frontend/src/coach/studio/CoachStudio.tsx", "coach-studio"),
        ("frontend/src/coach/studio/SpeechInspector.tsx", "coach-studio"),
        ("frontend/src/coach/studio/speech-inspector.css", "coach-studio"),
        ("frontend/studio-tests/coach-studio.spec.ts", "coach-studio"),
        ("frontend/playwright.coach.config.ts", "coach-studio"),
        ("frontend/intelligence-lab/corpus.ts", "intelligence-lab"),
        ("frontend/intelligence-tests/causal-dialogue.spec.ts", "intelligence-lab"),
        ("frontend/playwright.intelligence.config.ts", "intelligence-lab"),
        ("frontend/audio-studio/main.tsx", "audio-studio"),
        ("frontend/audio-studio/index.html", "audio-studio"),
        ("frontend/src/audio/studio/AudioStudio.tsx", "audio-studio"),
        ("frontend/src/audio/studio/studio.css", "audio-studio"),
        ("frontend/audio-tests/studio.spec.ts", "audio-studio"),
        ("frontend/audio-tests/engine.spec.ts", "audio-studio"),
        ("frontend/playwright.audio.config.ts", "audio-studio"),
        ("frontend/vite.audio.config.ts", "audio-studio"),
        ("frontend/tests/accounts.spec.ts", "accounts"),
        ("frontend/playwright.accounts.config.ts", "accounts"),
    ],
)
def test_isolated_browser_paths_select_their_suite(path, suite):
    assert_selection(ci_plan.select_checks([path]), build=True, suites=[suite])


@pytest.mark.parametrize(
    "path",
    [
        "frontend/studio-tests/fixtures/runtime.ts",
        "frontend/studio-tests/helpers/viteFsPath.ts",
    ],
)
def test_shared_standalone_browser_helpers_keep_audio_and_intelligence(path):
    assert_selection(
        ci_plan.select_checks([path]),
        build=True,
        suites=["coach-studio", "intelligence-lab", "audio-studio"],
    )


@pytest.mark.parametrize(
    "path",
    [
        "frontend/tests/semantic-fixtures.ts",
        "frontend/tests/human-fixtures.ts",
        "frontend/tests/positional-claims.ts",
        "frontend/tests/review.spec.ts",
        "frontend/playwright.config.ts",
    ],
)
def test_browser_fixture_dependencies_include_intelligence_and_audio(path):
    assert_selection(ci_plan.select_checks([path]), build=True, suites=PYTHON_SUITES)


def test_type_tests_run_in_the_build():
    assert_selection(ci_plan.select_checks(["frontend/type-tests/api.ts"]), build=True)


def test_selection_unions_paths_and_does_not_let_docs_hide_runtime_changes():
    paths = [
        "docs/TESTING.md",
        "frontend/studio-tests/cast.spec.ts",
        "backend/trainer/game_review.py",
    ]
    assert_selection(
        ci_plan.select_checks(paths),
        backend=True,
        build=True,
        docker=True,
        suites=ALL_SUITES,
    )
    assert ci_plan.select_checks(paths) == ci_plan.select_checks(paths + paths)


@pytest.mark.parametrize(
    ("dependency", "suites"),
    [
        ("frontend/src/coach/idleCoordinator.ts", ALL_SUITES),
        ("frontend/src/foundation.css", ALL_SUITES),
        ("frontend/src/MotionSelect.tsx", ALL_SUITES),
        ("frontend/src/EvaluationScore.tsx", ALL_SUITES),
        ("frontend/src/ChoiceGroup.tsx", ALL_SUITES),
        ("frontend/src/choice-group.css", ALL_SUITES),
        ("frontend/src/Button.tsx", ALL_SUITES),
        ("frontend/src/action-controls.css", ALL_SUITES),
        ("frontend/src/useModalDialog.ts", ALL_SUITES),
        ("frontend/src/coach/ArtworkRig.tsx", ALL_SUITES),
        ("frontend/src/dialogue/DialogueText.tsx", ALL_SUITES),
        ("frontend/src/useSavedPreferences.ts", ALL_SUITES),
        ("frontend/studio-tests/fixtures/runtime.ts", ALL_SUITES),
        ("frontend/studio-tests/helpers/viteFsPath.ts", ALL_SUITES),
        ("frontend/src/audio/engine.ts", ALL_SUITES),
        ("frontend/audio-tests/studio.spec.ts", AUDIO_CONSUMER_SUITES),
        ("frontend/tests/semantic-fixtures.ts", PYTHON_SUITES),
    ],
)
def test_application_exclusions_do_not_hide_changed_standalone_dependencies(dependency, suites):
    paths = ["docs/TESTING.md", "frontend/src/study/StudyScreen.tsx", dependency]
    assert_selection(ci_plan.select_checks(paths), build=True, docker=True, suites=suites)
    assert ci_plan.select_checks(paths) == ci_plan.select_checks(paths + paths)


@pytest.mark.parametrize("path", sorted(ci_plan.APPLICATION_CSS))
def test_application_styles_skip_standalone_browser_suites(path):
    assert (ci_plan.ROOT / path).is_file()
    assert_selection(
        ci_plan.select_checks([path]), build=True, docker=True, suites=["local", "accounts"]
    )


@pytest.mark.parametrize("path", sorted(ci_plan.APPLICATION_AND_INTELLIGENCE_CSS))
def test_board_styles_skip_coach_but_keep_intelligence(path):
    assert (ci_plan.ROOT / path).is_file()
    assert_selection(
        ci_plan.select_checks([path]), build=True, docker=True, suites=APPLICATION_SUITES
    )


@pytest.mark.parametrize(
    "path",
    [
        "frontend/src/foundation.css",
        "frontend/src/coach-presentation.css",
        "frontend/src/action-controls.css",
        "frontend/src/choice-group.css",
        "frontend/src/motion-select.css",
    ],
)
def test_application_style_exclusions_cannot_hide_shared_styles(path):
    assert_selection(
        ci_plan.select_checks([*ci_plan.APPLICATION_CSS, path]),
        build=True,
        docker=True,
        suites=ALL_SUITES,
    )


def test_board_and_application_styles_keep_all_their_consumers():
    assert_selection(
        ci_plan.select_checks(
            [*ci_plan.APPLICATION_CSS, *ci_plan.APPLICATION_AND_INTELLIGENCE_CSS]
        ),
        build=True,
        docker=True,
        suites=APPLICATION_SUITES,
    )


@pytest.mark.parametrize("paths", [[], ["docs/TESTING.md"], ["frontend/type-tests/api.ts"]])
def test_full_override_covers_every_check(paths):
    assert_selection(
        ci_plan.select_checks(paths, full=True),
        backend=True,
        build=True,
        docker=True,
        suites=ALL_SUITES,
    )


def test_matrix_covers_every_viewport_and_application_coach_shard_with_runtime_dependencies():
    matrix = ci_plan.select_checks([], full=True)["matrix"]["include"]
    assert len(matrix) == 14
    assert len({(entry["suite"], entry["project"], entry["shard"]) for entry in matrix}) == 14
    for suite in ALL_SUITES:
        entries = [entry for entry in matrix if entry["suite"] == suite]
        shards = ["1/2", "2/2"] if suite in {"local", "coach-studio"} else ["1/1"]
        assert {(entry["project"], entry["shard"]) for entry in entries} == {
            (project, shard) for project in ["desktop", "mobile"] for shard in shards
        }
        for entry in entries:
            assert entry["config"] == ci_plan.SUITES[suite]
            assert entry["api"] is (suite in ["local", "accounts"])
            assert entry["python"] is (suite in PYTHON_SUITES)


def test_empty_diff_has_an_empty_matrix():
    plan = ci_plan.select_checks([])
    assert_selection(plan)
    assert plan["matrix"] == {"include": []}


@pytest.fixture
def git_repository(tmp_path):
    def git(*args):
        return subprocess.run(
            ["git", *args], cwd=tmp_path, check=True, capture_output=True, text=True
        ).stdout.strip()

    def commit(*, stage=True):
        if stage:
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

    git("init", "-q")
    return tmp_path, commit


def test_git_diff_preserves_deleted_and_renamed_runtime_paths(git_repository):
    tmp_path, commit = git_repository
    renamed = tmp_path / "backend/trainer/old name.py"
    deleted = tmp_path / "frontend/src/deleted.ts"
    renamed.parent.mkdir(parents=True)
    deleted.parent.mkdir(parents=True)
    renamed.write_text("same content\n", encoding="utf-8")
    deleted.write_text("old code\n", encoding="utf-8")
    base = commit()
    (tmp_path / "docs").mkdir()
    renamed.rename(tmp_path / "docs/old name.md")
    deleted.unlink()
    head = commit()
    paths = ci_plan.changed_paths(base, head, root=tmp_path)
    assert set(paths) == {
        "backend/trainer/old name.py",
        "docs/old name.md",
        "frontend/src/deleted.ts",
    }
    assert set(ci_plan.changed_paths(base, head, root=tmp_path, deleted_only=True)) == {
        "backend/trainer/old name.py",
        "frontend/src/deleted.ts",
    }
    assert_selection(
        ci_plan.select_checks(paths), backend=True, build=True, docker=True, suites=ALL_SUITES
    )
    assert ci_plan.changed_paths(head, head, root=tmp_path) == []
    with pytest.raises(subprocess.CalledProcessError):
        ci_plan.changed_paths("--not-a-revision", head, root=tmp_path)


def test_cli_writes_machine_outputs_and_human_reason(tmp_path, monkeypatch, capsys):
    output = tmp_path / "outputs"
    summary = tmp_path / "summary"
    monkeypatch.setenv("GITHUB_OUTPUT", str(output))
    monkeypatch.setenv("GITHUB_STEP_SUMMARY", str(summary))
    assert ci_plan.main(["--paths", "frontend/tests/accounts.spec.ts"]) == 0
    plan = json.loads(capsys.readouterr().out)
    emitted = {
        key: json.loads(value)
        for key, value in (line.split("=", 1) for line in output.read_text().splitlines())
    }
    assert emitted == {
        "backend": False,
        "build": True,
        "docker": False,
        "browser": True,
        "suites": ["accounts"],
        "browser_matrix": plan["matrix"],
    }
    assert "accounts" in summary.read_text()
    assert plan["reasons"][0] in summary.read_text()


@pytest.mark.parametrize(
    "failure",
    [OSError("git unavailable"), subprocess.CalledProcessError(1, "git"), ValueError("unresolved")],
)
def test_unavailable_diff_runs_full_checks(monkeypatch, capsys, failure):
    def unavailable(*args):
        raise failure

    monkeypatch.setattr(ci_plan, "changed_paths", unavailable)
    assert ci_plan.main(["--base", "missing"]) == 0
    plan = json.loads(capsys.readouterr().out)
    assert_selection(plan, backend=True, build=True, docker=True, suites=ALL_SUITES)
    assert "could not be determined" in plan["reasons"][0]


def test_missing_base_is_full_and_explicit_empty_paths_can_skip(capsys):
    assert ci_plan.main([]) == 0
    assert_selection(
        json.loads(capsys.readouterr().out),
        backend=True,
        build=True,
        docker=True,
        suites=ALL_SUITES,
    )
    assert ci_plan.main(["--paths"]) == 0
    assert_selection(json.loads(capsys.readouterr().out))


def test_full_cli_does_not_need_a_diff(monkeypatch, capsys):
    def unexpected(*args):
        pytest.fail("Full correctness should not depend on available history")

    monkeypatch.setattr(ci_plan, "changed_paths", unexpected)
    assert ci_plan.main(["--full", "--base", "unavailable"]) == 0
    assert_selection(
        json.loads(capsys.readouterr().out),
        backend=True,
        build=True,
        docker=True,
        suites=ALL_SUITES,
    )


@pytest.mark.parametrize("path", ["README.md", "docs/TESTING.md"])
@pytest.mark.parametrize("operation", ["rename", "delete", "edit", "add"])
def test_documentation_edits_skip_but_removing_build_inputs_runs_full(
    git_repository, monkeypatch, capsys, path, operation
):
    tmp_path, commit = git_repository
    document = tmp_path / path
    document.parent.mkdir(parents=True, exist_ok=True)
    if operation == "add":
        (tmp_path / "existing.md").write_text("Existing documentation\n", encoding="utf-8")
    else:
        document.write_text("Original documentation\n", encoding="utf-8")
    base = commit()
    if operation == "rename":
        document.rename(document.with_name("RENAMED.md"))
    elif operation == "delete":
        document.unlink()
    else:
        document.write_text("Updated documentation\n", encoding="utf-8")
    head = commit()
    changed_paths = ci_plan.changed_paths

    def diff(base, head, **options):
        return changed_paths(base, head, root=tmp_path, **options)

    monkeypatch.setattr(ci_plan, "changed_paths", diff)
    assert ci_plan.main(["--base", base, "--head", head]) == 0
    plan = json.loads(capsys.readouterr().out)
    if operation in {"edit", "add"}:
        assert_selection(plan)
    else:
        assert_selection(plan, backend=True, build=True, docker=True, suites=ALL_SUITES)
        assert "removed or renamed" in plan["reasons"][0]


@pytest.mark.parametrize("path", ["README.md", "docs/TESTING.md", "docs/a name.svg"])
@pytest.mark.parametrize("operation", ["add", "replace", "retarget"])
def test_changed_documentation_symlinks_run_full_checks(
    git_repository, monkeypatch, capsys, path, operation
):
    tmp_path, commit = git_repository
    (tmp_path / "existing.md").write_text("Existing documentation\n", encoding="utf-8")
    document = tmp_path / path
    if operation == "replace":
        document.parent.mkdir(parents=True, exist_ok=True)
        document.write_text("Original documentation\n", encoding="utf-8")
    base = commit()

    # Author a real symlink tree entry without requiring Windows symlink
    # privileges or relying on how the working tree materializes that mode.
    def stage_link(target):
        blob = subprocess.run(
            ["git", "hash-object", "-w", "--stdin"],
            cwd=tmp_path,
            input=target,
            text=True,
            check=True,
            capture_output=True,
        ).stdout.strip()
        subprocess.run(
            ["git", "update-index", "--add", "--cacheinfo", f"120000,{blob},{path}"],
            cwd=tmp_path,
            check=True,
            capture_output=True,
        )

    if operation == "retarget":
        stage_link("previous.md")
        base = commit(stage=False)
    stage_link("../existing.md" if path.startswith("docs/") else "existing.md")
    head = commit(stage=False)
    assert not document.is_symlink()
    changed_paths = ci_plan.changed_paths
    assert changed_paths(base, head, root=tmp_path, symlinks_only=True) == [path]
    assert changed_paths(base, head, root=tmp_path, deleted_only=True) == []

    def diff(base, head, **options):
        return changed_paths(base, head, root=tmp_path, **options)

    monkeypatch.setattr(ci_plan, "changed_paths", diff)
    assert ci_plan.main(["--base", base, "--head", head]) == 0
    plan = json.loads(capsys.readouterr().out)
    assert_selection(plan, backend=True, build=True, docker=True, suites=ALL_SUITES)
    assert "Documentation symlinks changed" in plan["reasons"][0]


@pytest.fixture
def successful_jobs():
    return {
        "changes": {
            "result": "success",
            "outputs": {key: "true" for key in ["build", "backend", "browser", "docker"]},
        },
        **{
            job: {"result": "success"}
            for job in ["frontend-build", "backend", "browser", "docker-install"]
        },
    }


def test_gate_accepts_all_successful_checks(successful_jobs):
    assert ci_plan.check_results(successful_jobs) == []


@pytest.mark.parametrize(
    "job", ["changes", "frontend-build", "backend", "browser", "docker-install"]
)
@pytest.mark.parametrize("status", ["failure", "cancelled", "skipped", None])
def test_gate_rejects_unsuccessful_or_missing_selected_jobs(successful_jobs, job, status):
    if status is None:
        del successful_jobs[job]
    else:
        successful_jobs[job]["result"] = status
    assert ci_plan.check_results(successful_jobs)


def test_gate_accepts_intentionally_skipped_unselected_jobs(successful_jobs):
    for key in successful_jobs["changes"]["outputs"]:
        successful_jobs["changes"]["outputs"][key] = "false"
    for job in ["frontend-build", "backend", "browser", "docker-install"]:
        successful_jobs[job]["result"] = "skipped"
    assert ci_plan.check_results(successful_jobs) == []
    successful_jobs["backend"]["result"] = "failure"
    assert ci_plan.check_results(successful_jobs)


@pytest.mark.parametrize("output", ["build", "backend", "browser", "docker"])
@pytest.mark.parametrize("value", [None, "", "TRUE", True, "unexpected", {}])
def test_gate_rejects_missing_or_invalid_selection_outputs(successful_jobs, output, value):
    successful_jobs["changes"]["outputs"][output] = value
    assert ci_plan.check_results(successful_jobs)


def test_release_can_skip_only_docker_validation(successful_jobs):
    successful_jobs["docker-install"]["result"] = "skipped"
    assert ci_plan.check_results(successful_jobs, skip_docker=True) == []
    assert ci_plan.check_results(successful_jobs)
    successful_jobs["backend"]["result"] = "skipped"
    assert ci_plan.check_results(successful_jobs, skip_docker=True)


def test_release_docker_skip_does_not_hide_failure(successful_jobs):
    successful_jobs["docker-install"]["result"] = "failure"
    assert ci_plan.check_results(successful_jobs, skip_docker=True)


@pytest.mark.parametrize("results", [None, [], {}, {"changes": {"result": "success"}}])
def test_gate_rejects_malformed_job_results(results):
    assert ci_plan.check_results(results)


def test_gate_rejects_malformed_job_status(successful_jobs):
    successful_jobs["backend"]["result"] = {}
    assert ci_plan.check_results(successful_jobs)


def test_gate_cli_uses_environment_and_returns_failure(monkeypatch, successful_jobs):
    monkeypatch.setenv("CI_RESULTS", json.dumps(successful_jobs))
    assert ci_plan.main(["--check-results"]) == 0
    successful_jobs["docker-install"]["result"] = "skipped"
    monkeypatch.setenv("CI_RESULTS", json.dumps(successful_jobs))
    assert ci_plan.main(["--check-results"]) == 1
    monkeypatch.setenv("CI_SKIP_DOCKER", "true")
    assert ci_plan.main(["--check-results"]) == 0
    monkeypatch.delenv("CI_RESULTS")
    assert ci_plan.main(["--check-results"]) == 1
