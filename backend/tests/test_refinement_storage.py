"""Refinement ownership and additive schema changes preserve existing reviews."""

import json
from datetime import datetime, timezone

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import select, text
from trainer.accounts import Accounts
from trainer.db import database, migrate
from trainer.errors import NotFound
from trainer.models import Game, GameReview, GameReviewMove, ReviewRefinement, uid
from trainer.ownership import account_sessions
from trainer.review_reports import effective_report


def test_private_task_queries_and_references_cannot_cross_accounts(settings, sessions):
    owner = Accounts(settings.database_path).create("other-owner", "testing-password")
    other = account_sessions(sessions.kw["bind"], owner["id"])
    with other() as db:
        game = Game(fingerprint="private", white="A", black="B", learner_color=True, pgn="*")
        db.add(game)
        db.flush()
        task = ReviewRefinement(game_id=game.id, ply=1, task_key="private", triggers=[], config={})
        db.add(task)
        db.commit()
    with sessions() as db:
        assert db.get(ReviewRefinement, task.id) is None
        assert db.scalars(select(ReviewRefinement)).all() == []
        own = Game(fingerprint="own", white="A", black="B", learner_color=True, pgn="*")
        db.add(own)
        db.flush()
        db.add(GameReviewMove(game_id=own.id, ply=1, report={}, refinement_id=task.id))
        with pytest.raises(NotFound, match="not in this account"):
            db.flush()
    with sessions() as db:
        db.add(ReviewRefinement(game_id=game.id, ply=1, task_key="stolen", triggers=[], config={}))
        with pytest.raises(NotFound, match="not in this account"):
            db.flush()


def test_same_account_wrong_position_or_generation_is_not_promoted(sessions):
    baseline = {"before_analysis_id": "base", "played_analysis_id": "played", "depth": 16}
    row = GameReviewMove(game_id="game", ply=1, report=baseline)
    task = ReviewRefinement(
        game_id="different",
        ply=1,
        adopted=True,
        status="completed",
        report={"depth": 22},
        config={"baseline_ids": ["base", "played"]},
    )
    with sessions() as db:
        assert effective_report(db, row, task) == baseline
        task.game_id, task.config = "game", {"baseline_ids": ["other", "played"]}
        assert effective_report(db, row, task) == baseline


def test_upgrade_retains_reports_ids_ownership_and_legacy_defaults(settings):
    sql, sessions = database(settings.database_path)
    config = Config("alembic.ini")
    with sql.connect() as connection:
        config.attributes["connection"] = connection
        command.upgrade(config, "39c94b22a711")
        connection.commit()
    # Every model here has newer columns than this revision, so insert only the
    # legacy shapes through a migration connection.
    job_id, game_id = uid(), uid()
    payload = {"before_analysis_id": "baseline", "depth": 16}
    with sql.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO analysis_jobs (id,kind,status,games_total,games_processed,"
                "positions_triaged,deep_completed,mistakes_identified,classifications_completed,"
                "cancel_requested,created_at,user_id) VALUES (:job,'game_review','completed',"
                "0,0,0,0,0,0,0,:created,'local')"
            ),
            {"job": job_id, "created": datetime.now(timezone.utc).isoformat(" ")},
        )
        connection.execute(
            text(
                "INSERT INTO games (id,fingerprint,white,black,learner_color,pgn,created_at,user_id)"
                " VALUES (:game,'old-review','A','B',1,'*',:created,'local')"
            ),
            {"game": game_id, "created": datetime.now(timezone.utc).isoformat(" ")},
        )
        connection.execute(
            text(
                "INSERT INTO game_reviews (game_id,job_id,rating,user_id) VALUES (:game,:job,900,'local')"
            ),
            {"game": game_id, "job": job_id},
        )
        connection.execute(
            text(
                "INSERT INTO game_review_moves (game_id,ply,report,user_id) VALUES (:game,1,:report,'local')"
            ),
            {"game": game_id, "report": json.dumps(payload)},
        )
    migrate(sql)
    with sessions() as db:
        review = db.get(GameReview, game_id)
        row = db.get(GameReviewMove, (game_id, 1))
        assert (review.job_id, review.rating, review.revision, review.refinement_plan) == (
            job_id,
            900,
            0,
            None,
        )
        assert (row.report, row.revision, row.refinement_id) == (payload, 0, None)
    with sql.connect() as connection:
        assert connection.exec_driver_sql("PRAGMA foreign_key_check").all() == []
    sql.dispose()


@pytest.mark.parametrize(
    "adopted,status,baseline_ids,refined",
    [
        (True, "completed", ["base", "played"], True),
        (False, "completed", ["base", "played"], True),
        (True, "budget_limited", ["base", "played"], True),
        (True, "completed", ["other", "played"], True),
        (True, "completed", ["base", "played"], False),
    ],
)
def test_the_game_page_and_library_accuracy_agree_on_the_adopted_report(
    sessions, adopted, status, baseline_ids, refined
):
    # effective_report (Python) and load_accuracy_scores (SQL) state one rule twice.
    from trainer.review_reports import load_accuracy_scores

    def score(value):
        return {"kind": "cp", "value": value, "mate_given": False}

    baseline = {
        "before_analysis_id": "base",
        "played_analysis_id": "played",
        "depth": 16,
        "white_score": score(10),
        "best": {"score": score(20)},
    }
    better = baseline | {"depth": 22, "white_score": score(-40), "best": {"score": score(60)}}
    with sessions() as db:
        game = Game(fingerprint="agree", white="A", black="B", learner_color=True, pgn="*")
        db.add(game)
        db.flush()
        task = ReviewRefinement(
            game_id=game.id,
            ply=1,
            task_key="agree",
            triggers=[],
            adopted=adopted,
            status=status,
            report=better if refined else None,
            config={"baseline_ids": baseline_ids},
        )
        db.add(task)
        db.flush()
        row = GameReviewMove(game_id=game.id, ply=1, report=baseline, refinement_id=task.id)
        db.add(row)
        db.commit()
        page = effective_report(db, row, task)
        library = load_accuracy_scores(db, [game.id])[game.id][1]
        assert library == {
            "white_score": page["white_score"],
            "best": {"score": page["best"]["score"]},
        }


