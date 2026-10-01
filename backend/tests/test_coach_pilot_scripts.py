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
    additions = [
        *read("banks/pilot-additions.json")["recordings"],
        *read("banks/maia-combinations.json")["recordings"],
    ]
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
            assert pair[0] in catalogue and "primary" not in catalogue[pair[0]]
            assert pair[1] in original
            assert pair[1].startswith("human-")
            assert catalogue[row["id"]]["primary"] == pair[0]
            assert catalogue[row["id"]]["secondary"] == pair[1]


def test_maia_passages_are_complete_distinct_scripts_for_both_characters():
    rows = read("banks/maia-combinations.json")["recordings"]
    for text_field in ("walterText", "rivetText"):
        texts = [row[text_field] for row in rows]
        assert len(texts) == len(set(texts))
        for row, text in zip(rows, texts, strict=True):
            assert 1 <= len(text) <= 1000
            assert text.strip() == text and text.endswith((".", "?", "!"))
            # A named opening continuation is real opening context. The vague
            # tactical filler rejected by the owner is not that usage.
            if not row["primary"].startswith("book-opening-"):
                assert "continuation" not in text.lower()
            assert "in this continuation" not in text.lower()
            assert "in the continuation" not in text.lower()
            assert not any(marker in text for marker in ("{", "}", "TODO", "TBD"))
    for row in rows:
        assert row["group"] == "game_review"
        assert row["walterText"] != row["rivetText"]
