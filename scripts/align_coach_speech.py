"""Author two automatic Rhubarb previews from existing Walter recordings, entirely offline.

--check uses the standard library only. --generate additionally needs the pinned
Windows Rhubarb release, NumPy and SoundFile in the local authoring environment.
No executable, decoder, temporary WAV or service dependency ships with the app.
"""

import argparse
import hashlib
import json
import math
import subprocess
import sys
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEECH = ROOT / "frontend/src/audio/speech"
PLAN = SPEECH / "walter-contrasts-plan.json"
OUTPUT = SPEECH / "alignment"
RECORDINGS = SPEECH / "recordings/walter-contrasts-v1/walter"
SCRIPT_IDS = ("sound-sacrifice", "allowed-mate")
TOOL_VERSION = "1.14.0"
TOOL_URL = (
    "https://github.com/DanielSWolf/rhubarb-lip-sync/releases/download/v1.14.0/"
    "Rhubarb-Lip-Sync-1.14.0-Windows.zip"
)
ARCHIVE_SHA256 = "62fa416a8d5e382a3828ee4bef358ce520d0b4cabdeaea75a7ac266d098d1fe3"
EXECUTABLE_SHA256 = "9e289c6b5939ef6b306a61e8105ec721fd8d52b3ce950d08891ea3cc7df5718d"
RESOURCES_SHA256 = "638327009469aa6f8658db3cb01955baaaa65d2e0d0b3eeb0255f9ac24dcaa47"
DEFAULT_TOOL = ROOT / ".tools/rhubarb-1.14.0/Rhubarb-Lip-Sync-1.14.0-Windows/rhubarb.exe"
SHAPES = frozenset("ABCDEFGHX")
OPTIONS = [
    "--recognizer",
    "pocketSphinx",
    "--exportFormat",
    "json",
    "--extendedShapes",
    "GHX",
    "--threads",
    "1",
]


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def cue_digest(cues: list[dict]) -> str:
    return digest(json.dumps(cues, separators=(",", ":"), ensure_ascii=False).encode("utf-8"))


def resource_digest(directory: Path) -> str:
    value = hashlib.sha256()
    for path in sorted(path for path in directory.rglob("*") if path.is_file()):
        value.update(path.relative_to(directory).as_posix().encode("utf-8") + b"\0")
        value.update(hashlib.sha256(path.read_bytes()).digest())
    return value.hexdigest()


def number(value: object) -> bool:
    return type(value) in (int, float) and math.isfinite(value)


def validate_cues(result: dict, decoded_duration: float) -> list[dict]:
    """Validate native JSON without changing a single timing or shape choice."""
    duration = result.get("metadata", {}).get("duration")
    if not number(decoded_duration) or decoded_duration <= 0 or not number(duration):
        raise ValueError("Invalid recording duration")
    expected_duration = math.floor(decoded_duration * 100 + 1e-8) / 100
    if not math.isclose(duration, expected_duration, rel_tol=0, abs_tol=1e-8):
        raise ValueError("Rhubarb duration differs from the decoded audio timeline")
    cues = result.get("mouthCues")
    if not isinstance(cues, list) or not cues:
        raise ValueError("Missing mouth cues")
    previous = 0
    for cue in cues:
        if not isinstance(cue, dict) or set(cue) != {"start", "end", "value"}:
            raise ValueError("Invalid mouth cue fields")
        start, end, value = cue["start"], cue["end"], cue["value"]
        if (
            not number(start)
            or not number(end)
            or not isinstance(value, str)
            or value not in SHAPES
        ):
            raise ValueError("Invalid mouth cue value")
        if start != previous or not start < end <= duration:
            raise ValueError("Mouth cue gaps, overlaps or out-of-range timing")
        previous = end
    if previous != duration:
        raise ValueError("Mouth cues do not cover the complete native timeline")
    return cues


def source_inputs(script: dict, recording: Path, provenance: dict) -> bytes:
    original = recording.read_bytes()
    if digest(original) != provenance["sha256"] or len(original) != provenance["bytes"]:
        raise ValueError(f"Original recording changed: {recording.name}")
    if provenance["request"]["script"] != script:
        raise ValueError(f"Recording script differs from the current plan: {script['id']}")
    return original


