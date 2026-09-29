"""Every semantic family has evidence gates, positive cases and abstention cases."""

from copy import deepcopy

import chess
import pytest
from review_cause_fixtures import CAUSES, cause_report
from review_intelligence_fixtures import move_report
from test_review_clocks import game
from test_review_difficulty import report as human_report
from trainer.chess_core import Candidate
from trainer.game_review import line_evidence, public_report
from trainer.review_intelligence.context import move_contexts
from trainer.review_intelligence.difficulty import assess_difficulty
from trainer.review_intelligence.events import describe_move


def events(report, context=None, kind=None):
    result = describe_move(report, assess_difficulty(report), context)
    return [e for e in result.events if kind is None or e.kind == kind]


@pytest.mark.parametrize("black", [False, True])
@pytest.mark.parametrize("skill", CAUSES)
def test_mover_causes_survive_the_production_review_path(skill, black):
    report = cause_report(skill, black)
    mover, opponent = ("black", "white") if black else ("white", "black")
    finding = next(f for f in report["actual_line"]["findings"] if f["skill_id"] == skill)
    assert finding["actor"] == mover and finding["plies"] == [1, 2]
    described = public_report(report, 1000)
    causal = [e for e in described["intelligence"]["events"] if e["facts"].get("motif") == skill]
    assert len(causal) == 1
    event = causal[0]
    assert event["actor"] == mover
    assert event["facts"]["role"] == "caused"
    assert event["facts"]["opportunity_actor"] == opponent
    assert event["facts"]["settled_material_delta"] < 0
    assert event["facts"]["witness"][1]["san"] == report["actual_line"]["frames"][2]["san"]
    assert event["evidence"][0]["id"] == report["played_analysis_id"]
    assert "explanation" not in event["facts"]

    # A causal witness is still the mover's, not permission to ignore actor checks.
    finding["actor"] = opponent
    assert not [e for e in events(report, kind="tactic") if e.facts["motif"] == skill]


def test_causes_are_not_opponent_tactics_or_alternative_achievements():
    report = cause_report("abandoned_defender")
    finding = next(
        f for f in report["actual_line"]["findings"] if f["skill_id"] == "abandoned_defender"
    )
    for change in ({"plies": [2]}, {"direction": "missed_opportunity"}, {"frame_ply": 1}):
        modified = deepcopy(report)
        modified["actual_line"]["findings"] = [finding | change]
        assert not [
            e for e in events(modified, kind="tactic") if e.facts["motif"] == "abandoned_defender"
        ]
    # No poor-move gate means no causal diagnosis, even with a retained witness.
    report["actual"]["score"] = report["best"]["score"]
    assert not [
        e for e in events(report, kind="tactic") if e.facts["motif"] == "abandoned_defender"
    ]


@pytest.mark.parametrize(
    "before,after,transition",
    [(0, {"kind": "mate", "value": -2}, "allowed"), ({"kind": "mate", "value": 3}, 200, "missed")],
)
def test_new_mate_transition_has_both_analysis_references(before, after, transition):
    report = move_report(played="e2e4", best="d2d4", before=before, after=after)
    event = events(report, kind="mate")[0]
    assert event.facts["transition"] == transition
    assert {e.id for e in event.evidence} == {"root-evidence", "played-evidence"}
    report["best"]["score"] = report["actual"]["score"]
    assert not events(report, kind="mate")  # Already mated / preserved mate is not a new error.


def test_lost_advantage_and_decisive_swing_are_separate_and_small_loss_is_not_major():
    lost = events(move_report(best="d2d4", before=300, after=50), kind="evaluation_change")[0]
    assert lost.facts["lost_advantage"] and not lost.facts["decisive"]
    decisive = events(move_report(best="d2d4", before=0, after=-210), kind="evaluation_change")[0]
    assert decisive.facts["decisive"] and not decisive.facts["lost_advantage"]
    assert not events(move_report(before=30, after=20), kind="evaluation_change")


def test_only_good_defense_requires_losing_runner_up_and_more_than_one_legal_move():
    report = move_report(second=-220)
    critical = events(report, kind="critical_resource")[0]
    assert critical.facts == {"only_good_at_depth": 16, "difficult": False, "purpose": "defense"}
    for modified in [
        report | {"legal_count": 1},
        report | {"second_score": {"kind": "cp", "value": 0}},
        move_report(before=-500, after=-500, second=-1000),
    ]:
        assert not events(modified, kind="critical_resource")
    report["human"] = human_report(best_rank=10, played_rank=10, probability=0.001)["human"]
    assert events(report, kind="critical_resource")[0].facts["difficult"]
    assert "unusual_strong_move" in events(report, kind="human_contrast")[0].facts["observations"]


