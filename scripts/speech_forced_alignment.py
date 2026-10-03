"""Offline transcript-to-phone alignment and deterministic, reusable mouth mapping.

Only the worker imports PocketSphinx. Stored evidence and mapping checks remain
stdlib-only; native alignment runs in a bounded subprocess, never in the app.
"""

import argparse
import hashlib
import importlib.metadata
import json
import math
import re
import sys
import warnings
import wave
from pathlib import Path

if __package__:
    from . import speech_pronunciation
else:
    import speech_pronunciation

VERSION = "5.1.1"
FRAME_RATE = 100
SAMPLE_RATE = 16000
CONFIG_SHA256 = "73d0c5e4fa903522234e8c85b78c6d46f013110f759c4f40ed6639d1e8fdbc8e"
STATE_SAFE_CONFIG_SHA256 = "4cc690802d0d8774029df0c0d0e0a370dab93bb8a4bbe9f7a711e8a9c2d027c5"
MODEL_HASHES = {
    "en-us/cmudict-en-us.dict": "20b5c293e1f311fb375fe067e500ec5636f4fc7af5594967263696def9b23bfe",
    "en-us/en-us/feat.params": "c982c5f75e2a30c34d2c9ef1f6b129a5a00e67e3e927565076b58664cc2404c9",
    "en-us/en-us/mdef": "2360f9a86889c1cfee8bd618a0269387911e5fb2920a594f506b18b8c79683b0",
    "en-us/en-us/means": "832019e32cac12eb318964f96f469034acb12d0348eeddc3831831a100cb4dd4",
    "en-us/en-us/noisedict": "7295b07df2c204c4f87c6782b6be1a3859d7006d4e3864181c955d6dab105a33",
    "en-us/en-us/sendump": "8c9564c0d5bef69ca9d9bf1014abe162f071644cf02cf1fa8a483c3dc165a7a8",
    "en-us/en-us/transition_matrices": "c1f7f28ea43177be734be1f88bd7f1b9a853d0e660f8599c67c6eaeca8bb539a",
    "en-us/en-us/variances": "b00d696f85e96834fc10f8e5f06428d8c4db6bffdbe5845b6f69bf6efbc48fa5",
}
PHONE_SHAPES = {
    **dict.fromkeys(("B", "P", "M"), "A"),
    **dict.fromkeys(
        (
            "CH",
            "D",
            "DH",
            "G",
            "HH",
            "IH",
            "IY",
            "JH",
            "K",
            "N",
            "NG",
            "S",
            "SH",
            "T",
            "TH",
            "Y",
            "Z",
            "ZH",
        ),
        "B",
    ),
    **dict.fromkeys(("AE", "AH", "EH"), "C"),
    "AA": "D",
    **dict.fromkeys(("AO", "ER", "R", "UH"), "E"),
    **dict.fromkeys(("W", "UW"), "F"),
    **dict.fromkeys(("F", "V"), "G"),
    "L": "H",
    "SIL": "X",
}
DIPHTHONGS = {
    "AY": ("D", "B"),
    "AW": ("D", "F"),
    "EY": ("C", "B"),
    "OW": ("E", "F"),
    "OY": ("E", "B"),
}
MIN_DIPHTHONG_PART_FRAMES = 4
SILENCE_WORDS = frozenset(("<sil>", "<s>", "</s>"))


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def object_digest(value: object) -> str:
    return digest(json.dumps(value, sort_keys=True, separators=(",", ":")).encode())


def normalize_text(text: str) -> str:
    """Strip punctuation only; never silently drop numbers or invent pronunciations."""
    if not isinstance(text, str):
        raise ValueError("Forced alignment needs transcript text")
    text = text.lower().replace("’", "'")
    token = r"[a-z]+(?:'[a-z]+)?"
    remainder = re.sub(token, "", text)
    if re.search(r"[^\s.,;:!?()'\"\-–—]", remainder):
        raise ValueError("Transcript contains unsupported spelling; spell numbers and symbols out")
    words = re.findall(token, text)
    if not words:
        raise ValueError("Forced alignment needs a nonempty transcript")
    return " ".join(words)


