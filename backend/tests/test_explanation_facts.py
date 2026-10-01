"""Speech receives producer facts, never re-interprets chess or arbitrary prose."""

import chess
import pytest
from explanation_fixtures import seed_review
from fastapi.testclient import TestClient
from test_explanations import move
from test_lichess_reuse import FIXTURES, line
from test_local_classifier import evidence
from test_opening_journey import STUDIES, app_for, enroll_catalogue, exercise_at, start, submit
from test_patterns_v2 import CASES
from test_patterns_v3 import CAUSE_ACTUAL, CAUSE_BEST, CAUSE_FEN, COMBINATIONS
from trainer.api import create_app
from trainer.diagnosis_types import CUES, Finding
from trainer.explanations import Frame, replay_line
from trainer.local_classifier import LocalClassifier
from trainer.models import EngineAnalysis, ExerciseAnswer, SRSState, now
from trainer.tactical_patterns import recognized_patterns

FRAME_CASES = [
    (chess.STARTING_FEN, "e2e4", False, False, False, "ordinary"),
    ("4k3/8/8/8/8/8/8/R5K1 w - - 0 1", "a1e1", False, False, False, "check"),
    ("7k/5Q2/5K2/8/8/8/8/8 w - - 0 1", "f7g7", False, False, False, "mate"),
    ("k3r3/8/8/8/8/8/8/4K3 w - - 0 1", "e1d1", False, False, False, "escape"),
    ("4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1", "e4d5", True, False, False, "ordinary"),
    ("4k3/5p2/8/8/2B5/8/8/4K3 w - - 0 1", "c4f7", True, False, False, "check"),
    ("7k/5Qr1/5K2/8/8/8/8/8 w - - 0 1", "f7g7", True, False, False, "mate"),
    ("k7/8/8/8/8/8/4r3/4K3 w - - 0 1", "e1e2", True, False, False, "escape"),
    ("8/P7/7k/8/8/8/8/7K w - - 0 1", "a7a8q", False, True, False, "ordinary"),
    ("7k/P7/8/8/8/8/8/7K w - - 0 1", "a7a8q", False, True, False, "check"),
    ("7k/P7/7K/8/8/8/8/7R w - - 0 1", "a7a8q", False, True, False, "mate"),
    ("K6r/2P5/7k/8/8/8/8/8 w - - 0 1", "c7c8q", False, True, False, "escape"),
    ("1r6/P7/7k/8/8/8/8/6K1 w - - 0 1", "a7b8q", True, True, False, "ordinary"),
    ("1r5k/P7/8/8/8/8/8/6K1 w - - 0 1", "a7b8q", True, True, False, "check"),
    ("1r5k/P7/7K/8/8/8/8/7R w - - 0 1", "a7b8q", True, True, False, "mate"),
    ("1r6/PK6/7k/8/8/8/8/8 w - - 0 1", "a7b8q", True, True, False, "escape"),
    ("4k3/8/8/8/8/8/8/4K2R w K - 0 1", "e1g1", False, False, True, "ordinary"),
    ("5k2/8/8/8/8/8/8/4K2R w K - 0 1", "e1g1", False, False, True, "check"),
    ("2N1Nk2/8/2B1B3/8/8/8/8/4K2R w K - 0 1", "e1g1", False, False, True, "mate"),
]


@pytest.mark.parametrize("mirror", [False, True])
@pytest.mark.parametrize("fen,uci,capture,promotion,castling,ending", FRAME_CASES)
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


def test_en_passant_and_underpromotion_have_exact_facts():
    frame = replay_line(chess.Board("4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1"), ["e5d6"])[1]
    assert frame.capture == "pawn" and frame.promotion is None
    assert "d5" in frame.highlights
    frame = replay_line(chess.Board("4k3/P7/8/8/8/8/8/4K3 w - - 0 1"), ["a7a8n"])[1]
    assert frame.promotion == "knight"


@pytest.mark.parametrize("black", [False, True])
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
        ({"kind": "mate", "value": -2}, False, "mate_against_mover"),
        ({"kind": "cp", "value": 0}, True, "engine_accepted"),
        ({"kind": "cp", "value": 0}, False, "engine_rejected"),
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


