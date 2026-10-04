"""Bounded regular-English morphology for missing dictionary inflections.

This is an authoring fallback, not a general grapheme-to-phoneme model. Every
derived word records the dictionary base and rule; unsupported words still fail.
Two-word compounds join dictionary parts, and a small reviewed lexicon covers
interjections no rule can derive.
"""

import re
from collections.abc import Callable

REVISION = "regular-english-morphology-v5"
V1_RULES = frozenset(
    ("possessive", "plural-or-third-person", "negative-un", "able", "adjectival-al")
)
V2_RULES = V1_RULES | {"past-ed", "progressive-ing"}
V3_RULES = V2_RULES | {"ability", "less", "agent-ier"}
V4_RULES = V3_RULES | {"plural-ies"}
# Archives keep the revision they were generated with. Each revision only appends
# rules (v3 also tries a silent-e base for -able first), so a word an older
# revision derived still derives identically; older evidence may use only its rules.
REVISIONS = {
    "regular-english-morphology-v1": V1_RULES,
    "regular-english-morphology-v2": V2_RULES,
    "regular-english-morphology-v3": V3_RULES,
    "regular-english-morphology-v4": V4_RULES,
    REVISION: None,
}
SIBILANTS = frozenset(("S", "Z", "SH", "ZH", "CH", "JH"))
VOICELESS = frozenset(("P", "T", "K", "F", "TH"))
# Reviewed CMU-style pronunciations for interjections, coinages and coach names
# in authored scripts that no dictionary base or regular rule can produce.
LEXICON = {
    "eek": ("IY", "K"),
    "femi": ("F", "EH", "M", "IY"),
    "hidey": ("HH", "AY", "D", "IY"),
    "oof": ("UW", "F"),
    "oopsie": ("UW", "P", "S", "IY"),
    "peekaboo": ("P", "IY", "K", "AH", "B", "UW"),
    "psst": ("P", "S", "T"),
    "reka": ("R", "EY", "K", "AA"),
    "smidge": ("S", "M", "IH", "JH"),
    "tala": ("T", "AA", "L", "AH"),
    "tamar": ("T", "AA", "M", "AA", "R"),
    "wheee": ("W", "IY"),
    "wonky": ("W", "AA", "NG", "K", "IY"),
    "wowee": ("W", "AW", "IY"),
    "yowza": ("Y", "AW", "Z", "AH"),
    "ziggy": ("Z", "IH", "G", "IY"),
}


def candidates(word: str) -> list[tuple[str, str]]:
    values = []
    if word in LEXICON:
        values.append(("lexicon", word))
    if word.endswith("'s"):
        values.append(("possessive", word[:-2]))
    if word.endswith("s") and not word.endswith("ss"):
        values.append(("plural-or-third-person", word[:-1]))
    if word.endswith("ies") and len(word) > 4:
        values.append(("plural-ies", word[:-3] + "y"))
    if word.startswith("un") and len(word) > 4:
        values.append(("negative-un", word[2:]))
    # Silent-e restoration is tried first: "capturable" is "capture" + able.
    if word.endswith("able") and len(word) > 5:
        values.extend((("able", word[:-4] + "e"), ("able", word[:-4])))
    if word.endswith("ability") and len(word) > 9:
        values.extend((("ability", word[:-7] + "e"), ("ability", word[:-7])))
    if word.endswith("less") and len(word) > 6:
        values.append(("less", word[:-4]))
    if word.endswith("ier") and len(word) > 5:
        values.append(("agent-ier", word[:-3] + "y"))
    if word.endswith("al") and len(word) > 4:
        values.append(("adjectival-al", word[:-2]))
    # Silent-e restoration is tried first: "coding" is "code", never "cod".
    if word.endswith("ed") and len(word) > 4:
        values.extend((("past-ed", word[:-1]), ("past-ed", word[:-2])))
    if word.endswith("ing") and len(word) > 5:
        values.extend((("progressive-ing", word[:-3] + "e"), ("progressive-ing", word[:-3])))
    # A doubled final consonant is dropped: "snipped" is "snip".
    if word.endswith("ed") and len(word) > 5 and word[-3] == word[-4]:
        values.append(("past-ed", word[:-3]))
    if word.endswith("ied") and len(word) > 4:
        values.append(("past-ied", word[:-3] + "y"))
    if word.endswith("iest") and len(word) > 5:
        values.append(("superlative-iest", word[:-4] + "y"))
    # Two-word compounds, most balanced split first: "trapdoor" is "trap door".
    splits = sorted(range(3, len(word) - 2), key=lambda i: (-min(i, len(word) - i), i))
    values.extend(("compound", f"{word[:i]} {word[i:]}") for i in splits)
    return values


def pronunciation(word: str, lookup: Callable[[str], str | None]) -> dict | None:
    for rule, base in candidates(word):
        if rule == "lexicon":
            phones = list(LEXICON[word])
            return {
                "word": word,
                "rule": rule,
                "base": base,
                "basePhones": phones,
                "phones": phones,
            }
        if rule == "compound":
            parts = [lookup(part) for part in base.split()]
            if not all(parts):
                continue
            part_phones = [part.split() for part in parts]
            if any(
                re.fullmatch(r"[A-Z]+", phone) is None for part in part_phones for phone in part
            ):
                raise ValueError("Invalid source dictionary pronunciation")
            phones = [phone for part in part_phones for phone in part]
            return {
                "word": word,
                "rule": rule,
                "base": base,
                "basePhones": phones,
                "partPhones": part_phones,
                "phones": phones,
            }
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
        elif rule == "ability":
            result = [*phones, "AH", "B", "IH", "L", "AH", "T", "IY"]
        elif rule == "less":
            result = [*phones, "L", "AH", "S"]
        elif rule == "plural-ies":
            result = [*phones, "Z"]
        elif rule == "past-ied":
            result = [*phones, "D"]
        elif rule == "superlative-iest":
            result = [*phones, "AH", "S", "T"]
        elif rule == "agent-ier":
            result = [*phones, "ER"]
        elif rule == "past-ed":
            suffix = (
                ["IH", "D"]
                if phones[-1] in ("T", "D")
                else ["T"]
                if phones[-1] in VOICELESS | {"S", "SH", "CH"}
                else ["D"]
            )
            result = [*phones, *suffix]
        elif rule == "progressive-ing":
            # A syllabic final -le loses its schwa before the vowel: castle -> castling.
            stem = (
                phones[:-2] + ["L"]
                if base.endswith("le") and phones[-2:] == ["AH", "L"]
                else phones
            )
            result = [*stem, "IH", "NG"]
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
        or value.get("revision") not in REVISIONS
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
        allowed = REVISIONS[value["revision"]]
        if allowed is not None and entry.get("rule") not in allowed:
            raise ValueError("Automatic pronunciation rule is newer than its revision")
        known = {base: phones}
        if isinstance(entry.get("partPhones"), list):
            known.update(zip(base.split(), entry["partPhones"], strict=False))
        expected = pronunciation(
            word,
            lambda candidate: (
                " ".join(known[candidate])
                if candidate in known and isinstance(known[candidate], list)
                else None
            ),
        )
        if entry != expected:
            raise ValueError("Automatic pronunciation does not match its generic rule")
