"""Complete authored spoken scripts owned by Winston's and Button's banks."""

import json
import re
from pathlib import Path

import pytest

SPEECH = Path(__file__).resolve().parents[2] / "frontend/src/audio/speech"
# Each new voice owns one complete script source; Walter/Rivet text fields stay theirs.
AUTHORED = [
    ("capybara", "winston"),
    ("mushroom", "button"),
    ("ghost", "wisp"),
    ("slime", "pip"),
    ("alien", "ziggy"),
    ("living-pawn", "percy"),
    ("wizard", "orin"),
    ("cat-tuxedo", "felix"),
    ("raccoon", "bandit"),
    ("dog-gentle", "alfie"),
    ("cat-kitten", "pickle"),
    ("dragon", "ember"),
    ("dog-collie", "scout"),
    ("cat-black", "juniper"),
    ("dog-corgi", "waffles"),
    ("unicorn", "celeste"),
    ("man-expert", "jun"),
    ("frog", "fergus"),
    ("man-partner", "arjun"),
    ("gorilla", "monty"),
]
REGISTERED = [("capybara", "winston"), ("mushroom", "button")]
# Voices whose written personality sets questionFrequency to "none".
QUESTIONLESS = ["ziggy", "orin", "felix", "ember", "scout", "juniper", "waffles", "celeste", "jun", "fergus", "monty"]


def read(path):
    return json.loads((SPEECH / path).read_text(encoding="utf-8"))


def active_reference_texts():
    # Walter's and Rivet's banks; the authored voices' own manifests are checked below.
    authored = {voice for _, voice in AUTHORED}
    texts = set()
    for bank in read("banks/registry.json")["banks"]:
        if bank["voiceId"] not in authored:
            texts.update(row["text"] for row in read(bank["manifestPath"])["recordings"])
    return texts


@pytest.mark.parametrize(("coach", "voice"), REGISTERED)
def test_registered_bank_records_exactly_the_authored_scripts(coach, voice):
    entry = [bank for bank in read("banks/registry.json")["banks"] if bank["voiceId"] == voice]
    assert entry == [
        {"coachId": coach, "voiceId": voice, "manifestPath": f"banks/{voice}/manifest.json"}
    ]
    manifest = read(entry[0]["manifestPath"])
    assert (manifest["coachId"], manifest["voiceId"]) == (coach, voice)
    scripts = read(f"banks/{voice}/scripts.json")["records"]
    assert [(row["id"], row["group"], row["text"]) for row in manifest["recordings"]] == [
        (row["id"], row["group"], row["text"]) for row in scripts
    ]


@pytest.mark.parametrize(("coach", "voice"), AUTHORED)
def test_authored_scripts_cover_the_catalogue_exactly(coach, voice):
    scripts = read(f"banks/{voice}/scripts.json")
    assert scripts["coachId"] == coach and scripts["voiceId"] == voice
    catalogue = read("meanings.json")["meanings"]
    rows = scripts["records"]
    assert [row["id"] for row in rows] == [row["id"] for row in catalogue]
    for row, meaning in zip(rows, catalogue, strict=True):
        assert row["group"] == meaning["group"]
        assert row.get("primary") == meaning.get("primary")
        assert row.get("secondary") == meaning.get("secondary")


@pytest.mark.parametrize(("coach", "voice"), AUTHORED)
def test_authored_scripts_are_complete_distinct_spoken_text(coach, voice):
    rows = read(f"banks/{voice}/scripts.json")["records"]
    texts = [row["text"] for row in rows]
    assert len(texts) == len(set(texts))
    assert not set(texts) & active_reference_texts()
    for row in rows:
        text = row["text"]
        assert 1 <= len(text) <= 1000, row["id"]
        assert text.strip() == text and text.endswith((".", "?", "!")), row["id"]
        assert not re.search(r"\bseparate(?:ly)?\b", text, flags=re.IGNORECASE), row["id"]
        assert not re.search(r"\b(?:in|this|the) continuation\b", text, flags=re.IGNORECASE), row[
            "id"
        ]
        if not row["id"].startswith("book-opening-") and not row.get("primary", "").startswith(
            "book-opening-"
        ):
            assert "continuation" not in text.lower(), row["id"]
        assert not any(marker in text for marker in ("{", "}", "TODO", "TBD")), row["id"]
        # Recordings serve many positions; squares and move numbers stay in the bubble.
        assert not re.search(r"\b[a-h][1-8]\b|\d", text), row["id"]


def test_authored_voices_never_share_a_script():
    banks = [
        {row["text"] for row in read(f"banks/{voice}/scripts.json")["records"]}
        for _, voice in AUTHORED
    ]
    for index, texts in enumerate(banks):
        for other in banks[index + 1 :]:
            assert not texts & other


@pytest.mark.parametrize(("coach", "voice"), AUTHORED)
def test_difficulty_is_attributed_to_the_human_model(coach, voice):
    # Spoken right after "the engine's best", bare "evidence" sounds like engine judgement.
    for row in read(f"banks/{voice}/scripts.json")["records"]:
        assert not re.search(r"\b(?:the|model) evidence\b", row["text"], flags=re.IGNORECASE), row[
            "id"
        ]


@pytest.mark.parametrize("voice", QUESTIONLESS)
def test_question_free_voices_ask_no_spoken_questions(voice):
    for row in read(f"banks/{voice}/scripts.json")["records"]:
        assert "?" not in row["text"], row["id"]
