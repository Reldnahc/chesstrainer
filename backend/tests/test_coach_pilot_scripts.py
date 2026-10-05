"""Both pilot voices render the same meanings with their own whole scripts."""

import json
import re
from pathlib import Path

from test_coach_bank_scripts import AWAITING_RECORDING

SPEECH = Path(__file__).resolve().parents[2] / "frontend/src/audio/speech"


def read(path):
    return json.loads((SPEECH / path).read_text(encoding="utf-8"))


def test_active_scripts_avoid_ambiguous_separate_pronunciation():
    # The locked voices do not reliably distinguish the verb from the adjective.
    # Historical takes retain their original text; only active speech is checked.
    affected = [
        f"{manifest['voiceId']}/{row['id']}"
        for bank in read("banks/registry.json")["banks"]
        for manifest in (read(bank["manifestPath"]),)
        for row in manifest["recordings"]
        if re.search(r"\bseparate(?:ly)?\b", row["text"], flags=re.IGNORECASE)
    ]
    assert not affected, affected


def test_pilot_scripts_match_the_registered_recordings_without_losing_base_meanings():
    revision = read("bank/revisions/walter-language-v1-manifest.json")["recordings"]
    # The historical revision keeps the retired Maia and clock rows; every other
    # base meaning must survive. Coaches never speak a Maia reading.
    retired = {row["id"] for row in revision if row["id"].startswith("human-")}
    retired |= {"clock-low", "clock-fast", "clock-long"}
    original = {row["id"]: row for row in revision if row["id"] not in retired}
    assert len(original) == len(revision) - len(retired)
    base_rivet = {row["id"]: row for row in read("banks/rivet/scripts.json")["records"]}
    additions = read("banks/pilot-additions.json")["recordings"]
    extras = {row["id"]: row for row in additions}
    assert len(extras) == len(additions)
    assert original.keys() == base_rivet.keys()
    assert not original.keys() & extras.keys()
    catalogue = {row["id"]: row for row in read("meanings.json")["meanings"]}
    # Every meaning, piece variants included, has authored Walter and Rivet text,
    # recorded or not.
    assert catalogue.keys() <= original.keys() | extras.keys()
    for coach, path, text_field in [
        ("classic", "bank/manifest.json", "walterText"),
        ("robot", "banks/rivet/manifest.json", "rivetText"),
    ]:
        manifest = read(path)
        records = {row["id"]: row for row in manifest["recordings"]}
        assert manifest["coachId"] == coach
        # Generic lesson prompts may be authored before they are recorded.
        unrecorded = (catalogue.keys() | extras.keys()) - records.keys()
        assert all(
            catalogue[key]["group"] == "lessons" or key in AWAITING_RECORDING
            for key in unrecorded
        )
        assert records.keys() == original.keys() | (extras.keys() & records.keys())
        assert records.keys() <= catalogue.keys()
        for key, row in records.items():
            assert row["group"] == catalogue[key]["group"]
            if key in extras:
                assert row["text"] == extras[key][text_field]
            elif coach == "robot":
                assert row["text"] == base_rivet[key]["text"]
    for row in additions:
        assert row["walterText"] != row["rivetText"]
        assert "primary" not in row and "secondary" not in row


def test_no_maia_reading_is_a_spoken_meaning():
    # Maia stays visible (badge, popup, written sentence) but is never voiced.
    maia = re.compile(r"^(?:human-|combo-|combined-)")
    catalogue = read("meanings.json")["meanings"]
    assert not [row["id"] for row in catalogue if maia.match(row["id"])]
    assert not [row for row in catalogue if "primary" in row or "secondary" in row]
    assert not (SPEECH / "banks/maia-combinations.json").exists()
    for bank in read("banks/registry.json")["banks"]:
        manifest = read(bank["manifestPath"])
        assert not [row["id"] for row in manifest["recordings"] if maia.match(row["id"])]
    for scripts in sorted(SPEECH.glob("banks/*/scripts.json")):
        rows = json.loads(scripts.read_text(encoding="utf-8"))["records"]
        assert not [row["id"] for row in rows if maia.match(row["id"])], scripts.parent.name
