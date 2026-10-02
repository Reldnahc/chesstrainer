"""Encode recorded coach speech from the provider's MP3 to compact Ogg Opus.

The speech provider returns 128 kbps MP3 (`mp3_44100_128`); its smallest Opus
format is 32 kbps. Fieldwork commits and ships mono Opus at about 24 kbps: roughly
a fifth of the MP3's size, with the same timeline. `record_coach_speech.mjs` calls
`--stdin` for every new recording, so a provider MP3 is never written to a bank.
Paths convert recordings made before that: each MP3 is replaced by `<id>.opus`,
its sidecar keeps the provider request untouched, moves the provider file's
fingerprint to `providerAudio`, and sets `sha256`/`bytes` to the committed Opus
file, so every existing hash check binds the exact audio that ships. A clip
without a sidecar (early voice-design previews) gets one holding only those
fingerprints and the encoding.

Encoding needs the optional SoundFile authoring dependency (libsndfile with
Opus); nothing here ships with the app.
"""

import argparse
import base64
import hashlib
import io
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEECH = ROOT / "frontend/src/audio/speech"
FORMAT = "ogg-opus"
SAMPLE_RATE = 48_000
COMPRESSION_LEVEL = 0.93
MAX_SOURCE_BYTES = 8_000_000
# About 32 kbps of audio plus Ogg/Opus headers; the encoding averages ~24 kbps.
MAX_BYTES_PER_SECOND = 4_000
MAX_OVERHEAD_BYTES = 2_000


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def check_encoded(audio: bytes, recorded: dict, duration: float | None = None) -> None:
    """Standard-library guard: committed speech must be this exact Opus encoding.

    Rejects a provider MP3, another codec or setting, a stereo stream, or a clip
    whose average bitrate is above the bank's 24 kbps class (plus Ogg overhead).
    """
    encoding = recorded.get("encoding")
    provider = recorded.get("providerAudio")
    if (
        not isinstance(encoding, dict)
        or encoding.get("format") != FORMAT
        or encoding.get("channels") != 1
        or encoding.get("sampleRate") != SAMPLE_RATE
        or encoding.get("compressionLevel") != COMPRESSION_LEVEL
        or not isinstance(provider, dict)
        or not isinstance(provider.get("sha256"), str)
        or len(provider["sha256"]) != 64
        or type(provider.get("bytes")) is not int
    ):
        raise ValueError("Recording provenance does not describe the banks' Opus encoding")
    head = audio.find(b"OpusHead", 0, 64)
    if audio[:4] != b"OggS" or head < 0 or len(audio) < head + 10 or audio[head + 9] != 1:
        raise ValueError("Committed speech must be mono Ogg Opus, not the provider's MP3")
    if duration is not None and len(audio) > MAX_BYTES_PER_SECOND * duration + MAX_OVERHEAD_BYTES:
        raise ValueError("Committed speech exceeds the banks' Opus bitrate")


def load(audio_deps: Path):
    if audio_deps.is_dir():
        sys.path.insert(0, str(audio_deps.resolve()))
    import numpy as np
    import soundfile as sf

    if "OPUS" not in sf.available_subtypes("OGG") or "MPEG_LAYER_III" not in sf.available_subtypes(
        "MP3"
    ):
        raise ValueError("This libsndfile build cannot decode MP3 and encode Ogg Opus")
    return sf, np


def encoding_provenance(sf, np) -> dict:
    return {
        "format": FORMAT,
        "channels": 1,
        "sampleRate": SAMPLE_RATE,
        "compressionLevel": COMPRESSION_LEVEL,
        "method": (
            "SoundFile float64 decode; arithmetic channel mean; band-limited FFT resample "
            f"to {SAMPLE_RATE} Hz; libsndfile Ogg Opus at compression level {COMPRESSION_LEVEL}"
        ),
        "encoder": "SoundFile",
        "encoderVersion": sf.__version__,
        "libsndfileVersion": sf.__libsndfile_version__,
        "numpyVersion": np.__version__,
    }


def resample(mono, rate: int, np):
    """Band-limited resampling of one complete clip, without a native resampler."""
    if rate == SAMPLE_RATE:
        return mono
    frames = round(len(mono) * SAMPLE_RATE / rate)
    spectrum = np.fft.rfft(mono)
    bins = frames // 2 + 1
    if bins <= len(spectrum):
        spectrum = spectrum[:bins]
    else:
        spectrum = np.concatenate([spectrum, np.zeros(bins - len(spectrum), dtype=spectrum.dtype)])
    return np.fft.irfft(spectrum, frames) * (frames / len(mono))


