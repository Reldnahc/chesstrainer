"""Offline speech tracks must retain source identity and gap-free cue timing."""

import hashlib
import json
import subprocess
import sys
from copy import deepcopy
from pathlib import Path

import pytest

from scripts import align_coach_speech as alignment

ROOT = Path(__file__).resolve().parents[2]
SPEECH = ROOT / "frontend/src/audio/speech"
PLAN_PATH = "frontend/src/audio/speech/walter-contrasts-plan.json"


@pytest.fixture(params=["sound-sacrifice", "allowed-mate"])
def saved_track(request):
    script_id = request.param
    plan = json.loads((ROOT / PLAN_PATH).read_text(encoding="utf-8"))
    script = next(script for script in plan["scripts"] if script["id"] == script_id)
    recording = SPEECH / "recordings/walter-contrasts-v1/walter" / f"{script_id}.opus"
    recorded = json.loads(recording.with_suffix(".provenance.json").read_text(encoding="utf-8"))
    track = json.loads((SPEECH / "alignment" / f"{script_id}.json").read_text(encoding="utf-8"))
    return track, script, recording, recorded


def check_saved_track(inputs):
    alignment.check_track(*inputs, PLAN_PATH)


@pytest.fixture
def rhubarb_result():
    return {
        "metadata": {"soundFile": "recording.wav", "duration": 1.23},
        "mouthCues": [
            {"start": 0.0, "end": 0.12, "value": "A"},
            {"start": 0.12, "end": 0.4, "value": "D"},
            {"start": 0.4, "end": 1.23, "value": "X"},
        ],
    }


def test_valid_cues_preserve_generated_timing_without_mutating_result(rhubarb_result):
    original = deepcopy(rhubarb_result)

    cues = alignment.validate_cues(rhubarb_result, 1.2399)

    assert cues == original["mouthCues"]
    assert rhubarb_result == original


@pytest.mark.parametrize("shape", list("ABCDEFGHX"))
def test_each_supported_shape_is_accepted(rhubarb_result, shape):
    rhubarb_result["mouthCues"][1]["value"] = shape

    assert alignment.validate_cues(rhubarb_result, 1.2399)[1]["value"] == shape


@pytest.mark.parametrize("decoded_duration", [1.23, 1.2300000000000002, 1.239999])
def test_metadata_duration_uses_centisecond_truncation(rhubarb_result, decoded_duration):
    assert alignment.validate_cues(rhubarb_result, decoded_duration)


@pytest.mark.parametrize("duration", [1.22, 1.24, 1.2301, 1.2399])
def test_wrong_metadata_duration_is_rejected_even_when_final_cue_matches(rhubarb_result, duration):
    rhubarb_result["metadata"]["duration"] = duration
    rhubarb_result["mouthCues"][-1]["end"] = duration

    with pytest.raises(ValueError):
        alignment.validate_cues(rhubarb_result, 1.2399)


@pytest.mark.parametrize("field", ["start", "end"])
@pytest.mark.parametrize("value", [True, False, None, "0.12", float("nan"), float("inf")])
def test_cue_times_must_be_finite_numbers_not_booleans(rhubarb_result, field, value):
    rhubarb_result["mouthCues"][1][field] = value

    with pytest.raises(ValueError):
        alignment.validate_cues(rhubarb_result, 1.2399)


@pytest.mark.parametrize("duration", [True, False, None, "1.23", 0, -1, float("nan"), float("inf")])
def test_metadata_duration_must_be_finite_and_positive(rhubarb_result, duration):
    rhubarb_result["metadata"]["duration"] = duration

    with pytest.raises(ValueError):
        alignment.validate_cues(rhubarb_result, 1.2399)


@pytest.mark.parametrize(
    "duration", [True, False, None, "1.2399", 0, -1, float("nan"), float("inf")]
)
def test_decoded_duration_must_be_finite_and_positive(rhubarb_result, duration):
    with pytest.raises(ValueError):
        alignment.validate_cues(rhubarb_result, duration)


@pytest.mark.parametrize("shape", ["", "I", "a", "AA", None, 1])
def test_unknown_mouth_shapes_are_rejected(rhubarb_result, shape):
    rhubarb_result["mouthCues"][1]["value"] = shape

    with pytest.raises(ValueError):
        alignment.validate_cues(rhubarb_result, 1.2399)


@pytest.mark.parametrize(
    ("index", "field", "value"),
    [
        (0, "start", -0.01),
        (0, "start", 0.01),
        (1, "start", 0.13),
        (1, "start", 0.11),
        (1, "end", 0.12),
        (1, "end", 0.1),
        (2, "end", 1.22),
        (2, "end", 1.24),
    ],
    ids=[
        "negative-start",
        "missing-opening",
        "gap",
        "overlap",
        "empty-interval",
        "reversed-interval",
        "missing-ending",
        "beyond-duration",
    ],
)
def test_cues_cover_the_recording_once_in_order(rhubarb_result, index, field, value):
    rhubarb_result["mouthCues"][index][field] = value

    with pytest.raises(ValueError):
        alignment.validate_cues(rhubarb_result, 1.2399)


