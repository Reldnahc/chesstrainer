"""Walter's wording revision keeps whole recordings and their evidence intact."""

import hashlib
import json
import re
from pathlib import Path

from scripts.prepare_coach_voice_bank import compact_track

ROOT = Path(__file__).resolve().parents[2]
BANK = ROOT / "frontend/src/audio/speech/bank"


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


def test_walter_revision_preserves_meanings_and_the_locked_voice():
    original = read(BANK / "revisions/walter-language-v1-manifest.json")
    current = read(BANK / "manifest.json")
    revision = read(BANK / "revisions/walter-language-v2.json")
    before = {item["id"]: item for item in original["recordings"]}
    after = {item["id"]: item for item in current["recordings"]}
    changes = {item["id"]: item for item in revision["recordings"]}
    pilot = {
        item["id"]: item for item in read(BANK / "revisions/walter-pilot-v1.json")["recordings"]
    }
    assert len(changes) == len(revision["recordings"])
    # Coaches voice a Maia (human-move) reading only when it is a ply's whole
    # content. These two always sit beside a stronger alternative, so they are
    # retired, as are the clock observations; every other original recording
    # must survive.
    retired = {"human-natural-error", "human-hard-defense-missed", "clock-low", "clock-fast", "clock-long"}
    assert retired <= before.keys() and not retired & after.keys()
    before = {key: item for key, item in before.items() if key not in retired}
    assert before.keys() <= after.keys()
    for field in ("coachId", "voiceId", "providerVoiceId", "modelId", "settings", "silentIds"):
        assert original[field] == current[field]
    assert current["scope"] == "non-lesson"
    for key in before:
        item = after[key]
        assert item["group"] == before[key]["group"]
        if key in pilot:
            previous = changes.get(key, before[key])["text"]
            assert pilot[key]["previousText"] == previous
            assert item["text"] == pilot[key]["text"] != previous
            continue
        if key not in changes:
            assert item == before[key]
            continue
        change = changes[key]
        assert change["previousText"] == before[key]["text"]
        assert item["text"] == change["text"] != change["previousText"]
        assert item["audioPath"] != before[key]["audioPath"]
        # Concrete board coordinates, SAN payload slots and dynamic counts do
        # not belong in reusable recordings. Generic chess concepts still do.
        assert not re.search(r"\b[a-h][1-8]\b|[{}]|\d", change["text"])
        assert not re.search(r"\bcontinuations?\b", change["text"], re.I)
    assert {
        key for key, item in before.items() if re.search(r"\bcontinuations?\b", item["text"], re.I)
    } <= changes.keys()


def test_original_comparison_audio_and_mouth_tracks_remain_exact():
    manifest = read(BANK / "revisions/walter-language-v1-manifest.json")
    tracks = read(BANK / "revisions/walter-language-v1-tracks.json")
    revisions = read(BANK / "revisions/walter-language-v2.json")
    originals = {item["id"]: item for item in manifest["recordings"]}
    for change in revisions["recordings"]:
        item = originals[change["id"]]
        audio = BANK / item["audioPath"]
        metadata = read(BANK / item["sidecarPath"])
        assert metadata["request"]["script"]["text"] == change["previousText"]
        assert metadata["request"]["voice"]["providerVoiceId"] == manifest["providerVoiceId"]
        assert metadata["sha256"] == hashlib.sha256(audio.read_bytes()).hexdigest()
        alignment = read(BANK / item["alignmentPath"])
        assert alignment["provenance"]["recording"]["sha256"] == metadata["sha256"]
        assert alignment["provenance"]["script"]["text"] == change["previousText"]
        assert compact_track(alignment) == tracks[change["id"]]
