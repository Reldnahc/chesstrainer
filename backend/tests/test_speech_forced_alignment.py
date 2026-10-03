"""Automatic mouth cues remain reproducible from exact transcript/phone evidence."""

import json
from copy import deepcopy

import pytest

from scripts import align_coach_speech as alignment
from scripts import speech_forced_alignment as forced


def evidence(phones, word="voice"):
    start = 0
    entries = []
    for name, duration in phones:
        entries.append({"phone": name, "startFrame": start, "durationFrames": duration})
        start += duration
    return {
        "frameRate": 100,
        "normalizedTranscript": word,
        "words": [{"word": word, "startFrame": 0, "durationFrames": start, "phones": entries}],
    }


@pytest.fixture(params=alignment.SCRIPT_IDS)
def saved_forced(request):
    script_id = request.param
    plan = json.loads(alignment.PLAN.read_text("utf-8"))
    script = next(script for script in plan["scripts"] if script["id"] == script_id)
    track = json.loads((alignment.OUTPUT / f"{script_id}-forced.json").read_text("utf-8"))
    recording = alignment.RECORDINGS / f"{script_id}.opus"
    recorded = json.loads(recording.with_suffix(".provenance.json").read_text("utf-8"))
    return track, script, recording, recorded, alignment.PLAN.relative_to(alignment.ROOT).as_posix()


def test_normalization_only_removes_punctuation_and_retains_word_order():
    assert (
        forced.normalize_text("It's fine—don’t hurry. A sound idea!")
        == "it's fine don't hurry a sound idea"
    )


def test_mapping_covers_the_complete_cmu_arpabet_inventory():
    standard = set(
        "AA AE AH AO AW AY B CH D DH EH ER EY F G HH IH IY JH K L M N NG OW OY P R S SH T TH UH UW V W Y Z ZH".split()
    )
    assert len(standard) == 39
    assert set(forced.PHONE_SHAPES) | set(forced.DIPHTHONGS) == standard | {"SIL"}


@pytest.mark.parametrize(
    "text", ["", "!!!", "Mate in 2.", "Play Nf6.", "café", "good & bad", "½ a chance", None]
)
def test_unsupported_transcript_is_not_silently_rewritten(text):
    with pytest.raises(ValueError):
        forced.normalize_text(text)


@pytest.mark.parametrize(("phone", "shape"), sorted(forced.PHONE_SHAPES.items()))
def test_every_supported_monophthong_and_consonant_maps_without_moving_boundaries(phone, shape):
    native = evidence([(phone, 10)], "<sil>" if phone == "SIL" else "voice")
    if phone == "SIL":
        # Silence is permitted within spoken scripts, not instead of all source words.
        native = evidence([("V", 6)])
        native["words"].append(
            {
                "word": "<sil>",
                "startFrame": 6,
                "durationFrames": 4,
                "phones": [{"phone": "SIL", "startFrame": 6, "durationFrames": 4}],
            }
        )
    cues = forced.mouth_cues(native, "voice", 0.1)
    assert cues[-1]["value"] == shape
    assert cues[0]["start"] == 0
    assert cues[-1]["end"] == 0.1


@pytest.mark.parametrize(("phone", "shapes"), sorted(forced.DIPHTHONGS.items()))
def test_diphthongs_split_generically_only_when_both_targets_have_at_least_40ms(phone, shapes):
    assert forced.mouth_cues(evidence([(phone, 7)]), "voice", 0.07) == [
        {"start": 0, "end": 0.07, "value": shapes[0]}
    ]
    assert forced.mouth_cues(evidence([(phone, 9)]), "voice", 0.09) == [
        {"start": 0, "end": 0.04, "value": shapes[0]},
        {"start": 0.04, "end": 0.09, "value": shapes[1]},
    ]


def test_adjacent_equal_shapes_coalesce_but_bilabial_closure_is_preserved():
    native = evidence([("S", 4), ("T", 4), ("P", 3), ("AE", 9)])
    original = deepcopy(native)
    assert forced.mouth_cues(native, "voice", 0.2) == [
        {"start": 0, "end": 0.08, "value": "B"},
        {"start": 0.08, "end": 0.11, "value": "A"},
        {"start": 0.11, "end": 0.2, "value": "C"},
    ]
    assert native == original