def check_track(
    track: dict, script: dict, recording_path: Path, recording_provenance: dict, plan_path: str
) -> None:
    original = source_inputs(script, recording_path, recording_provenance)
    if (
        track.get("schemaVersion") != 1
        or track.get("scriptId") != f"contrast-{script['id']}"
        or track.get("voiceId") != "walter"
    ):
        raise ValueError("Unexpected alignment identity")
    provenance = track["provenance"]
    if (
        provenance["sourceScriptId"] != script["id"]
        or provenance.get("manualTimingEdits") is not False
    ):
        raise ValueError("Alignment must retain its automatic source identity")
    source = provenance["recording"]
    if source != {
        "path": recording_path.relative_to(ROOT).as_posix(),
        "sha256": digest(original),
        "bytes": len(original),
    }:
        raise ValueError("Alignment recording fingerprint is stale")
    text = script["text"]
    if provenance["script"] != {
        "planPath": plan_path,
        "text": text,
        "sha256": digest(text.encode("utf-8")),
    }:
        raise ValueError("Alignment script fingerprint is stale")
    tool = provenance["tool"]
    if tool != tool_provenance():
        raise ValueError("Unexpected alignment tool or options")
    conversion = provenance["conversion"]
    if (
        conversion["channels"] != 1
        or conversion["sampleWidthBytes"] != 2
        or conversion["trimmed"] is not False
        or conversion["resampled"] is not False
    ):
        raise ValueError("Alignment conversion changed the audio timeline")
    frames, rate = conversion["frames"], conversion["sampleRate"]
    if type(frames) is not int or frames <= 0 or type(rate) is not int or rate <= 0:
        raise ValueError("Invalid decoded audio format")
    duration = conversion["durationSeconds"]
    if not number(duration) or not math.isclose(duration, frames / rate, rel_tol=0, abs_tol=1e-9):
        raise ValueError("Decoded duration does not match the frame count")
    cues = validate_cues(track, duration)
    if provenance["cueSha256"] != cue_digest(cues):
        raise ValueError("Generated cue fingerprint changed")


def tool_provenance() -> dict:
    return {
        "name": "Rhubarb Lip Sync",
        "version": TOOL_VERSION,
        "platform": "Windows",
        "releaseUrl": TOOL_URL,
        "archiveSha256": ARCHIVE_SHA256,
        "executableSha256": EXECUTABLE_SHA256,
        "resourcesSha256": RESOURCES_SHA256,
        "recognizer": "pocketSphinx",
        "options": OPTIONS,
        "dialogFile": "exact UTF-8 script text, without an added newline",
    }


def decode(recording: Path, wav_path: Path, audio_deps: Path) -> dict:
    if audio_deps.is_dir():
        sys.path.insert(0, str(audio_deps.resolve()))
    import numpy as np
    import soundfile as sf

    samples, rate = sf.read(recording, dtype="float64", always_2d=True)
    if not samples.size or not np.isfinite(samples).all():
        raise ValueError("Recording did not decode to finite audio samples")
    mono = samples.mean(axis=1)
    pcm = np.rint(np.clip(mono, -1, 1) * 32767).astype("<i2")
    with wave.open(str(wav_path), "wb") as stream:
        stream.setnchannels(1)
        stream.setsampwidth(2)
        stream.setframerate(rate)
        stream.writeframes(pcm.tobytes())
    return {
        "decoder": "SoundFile",
        "decoderVersion": sf.__version__,
        "libsndfileVersion": sf.__libsndfile_version__,
        "numpyVersion": np.__version__,
        "inputChannels": samples.shape[1],
        "channels": 1,
        "sampleRate": rate,
        "sampleWidthBytes": 2,
        "frames": len(pcm),
        "durationSeconds": len(pcm) / rate,
        "method": "float64 MP3 decode; arithmetic channel mean; round(clip(sample,-1,1)*32767) to little-endian PCM16 WAV",
        "trimmed": False,
        "resampled": False,
        "wavSha256": digest(wav_path.read_bytes()),
    }


