"""Legal, synthetic-score fixtures test the rule contract, not engine strength."""

import copy

import chess
import pytest
from account_units import units_for
from fastapi.testclient import TestClient
from sqlalchemy import select
from trainer.api import create_app
from trainer.chess_core import Candidate, Score
from trainer.classification import classify_decision
from trainer.local_classifier import LocalClassifier
from trainer.models import AnalysisJob, ClassificationRun, Decision, SRSState

FEN = "r3k3/8/8/1N6/8/8/8/6K1 w - - 0 1"
BEST = ["b5c7", "e8d7", "c7a8", "d7c6", "a8c7", "c6b6"]
ACTUAL = ["b5a3", "a8a3", "g1f2", "a3a2", "f2e3", "a2a1"]


def evidence(fen=FEN, best=BEST, actual=ACTUAL, best_score=300, actual_score=-500, black=False):
    board = chess.Board(fen)
    if black:
        board = board.mirror()

    def candidate(line, score):
        if black:
            line = [
                chess.Move(
                    chess.square_mirror(chess.parse_square(u[:2])),
                    chess.square_mirror(chess.parse_square(u[2:4])),
                    promotion=chess.Move.from_uci(u).promotion,
                ).uci()
                for u in line
            ]
        b = board.copy()
        for uci in line:
            b.push(b.parse_uci(uci))
        return Candidate(
            uci=line[0],
            san=board.san(chess.Move.from_uci(line[0])),
            pv=line,
            score=score if isinstance(score, Score) else Score(kind="cp", value=score),
        ).model_dump()

    actual_candidate = candidate(actual, actual_score)
    return {
        "fen": board.fen(),
        "decision_id": "fixture",
        "evidence_ids": ["best", "actual"],
        "user_move": {"uci": actual_candidate["uci"]},
        "best_candidates": [candidate(best, best_score)],
        "played_candidate": actual_candidate,
    }


@pytest.mark.parametrize("black", [False, True])
def test_fork_hanging_capture_direction_and_witness(black):
    payload = evidence(black=black)
    result = LocalClassifier().classify(payload)
    findings = {f.skill_id: f for f in result.findings}
    assert set(findings) == {"material_loss", "hanging_piece", "missed_material_gain", "fork"}
    fork, hanging = findings["fork"], findings["hanging_piece"]
    assert fork.direction == "missed_opportunity" and fork.actor == ("black" if black else "white")
    assert hanging.direction == "allowed_opponent_tactic" and hanging.actor != fork.actor
    assert fork.analysis_id == "best" and fork.plies == [1, 3]
    for finding in result.findings:
        line = (
            payload["best_candidates"][0]["pv"]
            if finding.analysis_id == "best"
            else payload["played_candidate"]["pv"]
        )
        assert finding.moves == [line[p - 1] for p in finding.plies]


@pytest.mark.parametrize(
    "reason", ["sound", "truncated", "same_loss", "still_ahead", "no_collection"]
)
def test_abstains_on_unsupported_material_or_fork(reason):
    payload = evidence()
    if reason == "sound":
        payload["played_candidate"]["score"]["value"] = 290
    elif reason == "truncated":
        payload["best_candidates"][0]["pv"] = BEST[:3]
    elif reason == "same_loss":
        payload["best_candidates"] = [copy.deepcopy(payload["played_candidate"])]
        payload["best_candidates"][0]["score"]["value"] = 300
    elif reason == "still_ahead":
        payload["played_candidate"]["score"]["value"] = 100
    else:
        payload["best_candidates"][0]["pv"] = ["b5c7", "e8d7", "c7b5", "d7c6"]
    result = LocalClassifier().classify(payload)
    skills = {f.skill_id for f in result.findings}
    if reason == "still_ahead":
        assert "material_loss" in skills  # Losing material can matter while still ahead.
    elif reason == "no_collection":
        assert "fork" not in skills
    else:
        assert not skills and result.primary_skill == "unclassified"