def test_restricted_played_root_can_disprove_an_only_good_move_claim():
    report = move_report(played="e2e4", best="d2d4", before=0, after=-5, second=-220)
    practical = assess_difficulty(report)
    assert practical.components.acceptable_count_lower_bound == 2
    assert not practical.components.only_good_move_at_depth
    assert not events(report, kind="critical_resource")
    assert public_report(report, 1000)["engine_label"] == "Good"
    report["second_score"] = None
    report["actual"]["score"]["value"] = -500
    assert assess_difficulty(report).components.only_good_move_at_depth is None


def test_sound_sacrifice_requires_acceptance_evidence_and_does_not_require_top_rank():
    report = move_report(best="d2d4", before=100, after=70)
    assert not events(report, kind="sacrifice")
    report["sacrifice"] = {
        "analysis_id": "acceptance",
        "capture": "d7d5",
        "score": {"kind": "cp", "value": 70},
    }
    sacrifice = events(report, kind="sacrifice")[0]
    assert sacrifice.evidence[-1].id == "acceptance"
    report["actual"]["score"]["value"] = -100
    assert not events(report, kind="sacrifice")


def test_positive_tactic_is_a_line_witness_not_a_played_game_claim_or_best_line_leak():
    board = chess.Board("8/7k/8/8/4q3/5N2/8/K7 w - - 0 1")
    report = move_report(board, "f3g5", pv=["f3g5", "h7g8", "g5e4"])
    report["actual_line"] = line_evidence(
        board, Candidate.model_validate(report["actual"]), "played-evidence", 1
    )
    report["best_line"] = deepcopy(report["actual_line"])
    tactics = events(report, kind="tactic")
    fork = next(event for event in tactics if event.facts["motif"] == "fork")
    assert fork.confidence == "line_witness" and fork.facts["role"] == "played"
    assert fork.actor == "white" and fork.facts["plies"]
    assert fork.facts["pieces"]["e4"] == {"piece": "queen", "color": "black"}
    assert fork.facts["witness"] == [
        {"ply": 1, "san": "Ng5+", "capture": None, "gives_check": True}
    ]  # The fork does not pretend a later capture already happened.
    assert fork.facts["settled_material_delta"] is None or fork.facts["settled_material_delta"] > 0
    assert "explanation" not in fork.facts and "cue" not in fork.facts
    changed = deepcopy(report)
    changed["actual_line"]["findings"] = []
    assert not events(
        changed, kind="tactic"
    )  # Identical best move's line cannot impersonate the played line.
    changed = deepcopy(report)
    for finding in changed["actual_line"]["findings"]:
        finding["actor"] = "black"
    assert not events(changed, kind="tactic")
    changed["actual_line"]["frames"][1]["uci"] = "f3d4"
    assert not events(changed, kind="tactic")


def test_immediate_reply_is_projected_from_verified_line_not_a_best_line_hint():
    board = game("1. f3 e5 *").end().board()
    report = move_report(
        board, "g2g4", best="b1c3", pv=["g2g4", "d8h4"], after={"kind": "mate", "value": -1}
    )
    report["actual_line"] = line_evidence(
        board, Candidate.model_validate(report["actual"]), "played-evidence", 1
    )
    result = public_report(report, 1000)
    assert result["immediate_reply"]["san"] == "Qh4#"
    report["actual_line"]["frames"] = report["actual_line"]["frames"][:2]
    assert public_report(report, 1000)["immediate_reply"] is None


def test_human_contrast_carries_domain_and_never_changes_objective_event_identity_or_grade():
    report = move_report(best="d2d4", after=-210)
    initial = public_report(report, 1000)
    human = human_report(loss=210, shifted=True)["human"]
    human["engine_best"]["uci"] = "d2d4"
    report["human"] = human
    result = public_report(report, 1000)
    assert initial["label"] == result["label"]
    assert [
        e for e in result["intelligence"]["events"] if e["kind"] != "human_contrast"
    ] == initial["intelligence"]["events"]
    contrast = events(report, kind="human_contrast")[0]
    assert "natural_error" in contrast.facts["observations"]
    assert contrast.facts["domain"]["calibration"] == "unvalidated"
    report["human"] = {"status": "unavailable"}
    assert not events(report, kind="human_contrast")


