"""Both pilot voices render the same meanings with their own whole scripts."""

import json
import re
from pathlib import Path

SPEECH = Path(__file__).resolve().parents[2] / "frontend/src/audio/speech"
# The Maia readings a coach speaks when one is a ply's whole content. The other
# two only occur beside a stronger alternative and stay retired.
SOLE_MAIA = {
    "human-natural-best",
    "human-natural-strong",
    "human-unusual-strong",
    "human-hard-find",
    "human-hard-defense-found",
}
RETIRED_MAIA = {"human-natural-error", "human-hard-defense-missed"}


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
    # base meaning, including the sole-content Maia readings, must survive.
    retired = RETIRED_MAIA | {"clock-low", "clock-fast", "clock-long"}
    original = {row["id"]: row for row in revision if row["id"] not in retired}
    assert len(original) == len(revision) - len(retired)
    base_rivet = {row["id"]: row for row in read("banks/rivet/scripts.json")["records"]}
    additions = read("banks/pilot-additions.json")["recordings"]
    extras = {row["id"]: row for row in additions}
    assert len(extras) == len(additions)
    assert original.keys() == base_rivet.keys()
    assert not original.keys() & extras.keys()
    catalogue = {row["id"]: row for row in read("meanings.json")["meanings"]}
    # Every meaning has authored Walter and Rivet text, recorded or not.
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
        assert all(catalogue[key]["group"] == "lessons" for key in unrecorded)
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


def test_only_sole_content_maia_readings_are_spoken_meanings():
    # Maia stays visible (badge, popup, written sentence). It is voiced only when
    # it is a ply's whole content, never beside or combined with another fact.
    maia = re.compile(r"^(?:human-|combo-|combined-)")
    catalogue = read("meanings.json")["meanings"]
    assert {row["id"] for row in catalogue if maia.match(row["id"])} == SOLE_MAIA
    assert not [row for row in catalogue if "primary" in row or "secondary" in row]
    assert not (SPEECH / "banks/maia-combinations.json").exists()
    for bank in read("banks/registry.json")["banks"]:
        manifest = read(bank["manifestPath"])
        assert {row["id"] for row in manifest["recordings"] if maia.match(row["id"])} <= SOLE_MAIA
    for scripts in sorted(SPEECH.glob("banks/*/scripts.json")):
        rows = json.loads(scripts.read_text(encoding="utf-8"))["records"]
        spoken = {row["id"] for row in rows if maia.match(row["id"])}
        assert spoken == SOLE_MAIA, scripts.parent.name
