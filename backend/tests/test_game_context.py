"""Structured stories link observed play; score drift and missing plies break inference."""

from copy import deepcopy

import pytest
from review_cause_fixtures import CAUSES, cause_report
from review_intelligence_fixtures import move_report, support_event, tactic_event
from test_review_clocks import game
from trainer.game_review import public_report
from trainer.review_intelligence.game_context import game_context
from trainer.review_intelligence.presentation import present_game

LINE = "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6"


def reviewed(scores, initial=0, result="*", line=LINE):
    parsed = game(f"{line} {result}")
    board, raw, previous = parsed.board(), {}, initial
    for ply, move in enumerate(parsed.mainline_moves(), 1):
        value = scores[min(ply - 1, len(scores) - 1)]
        sign = 1 if board.turn else -1
        before, after = previous * sign, value * sign
        best = (
            next(m.uci() for m in board.legal_moves if m != move) if before > after else move.uci()
        )
        raw[ply] = move_report(
            board, move.uci(), best=best, before=before, after=after, second=before - 20
        )
        raw[ply].update(before_analysis_id=f"root-{ply}", played_analysis_id=f"played-{ply}")
        previous = value
        board.push(move)
    reports, context = present_game(parsed, raw, 1000, completed=True)
    return parsed, reports, context


def links(context, kind):
    return [r for r in context.relationships if r.kind == kind]


def test_mistake_missed_punishment_recovery_preserves_actor_and_evidence():
    parsed, reports, context = reviewed([-300, 0, 0])
    missed = links(context, "punishment")[0]
    assert missed.actor == "black" and missed.plies == [1, 2]
    assert missed.facts.outcome == "missed"
    recovery = links(context, "recovery")[0]
    assert recovery.actor == "white" and recovery.plies == [1, 2, 3]
    assert recovery.facts.opponent_errors == [2]
    assert {e.ply for e in recovery.evidence if e.source == "stockfish"} == {1, 2, 3}
    assert context == game_context(parsed, reports, completed=True)
    _, _, punished = reviewed([-300, -300, -300])
    assert links(punished, "punishment")[0].facts.outcome == "capitalized"
    assert not links(punished, "recovery")


def test_partial_benefit_is_not_described_as_completely_missed():
    _, _, context = reviewed([-500, -380, -380])
    assert not links(context, "punishment")


def test_gaps_and_inconsistent_searches_break_sequential_claims():
    parsed, reports, original = reviewed([-300, 0, 0])
    partial = game_context(parsed, {p: r for p, r in reports.items() if p != 2}, completed=True)
    assert partial.missing_plies == [2] and not partial.complete
    assert not links(partial, "recovery") and not links(partial, "punishment")
    changed = deepcopy(reports)
    changed[2]["best"]["score"]["value"] = 800
    changed[2]["actual"]["score"]["value"] = 800
    context = game_context(parsed, changed, completed=True)
    assert "adjacent_searches_disagree_relationships_abstained" in context.limitations
    assert not links(context, "recovery")
    assert context.input_digest != original.input_digest


def test_only_sustained_reviewed_advantage_and_matching_result_can_be_converted():
    parsed, reports, context = reviewed([300] * 8, initial=300, result="1-0")
    run = links(context, "advantage_run")[0]
    assert run.actor == "white" and run.plies == list(range(1, 9))
    assert run.facts.outcome == "converted" and run.facts.result_source == "pgn"
    assert links(game_context(parsed, reports), "advantage_run")[0].facts.outcome == "maintained"
    assert (
        links(reviewed([300] * 8, initial=300, result="1/2-1/2")[2], "advantage_run")[
            0
        ].facts.outcome
        == "maintained"
    )
    assert not links(reviewed([300, 300, 0, 0])[2], "advantage_run")


def test_an_advantage_run_lists_the_sides_own_errors_inside_it():
    context = reviewed([300] * 8, initial=300, result="1-0")[2]
    assert links(context, "advantage_run")[0].facts.own_error_plies == []
    # White drops four pawns at ply 3 but stays above +2.00, so the run still converts.
    context = reviewed([900, 900, 500, 500, 500, 500, 500, 500], initial=900, result="1-0")[2]
    run = links(context, "advantage_run")[0]
    assert run.facts.outcome == "converted" and run.plies == list(range(1, 9))
    assert run.facts.own_error_plies == [3]
    # Inaccuracies count too: 0.90 given back at plies 3 and 7 is not "no slip".
    context = reviewed([900, 900, 810, 810, 810, 810, 720, 720], initial=900, result="1-0")[2]
    assert links(context, "advantage_run")[0].facts.own_error_plies == [3, 7]