def mapping_provenance() -> dict:
    return {
        "revision": "arpabet-mouth-v1",
        "phoneShapes": PHONE_SHAPES,
        "diphthongs": {phone: list(shapes) for phone, shapes in DIPHTHONGS.items()},
        "minimumDiphthongPartFrames": MIN_DIPHTHONG_PART_FRAMES,
        "diphthongSplit": "midpoint in integer frames; short phones keep the first shape",
        "adjacentEqualShapes": "coalesce",
        "uncoveredFinalFrames": "rest; at most two analysis frames",
        "perClipOverrides": False,
    }


def tool_provenance(config: dict) -> dict:
    return {
        "name": "PocketSphinx",
        "version": VERSION,
        "api": ["Decoder.set_align_text", "Decoder.set_alignment", "Decoder.get_alignment"],
        "documentation": "https://pocketsphinx.readthedocs.io/en/latest/pocketsphinx.html#pocketsphinx.Decoder.set_alignment",
        "modelFilesSha256": MODEL_HASHES,
        "configuration": config,
        "configurationSha256": object_digest(config),
    }


def validate_tool(tool: dict) -> None:
    config = tool.get("configuration")
    if not isinstance(config, dict) or object_digest(config) not in (
        CONFIG_SHA256,
        STATE_SAFE_CONFIG_SHA256,
    ):
        raise ValueError("Forced alignment decoder configuration changed")
    if tool != tool_provenance(config):
        raise ValueError("Forced alignment tool or model fingerprint changed")


def frame_span(entry: dict, name: str, previous: int) -> int:
    if not isinstance(entry, dict) or not isinstance(entry.get(name), str):
        raise ValueError(f"Invalid alignment {name} evidence")
    start, duration = entry.get("startFrame"), entry.get("durationFrames")
    if type(start) is not int or type(duration) is not int or start != previous or duration <= 0:
        raise ValueError("Alignment evidence has missing, overlapping or invalid frames")
    return start + duration


def validated_phones(alignment: dict, text: str, duration: float) -> list[dict]:
    if not isinstance(alignment, dict) or alignment.get("frameRate") != FRAME_RATE:
        raise ValueError("Invalid alignment frame rate")
    normalized = normalize_text(text)
    if alignment.get("normalizedTranscript") != normalized:
        raise ValueError("Forced alignment transcript differs from exact source words")
    words = alignment.get("words")
    if not isinstance(words, list) or not words:
        raise ValueError("Missing word alignment evidence")
    phones, spoken = [], []
    end = 0
    for word in words:
        end = frame_span(word, "word", end)
        name = word["word"]
        silent = name in SILENCE_WORDS
        if not silent:
            # PocketSphinx retains CMU dictionary pronunciation suffixes, e.g. the(2).
            spoken.append(re.sub(r"\([1-9][0-9]*\)$", "", name))
        items = word.get("phones")
        if not isinstance(items, list) or not items:
            raise ValueError("Missing phone alignment evidence")
        phone_end = word["startFrame"]
        for phone in items:
            phone_end = frame_span(phone, "phone", phone_end)
            if phone["phone"] not in PHONE_SHAPES and phone["phone"] not in DIPHTHONGS:
                raise ValueError(f"Unsupported aligned phone: {phone['phone']}")
            if silent != (phone["phone"] == "SIL"):
                raise ValueError("Word and phone silence evidence disagree")
            phones.append(phone)
        if phone_end != end:
            raise ValueError("Phone frames do not cover their word")
    if spoken != normalized.split():
        raise ValueError("Aligned words do not cover the exact transcript in order")
    if type(duration) not in (int, float) or not math.isfinite(duration) or duration <= 0:
        raise ValueError("Invalid forced alignment duration")
    total = round(duration * FRAME_RATE)
    if not math.isclose(total / FRAME_RATE, duration, rel_tol=0, abs_tol=1e-8):
        raise ValueError("Forced preview duration must use integer analysis frames")
    if not 0 <= total - end <= 2:
        raise ValueError("Word alignment does not cover the recording timeline")
    return phones