def test_unmodeled_final_analysis_frame_is_rest_not_stretched_phoneme():
    assert forced.mouth_cues(evidence([("V", 9)]), "voice", 0.1) == [
        {"start": 0, "end": 0.09, "value": "G"},
        {"start": 0.09, "end": 0.1, "value": "X"},
    ]


def test_dictionary_pronunciation_variant_retains_exact_source_word():
    native = evidence([("DH", 4), ("IY", 6)], "the")
    native["words"][0]["word"] = "the(2)"
    assert forced.mouth_cues(native, "the", 0.1)


@pytest.mark.parametrize(
    "mutation",
    [
        "missing-word",
        "wrong-word",
        "wrong-text",
        "unknown-phone",
        "silence-word",
        "silence-phone",
        "wrong-frate",
        "word-gap",
        "word-overlap",
        "word-duration",
        "phone-gap",
        "phone-overlap",
        "phone-duration",
        "boolean-frame",
        "float-frame",
        "no-phones",
        "no-words",
        "truncated-word",
    ],
)
def test_malformed_alignment_and_incomplete_transcript_fail_explicitly(mutation):
    native = evidence([("V", 5), ("S", 5)])
    word = native["words"][0]
    phone = word["phones"][1]
    if mutation == "missing-word":
        native["normalizedTranscript"] = "voice omitted"
    elif mutation == "wrong-word":
        word["word"] = "different"
    elif mutation == "wrong-text":
        native["normalizedTranscript"] = "VOICE"
    elif mutation == "unknown-phone":
        phone["phone"] = "UNKNOWN"
    elif mutation == "silence-word":
        word["word"] = "<sil>"
    elif mutation == "silence-phone":
        phone["phone"] = "SIL"
    elif mutation == "wrong-frate":
        native["frameRate"] = 50
    elif mutation == "word-gap":
        word["startFrame"] = 1
    elif mutation == "word-overlap":
        word["startFrame"] = -1
    elif mutation == "word-duration":
        word["durationFrames"] = 9
    elif mutation == "phone-gap":
        phone["startFrame"] = 6
    elif mutation == "phone-overlap":
        phone["startFrame"] = 4
    elif mutation == "phone-duration":
        phone["durationFrames"] = 0
    elif mutation == "boolean-frame":
        phone["startFrame"] = True
    elif mutation == "float-frame":
        phone["startFrame"] = 5.0
    elif mutation == "no-phones":
        word["phones"] = []
    elif mutation == "no-words":
        native["words"] = []
    elif mutation == "truncated-word":
        word["durationFrames"] = 5
        word["phones"] = word["phones"][:1]
    with pytest.raises(ValueError):
        forced.mouth_cues(native, "voice", 0.1)


@pytest.mark.parametrize("duration", [True, 0, -1, 0.01, 0.095, 0.2, float("nan"), float("inf")])
def test_invalid_or_mismatched_timeline_fails(duration):
    with pytest.raises(ValueError):
        forced.mouth_cues(evidence([("V", 10)]), "voice", duration)


def test_committed_automatic_tracks_check_without_audio_or_native_imports(
    saved_forced, monkeypatch
):
    def forbidden(*args, **kwargs):
        pytest.fail("Stored evidence checks cannot invoke a decoder or aligner")

    monkeypatch.setattr(alignment, "decode", forbidden)
    monkeypatch.setattr(alignment.subprocess, "run", forbidden)
    monkeypatch.setattr(forced, "run_worker", forbidden)
    alignment.check_track(*saved_forced)
    track, script, *_ = saved_forced
    provenance = track["provenance"]
    assert provenance["mapping"]["perClipOverrides"] is False
    assert provenance["manualTimingEdits"] is False
    assert track["mouthCues"] == forced.mouth_cues(
        provenance["alignment"], script["text"], track["metadata"]["duration"]
    )


