"""Bounded regular-English morphology for missing dictionary inflections.

This is an authoring fallback, not a general grapheme-to-phoneme model. Every
derived word records the dictionary base and rule; unsupported words still fail.
"""

import re
from collections.abc import Callable

REVISION = "regular-english-morphology-v1"
SIBILANTS = frozenset(("S", "Z", "SH", "ZH", "CH", "JH"))
VOICELESS = frozenset(("P", "T", "K", "F", "TH"))


def candidates(word: str) -> list[tuple[str, str]]:
    values = []
    if word.endswith("'s"):
        values.append(("possessive", word[:-2]))
    if word.endswith("s") and not word.endswith("ss"):
        values.append(("plural-or-third-person", word[:-1]))
    if word.startswith("un") and len(word) > 4:
        values.append(("negative-un", word[2:]))
    if word.endswith("able") and len(word) > 5:
        values.append(("able", word[:-4]))
    if word.endswith("al") and len(word) > 4:
        values.append(("adjectival-al", word[:-2]))
    return values


def pronunciation(word: str, lookup: Callable[[str], str | None]) -> dict | None:
    for rule, base in candidates(word):
        value = lookup(base)
        if not value:
            continue
        phones = value.split()
        if not phones or any(re.fullmatch(r"[A-Z]+", phone) is None for phone in phones):
            raise ValueError("Invalid source dictionary pronunciation")
        if rule in ("possessive", "plural-or-third-person"):
            suffix = (
                ["IH", "Z"]
                if phones[-1] in SIBILANTS
                else ["S"]
                if phones[-1] in VOICELESS
                else ["Z"]
            )
            result = [*phones, *suffix]
        elif rule == "negative-un":
            result = ["AH", "N", *phones]
        elif rule == "able":
            result = [*phones, "AH", "B", "AH", "L"]
        else:
            result = [*phones, "AH", "L"]
        return {"word": word, "rule": rule, "base": base, "basePhones": phones, "phones": result}
    return None


def evidence(derivations: list[dict]) -> dict:
    return {
        "revision": REVISION,
        "source": "pinned PocketSphinx CMU dictionary",
        "derivations": derivations,
    }


def validate(value: dict, transcript: str) -> None:
    if (
        not isinstance(value, dict)
        or value.get("revision") != REVISION
        or value.get("source") != "pinned PocketSphinx CMU dictionary"
    ):
        raise ValueError("Unknown automatic pronunciation rules")
    entries = value.get("derivations")
    if not isinstance(entries, list) or not entries:
        raise ValueError("Missing automatic pronunciation derivations")
    seen = set()
    for entry in entries:
        if not isinstance(entry, dict):
            raise ValueError("Invalid automatic pronunciation evidence")
        word, base, phones = entry.get("word"), entry.get("base"), entry.get("basePhones")
        if (
            not isinstance(word, str)
            or word not in transcript.split()
            or word in seen
            or not isinstance(base, str)
            or not isinstance(phones, list)
            or any(not isinstance(phone, str) for phone in phones)
        ):
            raise ValueError("Automatic pronunciation differs from transcript")
        seen.add(word)
        expected = pronunciation(
            word, lambda candidate: " ".join(phones) if candidate == base else None
        )
        if entry != expected:
            raise ValueError("Automatic pronunciation does not match its generic rule")