def test_several_small_concessions_need_net_deterioration_not_just_badges():
    context = reviewed([400, 400, 300, 300, 200, 200, 100, 100], initial=500)[2]
    erosion = links(context, "erosion")[0]
    assert erosion.actor == "white" and erosion.plies == [1, 3, 5]
    assert erosion.facts.net_deterioration_cp == 300
    assert not links(reviewed([400, 500, 400, 500, 400, 500, 400, 500], initial=500)[2], "erosion")
    # Each of these concessions is a full pawn, a Mistake.
    assert erosion.facts.own_mistake_plies == [1, 3, 5]


def test_erosion_lists_the_sides_own_mistakes_since_its_first_concession():
    # Four 0.60 concessions: small slips, no Mistake among them.
    context = reviewed([500, 500, 440, 440, 380, 380, 320, 320], initial=560)[2]
    erosion = links(context, "erosion")[-1]
    assert erosion.plies == [1, 3, 5, 7] and erosion.facts.own_mistake_plies == []
    # The last concession is 1.40, a Mistake.
    context = reviewed([500, 500, 440, 440, 380, 380, 240, 240], initial=560)[2]
    assert links(context, "erosion")[-1].facts.own_mistake_plies == [7]
    # A separate three-pawn drop at ply 3 between concessions at 1, 5 and 7.
    context = reviewed([900, 900, 600, 600, 500, 500, 400, 400], initial=1000)[2]
    erosion = links(context, "erosion")[0]
    assert erosion.plies == [1, 5, 7] and 3 in erosion.facts.own_mistake_plies


def test_repeated_motif_uses_player_role_and_unique_plies_not_duplicate_detectors():
    parsed, reports, _ = reviewed([0] * 8)
    for ply, role in [
        (1, "missed"),
        (2, "missed"),
        (3, "missed"),
        (5, "alternative"),
        (7, "played"),
    ]:
        event = tactic_event(f"fork-{ply}", role=role)
        reports[ply]["intelligence"]["events"] += [event, deepcopy(event)]
    context = game_context(parsed, reports, completed=True)
    repeated = links(context, "repeated_motif")
    assert len(repeated) == 1
    assert repeated[0].actor == "white" and repeated[0].plies == [1, 3]
    assert repeated[0].facts.occurrence == 2
    assert repeated[0].event_ids == ["fork-1", "fork-3"]


@pytest.mark.parametrize("skill", CAUSES[:1])
@pytest.mark.parametrize("black", [False, True])
def test_repeated_causes_belong_to_the_responsible_player(skill, black):
    parsed, reports, _ = reviewed([0] * 8)
    mover = "black" if black else "white"
    own = [2, 4] if black else [1, 3]
    opponent = 5 if black else 6
    for ply in [*own, opponent]:
        source = public_report(cause_report(skill, black if ply in own else not black), 1000)
        event = next(
            e
            for e in source["intelligence"]["events"]
            if e["kind"] == "tactic" and e["facts"]["motif"] == skill
        )
        event["id"] = f"{event['id']}:{ply}"
        reports[ply]["intelligence"]["events"] += [event, deepcopy(event)]
    repeated = links(game_context(parsed, reports, completed=True), "repeated_motif")
    assert len(repeated) == 1
    assert repeated[0].actor == mover and repeated[0].plies == own
    assert repeated[0].facts.role == "caused"
    assert repeated[0].facts.occurrence == 2


def test_actual_development_and_return_restore_a_concrete_knights_support():
    _, _, context = reviewed([0] * 8, line="1. e4 e5 2. Nf3 Nc6 3. Ng5 a6 4. Nh3 Nf6")
    restored = links(context, "support_restored")
    assert any(r.plies == [5, 7] and r.facts.target == "h3" for r in restored)


def test_support_relationship_does_not_match_an_unrelated_same_type():
    parsed, reports, _ = reviewed([0] * 8)
    for ply, before, after in [(3, ["g2"], []), (5, [], ["g2"])]:
        reports[ply]["intelligence"]["events"].append(
            support_event(f"support-{ply}", "white", "f3", "knight", before, after)
        )
    context = game_context(parsed, reports, completed=True)
    assert links(context, "support_restored")[0].event_ids == ["support-3", "support-5"]
    reports[5]["intelligence"]["events"][-1]["facts"]["target"] = "b1"
    assert not links(game_context(parsed, reports, completed=True), "support_restored")


def test_biggest_swing_prioritizes_mate_and_records_partial_review_caveat():
    parsed, reports, context = reviewed([-500, 0, 0])
    assert context.biggest_swing_ply == 1
    reports[5]["actual"]["score"] = {"kind": "mate", "value": -3}
    context = game_context(parsed, reports)
    assert context.biggest_swing_ply == 5 and context.turning_points[0].mate_transition
    assert "partial_review_relationships_are_provisional" in context.limitations
    assert not links(context, "advantage_run")