def test_training_decisions_use_the_adopted_refinement(settings, sessions):
    import chess
    from trainer.analysis import analyze_decision
    from trainer.models import Decision, EngineAnalysis

    board = chess.Board()
    move = chess.Move.from_uci("e2e4")

    def analysis(key, value):
        candidate = {
            "uci": "e2e4",
            "san": "e4",
            "pv": ["e2e4"],
            "score": {"kind": "cp", "value": value},
        }
        return EngineAnalysis(
            cache_key=key,
            fen=board.fen(),
            engine_version="fixture",
            config={},
            candidates=[candidate],
        )

    with sessions() as db:
        game = Game(fingerprint="train", white="A", black="B", learner_color=True, pgn="1. e4 *")
        rows = {key: analysis(key, value) for key, value in [("base", 20), ("deep", 35)]}
        db.add_all([game, *rows.values()])
        db.flush()
        baseline = {
            "before_analysis_id": rows["base"].id,
            "played_analysis_id": rows["base"].id,
            "depth": 16,
        }
        refined = baseline | {
            "before_analysis_id": rows["deep"].id,
            "played_analysis_id": rows["deep"].id,
            "depth": 22,
        }
        task = ReviewRefinement(
            game_id=game.id,
            ply=1,
            task_key="train",
            triggers=[],
            adopted=True,
            status="completed",
            report=refined,
            config={"baseline_ids": [rows["base"].id, rows["base"].id]},
        )
        db.add(task)
        db.flush()
        db.add(GameReviewMove(game_id=game.id, ply=1, report=baseline, refinement_id=task.id))
        db.commit()
        decision = analyze_decision(db, None, settings, game, 1, board, move)
        assert db.get(Decision, decision.id).before_analysis_id == rows["deep"].id


def test_a_refinement_adopted_later_updates_the_decision_and_its_exercise(settings, sessions):
    import chess
    from trainer.analysis import analyze_decision
    from trainer.exercises import exercise_from_decision
    from trainer.models import Decision, EngineAnalysis, ExerciseAnswer, SRSState
    from trainer.scheduling import FSRSScheduler

    board = chess.Board()
    move = chess.Move.from_uci("f2f3")

    def analysis(key, scores):
        candidates = [
            {"uci": uci, "san": board.san(chess.Move.from_uci(uci)), "pv": [uci]}
            | {"score": {"kind": "cp", "value": value}}
            for uci, value in scores
        ]
        return EngineAnalysis(
            cache_key=key,
            fen=board.fen(),
            engine_version="fixture",
            config={},
            candidates=candidates,
        )

    with sessions() as db:
        game = Game(fingerprint="later", white="A", black="B", learner_color=True, pgn="1. f3 *")
        rows = {
            "base": analysis("base", [("e2e4", 40), ("f2f3", -260)]),
            "base_played": analysis("base_played", [("f2f3", -260)]),
            "deep": analysis("deep", [("d2d4", 45), ("e2e4", 40), ("f2f3", -240)]),
            "deep_played": analysis("deep_played", [("f2f3", -240)]),
        }
        db.add_all([game, *rows.values()])
        db.flush()
        baseline = {
            "before_analysis_id": rows["base"].id,
            "played_analysis_id": rows["base_played"].id,
            "depth": 16,
        }
        db.add(GameReviewMove(game_id=game.id, ply=1, report=baseline))
        db.commit()
        scheduler = FSRSScheduler(settings)
        decision = analyze_decision(db, None, settings, game, 1, board, move)
        exercise = exercise_from_decision(db, decision, settings, scheduler)
        assert decision.meaningful

        # A refine request adopts a deeper search after training was built.
        task = ReviewRefinement(
            game_id=game.id,
            ply=1,
            task_key="later",
            triggers=[],
            adopted=True,
            status="completed",
            report=baseline
            | {
                "before_analysis_id": rows["deep"].id,
                "played_analysis_id": rows["deep_played"].id,
            },
            config={"baseline_ids": [rows["base"].id, rows["base_played"].id]},
        )
        db.add(task)
        db.flush()
        db.get(GameReviewMove, (game.id, 1)).refinement_id = task.id
        db.commit()

        again = analyze_decision(db, None, settings, game, 1, board, move)
        assert again.id == decision.id
        assert db.get(Decision, decision.id).before_analysis_id == rows["deep"].id
        assert again.loss_cp == 285
        updated = exercise_from_decision(db, again, settings, scheduler)
        # The same exercise, keeping its schedule, with the deeper search's answers.
        assert updated.id == exercise.id and db.get(SRSState, exercise.id) is not None
        answers = db.scalars(
            select(ExerciseAnswer).where(ExerciseAnswer.exercise_id == exercise.id)
        ).all()
        assert {answer.uci for answer in answers} == {"d2d4", "e2e4", "f2f3"}
        assert {answer.analysis_id for answer in answers} == {rows["deep"].id}