def mouth_cues(alignment: dict, text: str, duration: float) -> list[dict]:
    """Map native phone spans using shared rules, without per-recording corrections."""
    phones = validated_phones(alignment, text, duration)
    cues = []

    def append(start: int, end: int, shape: str) -> None:
        if start == end:
            return
        if cues and cues[-1]["value"] == shape:
            cues[-1]["end"] = end / FRAME_RATE
        else:
            cues.append({"start": start / FRAME_RATE, "end": end / FRAME_RATE, "value": shape})

    for phone in phones:
        start, length, name = phone["startFrame"], phone["durationFrames"], phone["phone"]
        end = start + length
        if name in DIPHTHONGS:
            first, second = DIPHTHONGS[name]
            if length >= MIN_DIPHTHONG_PART_FRAMES * 2:
                middle = start + length // 2
                append(start, middle, first)
                append(middle, end, second)
            else:
                append(start, end, first)
        else:
            append(start, end, PHONE_SHAPES[name])
    append(
        phones[-1]["startFrame"] + phones[-1]["durationFrames"], round(duration * FRAME_RATE), "X"
    )
    return cues


# Weak forms the aligner may fall back to when a voice contracts the written word.
REDUCED_FORMS = {"have": ("AH", "V")}


def validate_evidence(provenance: dict, text: str, duration: float, cues: list[dict]) -> None:
    validate_tool(provenance["tool"])
    if provenance["mapping"] != mapping_provenance():
        raise ValueError("Forced alignment mouth mapping changed")
    alignment = provenance["alignment"]
    if "pronunciationExtensions" in provenance:
        speech_pronunciation.validate(provenance["pronunciationExtensions"], normalize_text(text))
        extensions = {
            entry["word"]: entry["phones"]
            for entry in provenance["pronunciationExtensions"]["derivations"]
        }
        for word in alignment["words"]:
            name = re.sub(r"\([1-9][0-9]*\)$", "", word["word"])
            if (
                name in extensions
                and [phone["phone"] for phone in word["phones"]] != extensions[name]
            ):
                raise ValueError("Aligned phones differ from the automatic pronunciation")
    reduced = provenance.get("reducedForms", {})
    if any(
        word not in REDUCED_FORMS or tuple(phones) != REDUCED_FORMS[word]
        or word not in normalize_text(text).split()
        for word, phones in reduced.items()
    ):
        raise ValueError("Unknown reduced pronunciation form")
    for word in alignment["words"]:
        name = re.sub(r"\([1-9][0-9]*\)$", "", word["word"])
        if word["word"] == f"{name}(2)" and name in REDUCED_FORMS and name not in reduced:
            raise ValueError("Reduced pronunciation used without its evidence")
    if provenance["alignmentSha256"] != object_digest(alignment):
        raise ValueError("Forced word/phone alignment fingerprint changed")
    if mouth_cues(alignment, text, duration) != cues:
        raise ValueError("Mouth cues differ from the automatic phone evidence")
    resampling = provenance["resampling"]
    source = provenance["conversion"]
    frames = resampling["frames"]
    if (
        resampling["method"] != "Python 3.12 audioop.ratecv PCM16 mono, weightA=1, weightB=0"
        or resampling["sourceSampleRate"] != source["sampleRate"]
        or resampling["sampleRate"] != SAMPLE_RATE
        or resampling["sampleWidthBytes"] != 2
        or resampling["channels"] != 1
        or resampling["trimmed"] is not False
        or type(frames) is not int
        or frames != math.floor((source["frames"] - 1) * SAMPLE_RATE / source["sampleRate"]) + 1
        or resampling["durationSeconds"] != frames / SAMPLE_RATE
        or not re.fullmatch(r"[0-9a-f]{64}", resampling["pcmSha256"])
    ):
        raise ValueError("Forced alignment resampling metadata is inconsistent")


