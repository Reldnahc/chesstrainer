"""Missing English inflections use bounded, inspectable rules, never clip exceptions."""

from copy import deepcopy

import pytest

from scripts import speech_pronunciation as pronunciation


@pytest.mark.parametrize(
    ("word", "base", "base_phones", "rule", "suffix"),
    [
        ("cats", "cat", "K AE T", "plural-or-third-person", "S"),
        ("cliffs", "cliff", "K L IH F", "plural-or-third-person", "S"),
        ("dogs", "dog", "D AO G", "plural-or-third-person", "Z"),
        ("bees", "bee", "B IY", "plural-or-third-person", "Z"),
        ("judges", "judge", "JH AH JH", "plural-or-third-person", "IH Z"),
        ("cat's", "cat", "K AE T", "possessive", "S"),
        ("dog's", "dog", "D AO G", "possessive", "Z"),
        ("boss's", "boss", "B AO S", "possessive", "IH Z"),
        ("church's", "church", "CH ER CH", "possessive", "IH Z"),
        ("liftable", "lift", "L IH F T", "able", "AH B AH L"),
        ("capturable", "capture", "K AE P CH ER", "able", "AH B AH L"),
        ("playability", "play", "P L EY", "ability", "AH B IH L AH T IY"),
        ("pawnless", "pawn", "P AO N", "less", "L AH S"),
        ("classifier", "classify", "K L AE S AH F AY", "agent-ier", "ER"),
        ("steadies", "steady", "S T EH D IY", "plural-ies", "Z"),
        ("fictional", "fiction", "F IH K SH AH N", "adjectival-al", "AH L"),
    ],
)
def test_regular_suffixes_retain_dictionary_base_and_record_the_generic_rule(
    word, base, base_phones, rule, suffix
):
    dictionary = {base: base_phones}

    result = pronunciation.pronunciation(word, dictionary.get)

    assert result == {
        "word": word,
        "base": base,
        "rule": rule,
        "basePhones": base_phones.split(),
        "phones": (base_phones + " " + suffix).split(),
    }
    pronunciation.validate(pronunciation.evidence([result]), f"a {word} matters")


@pytest.mark.parametrize(
    ("word", "dictionary", "base", "rule", "phones"),
    [
        ("castled", {"castle": "K AE S AH L"}, "castle", "past-ed", "K AE S AH L D"),
        ("reloaded", {"reload": "R IY L OW D"}, "reload", "past-ed", "R IY L OW D IH D"),
        ("hoped", {"hope": "HH OW P", "hop": "HH AA P"}, "hope", "past-ed", "HH OW P T"),
        ("reloading", {"reload": "R IY L OW D"}, "reload", "progressive-ing", "R IY L OW D IH NG"),
        ("coding", {"code": "K OW D", "cod": "K AA D"}, "code", "progressive-ing", "K OW D IH NG"),
        ("castling", {"castle": "K AE S AH L"}, "castle", "progressive-ing", "K AE S L IH NG"),
        ("snipped", {"snip": "S N IH P"}, "snip", "past-ed", "S N IH P T"),
        ("tidied", {"tidy": "T AY D IY"}, "tidy", "past-ied", "T AY D IY D"),
        (
            "steadiest",
            {"steady": "S T EH D IY"},
            "steady",
            "superlative-iest",
            "S T EH D IY AH S T",
        ),
    ],
)
def test_regular_past_and_progressive_restore_silent_e_before_bare_stems(
    word, dictionary, base, rule, phones
):
    result = pronunciation.pronunciation(word, dictionary.get)

    assert (result["base"], result["rule"], result["phones"]) == (base, rule, phones.split())
    pronunciation.validate(pronunciation.evidence([result]), f"a {word} matters")


def test_compounds_join_two_dictionary_parts_preferring_the_balanced_split():
    dictionary = {"trap": "T R AE P", "door": "D AO R", "tra": "T R AA", "pdoor": "B AE D"}
    result = pronunciation.pronunciation("trapdoor", dictionary.get)

    assert result == {
        "word": "trapdoor",
        "rule": "compound",
        "base": "trap door",
        "basePhones": ["T", "R", "AE", "P", "D", "AO", "R"],
        "partPhones": [["T", "R", "AE", "P"], ["D", "AO", "R"]],
        "phones": ["T", "R", "AE", "P", "D", "AO", "R"],
    }
    pronunciation.validate(pronunciation.evidence([result]), "a trapdoor opens")
    assert pronunciation.pronunciation("trapdoor", {"trap": "T R AE P"}.get) is None


def test_reviewed_lexicon_covers_only_listed_interjections():
    result = pronunciation.pronunciation("psst", lambda _base: None)

    assert (result["rule"], result["phones"]) == ("lexicon", ["P", "S", "T"])
    pronunciation.validate(pronunciation.evidence([result]), "psst look")
    tampered = {**result, "phones": ["P", "S"], "basePhones": ["P", "S"]}
    with pytest.raises(ValueError, match="does not match"):
        pronunciation.validate(pronunciation.evidence([tampered]), "psst look")