# One colour per transition, alternating; the classifier is colour-generic.
@pytest.mark.parametrize(
    "black,kind",
    [(False, "allowed"), (True, "missed"), (False, "already_lost"), (True, "still_mates")],
)
def test_mate_transitions(black, kind):
    payload = evidence(black=black)
    if kind in {"allowed", "already_lost"}:
        payload["played_candidate"]["score"] = Score(kind="mate", value=-3).model_dump()
    if kind in {"missed", "still_mates"}:
        payload["best_candidates"][0]["score"] = Score(kind="mate", value=3).model_dump()
    if kind == "already_lost":
        payload["best_candidates"][0]["score"] = Score(kind="mate", value=-5).model_dump()
    if kind == "still_mates":
        payload["played_candidate"]["score"] = Score(kind="mate", value=5).model_dump()
    result = LocalClassifier().classify(payload)
    skills = {f.skill_id for f in result.findings}
    assert ("allowed_mate" in skills) == (kind == "allowed")
    assert ("missed_mate" in skills) == (kind == "missed")


@pytest.mark.parametrize("black", [False])
def test_promotion(black):
    result = LocalClassifier().classify(
        # The king is near enough to win the pawn once White delays promoting.
        evidence(
            "8/P1k5/8/8/8/8/8/6K1 w - - 0 1",
            ["a7a8q", "c7d7", "a8a1", "d7e6"],
            ["g1f2", "c7b7", "f2e3", "b7a7", "e3d4", "a7b6"],
            800,
            0,
            black,
        )
    )
    promotion = next(f for f in result.findings if f.skill_id == "promotion_awareness")
    assert promotion.moves[0].endswith("q")


@pytest.mark.parametrize(
    "move,skill,black", [("e2d3", "discovered_attack", False), ("e2b5", "double_attack", True)]
)
def test_discovered_and_double_check(move, skill, black):
    result = LocalClassifier().classify(
        evidence(
            "4k3/8/8/8/8/8/4B3/4R1K1 w - - 0 1",
            [move],
            ["e2f1"],
            Score(kind="mate", value=3),
            0,
            black,
        )
    )
    assert skill in {f.skill_id for f in result.findings}


def test_corrupt_line_and_wrong_actual_move_rejected():
    for kind in ["move", "pv"]:
        payload = evidence()
        if kind == "move":
            payload["user_move"]["uci"] = "g1f2"
        else:
            payload["played_candidate"]["pv"][1] = "a8h1"
        with pytest.raises(ValueError):
            LocalClassifier().classify(payload)


def test_local_cache_rejection_and_backfill_preserve_srs(settings):
    from explanation_fixtures import seed_review
    from trainer.classification import reject_run

    settings.stockfish_path = "missing-test-engine"
    app = create_app(settings, workers=False)
    with TestClient(app) as client:
        with app.state.sessions() as db:
            fixture = seed_review(db, settings)
            decision = db.scalar(select(Decision))
            state = db.get(SRSState, fixture["exercise_id"])
            saved = state.card, state.due, state.reviews, state.retired_at, state.eligible
            classifier = LocalClassifier(settings)
            db.commit()
            units = units_for(db)
            assert classify_decision(units, decision, classifier)
            assert classify_decision(units, decision, classifier)
            runs = db.scalars(select(ClassificationRun)).all()
            assert len(runs) == 1 and runs[0].provider == "local_rules"
            assert runs[0].response["primary_skill"] == "unclassified"  # Short fixture PV.
            reject_run(db, runs[0].id)
            db.commit()
            assert not classify_decision(units, decision, classifier)
            settings.classification_max_plies = 6
            assert classify_decision(units, decision, LocalClassifier(settings))
            assert len(db.scalars(select(ClassificationRun)).all()) == 2
        job_id = client.post("/api/classifications/retry").json()["job_id"]
        app.state.runner.run_job(job_id)
        with app.state.sessions() as db:
            assert db.get(AnalysisJob, job_id).status == "completed"
            state = db.get(SRSState, fixture["exercise_id"])
            assert (state.card, state.due, state.reviews, state.retired_at, state.eligible) == saved
