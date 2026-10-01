"""Both pilot voices render the same meanings with their own whole scripts."""

import json
from pathlib import Path

SPEECH = Path(__file__).resolve().parents[2] / "frontend/src/audio/speech"


def read(path):
    return json.loads((SPEECH / path).read_text(encoding="utf-8"))


def test_pilot_scripts_match_the_registered_recordings_without_losing_base_meanings():
    original = {
        row["id"]: row
        for row in read("bank/revisions/walter-language-v1-manifest.json")["recordings"]
    }
    base_rivet = {row["id"]: row for row in read("banks/rivet/scripts.json")["records"]}
    additions = read("banks/pilot-additions.json")["recordings"]
    extras = {row["id"]: row for row in additions}
    assert len(extras) == len(additions)
    assert original.keys() == base_rivet.keys()
    assert not original.keys() & extras.keys()
    catalogue = {row["id"]: row for row in read("meanings.json")["meanings"]}
    for coach, path, text_field in [
        ("classic", "bank/manifest.json", "walterText"),
        ("robot", "banks/rivet/manifest.json", "rivetText"),
    ]:
        manifest = read(path)
        records = {row["id"]: row for row in manifest["recordings"]}
        assert manifest["coachId"] == coach
        assert records.keys() == original.keys() | extras.keys() == catalogue.keys()
        for key, row in records.items():
            assert row["group"] == catalogue[key]["group"]
            if key in extras:
                assert row["text"] == extras[key][text_field]
            elif coach == "robot":
                assert row["text"] == base_rivet[key]["text"]
    pairs = set()
    for row in additions:
        assert row["walterText"] != row["rivetText"]
        if "primary" in row:
            pair = row["primary"], row["secondary"]
            assert pair not in pairs
            pairs.add(pair)
            assert pair[0] in original and pair[1] in original
            assert pair[1].startswith("human-")
            assert catalogue[row["id"]]["primary"] == pair[0]
            assert catalogue[row["id"]]["secondary"] == pair[1]