def test_earlier_revision_evidence_stays_valid_but_cannot_claim_newer_rules():
    cats = pronunciation.pronunciation("cats", {"cat": "K AE T"}.get)
    castled = pronunciation.pronunciation("castled", {"castle": "K AE S AH L"}.get)
    old = {**pronunciation.evidence([cats]), "revision": "regular-english-morphology-v1"}

    pronunciation.validate(old, "cats castled")
    with pytest.raises(ValueError, match="newer than its revision"):
        pronunciation.validate({**old, "derivations": [castled]}, "cats castled")


def test_negative_prefix_retains_the_complete_base_pronunciation():
    assert pronunciation.pronunciation("unhappy", {"happy": "HH AE P IY"}.get) == {
        "word": "unhappy",
        "base": "happy",
        "rule": "negative-un",
        "basePhones": ["HH", "AE", "P", "IY"],
        "phones": ["AH", "N", "HH", "AE", "P", "IY"],
    }


@pytest.mark.parametrize("ending", ["P", "T", "K", "F", "TH"])
def test_each_voiceless_ending_selects_unvoiced_plural_suffix(ending):
    result = pronunciation.pronunciation("cats", {"cat": f"K AE {ending}"}.get)
    assert result["phones"][-1] == "S"


@pytest.mark.parametrize("ending", ["S", "Z", "SH", "ZH", "CH", "JH"])
def test_each_sibilant_ending_inserts_a_vowel_before_possessive_suffix(ending):
    result = pronunciation.pronunciation("boss's", {"boss": f"B AO {ending}"}.get)
    assert result["phones"][-2:] == ["IH", "Z"]


@pytest.mark.parametrize(
    "word", ["cats", "boss's", "unhappy", "liftable", "fictional", "castled", "castling", "blorf"]
)
def test_unknown_base_never_gets_guessed(word):
    assert pronunciation.pronunciation(word, lambda _base: None) is None


def test_possessive_uses_its_dictionary_base_instead_of_stripping_a_plural_suffix():
    dictionary = {"dog": "D AO G", "dog'": "B AE D"}
    result = pronunciation.pronunciation("dog's", dictionary.get)

    assert result["rule"] == "possessive"
    assert result["base"] == "dog"
    assert result["phones"] == ["D", "AO", "G", "Z"]


@pytest.mark.parametrize("phones", ["K AE1 T", "k ae t", "K AE ?", "  \t "])
def test_malformed_dictionary_phones_are_not_silently_cleaned_up(phones):
    with pytest.raises(ValueError, match="Invalid source dictionary pronunciation"):
        pronunciation.pronunciation("cats", {"cat": phones}.get)


@pytest.fixture
def derived_evidence():
    entry = pronunciation.pronunciation("cats", {"cat": "K AE T"}.get)
    return pronunciation.evidence([entry])


def test_evidence_is_reproducible_without_dictionary_or_native_runtime(derived_evidence):
    original = deepcopy(derived_evidence)

    pronunciation.validate(derived_evidence, "cats watch other cats")

    assert derived_evidence == original


@pytest.mark.parametrize(
    "mutation",
    [
        "revision",
        "source",
        "empty",
        "non-list",
        "non-entry",
        "duplicate",
        "unrelated-word",
        "base",
        "base-phones-type",
        "base-phone-type",
        "rule",
        "phones",
        "extra-field",
    ],
)
def test_altered_or_unrelated_derivation_evidence_is_rejected(derived_evidence, mutation):
    entry = derived_evidence["derivations"][0]
    if mutation == "revision":
        derived_evidence["revision"] = "unknown-rules"
    elif mutation == "source":
        derived_evidence["source"] = "manual phoneme edit"
    elif mutation == "empty":
        derived_evidence["derivations"] = []
    elif mutation == "non-list":
        derived_evidence["derivations"] = entry
    elif mutation == "non-entry":
        derived_evidence["derivations"] = [None]
    elif mutation == "duplicate":
        derived_evidence["derivations"].append(deepcopy(entry))
    elif mutation == "unrelated-word":
        derived_evidence["derivations"][0] = pronunciation.pronunciation(
            "dogs", {"dog": "D AO G"}.get
        )
    elif mutation == "base":
        entry["base"] = "dog"
    elif mutation == "base-phones-type":
        entry["basePhones"] = "K AE T"
    elif mutation == "base-phone-type":
        entry["basePhones"] = ["K", "AE", 42]
    elif mutation == "rule":
        entry["rule"] = "possessive"
    elif mutation == "phones":
        entry["phones"][-1] = "Z"
    elif mutation == "extra-field":
        entry["clipOverride"] = True

    with pytest.raises(ValueError):
        pronunciation.validate(derived_evidence, "cats watch other cats")
