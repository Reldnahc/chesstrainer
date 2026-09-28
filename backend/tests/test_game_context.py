"""Structured stories link observed play; score drift and missing plies break inference."""

from copy import deepcopy

import pytest
from review_cause_fixtures import CAUSES, cause_report
from review_intelligence_fixtures import move_report
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
    assert missed.facts["outcome"] == "missed"
    recovery = links(context, "recovery")[0]
    assert recovery.actor == "white" and recovery.plies == [1, 2, 3]
    assert recovery.facts["opponent_errors"] == [2]
    assert {e.ply for e in recovery.evidence if e.source == "stockfish"} == {1, 2, 3}
    assert context == game_context(parsed, reports, completed=True)
    _, _, punished = reviewed([-300, -300, -300])
    assert links(punished, "punishment")[0].facts["outcome"] == "capitalized"
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


def test_wrong_mainline_generation_is_missing_not_a_branch_story():
    parsed, reports, _ = reviewed([-300, 0, 0])
    reports[1]["actual"]["uci"] = "d2d4"
    context = game_context(parsed, reports, completed=True)
    assert context.missing_plies == [1]
    assert not links(context, "recovery")


def test_only_sustained_reviewed_advantage_and_matching_result_can_be_converted():
    parsed, reports, context = reviewed([300] * 8, initial=300, result="1-0")
    run = links(context, "advantage_run")[0]
    assert run.actor == "white" and run.plies == list(range(1, 9))
    assert run.facts["outcome"] == "converted" and run.facts["result_source"] == "pgn"
    assert links(game_context(parsed, reports), "advantage_run")[0].facts["outcome"] == "maintained"
    assert (
        links(reviewed([300] * 8, initial=300, result="1/2-1/2")[2], "advantage_run")[0].facts[
            "outcome"
        ]
        == "maintained"
    )
    assert not links(reviewed([300, 300, 0, 0])[2], "advantage_run")


def test_several_small_concessions_need_net_deterioration_not_just_badges():
    context = reviewed([400, 400, 300, 300, 200, 200, 100, 100], initial=500)[2]
    erosion = links(context, "erosion")[0]
    assert erosion.actor == "white" and erosion.plies == [1, 3, 5]
    assert erosion.facts["net_deterioration_cp"] == 300
    assert not links(reviewed([400, 500, 400, 500, 400, 500, 400, 500], initial=500)[2], "erosion")


def test_repeated_motif_uses_player_role_and_unique_plies_not_duplicate_detectors():
    parsed, reports, _ = reviewed([0] * 8)
    for ply, role in [
        (1, "missed"),
        (2, "missed"),
        (3, "missed"),
        (5, "alternative"),
        (7, "played"),
    ]:
        event = {"id": f"fork-{ply}", "kind": "tactic", "facts": {"motif": "fork", "role": role}}
        reports[ply]["intelligence"]["events"] += [event, deepcopy(event)]
    context = game_context(parsed, reports, completed=True)
    repeated = links(context, "repeated_motif")
    assert len(repeated) == 1
    assert repeated[0].actor == "white" and repeated[0].plies == [1, 3]
    assert repeated[0].facts["occurrence"] == 2
    assert repeated[0].event_ids == ["fork-1", "fork-3"]


@pytest.mark.parametrize("skill", CAUSES)
@pytest.mark.parametrize("black", [False, True])
def test_repeated_causes_belong_to_the_responsible_player(skill, black):
    parsed, reports, _ = reviewed([0] * 8)
    mover = "black" if black else "white"
    own = [2, 4] if black else [1, 3]
    opponent = 5 if black else 6
    for ply in [*own, opponent]:
        source = public_report(cause_report(skill, black if ply in own else not black), 1000)
        event = next(
            e for e in source["intelligence"]["events"] if e["facts"].get("motif") == skill
        )
        event["id"] = f"{event['id']}:{ply}"
        reports[ply]["intelligence"]["events"] += [event, deepcopy(event)]
    repeated = links(game_context(parsed, reports, completed=True), "repeated_motif")
    assert len(repeated) == 1
    assert repeated[0].actor == mover and repeated[0].plies == own
    assert repeated[0].facts["role"] == "caused"
    assert repeated[0].facts["occurrence"] == 2


def test_actual_development_and_return_restore_a_concrete_knights_support():
    _, _, context = reviewed([0] * 8, line="1. e4 e5 2. Nf3 Nc6 3. Ng5 a6 4. Nh3 Nf6")
    restored = links(context, "support_restored")
    assert any(r.plies == [5, 7] and r.facts["target"] == "h3" for r in restored)


def test_support_relationship_does_not_match_an_unrelated_same_type():
    parsed, reports, _ = reviewed([0] * 8)
    for ply, before, after in [(3, ["g2"], []), (5, [], ["g2"])]:
        reports[ply]["intelligence"]["events"].append(
            dict(
                id=f"support-{ply}",
                kind="positional",
                facts=dict(
                    feature="piece_support",
                    line="actual",
                    side="white",
                    target="f3",
                    piece="knight",
                    before=before,
                    after=after,
                ),
            )
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
