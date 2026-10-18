"""Speech receives producer facts, never re-interprets chess or arbitrary prose."""

import chess
import pytest
from explanation_fixtures import seed_review
from fastapi.testclient import TestClient
from test_explanations import move
from test_lichess_reuse import FIXTURES, line
from test_local_classifier import evidence
from test_patterns_v2 import CASES
from test_patterns_v3 import COMBINATIONS
from trainer.api import create_app
from trainer.diagnosis_types import CUES
from trainer.explanation_types import replay_line
from trainer.local_classifier import LocalClassifier
from trainer.models import EngineAnalysis, ExerciseAnswer
from trainer.tactical_patterns import recognized_patterns

FRAME_CASES = [
    ("4k3/8/8/8/8/8/8/R5K1 w - - 0 1", "a1e1", False, False, False, "check", False),
    ("7k/5Q2/5K2/8/8/8/8/8 w - - 0 1", "f7g7", False, False, False, "mate", False),
    ("k3r3/8/8/8/8/8/8/4K3 w - - 0 1", "e1d1", False, False, False, "escape", False),
    ("4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1", "e4d5", True, False, False, "ordinary", False),
    ("1r5k/P7/8/8/8/8/8/6K1 w - - 0 1", "a7b8q", True, True, False, "check", False),
    ("4k3/8/8/8/8/8/8/4K2R w K - 0 1", "e1g1", False, False, True, "ordinary", True),
]


@pytest.mark.parametrize("fen,uci,capture,promotion,castling,ending,mirror", FRAME_CASES)
def test_legal_frame_facts_preserve_whole_move(
    fen, uci, capture, promotion, castling, ending, mirror
):
    board = chess.Board(fen)
    action = chess.Move.from_uci(uci)
    if mirror:
        board = board.mirror()
        action = chess.Move(
            chess.square_mirror(action.from_square),
            chess.square_mirror(action.to_square),
            promotion=action.promotion,
        )
    start, frame = replay_line(board, [action.uci()])
    assert start.facts_version == frame.facts_version == 1
    assert start.uci is None
    assert bool(frame.capture) is capture
    assert bool(frame.promotion) is promotion
    assert frame.castling is castling
    assert frame.checkmate is (ending == "mate")
    assert frame.gives_check is (ending in {"mate", "check"})
    assert frame.escaped_check is (ending == "escape")
    assert frame.promotion == ("queen" if promotion else None)
    assert not start.castling and not start.checkmate and not start.escaped_check


@pytest.mark.parametrize("black", [False])
def test_summary_facts_are_scoped_to_current_attempt_and_cold_stays_cold(settings, black):
    settings.stockfish_path = "missing-test-engine"
    app = create_app(settings, workers=False)
    with TestClient(app) as client:
        with app.state.sessions() as db:
            fixture = seed_review(db, settings, black)
        cold = client.post(f"/api/review/{fixture['exercise_id']}/start").json()
        assert "feedback" not in cold
        assert "summary_kind" not in str(cold) and "mechanism" not in str(cold)
        path = f"/api/review/sessions/{cold['session_id']}/explanation"
        assert client.get(path).status_code == 422
        assert client.get(path + "?solution=true").status_code == 422
        failed = move(client, cold["session_id"], fixture["wrong"])
        assert failed["explanation_summary_kind"] == "material_loss"
        data = client.get(path).json()
        assert data["summary_kind"] == "material_loss"
        assert data["summary_frame_index"] is None
        assert data["note_kinds"] == ["strong_replies", "material_scope", "saved_policy"]
        assert len(data["notes"]) == len(data["note_kinds"])
        assert all(f["analysis_id"] == data["analysis_id"] for f in data["findings"])
        solved = move(client, cold["session_id"], fixture["alternative"])
        assert solved["explanation_summary_kind"] == "material_gain"
        assert solved["message_kind"] == "relearning"
        resumed = client.get(f"/api/review/sessions/{cold['session_id']}").json()
        assert resumed["feedback"]["grade"] == "already_recorded"
        assert resumed["feedback"].get("message_kind") is None


