"""Verify audio assets offline, or explicitly prepare them from pinned sources.

--check uses only the standard library. --prepare additionally needs NumPy and
SoundFile; see the assets README. Nothing downloads during an application build.
"""

import argparse
import hashlib
import io
import json
import re
import struct
import wave
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "frontend/src/audio/assets"
MANIFEST = ASSETS / "sources.json"


def safe_path(directory: Path, name: str) -> Path:
    if not re.fullmatch(r"[a-z0-9-]+", name):
        raise ValueError(f"Invalid asset name: {name}")
    path = (directory / name).resolve()
    if not path.is_relative_to(directory.resolve()):
        raise ValueError("Asset path left its directory")
    return path


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def check(manifest: dict) -> None:
    expected = set()
    total = 0
    for asset in manifest["assets"]:
        path = safe_path(safe_path(ASSETS, asset["palette"]), asset["cue"]).with_suffix(".wav")
        if path in expected:
            raise ValueError(f"Duplicate asset: {path}")
        expected.add(path)
        data = path.read_bytes()
        if digest(data) != asset["sha256"]:
            raise ValueError(f"Asset hash mismatch: {path}")
        license_info = manifest["licenses"].get(asset["license"])
        if (
            not license_info
            or not license_info["url"].startswith("https://creativecommons.org/")
            or not asset["sourceUrl"].startswith("https://")
            or not all(asset.get(key) for key in ("title", "author", "modifications"))
        ):
            raise ValueError(f"Missing provenance: {path}")
        with wave.open(io.BytesIO(data)) as stream:
            assert stream.getnchannels() == 1 and stream.getsampwidth() == 2, path
            assert stream.getframerate() == asset["sampleRate"], path
            assert 0.075 <= stream.getnframes() / stream.getframerate() <= 2.5, path
            raw = stream.readframes(stream.getnframes())
            samples = struct.unpack(f"<{len(raw) // 2}h", raw)
            assert 0 < max(abs(sample) for sample in samples) <= 21300, path
            assert not any(samples[-int(stream.getframerate() * 0.004) :]), path
        total += len(data)
    actual = {path.resolve() for path in ASSETS.glob("*/*.wav")}
    if actual != expected:
        raise ValueError(f"Uncatalogued or missing WAVs: {actual ^ expected}")
    print(
        f"Verified {len(expected)} audio candidates; {total:,} bytes; hashes, levels and provenance intact."
    )


def prepare(manifest: dict, source_dir: Path, fetch: bool, update_hashes: bool) -> None:
    import numpy as np
    import soundfile as sf

    source_dir.mkdir(parents=True, exist_ok=True)
    recordings = {}
    for source in manifest["sources"]:
        path = safe_path(source_dir, source["id"]).with_suffix(".mp3")
        if not path.exists() and fetch:
            request = Request(
                source["downloadUrl"], headers={"User-Agent": "Fieldwork audio asset preparation"}
            )
            with urlopen(request, timeout=60) as response:
                data = response.read()
            if digest(data) != source["sha256"]:
                raise ValueError(f"Publisher file changed: {source['sourceUrl']}")
            path.write_bytes(data)
        if digest(path.read_bytes()) != source["sha256"]:
            raise ValueError(f"Source hash mismatch: {path}")
        frames, rate = sf.read(path, always_2d=True, dtype="float64")
        recordings[source["id"]] = (frames.mean(axis=1), rate)

    outputs = []
    for asset in manifest["assets"]:
        rate = asset["sampleRate"]
        playback_rate = float(asset.get("playbackRate", 1))
        fade_in_seconds = float(asset.get("fadeInSeconds", 0.001))
        if not 0.5 <= playback_rate <= 6 or not 0 <= fade_in_seconds <= 0.5:
            raise ValueError(f"Invalid playback rate or onset fade: {asset['palette']}")
        take_rates = [float(t.get("playbackRate", playback_rate)) for t in asset["takes"]]
        if any(not 0.5 <= speed <= 6 for speed in take_rates):
            raise ValueError(f"Invalid take playback rate: {asset['palette']}")
        length = max(
            t["at"] + (t["end"] - t["start"]) / speed
            for t, speed in zip(asset["takes"], take_rates, strict=True)
        )
        samples = np.zeros(round(length * rate) + round(0.006 * rate))
        for take, speed in zip(asset["takes"], take_rates, strict=True):
            original, original_rate = recordings[take["source"]]
            assert 0 <= take["start"] < take["end"] <= len(original) / original_rate
            gain = float(take.get("gain", 1))
            if not 0 < gain <= 1 or take["at"] < 0:
                raise ValueError(f"Invalid take gain or offset: {asset['palette']}")
            frames = round((take["end"] - take["start"]) * rate / speed)
            times = take["start"] + np.arange(frames) / rate * speed
            clip = np.interp(times * original_rate, np.arange(len(original)), original)
            # Remove recording DC offset and soften only the edit boundaries.
            clip -= clip.mean()
            fade_in = min(len(clip), round(fade_in_seconds * rate))
            fade_out = min(len(clip), round(asset["fadeOutSeconds"] * rate))
            clip[:fade_in] *= np.linspace(0, 1, fade_in)
            clip[-fade_out:] *= np.linspace(1, 0, fade_out)
            start = round(take["at"] * rate)
            samples[start : start + len(clip)] += clip * gain
        peak = float(np.max(np.abs(samples)))
        active = samples[np.abs(samples) > peak * 0.05]
        rms = float(np.sqrt(np.mean(active**2)))
        samples *= min(asset["peakLimit"] / peak, asset["targetRms"] / rms)
        pcm = np.rint(samples * 32767).astype("<i2")
        buffer = io.BytesIO()
        with wave.open(buffer, "wb") as stream:
            stream.setnchannels(1)
            stream.setsampwidth(2)
            stream.setframerate(rate)
            stream.writeframes(pcm.tobytes())
        data = buffer.getvalue()
        hash_value = digest(data)
        if not update_hashes and hash_value != asset["sha256"]:
            raise ValueError(f"Prepared output changed: {asset['palette']}/{asset['cue']}")
        path = safe_path(safe_path(ASSETS, asset["palette"]), asset["cue"]).with_suffix(".wav")
        outputs.append((path, data))
        asset["sha256"] = hash_value
    # Validate every source/output first; a mismatch leaves checked-in files alone.
    for path, data in outputs:
        path.parent.mkdir(exist_ok=True)
        path.write_bytes(data)
    if update_hashes:
        MANIFEST.write_text(
            json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
        )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--check", action="store_true")
    mode.add_argument("--prepare", action="store_true")
    parser.add_argument("--source-dir", type=Path, default=ROOT / ".tools/audio-sources")
    parser.add_argument(
        "--fetch", action="store_true", help="Explicitly download absent pinned source recordings"
    )
    parser.add_argument(
        "--update-hashes", action="store_true", help="Accept intentional recipe/output changes"
    )
    args = parser.parse_args()
    if args.check and (args.fetch or args.update_hashes):
        parser.error("Fetching and updating hashes require --prepare")
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    if args.prepare:
        prepare(manifest, args.source_dir, args.fetch, args.update_hashes)
    check(manifest)


if __name__ == "__main__":
    main()
