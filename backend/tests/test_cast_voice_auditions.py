"""Cast audition tracks retain verified design requests and automatic phone evidence."""

import builtins
import importlib
import json
from copy import deepcopy
from pathlib import Path

import pytest

from scripts import align_coach_speech as alignment
from scripts import prepare_cast_voice_auditions as cast

ROOT = Path(__file__).resolve().parents[2]
SPEECH = Path("frontend/src/audio/speech")
CAST = SPEECH / "cast-auditions"
KEYS = ("unicorn:gentle", "unicorn:bright", "dragon:gentle")


def read_json(path):
    return json.loads(path.read_text("utf-8"))


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False) + "\n", encoding="utf-8")


def request_hash(request):
    return alignment.digest(
        json.dumps(request, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    )


def design_request(plan, coach, direction):
    """Independent fixture spelling of design_coach_voices.mjs requestFor."""
    seed_input = "\0".join((coach["coachId"], direction["id"], direction["prompt"], coach["text"]))
    seed = int(alignment.digest(seed_input.encode("utf-8"))[:8], 16) % 2147483648
    return {
        "schemaVersion": 1,
        "provider": plan["provider"],
        "modelId": plan["modelId"],
        "outputFormat": plan["outputFormat"],
        "coachId": coach["coachId"],
        "directionId": direction["id"],
        "label": direction["label"],
        "body": {
            "model_id": plan["modelId"],
            "voice_description": direction["prompt"],
            "text": coach["text"],
            "auto_generate_text": False,
            "loudness": 0.5,
            "seed": seed,
            "guidance_scale": 3.5,
        },
    }


def asset(plan, key=KEYS[0], kind="archive"):
    coach, direction = key.split(":")
    if kind == "archive":
        return plan.parent / "alignment" / coach / f"{direction}.json"
    extension = "opus" if kind == "audio" else "provenance.json"
    return plan.parent / "recordings" / coach / f"{direction}.{extension}"


def snapshot(directory):
    return {
        path.relative_to(directory).as_posix(): (
            (path.read_bytes(), path.stat().st_mtime_ns) if path.is_file() else None
        )
        for path in directory.rglob("*")
    }


def no_native_work(*_args, **_kwargs):
    pytest.fail("Fixture checks and cached resume must not invoke native audio work")


@pytest.fixture(autouse=True)
def forbid_native_work(monkeypatch):
    original_import = builtins.__import__

    def checked_import(name, *args, **kwargs):
        if name.split(".")[0] in {"numpy", "soundfile", "pocketsphinx"}:
            pytest.fail(f"Cast verification imported optional native dependency {name}")
        return original_import(name, *args, **kwargs)

    monkeypatch.setattr(builtins, "__import__", checked_import)
    monkeypatch.setattr(alignment, "decode", no_native_work)
    monkeypatch.setattr(alignment.subprocess, "run", no_native_work)
    monkeypatch.setattr(alignment, "generate_forced_source", no_native_work)


@pytest.fixture
def saved_cast(tmp_path, monkeypatch):
    """Real Opus/transcript/phone evidence; synthetic design identity only."""
    originals = [
        read_json(ROOT / SPEECH / "alignment" / f"{name}-forced.json")
        for name in ("sound-sacrifice", "allowed-mate")
    ]
    plan = {
        "schemaVersion": 1,
        "provider": "elevenlabs",
        "method": "voice-design",
        "modelId": "eleven_ttv_v3",
        "outputFormat": "mp3_44100_128",
        "coaches": [
            {
                "coachId": coach,
                "name": name,
                "group": "fantasy",
                "text": original["provenance"]["script"]["text"],
                "directions": [
                    {
                        "id": direction,
                        "label": f"{direction.title()} teacher",
                        "prompt": f"An original {direction} teaching voice with clear English phrasing.",
                    }
                    for direction in directions
                ],
            }
            for coach, name, directions, original in zip(
                ("unicorn", "dragon"),
                ("Celeste", "Ember"),
                (("gentle", "bright"), ("gentle",)),
                originals,
                strict=True,
            )
        ],
    }
    plan_path = tmp_path / CAST / "design-plan.json"
    write_json(plan_path, plan)
    recordings = []
    for coach, original in zip(plan["coaches"], originals, strict=True):
        for direction in coach["directions"]:
            key = f"{coach['coachId']}:{direction['id']}"
            recording = ROOT / original["provenance"]["recording"]["path"]
            audio = recording.read_bytes()
            encoded = read_json(recording.with_suffix(".provenance.json"))
            audio_path = asset(plan_path, key, "audio")
            audio_path.parent.mkdir(parents=True, exist_ok=True)
            audio_path.write_bytes(audio)
            request = design_request(plan, coach, direction)
            sidecar = {
                "schemaVersion": 1,
                "request": request,
                "requestHash": request_hash(request),
                "sha256": alignment.digest(audio),
                "bytes": len(audio),
                "recordedAt": "2026-10-01T00:00:00.000Z",
                "providerAudio": encoded["providerAudio"],
                "encoding": encoded["encoding"],
                "requestId": None,
                "selected": {
                    "generatedVoiceId": f"fixture-{coach['coachId']}-{direction['id']}",
                    "mediaType": "audio/mpeg",
                    "durationSeconds": original["metadata"]["duration"],
                    "language": "en",
                    "previewIndex": 0,
                    "returnedPreviewCount": 3,
                    "selection": "closest-to-nine-seconds; original index breaks ties",
                },
            }
            sidecar_path = asset(plan_path, key, "sidecar")
            write_json(sidecar_path, sidecar)
            recordings.append(
                {
                    "id": key,
                    "coachId": coach["coachId"],
                    "directionId": direction["id"],
                    "label": direction["label"],
                    "text": coach["text"],
                    "audioPath": audio_path.relative_to(plan_path.parent).as_posix(),
                    "durationSeconds": sidecar["selected"]["durationSeconds"],
                    "generatedVoiceId": sidecar["selected"]["generatedVoiceId"],
                }
            )
            track = deepcopy(original)
            track["scriptId"] = key
            track["voiceId"] = coach["coachId"]
            provenance = track["provenance"]
            provenance["sourceScriptId"] = key.replace(":", "--")
            provenance["recording"]["path"] = audio_path.relative_to(tmp_path).as_posix()
            provenance["script"]["planPath"] = plan_path.relative_to(tmp_path).as_posix()
            provenance["voiceDesign"] = {
                "requestSha256": sidecar["requestHash"],
                "provenancePath": sidecar_path.relative_to(tmp_path).as_posix(),
                "provenanceSha256": alignment.digest(sidecar_path.read_bytes()),
                "generatedVoiceId": sidecar["selected"]["generatedVoiceId"],
                "directionId": direction["id"],
            }
            write_json(asset(plan_path, key), track)
    write_json(
        plan_path.parent / "manifest.json",
        {
            "schemaVersion": 1,
            "provider": plan["provider"],
            "modelId": plan["modelId"],
            "recordings": recordings,
        },
    )
    monkeypatch.setattr(alignment, "ROOT", tmp_path)
    return plan_path


def test_cached_cast_resumes_without_native_imports_or_subprocesses(saved_cast):
    importlib.reload(cast)
    archives = {key: asset(saved_cast, key).read_bytes() for key in KEYS}
    sidecars = {key: asset(saved_cast, key, "sidecar").read_bytes() for key in KEYS}

    result = cast.prepare_cast(saved_cast, generate=True)

    assert result == {"ready": 3, "generated": 0, "reused": 3, "missing": []}
    assert set(read_json(saved_cast.parent / "tracks.json")) == set(KEYS)
    assert {key: asset(saved_cast, key).read_bytes() for key in KEYS} == archives
    assert {key: asset(saved_cast, key, "sidecar").read_bytes() for key in KEYS} == sidecars
    before = snapshot(alignment.ROOT)
    assert cast.prepare_cast(saved_cast)["ready"] == 3
    assert snapshot(alignment.ROOT) == before


@pytest.mark.parametrize("missing", ["audio", "sidecar", "archive", "runtime"])
def test_check_requires_every_planned_audio_archive_and_runtime_without_writes(saved_cast, missing):
    cast.prepare_cast(saved_cast, generate=True)
    target = (
        saved_cast.parent / "tracks.json"
        if missing == "runtime"
        else asset(saved_cast, kind=missing)
    )
    target.unlink()
    before = snapshot(alignment.ROOT)

    with pytest.raises(ValueError):
        cast.prepare_cast(saved_cast)

    assert snapshot(alignment.ROOT) == before


@pytest.mark.parametrize("missing", ["audio", "sidecar"])
def test_incomplete_recording_pair_errors_even_outside_the_generation_filter(saved_cast, missing):
    asset(saved_cast, KEYS[2], missing).unlink()
    before = snapshot(alignment.ROOT)

    with pytest.raises(ValueError):
        cast.prepare_cast(saved_cast, generate=True, coaches=("unicorn",))

    assert snapshot(alignment.ROOT) == before


@pytest.mark.parametrize(
    "mutation",
    [
        "audio",
        "bytes",
        "audio-hash",
        "request-hash",
        "provider",
        "model",
        "format",
        "coach",
        "direction",
        "label",
        "prompt",
        "text",
        "seed",
        "loudness",
        "guidance",
        "auto-text",
    ],
)
def test_rehashed_wrong_requests_and_changed_audio_cannot_reuse_archives(saved_cast, mutation):
    sidecar_path = asset(saved_cast, kind="sidecar")
    sidecar = read_json(sidecar_path)
    request = sidecar["request"]
    if mutation == "audio":
        audio_path = asset(saved_cast, kind="audio")
        audio = bytearray(audio_path.read_bytes())
        audio[-1] ^= 1
        audio_path.write_bytes(audio)
    elif mutation == "bytes":
        sidecar["bytes"] += 1
    elif mutation == "audio-hash":
        sidecar["sha256"] = "0" * 64
    elif mutation == "request-hash":
        sidecar["requestHash"] = "0" * 64
    else:
        fields = {
            "provider": (request, "provider", "other-provider"),
            "model": (request, "modelId", "other-model"),
            "format": (request, "outputFormat", "pcm_44100"),
            "coach": (request, "coachId", "ghost"),
            "direction": (request, "directionId", "different"),
            "label": (request, "label", "Different label"),
            "prompt": (request["body"], "voice_description", "A different voice direction."),
            "text": (request["body"], "text", "A different chess explanation."),
            "seed": (request["body"], "seed", request["body"]["seed"] + 1),
            "loudness": (request["body"], "loudness", 0.7),
            "guidance": (request["body"], "guidance_scale", 2),
            "auto-text": (request["body"], "auto_generate_text", True),
        }
        target, field, value = fields[mutation]
        target[field] = value
        sidecar["requestHash"] = request_hash(request)
    write_json(sidecar_path, sidecar)
    # Keep the archive's sidecar fingerprint current: the request itself must be
    # checked against the plan, not merely against a self-consistent saved hash.
    track = read_json(asset(saved_cast))
    track["provenance"]["voiceDesign"]["requestSha256"] = sidecar["requestHash"]
    track["provenance"]["voiceDesign"]["provenanceSha256"] = alignment.digest(
        sidecar_path.read_bytes()
    )
    write_json(asset(saved_cast), track)
    before = snapshot(alignment.ROOT)

    with pytest.raises(ValueError):
        cast.prepare_cast(saved_cast, generate=True)

    assert snapshot(alignment.ROOT) == before


@pytest.mark.parametrize(
    "mutation", ["boolean-zero", "integer-float", "schema-boolean", "key-order"]
)
def test_saved_request_must_match_the_original_serialized_fingerprint(saved_cast, mutation):
    path = asset(saved_cast, kind="sidecar")
    sidecar = read_json(path)
    request = sidecar["request"]
    if mutation == "boolean-zero":
        request["body"]["auto_generate_text"] = 0
    elif mutation == "integer-float":
        request["body"]["seed"] = float(request["body"]["seed"])
    elif mutation == "schema-boolean":
        request["schemaVersion"] = True
    else:
        sidecar["request"] = dict(reversed(list(request.items())))
    # Preserve the previous hash. Python's dictionary equality alone would
    # accept all four alterations even though their serialized bytes changed.
    write_json(path, sidecar)
    track = read_json(asset(saved_cast))
    track["provenance"]["voiceDesign"]["provenanceSha256"] = alignment.digest(path.read_bytes())
    write_json(asset(saved_cast), track)

    with pytest.raises(ValueError):
        cast.prepare_cast(saved_cast, generate=True)


@pytest.mark.parametrize("field", ["text", "prompt", "label"])
def test_plan_changes_invalidate_previous_voice_design_evidence(saved_cast, field):
    plan = read_json(saved_cast)
    coach = plan["coaches"][0]
    target = coach if field == "text" else coach["directions"][0]
    target[field] += " A changed instruction."
    write_json(saved_cast, plan)

    with pytest.raises(ValueError):
        cast.prepare_cast(saved_cast, generate=True)


@pytest.mark.parametrize(
    "mutation", ["missing-entry", "duplicate", "unplanned", "audio-path", "voice"]
)
def test_check_validates_manifest_identity_and_complete_coverage(saved_cast, mutation):
    cast.prepare_cast(saved_cast, generate=True)
    path = saved_cast.parent / "manifest.json"
    manifest = read_json(path)
    first = manifest["recordings"][0]
    if mutation == "missing-entry":
        manifest["recordings"].pop()
    elif mutation == "duplicate":
        manifest["recordings"].append(deepcopy(first))
    elif mutation == "unplanned":
        first["id"] = "ghost:gentle"
    elif mutation == "audio-path":
        first["audioPath"] = "../outside.opus"
    else:
        first["generatedVoiceId"] = "another-provider-voice"
    write_json(path, manifest)
    before = snapshot(alignment.ROOT)

    with pytest.raises(ValueError):
        cast.prepare_cast(saved_cast)

    assert snapshot(alignment.ROOT) == before


@pytest.mark.parametrize("mutation", ["missing", "extra", "shape", "time", "duration"])
def test_check_rejects_runtime_drift_from_exact_verified_cues(saved_cast, mutation):
    cast.prepare_cast(saved_cast, generate=True)
    output = saved_cast.parent / "tracks.json"
    runtime = read_json(output)
    first = runtime[KEYS[0]]
    if mutation == "missing":
        del runtime[KEYS[0]]
    elif mutation == "extra":
        runtime["ghost:unplanned"] = deepcopy(first)
    elif mutation == "shape":
        first["cues"][0]["shape"] = "rest"
    elif mutation == "time":
        first["cues"][0]["end"] += 0.01
    else:
        first["durationSeconds"] += 0.01
    write_json(output, runtime)
    before = snapshot(alignment.ROOT)

    with pytest.raises(ValueError):
        cast.prepare_cast(saved_cast)

    assert snapshot(alignment.ROOT) == before


@pytest.mark.parametrize("mutation", ["cue", "phone-evidence", "manual", "method", "design"])
def test_corrupt_existing_archive_is_never_silently_regenerated(saved_cast, mutation):
    cast.prepare_cast(saved_cast, generate=True)
    archive = asset(saved_cast)
    track = read_json(archive)
    if mutation == "cue":
        track["mouthCues"][0]["value"] = "X"
    elif mutation == "phone-evidence":
        track["provenance"]["alignment"]["words"][0]["phones"][0]["phone"] = "SIL"
        track["provenance"]["alignmentSha256"] = request_hash(track["provenance"]["alignment"])
    elif mutation == "manual":
        track["provenance"]["manualTimingEdits"] = True
    elif mutation == "method":
        track["provenance"]["tool"]["name"] = "Rhubarb Lip Sync"
    else:
        track["provenance"]["voiceDesign"]["generatedVoiceId"] = "different-voice"
    write_json(archive, track)
    before = snapshot(alignment.ROOT)

    with pytest.raises(ValueError):
        # Previously saved entries outside the selection must also be verified.
        cast.prepare_cast(saved_cast, generate=True, coaches=("dragon",))

    assert snapshot(alignment.ROOT) == before


@pytest.mark.parametrize(
    "options",
    [
        {"coaches": ("unicorn",)},
        {"directions": ("gentle",)},
        {"generate": True, "coaches": ("ghost",)},
        {"generate": True, "directions": ("unknown",)},
        {"generate": True, "coaches": ("dragon",), "directions": ("bright",)},
        {"generate": True, "coaches": ("../escape",)},
    ],
)
def test_filters_cannot_narrow_strict_check_or_select_unknown_jobs(saved_cast, options):
    before = snapshot(alignment.ROOT)
    with pytest.raises(ValueError):
        cast.prepare_cast(saved_cast, **options)
    assert snapshot(alignment.ROOT) == before


def test_subset_generation_publishes_only_new_and_previously_verified_tracks(
    saved_cast, monkeypatch
):
    selected = KEYS[0]
    expected = read_json(asset(saved_cast, selected))
    asset(saved_cast, selected).unlink()
    # An unselected direction may have no paid recording yet.
    for kind in ("audio", "sidecar", "archive"):
        asset(saved_cast, KEYS[1], kind).unlink()
    manifest_path = saved_cast.parent / "manifest.json"
    manifest = read_json(manifest_path)
    manifest["recordings"] = [item for item in manifest["recordings"] if item["id"] != KEYS[1]]
    write_json(manifest_path, manifest)
    unselected_before = asset(saved_cast, KEYS[2]).read_bytes()
    generated = []

    def generator(source, *_args):
        generated.append(source.runtime_script_id)
        assert source.runtime_script_id == selected
        assert source.script["text"] == expected["provenance"]["script"]["text"]
        assert source.script["id"] == selected.replace(":", "--")
        return deepcopy(expected)

    monkeypatch.setattr(alignment, "generate_forced_source", generator)
    result = cast.prepare_cast(
        saved_cast, generate=True, coaches=("unicorn",), directions=("gentle",)
    )

    assert generated == [selected]
    assert result == {"ready": 2, "generated": 1, "reused": 1, "missing": [KEYS[1]]}
    assert set(read_json(saved_cast.parent / "tracks.json")) == {KEYS[0], KEYS[2]}
    assert asset(saved_cast, KEYS[2]).read_bytes() == unselected_before
    with pytest.raises(ValueError):
        cast.prepare_cast(saved_cast)


def test_unselected_recording_without_archive_is_not_generated_or_published(saved_cast):
    asset(saved_cast, KEYS[1]).unlink()

    result = cast.prepare_cast(saved_cast, generate=True, directions=("gentle",))

    assert result == {"ready": 2, "generated": 0, "reused": 2, "missing": [KEYS[1]]}
    assert set(read_json(saved_cast.parent / "tracks.json")) == {KEYS[0], KEYS[2]}
    assert not asset(saved_cast, KEYS[1]).exists()


def test_unpublished_recording_does_not_leak_into_the_runtime_map(saved_cast):
    cast.prepare_cast(saved_cast, generate=True)
    path = saved_cast.parent / "manifest.json"
    manifest = read_json(path)
    manifest["recordings"] = manifest["recordings"][1:]
    write_json(path, manifest)
    before_archive = asset(saved_cast).read_bytes()

    result = cast.prepare_cast(saved_cast, generate=True, coaches=("dragon",))

    assert result == {"ready": 2, "generated": 0, "reused": 2, "missing": [KEYS[0]]}
    assert set(read_json(saved_cast.parent / "tracks.json")) == set(KEYS[1:])
    assert asset(saved_cast).read_bytes() == before_archive


@pytest.mark.parametrize("existing_runtime", [False, True])
def test_interrupted_generation_resumes_archives_without_publishing_unfinished_output(
    saved_cast, monkeypatch, existing_runtime
):
    output = saved_cast.parent / "tracks.json"
    if existing_runtime:
        cast.prepare_cast(saved_cast, generate=True)
    before_runtime = output.read_bytes() if output.exists() else None
    expected = {key: read_json(asset(saved_cast, key)) for key in KEYS[:2]}
    for key in expected:
        asset(saved_cast, key).unlink()
    generated = []

    def interrupted(source, *_args):
        generated.append(source.runtime_script_id)
        if source.runtime_script_id == KEYS[1]:
            raise RuntimeError("Native worker interrupted")
        return deepcopy(expected[source.runtime_script_id])

    monkeypatch.setattr(alignment, "generate_forced_source", interrupted)
    with pytest.raises(RuntimeError, match="Native worker interrupted"):
        cast.prepare_cast(saved_cast, generate=True, coaches=("unicorn",))

    first_archive = asset(saved_cast).read_bytes()
    assert not asset(saved_cast, KEYS[1]).exists()
    assert (output.read_bytes() if output.exists() else None) == before_runtime

    def resumed(source, *_args):
        assert source.runtime_script_id == KEYS[1]
        generated.append(source.runtime_script_id)
        return deepcopy(expected[source.runtime_script_id])

    monkeypatch.setattr(alignment, "generate_forced_source", resumed)
    result = cast.prepare_cast(saved_cast, generate=True, coaches=("unicorn",))

    assert result == {"ready": 3, "generated": 1, "reused": 2, "missing": []}
    assert generated == [KEYS[0], KEYS[1], KEYS[1]]
    assert asset(saved_cast).read_bytes() == first_archive
    assert cast.prepare_cast(saved_cast)["ready"] == 3


def test_invalid_new_alignment_is_rejected_before_archive_or_runtime_publication(
    saved_cast, monkeypatch
):
    expected = read_json(asset(saved_cast))
    expected["mouthCues"][0]["value"] = "X"
    expected["provenance"]["cueSha256"] = alignment.cue_digest(expected["mouthCues"])
    asset(saved_cast).unlink()
    before = snapshot(alignment.ROOT)
    monkeypatch.setattr(alignment, "generate_forced_source", lambda *_args: deepcopy(expected))

    with pytest.raises(ValueError):
        cast.prepare_cast(saved_cast, generate=True)

    assert snapshot(alignment.ROOT) == before


def test_compact_tracks_preserve_all_semantic_shapes_and_original_boundaries(saved_cast):
    cast.prepare_cast(saved_cast, generate=True)
    runtime = read_json(saved_cast.parent / "tracks.json")
    mapping = dict(
        zip(
            "ABCDEFGHX",
            (
                "closed",
                "consonant",
                "open",
                "wide",
                "round",
                "pucker",
                "lip-bite",
                "tongue",
                "rest",
            ),
            strict=True,
        )
    )
    seen = set()
    for key in KEYS:
        archive = read_json(asset(saved_cast, key))
        assert runtime[key] == {
            "durationSeconds": archive["metadata"]["duration"],
            "cues": [
                {"start": cue["start"], "end": cue["end"], "shape": mapping[cue["value"]]}
                for cue in archive["mouthCues"]
            ],
        }
        seen.update(cue["value"] for cue in archive["mouthCues"])
    assert seen == set(mapping)