def generate(script: dict, tool: Path, work: Path, audio_deps: Path) -> dict:
    recording = RECORDINGS / f"{script['id']}.mp3"
    recorded = json.loads(recording.with_suffix(".provenance.json").read_text("utf-8"))
    original = source_inputs(script, recording, recorded)
    working = work / script["id"]
    working.mkdir(parents=True, exist_ok=True)
    wav_path = working / "recording.wav"
    conversion = decode(recording, wav_path, audio_deps)
    text = script["text"]
    (working / "dialog.txt").write_bytes(text.encode("utf-8"))
    command = [
        str(tool),
        *OPTIONS,
        "--dialogFile",
        "dialog.txt",
        "--output",
        "native.json",
        "recording.wav",
    ]
    subprocess.run(command, cwd=working, check=True, timeout=180, capture_output=True)
    native = json.loads((working / "native.json").read_text("utf-8"))
    cues = validate_cues(native, conversion["durationSeconds"])
    track = {
        "schemaVersion": 1,
        "scriptId": f"contrast-{script['id']}",
        "voiceId": "walter",
        "metadata": {"duration": native["metadata"]["duration"]},
        "mouthCues": cues,
        "provenance": {
            "sourceScriptId": script["id"],
            "manualTimingEdits": False,
            "recording": {
                "path": recording.relative_to(ROOT).as_posix(),
                "sha256": digest(original),
                "bytes": len(original),
            },
            "script": {
                "planPath": PLAN.relative_to(ROOT).as_posix(),
                "text": text,
                "sha256": digest(text.encode("utf-8")),
            },
            "tool": tool_provenance(),
            "conversion": conversion,
            "cueSha256": cue_digest(cues),
        },
    }
    check_track(track, script, recording, recorded, PLAN.relative_to(ROOT).as_posix())
    return track


def write_track(path: Path, track: dict) -> None:
    # Keep each untouched native cue compact while leaving provenance readable.
    serialized = json.dumps(track, ensure_ascii=False, indent=2)
    cues = (
        "[\n"
        + ",\n".join("    " + json.dumps(cue, separators=(",", ":")) for cue in track["mouthCues"])
        + "\n  ]"
    )
    original = json.dumps(track["mouthCues"], indent=2)
    nested = "\n  ".join(original.splitlines())
    serialized = serialized.replace(nested, cues, 1)
    path.write_text(serialized + "\n", encoding="utf-8", newline="\n")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    action = parser.add_mutually_exclusive_group()
    action.add_argument(
        "--check", action="store_true", help="Verify stored cues without native tools (default)"
    )
    action.add_argument(
        "--generate",
        action="store_true",
        help="Run pinned Rhubarb offline and replace both preview tracks",
    )
    parser.add_argument("--rhubarb", type=Path, default=DEFAULT_TOOL)
    parser.add_argument("--audio-deps", type=Path, default=ROOT / ".tools/audio-authoring")
    parser.add_argument("--work-dir", type=Path, default=ROOT / ".tools/speech-alignment")
    args = parser.parse_args()
    plan = json.loads(PLAN.read_text("utf-8"))
    scripts = [
        next(script for script in plan["scripts"] if script["id"] == key) for key in SCRIPT_IDS
    ]
    if args.generate:
        tool = args.rhubarb.resolve()
        if not args.work_dir.resolve().is_relative_to((ROOT / ".tools").resolve()):
            raise ValueError("Temporary authoring files must stay in the ignored .tools directory")
        if digest(tool.read_bytes()) != EXECUTABLE_SHA256:
            raise ValueError(
                "Rhubarb executable does not match the pinned official Windows release"
            )
        if resource_digest(tool.parent / "res") != RESOURCES_SHA256:
            raise ValueError("Rhubarb recognition resources differ from the pinned release")
        version = subprocess.run(
            [str(tool), "--version"], check=True, capture_output=True, text=True, timeout=10
        ).stdout.strip()
        if version != f"Rhubarb Lip Sync version {TOOL_VERSION}":
            raise ValueError("Rhubarb version mismatch")
        # Prepare and verify both jobs before replacing either committed track.
        tracks = [
            (script, generate(script, tool, args.work_dir.resolve(), args.audio_deps))
            for script in scripts
        ]
        OUTPUT.mkdir(parents=True, exist_ok=True)
        for script, track in tracks:
            write_track(OUTPUT / f"{script['id']}.json", track)
            print(
                f"Generated {script['id']}: {len(track['mouthCues'])} automatic cues, {track['metadata']['duration']:.2f}s"
            )
    else:
        for script in scripts:
            recording = RECORDINGS / f"{script['id']}.mp3"
            check_track(
                json.loads((OUTPUT / f"{script['id']}.json").read_text("utf-8")),
                script,
                recording,
                json.loads(recording.with_suffix(".provenance.json").read_text("utf-8")),
                PLAN.relative_to(ROOT).as_posix(),
            )
        print(
            f"Verified {len(scripts)} automatic speech tracks against exact recordings and scripts."
        )


if __name__ == "__main__":
    main()
