"""Synthesize the original, dependency-free chess sound palettes.

Run from the repository root: python scripts/generate_audio.py
Use --check to verify the committed WAVs without changing files.
"""

import argparse
import hashlib
import io
import math
import random
import struct
import wave
from dataclasses import dataclass
from pathlib import Path

SAMPLE_RATE = 22_050
ASSET_ROOT = Path(__file__).resolve().parents[1] / "frontend/src/audio/assets"
PALETTES = ("warm-wood", "clean-minimal", "soft-digital")


@dataclass(frozen=True)
class Strike:
    start: float
    frequency: float
    strength: float = 1.0
    decay: float = 0.040


@dataclass(frozen=True)
class Cue:
    duration: float
    strikes: tuple[Strike, ...]
    volume: float = 1.0


# Small motifs carry meaning without voices, samples, or long notification melodies.
# Board actions are percussive; learning feedback uses related thirds and fifths.
CUES = {
    "move": Cue(0.160, (Strike(0.000, 292, decay=0.025),), 0.76),
    "capture": Cue(0.210, (Strike(0.000, 196, decay=0.038),), 0.94),
    "castle": Cue(0.290, (Strike(0.000, 262), Strike(0.095, 330, 0.78)), 0.82),
    "promotion": Cue(0.440, (Strike(0.000, 392), Strike(0.100, 523), Strike(0.200, 659)), 0.89),
    "check": Cue(0.280, (Strike(0.000, 440), Strike(0.085, 466, 0.70)), 0.78),
    "mate": Cue(0.520, (Strike(0.000, 392), Strike(0.130, 294), Strike(0.265, 262)), 0.86),
    "correct": Cue(0.340, (Strike(0.000, 523), Strike(0.110, 659, 0.84)), 0.87),
    "retry": Cue(0.280, (Strike(0.000, 330), Strike(0.095, 294, 0.72)), 0.72),
    "complete": Cue(0.560, (Strike(0.000, 392), Strike(0.125, 523), Strike(0.255, 659)), 0.91),
    "brilliant": Cue(0.510, (Strike(0.000, 523), Strike(0.100, 659), Strike(0.205, 784)), 0.91),
    "great": Cue(0.370, (Strike(0.000, 392), Strike(0.120, 587, 0.88)), 0.86),
    "miss": Cue(0.280, (Strike(0.000, 392), Strike(0.100, 349, 0.65)), 0.70),
    "mistake": Cue(0.340, (Strike(0.000, 330), Strike(0.125, 262, 0.75)), 0.75),
    "blunder": Cue(0.410, (Strike(0.000, 294), Strike(0.140, 196, 0.82)), 0.81),
}


def noise_generator(palette: str, cue: str, strike: int) -> random.Random:
    # Avoid Python's per-process hash randomization and platform-dependent entropy.
    seed = hashlib.sha256(f"chess-audio-v1/{palette}/{cue}/{strike}".encode()).digest()
    return random.Random(int.from_bytes(seed[:8], "little"))