def test_arbitrary_manual_explanations_remain_text_only_and_reveal_is_not_success(settings):
    with TestClient(create_app(settings, workers=False)) as client:
        exercise = client.post(
            "/api/exercises/manual",
            json={
                "fen": chess.STARTING_FEN,
                "moves": ["e2e4"],
                "explanation": "Stockfish finds a forced mate. This is a made-up manual note.",
            },
        ).json()["id"]
        cold = client.post(f"/api/review/{exercise}/start").json()
        result = move(client, cold["session_id"], "d2d4")
        assert result["explanation_summary_kind"] == "curated_rejected"
        result = client.post(f"/api/review/sessions/{cold['session_id']}/reveal").json()
        assert result["grade"] == "revealed" and result.get("message_kind") is None
        assert result["explanation_summary_kind"] == "curated_accepted"
        data = client.get(
            f"/api/review/sessions/{cold['session_id']}/explanation?solution=true"
        ).json()
        assert data["note_kinds"] == ["curated_authority", None]
        assert data["summary_kind"] == "curated_accepted"


def test_reply_summary_exports_only_the_actual_selected_frame(settings):
    app = create_app(settings, workers=False)
    with TestClient(app) as client:
        with app.state.sessions() as db:
            fixture = seed_review(db, settings)
            answer = db.get(ExerciseAnswer, (fixture["exercise_id"], fixture["wrong"]))
            analysis = db.get(EngineAnalysis, answer.analysis_id)
            analysis.candidates = [analysis.candidates[0] | {"pv": ["g1f1", "a5f5"]}]
            db.commit()
        cold = client.post(f"/api/review/{fixture['exercise_id']}/start").json()
        result = move(client, cold["session_id"], fixture["wrong"])
        assert result["explanation_summary_kind"] == "frame"
        assert result["explanation_summary_frame"] == result["counter_reply"]
        assert result["explanation_summary_frame"]["gives_check"]
        data = client.get(f"/api/review/sessions/{cold['session_id']}/explanation").json()
        assert data["summary_frame_index"] == 2
        assert result["explanation_summary_frame"] == data["frames"][2]


@pytest.mark.parametrize("state", ["ordinary", "changed", "retired"])
def test_opening_rejection_kind_uses_current_scheduling_authority(settings, state):
    app = app_for(settings)
    with TestClient(app) as client:
        study = enroll_catalogue(client, "e2e4")
        exercise = exercise_at(app)
        cold = start(client, exercise)
        if state == "changed":
            assert client.delete(f"{STUDIES}/{study['id']}").status_code == 200
        elif state == "retired":
            with app.state.sessions() as db:
                db.get(SRSState, exercise).retired_at = now()
                db.commit()
        result = submit(client, cold["session_id"], "d2d4")
        assert not result["completed"]
        assert result["message_kind"] == (
            "opening_rejected" if state == "ordinary" else f"opening_rejected_{state}"
        )


@pytest.mark.parametrize("black", [False, True])
@pytest.mark.parametrize("theme,fen,moves", FIXTURES)
def test_recognized_findings_retain_specific_non_material_mechanism(theme, fen, moves, black):
    expected = {
        "fork": "fork_recognized",
        "skewer": "skewer_collected",
        "promotion": "promotion",
        "doubleCheck": "double_check",
        "discoveredCheck": "discovered_check",
        "hangingPiece": "undefended_capture",
    }[theme]
    boards = line(fen, moves, black).boards
    findings = recognized_patterns(boards, 1, len(boards) - 1, "current-line", "missed_opportunity")
    assert expected in {finding.mechanism for finding in findings}
    for finding in findings:
        assert finding.cue_key == finding.skill_id and finding.cue == CUES[finding.cue_key]


@pytest.mark.parametrize("black", [False, True])
@pytest.mark.parametrize(
    "skill,fen,best,actual",
    [
        *(case[:4] for case in COMBINATIONS),
        *CASES[:3],
    ],
)
def test_verified_findings_keep_collection_or_defense_distinct_from_recognition(
    skill, fen, best, actual, black
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
    result, _ = LocalClassifier().classify(evidence(fen, best, actual, 800, 0, black))
    finding = next(f for f in result.findings if f.skill_id == skill)
    assert finding.mechanism == expected
    assert finding.cue_key == skill
    assert finding.analysis_id == "best"


def test_legacy_facts_do_not_acquire_mechanism_by_matching_prose():
    frame = replay_line(chess.Board(), ["e2e4"])[1].model_dump()
    for key in ("facts_version", "promotion", "castling", "checkmate", "escaped_check"):
        frame.pop(key)
    frame["annotation"] = "This is checkmate and promotes to a queen."
    assert Frame.model_validate(frame).facts_version is None
    result, _ = LocalClassifier().classify(evidence(CAUSE_FEN, CAUSE_BEST, CAUSE_ACTUAL, 900, -500))
    finding = next(f for f in result.findings if f.skill_id == "abandoned_defender")
    assert finding.mechanism == "abandoned_defender"
    legacy = finding.model_dump(exclude={"mechanism", "cue_key"})
    parsed = Finding.model_validate(legacy)
    assert parsed.mechanism is None and parsed.cue_key is None
