"""Refinement ownership and additive schema changes preserve existing reviews."""

import json
from datetime import datetime, timezone

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import select, text
from trainer.accounts import Accounts
from trainer.db import database, migrate
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
        with pytest.raises(ValueError, match="not in this account"):
            db.flush()
    with sessions() as db:
        db.add(ReviewRefinement(game_id=game.id, ply=1, task_key="stolen", triggers=[], config={}))
        with pytest.raises(ValueError, match="not in this account"):
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