@pytest.mark.parametrize(
    "score,accepted,kind",
    [
        ({"kind": "mate", "value": 2}, True, "mate_for_mover"),
        ({"kind": "mate", "value": -2}, True, "mate_against_mover"),
    ],
)
def test_summary_branch_does_not_turn_accepted_lost_position_into_mate_reward(
    settings, score, accepted, kind
):
    settings.stockfish_path = "missing-test-engine"
    app = create_app(settings, workers=False)
    with TestClient(app) as client:
        with app.state.sessions() as db:
            fixture = seed_review(db, settings)
            answer = db.get(ExerciseAnswer, (fixture["exercise_id"], fixture["wrong"]))
            answer.grade = "correct" if accepted else "failure"
            analysis = db.get(EngineAnalysis, answer.analysis_id)
            analysis.candidates = [
                analysis.candidates[0] | {"score": score, "pv": [fixture["wrong"]]}
            ]
            db.commit()
        cold = client.post(f"/api/review/{fixture['exercise_id']}/start").json()
        result = move(client, cold["session_id"], fixture["wrong"])
        assert result["explanation_summary_kind"] == kind
        data = client.get(f"/api/review/sessions/{cold['session_id']}/explanation").json()
        assert data["summary_kind"] == kind
        assert ("no_simple_reason" in data["note_kinds"]) is (score["kind"] == "cp")


@pytest.mark.parametrize("theme,fen,moves", FIXTURES)
def test_recognized_findings_retain_specific_non_material_mechanism(theme, fen, moves):
    expected = {
        "fork": "fork_recognized",
        "skewer": "skewer_collected",
        "promotion": "promotion",
        "doubleCheck": "double_check",
        "discoveredCheck": "discovered_check",
        "hangingPiece": "undefended_capture",
    }[theme]
    boards = line(fen, moves).boards
    findings = recognized_patterns(boards, 1, len(boards) - 1, "current-line", "missed_opportunity")
    assert expected in {finding.mechanism for finding in findings}
    for finding in findings:
        assert finding.cue_key == finding.skill_id and finding.cue == CUES[finding.cue_key]


@pytest.mark.parametrize(
    "skill,fen,best,actual",
    [
        *(case[:4] for case in COMBINATIONS),
        *CASES[:3],
    ],
)
def test_verified_findings_keep_collection_or_defense_distinct_from_recognition(
    skill, fen, best, actual
):
    expected = {
        "fork": "fork_collected",
        "discovered_attack": "discovered_capture",
        "double_attack": "double_attack_collected",
        "deflection": "deflection_collected",
        "pin": "pin_defenders_no_recapture",
        "skewer": "king_skewer_collected",
        "removing_defender": "sole_defender_captured",
    }[skill]
    result = LocalClassifier().classify(evidence(fen, best, actual, 800, 0))
    finding = next(f for f in result.findings if f.skill_id == skill)
    assert finding.mechanism == expected
    assert finding.cue_key == skill
    assert finding.analysis_id == "best"


def test_a_line_ending_mid_exchange_claims_no_material():
    from trainer.chess_core import replay_moves
    from trainer.continuations import settled_delta
    from trainer.explanation_types import replay_line
    from trainer.explanations import shown_material_change

    start = "rn1qkbnr/ppp2ppp/3p4/4p3/2B1P1b1/5N2/PPPP1PPP/RNBQK2R w KQkq - 2 4"
    board, ucis = chess.Board(start), []
    for san in ["h3", "Bh5", "g4", "Bg6", "Nh4", "Nc6", "Nxg6"]:
        move = board.parse_san(san)
        ucis.append(move.uci())
        board.push(move)
    boards = replay_moves(chess.Board(start), ucis)
    frames = replay_line(chess.Board(start), ucis)
    settled, _ = settled_delta(boards, True, max_plies=16)
    # The line stops on Nxg6 with ...hxg6 available: +3 at the last frame, not a gain.
    assert frames[-1].material_change == 3
    assert shown_material_change(boards, settled, frames[-1].material_change) == 0