@pytest.mark.parametrize(
    "field", ["modelFilesSha256", "configurationSha256", "configuration", "version", "api"]
)
def test_changed_aligner_models_or_configuration_fail(saved_forced, field):
    saved_forced[0]["provenance"]["tool"][field] = "changed"
    with pytest.raises(ValueError):
        alignment.check_track(*saved_forced)


@pytest.mark.parametrize("bestpath", [True, False])
def test_original_and_state_safe_decoder_profiles_are_explicitly_supported(saved_forced, bestpath):
    config = deepcopy(saved_forced[0]["provenance"]["tool"]["configuration"])
    config["bestpath"] = bestpath
    tool = forced.tool_provenance(config)

    forced.validate_tool(tool)

    assert tool["configurationSha256"] == (
        forced.CONFIG_SHA256 if bestpath else forced.STATE_SAFE_CONFIG_SHA256
    )


def test_state_safe_profile_does_not_permit_unrelated_decoder_changes(saved_forced):
    config = deepcopy(saved_forced[0]["provenance"]["tool"]["configuration"])
    config["bestpath"] = False
    config["samprate"] = 8000

    with pytest.raises(ValueError, match="decoder configuration changed"):
        forced.validate_tool(forced.tool_provenance(config))


def test_valid_but_hand_changed_cues_cannot_pass_by_updating_only_cue_hash(saved_forced):
    track, *_ = saved_forced
    track["mouthCues"][0]["value"] = "A"
    track["provenance"]["cueSha256"] = alignment.cue_digest(track["mouthCues"])
    with pytest.raises(ValueError, match="automatic phone evidence"):
        alignment.check_track(*saved_forced)


def test_changed_phone_evidence_hash_is_rejected(saved_forced):
    track, *_ = saved_forced
    track["provenance"]["alignment"]["words"][0]["phones"][0]["phone"] = "AE"
    with pytest.raises(ValueError, match="alignment fingerprint"):
        alignment.check_track(*saved_forced)


@pytest.mark.parametrize(
    "reduced", [{"have": ["AH"]}, {"the": ["DH", "AH"]}, {"have": ["AH", "V"]}]
)
def test_reduced_forms_must_be_the_known_weak_form_of_a_transcript_word(saved_forced, reduced):
    track, script, *_ = saved_forced
    if "have" in forced.normalize_text(script["text"]).split() and reduced == {"have": ["AH", "V"]}:
        pytest.skip("this fixture legitimately contains have")
    track["provenance"]["reducedForms"] = reduced
    with pytest.raises(ValueError, match="reduced pronunciation"):
        alignment.check_track(*saved_forced)


def test_changed_generic_mapping_is_rejected(saved_forced):
    track, *_ = saved_forced
    track["provenance"]["mapping"]["phoneShapes"]["P"] = "B"
    with pytest.raises(ValueError, match="mouth mapping"):
        alignment.check_track(*saved_forced)


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("frames", 1),
        ("channels", 2),
        ("sampleRate", 8000),
        ("sourceSampleRate", 44100),
        ("durationSeconds", 1),
        ("trimmed", True),
        ("pcmSha256", "bad"),
    ],
)
def test_resampling_cannot_silently_change_original_timeline(saved_forced, field, value):
    saved_forced[0]["provenance"]["resampling"][field] = value
    with pytest.raises(ValueError, match="resampling metadata"):
        alignment.check_track(*saved_forced)


def test_native_alignment_is_bounded_and_unknown_words_remain_actionable(
    saved_forced, tmp_path, monkeypatch
):
    track, script, *_ = saved_forced
    monkeypatch.setattr(alignment, "decode", lambda *args: track["provenance"]["conversion"])

    def failed_native(command, **options):
        assert options["timeout"] == 180
        assert options["check"] is True
        assert command[0] == alignment.sys.executable
        assert command[2].endswith("speech_forced_alignment.py")
        raise alignment.subprocess.CalledProcessError(
            1, command, stderr="No dictionary pronunciation for transcript words: unknownword"
        )

    monkeypatch.setattr(alignment.subprocess, "run", failed_native)
    with pytest.raises(ValueError, match="No dictionary pronunciation.*unknownword"):
        alignment.generate_forced(script, tmp_path, tmp_path, tmp_path)
