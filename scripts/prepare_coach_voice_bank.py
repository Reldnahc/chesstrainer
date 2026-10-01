"""Validate and align a complete recorded coach bank, without provider calls.

Generation resumes verified archives and reports not-yet-recorded clips. The
compact runtime bank is published only when every manifest entry is verified.
Default --check is strict and needs only the Python standard library.
"""

import argparse
import json
import re
from pathlib import Path

if __package__:
    from . import align_coach_speech as alignment
else:
    import align_coach_speech as alignment

MANIFEST = alignment.SPEECH / "bank/manifest.json"
SHAPES = dict(
    zip(
        "ABCDEFGHX",
        ("closed", "consonant", "open", "wide", "round", "pucker", "lip-bite", "tongue", "rest"),
        strict=True,
    )
)


def slug(value: object) -> bool:
    return isinstance(value, str) and re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", value) is not None


def paths(item: dict, manifest_path: Path) -> tuple[Path, Path, Path]:
    bank = manifest_path.parent.resolve()
    speech = bank.parent
    values = []
    for key in ("audioPath", "sidecarPath", "alignmentPath"):
        raw = item.get(key)
        if not isinstance(raw, str) or not raw or Path(raw).is_absolute():
            raise ValueError(f"Invalid {key} for voice bank entry")
        value = (bank / raw).resolve()
        if not value.is_relative_to(speech):
            raise ValueError("Voice bank paths must remain inside the speech asset directory")
        values.append(value)
    audio, sidecar, archive = values
    if audio.suffix != ".mp3" or sidecar != audio.with_suffix(".provenance.json"):
        raise ValueError("Voice bank audio and sidecar paths do not match")
    if archive != bank / "alignment" / f"{item['id']}.json":
        raise ValueError("Voice alignment path must be bank/alignment/<id>.json")
    return audio, sidecar, archive


def load_manifest(path: Path) -> dict:
    manifest = json.loads(path.read_text("utf-8"))
    if (
        not isinstance(manifest, dict)
        or manifest.get("schemaVersion") != 1
        or manifest.get("scope") != "non-lesson"
    ):
        raise ValueError("Unsupported voice bank manifest")
    if not slug(manifest.get("coachId")) or not slug(manifest.get("voiceId")):
        raise ValueError("Invalid voice bank coach or voice identity")
    for field in ("provider", "providerVoiceId", "modelId", "outputFormat"):
        if not isinstance(manifest.get(field), str) or not manifest[field]:
            raise ValueError(f"Missing voice bank {field}")
    if not isinstance(manifest.get("settings"), dict):
        raise ValueError("Missing recording settings")
    records = manifest.get("recordings")
    silent = manifest.get("silentIds")
    if (
        not isinstance(records, list)
        or not records
        or not isinstance(silent, list)
        or any(not slug(key) for key in silent)
        or len(silent) != len(set(silent))
    ):
        raise ValueError("Voice bank needs unique recordings and silent intent IDs")
    ids = set(silent)
    targets = set()
    for item in records:
        if not isinstance(item, dict) or not slug(item.get("id")) or item["id"] in ids:
            raise ValueError("Duplicate or invalid voice bank recording ID")
        ids.add(item["id"])
        if not isinstance(item.get("text"), str) or not 1 <= len(item["text"]) <= 2000:
            raise ValueError("Missing or oversized voice bank text")
        alignment.forced.normalize_text(item["text"])
        if (
            not isinstance(item.get("group"), str)
            or not item["group"]
            or "lesson" in item["group"].lower()
        ):
            raise ValueError("Voice bank recording group is outside non-lesson scope")
        for target in paths(item, path):
            if target in targets:
                raise ValueError("Voice bank entries cannot share asset paths")
            targets.add(target)
    return manifest


