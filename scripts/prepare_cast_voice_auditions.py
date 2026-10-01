"""Align development cast auditions with the existing offline PocketSphinx pipeline.

Generation may publish a partial studio preview while recording continues. The
default --check requires every direction in the plan, and uses only the standard
library: no decoding, native tools, network or writes.
"""

import argparse
import json
import re
from pathlib import Path

if __package__:
    from . import align_coach_speech as alignment
    from .prepare_coach_voice_bank import compact_track, slug
else:
    import align_coach_speech as alignment
    from prepare_coach_voice_bank import compact_track, slug

PLAN = alignment.SPEECH / "cast-auditions/design-plan.json"
FORMAT = "mp3_44100_128"
MODEL = "eleven_ttv_v3"


def read_json(path: Path, maximum: int = 2_000_000) -> dict:
    if path.is_symlink() or not path.is_file() or path.stat().st_size > maximum:
        raise ValueError(f"Missing, unsafe or oversized audition asset: {path.name}")
    value = json.loads(path.read_text("utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"Audition asset must contain an object: {path.name}")
    return value


def safe_slug(value: object) -> bool:
    return (
        slug(value)
        and len(value) <= 64
        and not re.fullmatch(r"con|prn|aux|nul|com[1-9]|lpt[1-9]", value)
    )


def text(value: object, minimum: int, maximum: int) -> bool:
    return (
        isinstance(value, str)
        and minimum <= len(value.strip())
        and len(value) <= maximum
        and re.search(r"[\x00-\x08\x0b-\x1f\x7f]", value) is None
    )


def load_plan(path: Path) -> dict:
    plan = read_json(path, 128 * 1024)
    if (
        plan.get("schemaVersion") != 1
        or plan.get("provider") != "elevenlabs"
        or plan.get("method") != "voice-design"
        or plan.get("modelId") != MODEL
        or plan.get("outputFormat") != FORMAT
    ):
        raise ValueError("Unsupported voice-design plan")
    coaches = plan.get("coaches")
    if not isinstance(coaches, list) or not 1 <= len(coaches) <= 30:
        raise ValueError("Voice-design plan needs one to thirty coaches")
    ids = set()
    direction_count = characters = distinct_characters = 0
    for coach in coaches:
        if not isinstance(coach, dict) or not safe_slug(coach.get("coachId")):
            raise ValueError("Invalid cast coach identity")
        if coach["coachId"] in ids:
            raise ValueError("Duplicate cast coach identity")
        ids.add(coach["coachId"])
        if not text(coach.get("text"), 100, 500):
            raise ValueError("Invalid audition transcript")
        if not text(coach.get("name"), 1, 120) or not text(coach.get("group"), 1, 60):
            raise ValueError("Missing cast identity metadata")
        alignment.forced.normalize_text(coach["text"])
        distinct_characters += len(coach["text"])
        directions = coach.get("directions")
        if not isinstance(directions, list) or not 1 <= len(directions) <= 3:
            raise ValueError("Each coach needs one to three audition directions")
        direction_ids, prompts = set(), set()
        for direction in directions:
            if not isinstance(direction, dict) or not safe_slug(direction.get("id")):
                raise ValueError("Invalid audition direction identity")
            if not text(direction.get("label"), 1, 160) or not text(
                direction.get("prompt"), 20, 1000
            ):
                raise ValueError("Invalid audition direction description")
            if direction["id"] in direction_ids or direction["prompt"].strip() in prompts:
                raise ValueError("Duplicate audition direction or prompt")
            direction_ids.add(direction["id"])
            prompts.add(direction["prompt"].strip())
            direction_count += 1
            characters += len(coach["text"])
    if direction_count > 90 or characters > 18000:
        raise ValueError("Voice-design plan exceeds its bounded audition scope")
    counts = plan.get("counts")
    if counts is not None and (
        not isinstance(counts, dict)
        or counts.get("coaches") != len(coaches)
        or counts.get("directions") != direction_count
        or counts.get("distinctScriptCharacters") != distinct_characters
        or counts.get("plannedSpokenInputCharacters") != characters
    ):
        raise ValueError("Voice-design plan counts differ from its contents")
    return plan


def request_for(plan: dict, coach: dict, direction: dict) -> dict:
    """Mirror design_coach_voices.mjs's versioned request, including its seeded identity."""
    identity = "\0".join((coach["coachId"], direction["id"], direction["prompt"], coach["text"]))
    seed = int(alignment.digest(identity.encode("utf-8"))[:8], 16) % 2147483648
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


def asset_path(directory: Path, relative: str) -> Path:
    path = directory / relative
    if not path.resolve().is_relative_to(directory.resolve()) or path.is_symlink():
        raise ValueError("Audition assets must remain inside their source directory")
    return path


def recording_source(
    plan_path: Path, request: dict, item: dict
) -> tuple[alignment.SpeechSource, dict]:
    coach, direction = request["coachId"], request["directionId"]
    relative = f"recordings/{coach}/{direction}.mp3"
    audio = asset_path(plan_path.parent, relative)
    sidecar = audio.with_suffix(".provenance.json")
    recorded = read_json(sidecar, 32768)
    if audio.is_symlink() or not audio.is_file() or not 3 <= audio.stat().st_size <= 3 * 1024**2:
        raise ValueError("Missing or oversized audition recording")
    serialized = json.dumps(request, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    if (
        recorded.get("schemaVersion") != 1
        or json.dumps(recorded.get("request"), ensure_ascii=False, separators=(",", ":")).encode(
            "utf-8"
        )
        != serialized
        or recorded.get("requestHash") != alignment.digest(serialized)
    ):
        raise ValueError("Audition request differs from its plan or fingerprint")
    selected = recorded.get("selected", {})
    duration = selected.get("durationSeconds")
    voice_id = selected.get("generatedVoiceId")
    request_id = recorded.get("requestId")
    if (
        not isinstance(voice_id, str)
        or not re.fullmatch(r"[a-zA-Z0-9_-]{1,128}", voice_id)
        or not alignment.number(duration)
        or not 0 < duration <= 60
        or selected.get("mediaType") not in ("audio/mpeg", "audio/mp3")
        or not isinstance(selected.get("language"), str)
        or not re.fullmatch(r"[a-zA-Z-]{2,16}", selected["language"])
        or type(selected.get("previewIndex")) is not int
        or selected["previewIndex"] not in range(3)
        or selected.get("returnedPreviewCount") != 3
        or (
            request_id is not None
            and (
                not isinstance(request_id, str)
                or not re.fullmatch(r"[a-zA-Z0-9_-]{1,128}", request_id)
            )
        )
    ):
        raise ValueError("Invalid saved audition selection")
    expected = {
        "id": f"{coach}:{direction}",
        "coachId": coach,
        "directionId": direction,
        "label": request["label"],
        "text": request["body"]["text"],
        "audioPath": relative,
        "durationSeconds": duration,
        "generatedVoiceId": voice_id,
        **({"requestId": request_id} if request_id else {}),
    }
    if item != expected:
        raise ValueError("Audition manifest differs from verified recording provenance")
    script = {"id": f"{coach}--{direction}", "text": request["body"]["text"]}
    # The shared aligner expects a normalized script-shaped source. Validate the
    # real design request above and bind its untouched sidecar into the archive.
    normalized = {**recorded, "request": {"script": script}}
    alignment.source_inputs(script, audio, normalized)
    fingerprint = {
        "requestSha256": recorded["requestHash"],
        "provenancePath": sidecar.relative_to(alignment.ROOT).as_posix(),
        "provenanceSha256": alignment.digest(sidecar.read_bytes()),
        "generatedVoiceId": voice_id,
        "directionId": direction,
    }
    return alignment.SpeechSource(
        script,
        audio,
        normalized,
        plan_path.relative_to(alignment.ROOT).as_posix(),
        expected["id"],
        coach,
    ), fingerprint


def check_archive(track: dict, source: alignment.SpeechSource, fingerprint: dict) -> None:
    if track.get("provenance", {}).get("tool", {}).get("name") != "PocketSphinx":
        raise ValueError("Cast auditions require automatic PocketSphinx phone alignment")
    if track["provenance"].get("voiceDesign") != fingerprint:
        raise ValueError("Audition alignment request provenance is stale")
    alignment.check_source_track(track, source)


def prepare_cast(
    plan_path: Path = PLAN,
    *,
    generate: bool = False,
    coaches: tuple[str, ...] = (),
    directions: tuple[str, ...] = (),
    work_dir: Path | None = None,
    audio_deps: Path | None = None,
    phoneme_deps: Path | None = None,
) -> dict:
    plan_path = plan_path.resolve()
    plan = load_plan(plan_path)
    if not generate and (coaches or directions):
        raise ValueError("--check requires complete plan coverage; filters are only for generation")
    jobs = {
        f"{coach['coachId']}:{direction['id']}": request_for(plan, coach, direction)
        for coach in plan["coaches"]
        for direction in coach["directions"]
    }
    if set(coaches) - {request["coachId"] for request in jobs.values()}:
        raise ValueError("Coach filter does not match the plan")
    eligible = {
        key for key, request in jobs.items() if not coaches or request["coachId"] in coaches
    }
    if set(directions) - {jobs[key]["directionId"] for key in eligible}:
        raise ValueError("Direction filter does not match the selected coaches")
    selected = {key for key in eligible if not directions or jobs[key]["directionId"] in directions}
    manifest = read_json(plan_path.parent / "manifest.json", 128 * 1024)
    if (
        manifest.get("schemaVersion") != 1
        or manifest.get("provider") != plan["provider"]
        or manifest.get("modelId") != plan["modelId"]
        or not isinstance(manifest.get("recordings"), list)
    ):
        raise ValueError("Unsupported cast audition manifest")
    recordings = {}
    for item in manifest["recordings"]:
        if not isinstance(item, dict) or item.get("id") not in jobs or item["id"] in recordings:
            raise ValueError("Duplicate or unplanned cast audition recording")
        recordings[item["id"]] = item
    working = (work_dir or alignment.ROOT / ".tools/cast-audition-alignment").resolve()
    if generate and not working.is_relative_to((alignment.ROOT / ".tools").resolve()):
        raise ValueError("Temporary authoring files must stay in ignored .tools")
    runtime = {}
    result = {"ready": 0, "generated": 0, "reused": 0, "missing": []}
    for key, request in jobs.items():
        if key not in recordings:
            result["missing"].append(key)
            continue
        source, fingerprint = recording_source(plan_path, request, recordings[key])
        archive = asset_path(
            plan_path.parent, f"alignment/{request['coachId']}/{request['directionId']}.json"
        )
        if archive.exists():
            track = read_json(archive)
            check_archive(track, source, fingerprint)
            result["reused"] += 1
        elif generate and key in selected:
            track = alignment.generate_forced_source(
                source,
                working,
                audio_deps or alignment.ROOT / ".tools/audio-authoring",
                phoneme_deps or alignment.ROOT / ".tools/phoneme-authoring",
            )
            track["provenance"]["voiceDesign"] = fingerprint
            check_archive(track, source, fingerprint)
            archive.parent.mkdir(parents=True, exist_ok=True)
            temporary = archive.with_suffix(".json.tmp")
            alignment.write_track(temporary, track)
            temporary.replace(archive)
            result["generated"] += 1
            print(f"Aligned {key}", flush=True)
        else:
            result["missing"].append(key)
            continue
        runtime[key] = compact_track(track)
    result["ready"] = len(runtime)
    output = asset_path(plan_path.parent, "tracks.json")
    if not generate:
        if result["missing"]:
            raise ValueError(f"Cast auditions incomplete: {', '.join(result['missing'])}")
        if not output.is_file() or read_json(output) != runtime:
            raise ValueError("Runtime cast tracks are missing or differ from verified archives")
    else:
        temporary = output.with_suffix(".json.tmp")
        temporary.write_text(
            json.dumps(runtime, ensure_ascii=False, separators=(",", ":")) + "\n",
            encoding="utf-8",
            newline="\n",
        )
        temporary.replace(output)
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    action = parser.add_mutually_exclusive_group()
    action.add_argument("--generate", action="store_true")
    action.add_argument("--check", action="store_true")
    parser.add_argument("--plan", type=Path, default=PLAN)
    parser.add_argument("--coach", action="append", default=[])
    parser.add_argument("--direction", action="append", default=[])
    parser.add_argument("--work-dir", type=Path)
    parser.add_argument("--audio-deps", type=Path)
    parser.add_argument("--phoneme-deps", type=Path)
    args = parser.parse_args()
    result = prepare_cast(
        args.plan,
        generate=args.generate,
        coaches=tuple(args.coach),
        directions=tuple(args.direction),
        work_dir=args.work_dir,
        audio_deps=args.audio_deps,
        phoneme_deps=args.phoneme_deps,
    )
    print(json.dumps(result, sort_keys=True))
    if result["missing"]:
        print("Partial development auditions only; --check still requires the complete plan.")


if __name__ == "__main__":
    main()