@pytest.mark.parametrize("cues", [[], None, {}, "AX", [None], [1], [{}]])
def test_missing_or_malformed_cues_are_rejected(rhubarb_result, cues):
    rhubarb_result["mouthCues"] = cues

    with pytest.raises(ValueError):
        alignment.validate_cues(rhubarb_result, 1.2399)


@pytest.mark.parametrize("field", ["start", "end", "value"])
def test_incomplete_cues_are_rejected(rhubarb_result, field):
    del rhubarb_result["mouthCues"][1][field]

    with pytest.raises(ValueError):
        alignment.validate_cues(rhubarb_result, 1.2399)


def test_saved_tracks_match_unchanged_recordings_and_exact_plan_text(saved_track, monkeypatch):
    def no_native_tools(*args, **kwargs):
        pytest.fail("Offline track checks must not decode audio or launch native tools")

    monkeypatch.setattr(alignment, "decode", no_native_tools)
    monkeypatch.setattr(alignment.subprocess, "run", no_native_tools)
    track, script, recording, recorded = saved_track
    original = recording.read_bytes()
    provenance = track["provenance"]

    assert provenance["recording"]["sha256"] == hashlib.sha256(original).hexdigest()
    assert provenance["recording"]["sha256"] == recorded["sha256"]
    assert provenance["recording"]["bytes"] == len(original) == recorded["bytes"]
    assert provenance["script"]["text"] == script["text"] == recorded["request"]["script"]["text"]
    assert provenance["script"]["sha256"] == hashlib.sha256(script["text"].encode()).hexdigest()
    assert provenance["manualTimingEdits"] is False
    check_saved_track(saved_track)


@pytest.mark.parametrize(
    ("field", "value"),
    [("path", "frontend/src/audio/speech/other.opus"), ("sha256", "0" * 64), ("bytes", 1)],
)
def test_saved_tracks_reject_stale_recording_fingerprints(saved_track, field, value):
    track, *_ = saved_track
    track["provenance"]["recording"][field] = value

    with pytest.raises(ValueError, match="recording fingerprint"):
        check_saved_track(saved_track)


@pytest.mark.parametrize("field", ["text", "sha256", "planPath"])
def test_saved_tracks_reject_stale_script_fingerprints(saved_track, field):
    track, *_ = saved_track
    fingerprint = track["provenance"]["script"]
    fingerprint[field] += " "
    if field == "text":
        # A consistent hash of different text must not pass exact-plan matching.
        fingerprint["sha256"] = hashlib.sha256(fingerprint["text"].encode()).hexdigest()

    with pytest.raises(ValueError, match="script fingerprint"):
        check_saved_track(saved_track)


def test_saved_tracks_reject_stale_plan_even_if_track_text_is_updated(saved_track):
    track, script, *_ = saved_track
    script["text"] += " Changed."
    track["provenance"]["script"]["text"] = script["text"]
    track["provenance"]["script"]["sha256"] = hashlib.sha256(script["text"].encode()).hexdigest()

    with pytest.raises(ValueError, match="Recording script differs"):
        check_saved_track(saved_track)


@pytest.mark.parametrize("change", ["stored-hash", "valid-shape", "contiguous-boundary"])
def test_saved_tracks_reject_changed_cues_even_when_structurally_valid(saved_track, change):
    track, *_ = saved_track
    cues = track["mouthCues"]
    if change == "stored-hash":
        track["provenance"]["cueSha256"] = "0" * 64
    elif change == "valid-shape":
        cues[0]["value"] = "A" if cues[0]["value"] != "A" else "X"
    else:
        boundary = (cues[0]["start"] + cues[0]["end"]) / 2
        cues[0]["end"] = boundary
        cues[1]["start"] = boundary

    with pytest.raises(ValueError, match="cue fingerprint"):
        check_saved_track(saved_track)


@pytest.mark.parametrize("field", ["version", "executableSha256", "options"])
def test_saved_tracks_reject_different_alignment_tool_settings(saved_track, field):
    track, *_ = saved_track
    track["provenance"]["tool"][field] = [] if field == "options" else "changed"

    with pytest.raises(ValueError, match="tool or options"):
        check_saved_track(saved_track)


def test_check_cli_runs_without_optional_packages():
    result = subprocess.run(
        [sys.executable, "-B", "-S", str(ROOT / "scripts/align_coach_speech.py"), "--check"],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
        timeout=10,
    )

    assert "Verified 2 automatic speech tracks" in result.stdout
