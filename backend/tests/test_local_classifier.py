"""Legal, synthetic-score fixtures test the rule contract, not engine strength."""

import copy

import chess
import pytest
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
    result, _ = LocalClassifier().classify(payload)
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
    result, _ = LocalClassifier().classify(payload)
    skills = {f.skill_id for f in result.findings}
    if reason == "still_ahead":
        assert "material_loss" in skills  # Losing material can matter while still ahead.
    elif reason == "no_collection":
        assert "fork" not in skills
    else:
        assert not skills and result.primary_skill == "unclassified"


@pytest.mark.parametrize("black", [False, True])
@pytest.mark.parametrize("kind", ["allowed", "missed", "already_lost", "still_mates"])
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
    result, _ = LocalClassifier().classify(payload)
    skills = {f.skill_id for f in result.findings}
    assert ("allowed_mate" in skills) == (kind == "allowed")
    assert ("missed_mate" in skills) == (kind == "missed")


@pytest.mark.parametrize("black", [False, True])
def test_promotion(black):
    result, _ = LocalClassifier().classify(
        evidence(
            "6k1/P7/8/8/8/8/8/6K1 w - - 0 1",
            ["a7a8q", "g8f7", "a8a1", "f7e6"],
            ["g1f2", "g8f7", "f2e3", "f7e6"],
            800,
            0,
            black,
        )
    )
    promotion = next(f for f in result.findings if f.skill_id == "promotion_awareness")
    assert promotion.moves[0].endswith("q")


@pytest.mark.parametrize("move,skill", [("e2d3", "discovered_attack"), ("e2b5", "double_attack")])
@pytest.mark.parametrize("black", [False, True])
def test_discovered_and_double_check(move, skill, black):
    result, _ = LocalClassifier().classify(
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


def test_config_changes_rule_thresholds(settings):
    settings.classification_min_material = 9
    result, _ = LocalClassifier(settings).classify(evidence())
    assert result.primary_skill == "unclassified"
    assert result.parameters["min_material"] == 9


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
            assert classify_decision(db, decision, classifier, settings)
            assert classify_decision(db, decision, classifier, settings)
            runs = db.scalars(select(ClassificationRun)).all()
            assert len(runs) == 1 and runs[0].provider == "local_rules"
            assert runs[0].response["primary_skill"] == "unclassified"  # Short fixture PV.
            reject_run(db, runs[0].id)
            assert not classify_decision(db, decision, classifier, settings)
            settings.classification_max_plies = 6
            assert classify_decision(db, decision, LocalClassifier(settings), settings)
            assert len(db.scalars(select(ClassificationRun)).all()) == 2
        job_id = client.post("/api/classifications/retry").json()["job_id"]
        app.state.runner.run_job(job_id)
        with app.state.sessions() as db:
            assert db.get(AnalysisJob, job_id).status == "completed"
            state = db.get(SRSState, fixture["exercise_id"])
            assert (state.card, state.due, state.reviews, state.retired_at, state.eligible) == saved


def test_no_provider_configuration_or_paid_job_paths(settings, monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "unused-legacy-test-key")
    monkeypatch.setenv("LLM_ENABLED", "true")
    settings.stockfish_path = "missing-test-engine"
    with TestClient(create_app(settings, workers=False)) as client:
        config = client.get("/api/settings").json()
        assert config["classification_provider"] == "local_rules"
        assert not any("openai" in key or "llm" in key for key in config)
        assert "unused-legacy-test-key" not in str(config)
        assert client.post("/api/course/teaching").status_code == 410
        with client.app.state.sessions() as db:
            job = AnalysisJob(kind="teaching", status="cancelled")
            db.add(job)
            db.commit()
            assert client.post(f"/api/jobs/{job.id}/retry").status_code == 410


def test_native_migration_preserves_legacy_audits_and_learning_history(settings):
    from alembic import command
    from alembic.config import Config
    from lesson_fixtures import seed_lesson
    from trainer.db import database

    settings.stockfish_path = "missing-test-engine"
    app = create_app(settings, workers=False)
    with TestClient(app):
        with app.state.sessions() as db:
            seed_lesson(db, settings, count=3)
    engine, _ = database(settings.database_path)
    config = Config("alembic.ini")
    with engine.begin() as connection:
        config.attributes["connection"] = connection
        command.downgrade(config, "b91a0673de42")
    tables = [
        "games",
        "decisions",
        "engine_analyses",
        "exercises",
        "reviews",
        "srs_states",
        "review_sessions",
        "course_revisions",
    ]
    with engine.connect() as connection:
        before = {
            table: connection.exec_driver_sql(f"SELECT * FROM {table} ORDER BY rowid").all()
            for table in tables
        }
        columns = [row[1] for row in connection.exec_driver_sql("PRAGMA table_info(llm_runs)")]
        audits = connection.exec_driver_sql("SELECT * FROM llm_runs ORDER BY id").all()
    with engine.begin() as connection:
        config.attributes["connection"] = connection
        command.upgrade(config, "c42d1738a9bf")
    with engine.connect() as connection:
        for table in tables:
            assert (
                connection.exec_driver_sql(f"SELECT * FROM {table} ORDER BY rowid").all()
                == before[table]
            )
        assert (
            connection.exec_driver_sql(
                "SELECT " + ",".join(columns) + " FROM classification_runs ORDER BY id"
            ).all()
            == audits
        )
        assert connection.exec_driver_sql("PRAGMA foreign_key_check").all() == []
        assert (
            connection.exec_driver_sql(
                "SELECT count(*) FROM skill_evidence WHERE active = 1"
            ).scalar()
            == 0
        )
    engine.dispose()