def encode(source: bytes, sf, np) -> bytes:
    """Encode one provider MP3, then prove the result decodes to the same timeline."""
    if not 0 < len(source) <= MAX_SOURCE_BYTES:
        raise ValueError("Recording is empty or exceeds authoring limits")
    samples, rate = sf.read(io.BytesIO(source), dtype="float64", always_2d=True)
    if not samples.size or not np.isfinite(samples).all():
        raise ValueError("Recording did not decode to finite audio samples")
    mono = np.clip(resample(samples.mean(axis=1), rate, np), -1, 1)
    output = io.BytesIO()
    sf.write(
        output,
        mono.astype("float32"),
        SAMPLE_RATE,
        format="OGG",
        subtype="OPUS",
        compression_level=COMPRESSION_LEVEL,
    )
    encoded = output.getvalue()
    info = sf.info(io.BytesIO(encoded))
    if (
        encoded[:4] != b"OggS"
        or b"OpusHead" not in encoded[:64]
        or info.samplerate != SAMPLE_RATE
        or info.channels != 1
        or abs(info.frames / SAMPLE_RATE - len(samples) / rate) > 0.001
    ):
        raise ValueError("Encoded Opus does not match the recording's timeline")
    return encoded


def convert(source: Path, sf, np) -> tuple[int, int]:
    target = source.with_suffix(".opus")
    sidecar = source.with_suffix(".provenance.json")
    if target.exists():
        raise ValueError(f"Opus recording already exists; inspect it before converting: {target}")
    original = source.read_bytes()
    if sidecar.exists():
        recorded = json.loads(sidecar.read_text("utf-8"))
        if "providerAudio" in recorded or "encoding" in recorded:
            raise ValueError(f"Sidecar already describes an encoded recording: {sidecar}")
        if recorded.get("sha256") != digest(original) or recorded.get("bytes") != len(original):
            raise ValueError(f"Recording differs from its provenance: {source}")
        provider_format = recorded.get("request", {}).get("outputFormat")
    else:
        recorded = {"schemaVersion": 1}
        provider_format = None
    encoded = encode(original, sf, np)
    recorded["sha256"] = digest(encoded)
    recorded["bytes"] = len(encoded)
    recorded["providerAudio"] = {
        **({"format": provider_format} if provider_format else {}),
        "sha256": digest(original),
        "bytes": len(original),
    }
    recorded["encoding"] = encoding_provenance(sf, np)
    temporary = target.with_suffix(".opus.tmp")
    temporary.write_bytes(encoded)
    sidecar_temporary = sidecar.with_suffix(".json.tmp")
    sidecar_temporary.write_text(
        json.dumps(recorded, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n"
    )
    temporary.replace(target)
    sidecar_temporary.replace(sidecar)
    source.unlink()
    return len(original), len(encoded)


def main(argv=None) -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("paths", nargs="*", type=Path, default=[], help="MP3 files or directories")
    mode.add_argument("--stdin", action="store_true", help="Encode MP3 bytes from stdin to JSON")
    mode.add_argument("--check", action="store_true", help="Verify the encoder is available")
    parser.add_argument("--audio-deps", type=Path, default=ROOT / ".tools/audio-authoring")
    args = parser.parse_args(argv)
    sf, np = load(args.audio_deps)
    if args.check:
        print(json.dumps({"encoding": encoding_provenance(sf, np)}))
        return
    if args.stdin:
        encoded = encode(sys.stdin.buffer.read(), sf, np)
        print(
            json.dumps(
                {
                    "encoding": encoding_provenance(sf, np),
                    "audio": base64.b64encode(encoded).decode("ascii"),
                }
            )
        )
        return
    sources = []
    for path in args.paths:
        path = path.resolve()
        if not path.is_relative_to(SPEECH.resolve()):
            raise ValueError("Only recorded speech under frontend/src/audio/speech is converted")
        sources += sorted(path.rglob("*.mp3")) if path.is_dir() else [path]
    before = after = 0
    for source in sources:
        old, new = convert(source, sf, np)
        before, after = before + old, after + new
    print(json.dumps({"converted": len(sources), "mp3Bytes": before, "opusBytes": after}))


if __name__ == "__main__":
    main()