def synthesize(palette: str, name: str, cue: Cue) -> list[float]:
    samples = [0.0] * round(cue.duration * SAMPLE_RATE)
    for index, strike in enumerate(cue.strikes):
        start = round(strike.start * SAMPLE_RATE)
        noise = noise_generator(palette, name, index)
        filtered_noise = 0.0
        for frame in range(start, len(samples)):
            t = (frame - start) / SAMPLE_RATE
            frequency = strike.frequency
            if palette == "warm-wood":
                # Inharmonic, rapidly damped body modes plus a soft, low-pass impact.
                # The fundamental bends down slightly as a wooden piece settles.
                frequency *= 0.69
                phase = math.tau * frequency * (t + 0.0016 * (1 - math.exp(-t / 0.009)))
                body = sum(
                    amplitude * math.sin(phase * ratio) * math.exp(-t / decay)
                    for ratio, amplitude, decay in (
                        (1.00, 0.76, strike.decay * 1.05),
                        (1.57, 0.33, strike.decay * 0.68),
                        (2.31, 0.16, strike.decay * 0.42),
                        (3.63, 0.06, strike.decay * 0.25),
                    )
                )
                filtered_noise = 0.76 * filtered_noise + 0.24 * noise.uniform(-1, 1)
                impact = 0.68 * filtered_noise * math.exp(-t / 0.006)
                signal = (body + impact) * (1 - math.exp(-t / 0.0009))
            elif palette == "clean-minimal":
                # A restrained, rounded two-partial click with virtually no noise.
                phase = math.tau * frequency * 1.18 * t
                envelope = (1 - math.exp(-t / 0.0025)) * math.exp(-t / (strike.decay * 0.73))
                signal = (
                    math.sin(phase) + 0.13 * math.sin(phase * 2) * math.exp(-t / 0.012)
                ) * envelope
            elif palette == "soft-digital":
                # Gentle FM at the onset, a warm sub-tone, and a quiet fifth shimmer.
                # No square/saw oscillators or abrupt pitch steps in the sustained tail.
                frequency *= 0.94
                phase = math.tau * frequency * t
                modulation = 0.30 * math.sin(phase * 2) * math.exp(-t / 0.032)
                envelope = (1 - math.exp(-t / 0.007)) * math.exp(-t / (strike.decay * 1.48))
                signal = (
                    0.72 * math.sin(phase + modulation)
                    + 0.18 * math.sin(phase / 2)
                    + 0.10 * math.sin(phase * 1.5) * math.exp(-t / 0.055)
                ) * envelope
            else:
                raise ValueError(f"Unknown palette: {palette}")
            samples[frame] += signal * strike.strength

    # Remove DC, gently fade both boundaries, and leave 4 ms of exact trailing silence.
    # The silence gives browsers an unambiguous click-free end, even for truncated tails.
    mean = sum(samples) / len(samples)
    fade_in = round(0.0015 * SAMPLE_RATE)
    fade_out = round(0.025 * SAMPLE_RATE)
    silence = round(0.004 * SAMPLE_RATE)
    end = len(samples) - silence
    for frame, value in enumerate(samples):
        attack = min(1.0, frame / fade_in)
        release = max(0.0, min(1.0, (end - frame) / fade_out))
        # Smoothstep reaches each boundary with a zero slope.
        release = release * release * (3 - 2 * release)
        samples[frame] = (value - mean) * attack * release

    # Similar perceived loudness, with ample headroom for short overlapping events.
    rms = math.sqrt(sum(value * value for value in samples) / len(samples))
    peak = max(abs(value) for value in samples)
    target_rms = {"warm-wood": 0.082, "clean-minimal": 0.062, "soft-digital": 0.074}[palette]
    gain = min(target_rms / rms, 0.45 / peak) * cue.volume
    return [value * gain for value in samples]


def encode_wav(samples: list[float]) -> bytes:
    if not all(math.isfinite(value) and abs(value) < 1.0 for value in samples):
        raise ValueError("Non-finite or clipping samples")
    pcm = [round(value * 32767) for value in samples]
    if pcm[0] != 0 or any(pcm[-round(0.004 * SAMPLE_RATE) :]):
        raise ValueError("Audio must begin and end at silence")
    output = io.BytesIO()
    with wave.open(output, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(SAMPLE_RATE)
        wav.writeframes(struct.pack(f"<{len(pcm)}h", *pcm))
    return output.getvalue()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Check files without writing them")
    args = parser.parse_args()
    total = 0
    for palette in PALETTES:
        for name, cue in CUES.items():
            audio = encode_wav(synthesize(palette, name, cue))
            path = ASSET_ROOT / palette / f"{name}.wav"
            if args.check:
                if not path.is_file() or path.read_bytes() != audio:
                    raise SystemExit(f"Sound asset differs or is missing: {path}")
            else:
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(audio)
            total += len(audio)
    if total >= 1_000_000:
        raise SystemExit(f"Sound asset budget exceeded: {total:,} bytes")
    verb = "Verified" if args.check else "Generated"
    print(f"{verb} {len(PALETTES) * len(CUES)} sounds; {total:,} bytes total.")


if __name__ == "__main__":
    main()