def recording_source(manifest: dict, item: dict, manifest_path: Path) -> alignment.SpeechSource:
    audio, sidecar, _ = paths(item, manifest_path)
    if not audio.is_file() or not sidecar.is_file():
        raise ValueError(f"Missing recording or provenance: {item['id']}")
    if audio.stat().st_size > 8_000_000 or sidecar.stat().st_size > 64_000:
        raise ValueError("Voice bank recording or provenance exceeds authoring limits")
    recorded = json.loads(sidecar.read_text("utf-8"))
    request = recorded.get("request")
    if (
        not isinstance(request, dict)
        or recorded.get("schemaVersion") != 1
        or request.get("schemaVersion") != 1
    ):
        raise ValueError("Invalid recorded voice provenance")
    request_hash = alignment.digest(
        json.dumps(request, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    )
    if recorded.get("requestHash") != request_hash:
        raise ValueError("Recorded voice request fingerprint is stale")
    for field in ("provider", "modelId", "outputFormat", "settings"):
        if request.get(field) != manifest[field]:
            raise ValueError(f"Recorded voice {field} differs from bank manifest")
    voice = request.get("voice", {})
    if (
        voice.get("id") != manifest["voiceId"]
        or voice.get("providerVoiceId") != manifest["providerVoiceId"]
    ):
        raise ValueError("Recorded voice identity differs from bank manifest")
    script = request.get("script", {})
    if script.get("id") != item["id"] or script.get("text") != item["text"]:
        raise ValueError("Recorded script differs from bank manifest")
    alignment.source_inputs(script, audio, recorded)
    return alignment.SpeechSource(
        script,
        audio,
        recorded,
        manifest_path.resolve().relative_to(alignment.ROOT.resolve()).as_posix(),
        item["id"],
        manifest["voiceId"],
    )


def compact_track(track: dict) -> dict:
    return {
        "durationSeconds": track["metadata"]["duration"],
        "cues": [
            {"start": cue["start"], "end": cue["end"], "shape": SHAPES[cue["value"]]}
            for cue in track["mouthCues"]
        ],
    }


def prepare_bank(
    manifest_path: Path = MANIFEST,
    *,
    generate: bool = False,
    work_dir: Path | None = None,
    audio_deps: Path | None = None,
    phoneme_deps: Path | None = None,
) -> dict:
    manifest_path = manifest_path.resolve()
    manifest = load_manifest(manifest_path)
    working = (work_dir or alignment.ROOT / ".tools/voice-bank-alignment").resolve()
    if generate and not working.is_relative_to((alignment.ROOT / ".tools").resolve()):
        raise ValueError("Temporary authoring files must stay in ignored .tools")
    runtime = {}
    result = {"ready": 0, "generated": 0, "reused": 0, "missing": []}
    for item in manifest["recordings"]:
        audio, sidecar, archive = paths(item, manifest_path)
        lock = audio.with_suffix(".lock")
        if lock.exists() or (not audio.exists() and not sidecar.exists()):
            result["missing"].append(item["id"])
            continue
        source = recording_source(manifest, item, manifest_path)
        if archive.exists():
            track = json.loads(archive.read_text("utf-8"))
            if track.get("provenance", {}).get("tool", {}).get("name") != "PocketSphinx":
                raise ValueError("Production voice bank requires forced phone alignment")
            alignment.check_source_track(track, source)
            result["reused"] += 1
        elif generate:
            track = alignment.generate_forced_source(
                source,
                working,
                audio_deps or alignment.ROOT / ".tools/audio-authoring",
                phoneme_deps or alignment.ROOT / ".tools/phoneme-authoring",
            )
            if not 0 < track["metadata"]["duration"] <= 120:
                raise ValueError("Recorded line exceeds the supported voice-bank duration")
            archive.parent.mkdir(parents=True, exist_ok=True)
            temporary = archive.with_suffix(".json.tmp")
            alignment.write_track(temporary, track)
            temporary.replace(archive)
            result["generated"] += 1
            print(f"Aligned {item['id']}", flush=True)
        else:
            result["missing"].append(item["id"])
            continue
        runtime[item["id"]] = compact_track(track)
    result["ready"] = len(runtime)
    if result["missing"]:
        if not generate:
            raise ValueError(f"Voice bank incomplete: {', '.join(result['missing'])}")
        return result
    output = manifest_path.parent / "tracks.json"
    if generate:
        temporary = output.with_suffix(".json.tmp")
        temporary.write_text(
            json.dumps(runtime, ensure_ascii=False, separators=(",", ":")) + "\n",
            encoding="utf-8",
            newline="\n",
        )
        temporary.replace(output)
    elif not output.is_file() or json.loads(output.read_text("utf-8")) != runtime:
        raise ValueError("Runtime voice tracks are missing or differ from verified archives")
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    action = parser.add_mutually_exclusive_group()
    action.add_argument("--generate", action="store_true")
    action.add_argument("--check", action="store_true")
    parser.add_argument("--manifest", type=Path, default=MANIFEST)
    parser.add_argument("--work-dir", type=Path)
    parser.add_argument("--audio-deps", type=Path)
    parser.add_argument("--phoneme-deps", type=Path)
    args = parser.parse_args()
    result = prepare_bank(
        args.manifest,
        generate=args.generate,
        work_dir=args.work_dir,
        audio_deps=args.audio_deps,
        phoneme_deps=args.phoneme_deps,
    )
    print(json.dumps(result, sort_keys=True))
    if result["missing"]:
        print("Partial authoring progress only; runtime tracks were not published.")


if __name__ == "__main__":
    main()
