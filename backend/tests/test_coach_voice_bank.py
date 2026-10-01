"""Whole voice banks publish only complete, source-verified automatic mouth tracks."""

import json
from copy import deepcopy
from pathlib import Path

import pytest

from scripts import align_coach_speech as alignment
from scripts import prepare_coach_voice_bank as bank

REPO_ROOT = Path(__file__).resolve().parents[2]
SPEECH_PATH = Path("frontend/src/audio/speech")
FIXTURE_IDS = ("sound-sacrifice", "allowed-mate")


def read_json(path):
    return json.loads(path.read_text("utf-8"))


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False) + "\n", encoding="utf-8")


def request_digest(request):
    return alignment.digest(
        json.dumps(request, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    )


@pytest.fixture
def saved_bank(tmp_path, monkeypatch):
    """Real MP3s, requests and phone evidence; only their archive identities move."""
    manifest = read_json(REPO_ROOT / SPEECH_PATH / "bank/manifest.json")
    manifest["recordings"] = [item for item in manifest["recordings"] if item["id"] in FIXTURE_IDS]
    manifest_path = tmp_path / SPEECH_PATH / "bank/manifest.json"
    write_json(manifest_path, manifest)
    for item in manifest["recordings"]:
        for field in ("audioPath", "sidecarPath"):
            original = REPO_ROOT / SPEECH_PATH / "bank" / item[field]
            target = manifest_path.parent / item[field]
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(original.read_bytes())
        track = read_json(REPO_ROOT / SPEECH_PATH / "alignment" / f"{item['id']}-forced.json")
        track["scriptId"] = item["id"]
        track["provenance"]["script"]["planPath"] = manifest_path.relative_to(tmp_path).as_posix()
        write_json(manifest_path.parent / item["alignmentPath"], track)
    monkeypatch.setattr(alignment, "ROOT", tmp_path)
    return manifest_path


def prepare(manifest_path, **options):
    return bank.prepare_bank(manifest_path, **options)


def no_native_work(*_args, **_kwargs):
    pytest.fail("A verified cached bank must not decode audio or invoke native tools")


def item_path(manifest_path, field, index=0):
    return manifest_path.parent / read_json(manifest_path)["recordings"][index][field]


def test_real_recording_provenance_can_be_reused_without_changing_its_script(saved_bank):
    manifest = bank.load_manifest(saved_bank)
    item = manifest["recordings"][0]
    source = bank.recording_source(manifest, item, saved_bank)

    assert source.script == read_json(item_path(saved_bank, "sidecarPath"))["request"]["script"]
    assert source.script["text"] == item["text"]
    assert source.runtime_script_id == item["id"]
    assert source.voice_id == "walter"


@pytest.mark.parametrize(
    "mutation",
    [
        "schema",
        "duplicate-id",
        "empty-recordings",
        "unsafe-id",
        "empty-text",
        "text-type",
        "audio-escape",
        "sidecar-escape",
        "alignment-escape",
        "alignment-other-id",
    ],
)
def test_manifest_rejects_ambiguous_identity_and_unsafe_output_paths(saved_bank, mutation):
    manifest = read_json(saved_bank)
    first = manifest["recordings"][0]
    if mutation == "schema":
        manifest["schemaVersion"] = 2
    elif mutation == "duplicate-id":
        manifest["recordings"].append(deepcopy(first))
    elif mutation == "empty-recordings":
        manifest["recordings"] = []
    elif mutation == "unsafe-id":
        first["id"] = "../outside"
    elif mutation == "empty-text":
        first["text"] = "  "
    elif mutation == "text-type":
        first["text"] = ["Unusable transcript"]
    elif mutation == "audio-escape":
        first["audioPath"] = "../../outside.mp3"
    elif mutation == "sidecar-escape":
        first["sidecarPath"] = "../../outside.provenance.json"
    elif mutation == "alignment-escape":
        first["alignmentPath"] = "../outside.json"
    elif mutation == "alignment-other-id":
        first["alignmentPath"] = "alignment/another-meaning.json"
    write_json(saved_bank, manifest)

    with pytest.raises(ValueError):
        bank.load_manifest(saved_bank)


@pytest.mark.parametrize(
    "mutation",
    [
        "recording-bytes",
        "recording-hash",
        "request-hash",
        "provider",
        "model",
        "format",
        "settings",
        "voice",
        "provider-voice",
        "script-id",
        "script-text",
    ],
)
def test_source_rejects_stale_and_validly_rehashed_but_wrong_requests(saved_bank, mutation):
    manifest = bank.load_manifest(saved_bank)
    item = manifest["recordings"][0]
    path = item_path(saved_bank, "sidecarPath")
    sidecar = read_json(path)
    request = sidecar["request"]
    if mutation == "recording-bytes":
        sidecar["bytes"] += 1
    elif mutation == "recording-hash":
        sidecar["sha256"] = "0" * 64
    elif mutation == "request-hash":
        sidecar["requestHash"] = "0" * 64
    elif mutation == "provider":
        request["provider"] = "other-provider"
    elif mutation == "model":
        request["modelId"] = "another-model"
    elif mutation == "format":
        request["outputFormat"] = "pcm_44100"
    elif mutation == "settings":
        request["settings"]["speed"] = 1.05
    elif mutation == "voice":
        request["voice"]["id"] = "someone-else"
    elif mutation == "provider-voice":
        request["voice"]["providerVoiceId"] = "different-voice"
    elif mutation == "script-id":
        request["script"]["id"] = "unrecognized-meaning"
    elif mutation == "script-text":
        request["script"]["text"] = "This means something different."
    if mutation not in {"request-hash", "recording-bytes", "recording-hash"}:
        sidecar["requestHash"] = request_digest(request)
    write_json(path, sidecar)

    with pytest.raises(ValueError):
        bank.recording_source(manifest, item, saved_bank)


def test_actual_audio_changes_cannot_reuse_old_fingerprints(saved_bank):
    path = item_path(saved_bank, "audioPath")
    audio = bytearray(path.read_bytes())
    audio[-1] ^= 1
    path.write_bytes(audio)
    manifest = bank.load_manifest(saved_bank)

    with pytest.raises(ValueError):
        bank.recording_source(manifest, manifest["recordings"][0], saved_bank)


def test_cached_alignment_resumes_without_audio_decoder_or_native_runtime(saved_bank, monkeypatch):
    monkeypatch.setattr(alignment, "decode", no_native_work)
    monkeypatch.setattr(alignment.subprocess, "run", no_native_work)

    result = prepare(saved_bank, generate=True)

    assert result == {"ready": 2, "generated": 0, "reused": 2, "missing": []}
    assert (saved_bank.parent / "tracks.json").is_file()
    assert prepare(saved_bank)["ready"] == 2


def test_interrupted_generation_resumes_verified_archives_before_publishing(
    saved_bank, monkeypatch
):
    records = read_json(saved_bank)["recordings"]
    expected = {}
    for item in records:
        archive = saved_bank.parent / item["alignmentPath"]
        expected[item["id"]] = read_json(archive)
        archive.unlink()
    first_id, second_id = (item["id"] for item in records)
    generated = []

    def interrupted_generator(source, *_args):
        generated.append(source.runtime_script_id)
        if source.runtime_script_id == second_id:
            raise RuntimeError("Native worker interrupted")
        return deepcopy(expected[source.runtime_script_id])

    monkeypatch.setattr(alignment, "generate_forced_source", interrupted_generator)
    with pytest.raises(RuntimeError, match="Native worker interrupted"):
        prepare(saved_bank, generate=True)

    first_archive = saved_bank.parent / records[0]["alignmentPath"]
    assert first_archive.is_file()
    before = first_archive.read_bytes()
    assert not (saved_bank.parent / records[1]["alignmentPath"]).exists()
    assert not (saved_bank.parent / "tracks.json").exists()

    def resumed_generator(source, *_args):
        assert source.runtime_script_id == second_id
        generated.append(source.runtime_script_id)
        return deepcopy(expected[source.runtime_script_id])

    monkeypatch.setattr(alignment, "generate_forced_source", resumed_generator)
    result = prepare(saved_bank, generate=True)

    assert result == {"ready": 2, "generated": 1, "reused": 1, "missing": []}
    assert generated == [first_id, second_id, second_id]
    assert first_archive.read_bytes() == before
    assert prepare(saved_bank)["ready"] == 2


@pytest.mark.parametrize("missing_field", ["audioPath", "sidecarPath", "alignmentPath"])
def test_check_requires_every_recording_and_archive(saved_bank, missing_field):
    prepare(saved_bank, generate=True)
    item_path(saved_bank, missing_field).unlink()

    with pytest.raises(ValueError):
        prepare(saved_bank)


@pytest.mark.parametrize("existing_runtime", [False, True])
def test_incomplete_generation_never_publishes_a_partial_runtime_bank(
    saved_bank, monkeypatch, existing_runtime
):
    monkeypatch.setattr(alignment, "decode", no_native_work)
    monkeypatch.setattr(alignment.subprocess, "run", no_native_work)
    output = saved_bank.parent / "tracks.json"
    if existing_runtime:
        prepare(saved_bank, generate=True)
    before = output.read_bytes() if output.exists() else None
    missing_id = read_json(saved_bank)["recordings"][1]["id"]
    item_path(saved_bank, "audioPath", 1).unlink()
    item_path(saved_bank, "sidecarPath", 1).unlink()

    result = prepare(saved_bank, generate=True)

    assert result["ready"] == 1
    assert result["generated"] == 0
    assert missing_id in result["missing"]
    assert (output.read_bytes() if output.exists() else None) == before


@pytest.mark.parametrize("missing_field", ["audioPath", "sidecarPath"])
def test_incomplete_recording_pair_fails_without_publishing(saved_bank, missing_field):
    item_path(saved_bank, missing_field).unlink()

    with pytest.raises(ValueError, match="Missing recording or provenance"):
        prepare(saved_bank, generate=True)

    assert not (saved_bank.parent / "tracks.json").exists()


def test_in_progress_recording_lock_withholds_runtime_publication(saved_bank, monkeypatch):
    monkeypatch.setattr(alignment, "decode", no_native_work)
    item_path(saved_bank, "audioPath").with_suffix(".lock").write_text("in progress")

    result = prepare(saved_bank, generate=True)

    assert result["ready"] == 1
    assert result["missing"] == [read_json(saved_bank)["recordings"][0]["id"]]
    assert not (saved_bank.parent / "tracks.json").exists()


@pytest.mark.parametrize("runtime_change", ["missing", "extra-entry", "wrong-shape", "wrong-time"])
def test_check_rejects_runtime_drift_from_validated_archives(saved_bank, runtime_change):
    prepare(saved_bank, generate=True)
    output = saved_bank.parent / "tracks.json"
    if runtime_change == "missing":
        output.unlink()
    else:
        runtime = read_json(output)
        first = runtime[next(iter(runtime))]
        if runtime_change == "extra-entry":
            runtime["not-in-manifest"] = deepcopy(first)
        elif runtime_change == "wrong-shape":
            first["cues"][0]["shape"] = "rest"
        elif runtime_change == "wrong-time":
            first["cues"][0]["end"] += 0.01
        write_json(output, runtime)

    with pytest.raises(ValueError, match="Runtime voice tracks"):
        prepare(saved_bank)


def test_corrupt_cached_archive_is_not_silently_replaced(saved_bank, monkeypatch):
    prepare(saved_bank, generate=True)
    archive = item_path(saved_bank, "alignmentPath")
    track = read_json(archive)
    track["mouthCues"][0]["value"] = "X"
    write_json(archive, track)
    before_archive = archive.read_bytes()
    output = saved_bank.parent / "tracks.json"
    before_runtime = output.read_bytes()
    monkeypatch.setattr(alignment, "decode", no_native_work)

    with pytest.raises(ValueError):
        prepare(saved_bank, generate=True)

    assert archive.read_bytes() == before_archive
    assert output.read_bytes() == before_runtime


def test_compact_cues_keep_exact_validated_boundaries_and_semantic_shapes(saved_bank):
    prepare(saved_bank, generate=True)
    published = read_json(saved_bank.parent / "tracks.json")
    mapping = {
        "A": "closed",
        "B": "consonant",
        "C": "open",
        "D": "wide",
        "E": "round",
        "F": "pucker",
        "G": "lip-bite",
        "H": "tongue",
        "X": "rest",
    }
    seen = set()
    for item in read_json(saved_bank)["recordings"]:
        archive = read_json(saved_bank.parent / item["alignmentPath"])
        runtime = bank.compact_track(archive)
        assert runtime == {
            "durationSeconds": archive["metadata"]["duration"],
            "cues": [
                {"start": cue["start"], "end": cue["end"], "shape": mapping[cue["value"]]}
                for cue in archive["mouthCues"]
            ],
        }
        assert published[item["id"]] == runtime
        seen.update(cue["value"] for cue in archive["mouthCues"])
    assert seen == set(mapping)