def test_board_check_and_mate_events_use_legality_not_engine_evaluation_or_pgn_result():
    board = game("1. f3 e5 2. g4 *").end().board()
    report = move_report(board, "d8h4")
    finish = events(report, kind="finish")[0]
    assert finish.facts == {"termination": "checkmate", "result": "0-1"}
    assert finish.confidence == "board_fact" and finish.actor == "black"
    assert not events(report, kind="check")  # Finish supersedes a generic check.
    assert not events(move_report(), kind="finish")
    board = game("1. e4 e5 2. Bc4 Nc6 *").end().board()
    check = events(move_report(board, "c4f7"), kind="check")[0]
    assert check.facts == {"gives_check": True, "escapes_check": False}
    assert not events(move_report(), kind="check")


def test_clock_and_opening_context_do_not_follow_arbitrary_analysis_branches():
    parsed = game(
        "1. f3 {[%clk 0:00:08]} e5 {[%clk 0:09:59]} 2. g4 {[%clk 0:00:05]} Qh4# 0-1", "600"
    )
    contexts = move_contexts(parsed)
    board = parsed.board()
    for move in list(parsed.mainline_moves())[:2]:
        board.push(move)
    report = move_report(board, "g2g4", best="b1c3", after={"kind": "mate", "value": -1})
    clock = events(report, contexts[3], "clock_observation")[0]
    assert clock.facts["before_band"] == "critical" and clock.facts["accompanied_error"]
    assert clock.facts["causation"] == "not_inferred"
    branch = move_report(board, "b1c3")
    result = describe_move(branch, assess_difficulty(branch), contexts[3])
    assert result.clock is None and not [e for e in result.events if e.kind == "clock_observation"]
    assert "mainline_context_mismatch" in result.limitations
    assert not events(report, kind="clock_observation")


def test_semantics_are_deterministic_prose_independent_and_no_refs_means_no_objective_story():
    report = move_report(best="d2d4", after=-210)
    initial = describe_move(report, assess_difficulty(report))
    report["coach"] = "Some different voice."
    report["actual_line"]["frames"][0]["annotation"] = "Different wording."
    assert describe_move(report, assess_difficulty(report)) == initial
    del report["before_analysis_id"]
    assert not events(report, kind="evaluation_change")


def test_opening_event_means_catalogue_departure_not_bad_move():
    parsed = game(
        "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3 Nb8 10. Kh2 Kh8 11. Kg1 Kg8 *"
    )
    context = next(c for c in move_contexts(parsed).values() if c.opening_departure)
    report = move_report(chess.Board(context.before_fen), context.uci)
    event = events(report, context, "opening_departure")[0]
    assert {ref.source for ref in event.evidence} == {"pgn", "book"}
    assert not events(report, context, "evaluation_change")
    assert not events(report, kind="opening_departure")


@pytest.mark.parametrize(
    "remaining,tempo", [("0:09:59", "fast_with_time"), ("0:08:00", "long_think")]
)
def test_tempo_with_error_is_an_observation_without_psychological_claim(remaining, tempo):
    parsed = game(f"1. e4 {{[%clk {remaining}]}} *", "600")
    report = move_report(best="d2d4", after=-150)
    event = events(report, move_contexts(parsed)[1], "clock_observation")[0]
    assert event.facts["tempo"] == tempo
    assert event.facts["accompanied_error"] and event.facts["causation"] == "not_inferred"


def test_cold_srs_cannot_serialize_intelligence_or_clock_hints(settings):
    from explanation_fixtures import seed_review
    from fastapi.testclient import TestClient
    from trainer.api import create_app

    app = create_app(settings, workers=False, start_engine=False)
    with TestClient(app) as client:
        with app.state.sessions() as db:
            fixture = seed_review(db, settings)
        cold = client.post(f"/api/review/{fixture['exercise_id']}/start").json()
        forbidden = {
            "intelligence",
            "events",
            "clock",
            "human",
            "practical",
            "findings",
            "best",
            "opening",
            "history",
        }
        assert not forbidden & cold.keys()
        assert (
            client.get(f"/api/review/sessions/{cold['session_id']}/explanation").status_code == 422
        )