def run_worker(wav_path: Path, text_path: Path, deps: Path) -> dict:
    """Two documented alignment passes; no provider request or private log parsing."""
    if sys.version_info[:2] != (3, 12):
        raise ValueError("Pinned speech authoring currently requires Python 3.12")
    sys.path.insert(0, str(deps.resolve()))
    from pocketsphinx import Decoder, get_model_path

    if importlib.metadata.version("pocketsphinx") != VERSION:
        raise ValueError("Install pinned optional pocketsphinx==5.1.1 for speech authoring")
    models = Path(get_model_path()).resolve()
    if any(
        digest((models / path).read_bytes()) != expected for path, expected in MODEL_HASHES.items()
    ):
        raise ValueError("PocketSphinx model/dictionary differs from the pinned release")
    # Lattice best-path backtracking can produce word spans that the phone-state
    # pass cannot satisfy. PocketSphinx explicitly recommends disabling it for
    # state alignment; preserve the original profile only to verify old previews.
    decoder = Decoder(
        lm=None, samprate=SAMPLE_RATE, frate=FRAME_RATE, loglevel="ERROR", seed=0, bestpath=False
    )
    config = json.loads(decoder.config.dumps())
    for key, value in config.items():
        if isinstance(value, str):
            try:
                config[key] = "$MODEL/" + Path(value).resolve().relative_to(models).as_posix()
            except ValueError:
                pass
    tool = tool_provenance(config)
    validate_tool(tool)
    normalized = normalize_text(text_path.read_text("utf-8"))
    missing = sorted({word for word in normalized.split() if not decoder.lookup_word(word)})
    derivations = []
    for word in missing:
        derived = speech_pronunciation.pronunciation(word, decoder.lookup_word)
        if derived is not None:
            decoder.add_word(word, " ".join(derived["phones"]))
            derivations.append(derived)
    missing = [word for word in missing if not decoder.lookup_word(word)]
    if missing:
        raise ValueError(f"No dictionary pronunciation for transcript words: {', '.join(missing)}")
    with wave.open(str(wav_path), "rb") as stream:
        if stream.getnchannels() != 1 or stream.getsampwidth() != 2:
            raise ValueError("Forced alignment requires mono PCM16 input")
        rate = stream.getframerate()
        pcm = stream.readframes(stream.getnframes())
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", DeprecationWarning)
        import audioop
    pcm, _ = audioop.ratecv(pcm, 2, 1, rate, SAMPLE_RATE, None)
    reduced = {}
    try:
        align_words(decoder, normalized, pcm)
    except RuntimeError:
        # Voices often contract "would have" to "would've". Retry once with the
        # reduced form as an alternate and record it, never a per-clip exception.
        usable = {word: phones for word, phones in REDUCED_FORMS.items() if word in normalized.split()}
        if not usable:
            raise
        for word, phones in usable.items():
            decoder.add_word(f"{word}(2)", " ".join(phones))
        align_words(decoder, normalized, pcm)
        reduced = usable
    decoder.start_utt()
    decoder.process_raw(pcm, full_utt=True)
    decoder.end_utt()
    native = decoder.get_alignment()
    if native is None:
        raise ValueError("PocketSphinx did not produce a phone alignment")
    words = [
        {
            "word": word.name,
            "startFrame": word.start,
            "durationFrames": word.duration,
            "phones": [
                {"phone": phone.name, "startFrame": phone.start, "durationFrames": phone.duration}
                for phone in word
            ],
        }
        for word in native
    ]
    result = {
        "tool": tool,
        "alignment": {"frameRate": FRAME_RATE, "normalizedTranscript": normalized, "words": words},
        "resampling": {
            "method": "Python 3.12 audioop.ratecv PCM16 mono, weightA=1, weightB=0",
            "sourceSampleRate": rate,
            "sampleRate": SAMPLE_RATE,
            "sampleWidthBytes": 2,
            "channels": 1,
            "frames": len(pcm) // 2,
            "durationSeconds": len(pcm) / (2 * SAMPLE_RATE),
            "trimmed": False,
            "pcmSha256": digest(pcm),
        },
    }
    if derivations:
        result["pronunciationExtensions"] = speech_pronunciation.evidence(derivations)
    if reduced:
        result["reducedForms"] = {word: list(phones) for word, phones in reduced.items()}
    return result


def align_words(decoder, normalized: str, pcm: bytes) -> None:
    decoder.set_align_text(normalized)
    decoder.start_utt()
    decoder.process_raw(pcm, full_utt=True)
    decoder.end_utt()
    decoder.set_alignment()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--wav", required=True, type=Path)
    parser.add_argument("--text", required=True, type=Path)
    parser.add_argument("--deps", required=True, type=Path)
    args = parser.parse_args()
    print(json.dumps(run_worker(args.wav, args.text, args.deps), ensure_ascii=False))


if __name__ == "__main__":
    main()
