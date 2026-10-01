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


@pytest.mark.parametrize("word", ["cats", "boss's", "unhappy", "liftable", "fictional", "blorf"])
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
