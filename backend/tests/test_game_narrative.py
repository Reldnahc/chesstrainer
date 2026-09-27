"""Every summary slot must be stable, useful and traceable to reviewed evidence."""

from copy import deepcopy

from test_game_context import reviewed
from trainer.review_intelligence.game_context import game_context
from trainer.review_intelligence.narrative import game_narrative


def test_summary_traceability_stability_and_bounded_jumps():
    parsed, reports, context = reviewed([-300, 0, 0], result="1-0")
    story = game_narrative(parsed, reports, context)
    assert story == game_narrative(parsed, reports, context)
    assert story.complete and story.context_digest == context.input_digest
    assert 2 <= len(story.key_plies) <= 4
    assert len(story.takeaways) <= 2 and set(story.takeaways) <= {m.id for m in story.moments}
    events = {
        event["id"] for report in reports.values() for event in report["intelligence"]["events"]
    }
    relationships = {r.id for r in context.relationships}
    for moment in story.moments:
        assert set(moment.plies) <= set(reports)
        assert set(moment.event_ids) <= events
        assert set(moment.relationship_ids) <= relationships
    assert {"turning_point", "recovery", "conclusion"} <= {m.kind for m in story.moments}
    conclusion = next(m for m in story.moments if m.kind == "conclusion")
    assert conclusion.facts["source"] == "pgn" and conclusion.facts["termination"] is None


def test_partial_review_has_no_completion_or_conversion_and_changed_generation_has_new_id():
    parsed, reports, context = reviewed([300] * 8, initial=300, result="1-0")
    complete = game_narrative(parsed, reports, context)
    assert any(m.kind == "conversion" for m in complete.moments)
    partial = game_context(parsed, {p: r for p, r in reports.items() if p != 4}, completed=True)
    story = game_narrative(parsed, reports, partial)
    assert not story.complete
    assert not [m for m in story.moments if m.kind in {"conclusion", "conversion"}]
    assert story.input_digest != complete.input_digest


def test_a_strong_find_requires_positive_quality_and_concrete_evidence():
    parsed, reports, context = reviewed([0] * 8)
    story = game_narrative(parsed, reports, context)
    assert any(m.kind == "best_find" for m in story.moments)
    changed = deepcopy(reports)
    for report in changed.values():
        report["engine_label"] = "Mistake"
    assert not [
        m
        for m in game_narrative(parsed, changed, context).moments
        if m.kind in {"best_find", "hard_find"}
    ]
    for report in changed.values():
        report["engine_label"] = "Best"
        report["intelligence"]["events"] = []
    assert not [
        m for m in game_narrative(parsed, changed, context).moments if m.kind == "best_find"
    ]


def test_difficult_engine_alternative_is_not_credited_as_the_played_find():
    parsed, reports, context = reviewed([0] * 8)
    reports[3]["practical"].update(best_find_difficulty="difficult", confidence="limited")
    story = game_narrative(parsed, reports, context)
    hard = next(m for m in story.moments if m.kind == "hard_find")
    assert hard.plies == [3] and hard.facts["domain_calibration"] == "unvalidated"
    reports[3]["best"]["uci"] = "d2d4"
    assert not [
        m for m in game_narrative(parsed, reports, context).moments if m.kind == "hard_find"
    ]


def test_proven_board_ending_wins_over_conflicting_declared_result_without_invented_cause():
    parsed, reports, _ = reviewed([0] * 4, line="1. f3 e5 2. g4 Qh4#", result="0-1")
    parsed.headers["Result"] = "1-0"
    context = game_context(parsed, reports, completed=True)
    story = game_narrative(parsed, reports, context)
    end = next(m for m in story.moments if m.kind == "conclusion")
    assert end.facts == {
        "result": "0-1",
        "source": "board",
        "termination": "checkmate",
        "result_conflict": True,
    }
    assert not [m for m in story.moments if m.kind == "conversion"]


def test_book_recognition_never_implies_good_objective_quality_and_prose_is_not_an_input():
    parsed, reports, context = reviewed([0] * 8)
    first = game_narrative(parsed, reports, context)
    opening = next(m for m in first.moments if m.kind == "opening")
    assert opening.facts["meaning"] == "catalogue_recognition_not_quality"
    for report in reports.values():
        report["coach"] = "An unrelated character-specific sentence."
    assert first == game_narrative(parsed, reports, context)
