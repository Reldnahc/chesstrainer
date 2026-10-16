"""Refinement ownership and additive schema changes preserve existing reviews."""

import json
from datetime import datetime, timezone

import pytest
from account_units import units_for
from alembic import command
from alembic.config import Config
from sqlalchemy import func, select, text
from trainer.accounts import Accounts
from trainer.db import database, migrate
from trainer.errors import NotFound
from trainer.models import Game, GameReview, GameReviewMove, ReviewRefinement, uid
from trainer.ownership import account_sessions
from trainer.review_reports import reports_for


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
    with sessions() as db:
        game, other = (
            Game(fingerprint=key, white="A", black="B", learner_color=True, pgn="*")
            for key in ("game", "other")
        )
        db.add_all([game, other])
        db.flush()
        task = ReviewRefinement(
            game_id=other.id,
            ply=1,
            task_key="elsewhere",
            triggers=[],
            adopted=True,
            status="completed",
            report={"depth": 22},
            config={"baseline_ids": ["base", "played"]},
        )
        db.add(task)
        db.flush()
        db.add(GameReviewMove(game_id=game.id, ply=1, report=baseline, refinement_id=task.id))
        db.flush()
        assert reports_for(db, game.id)[0] == {1: baseline}
        task.game_id, task.config = game.id, {"baseline_ids": ["other", "played"]}
        db.flush()
        assert reports_for(db, game.id)[0] == {1: baseline}


@pytest.mark.pristine_database
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
    # The game page (reports_for) and library accuracy (load_accuracy_scores)
    # both read review_reports.adopted, so they cannot disagree.
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
        page = reports_for(db, game.id)[0][1]
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
        decision = analyze_decision(units_for(db), None, settings, game, 1, board, move)
        assert db.get(Decision, decision.id).before_analysis_id == rows["deep"].id


def test_a_played_move_inside_the_root_search_is_compared_at_the_same_depth(settings, sessions):
    import chess
    from trainer.analysis import analyze_decision
    from trainer.models import Decision, EngineAnalysis

    board = chess.Board()
    move = chess.Move.from_uci("e2e4")
    root = EngineAnalysis(
        cache_key="refined-root",
        fen=board.fen(),
        engine_version="fixture",
        config={"depth": 22, "time": 2.0, "multipv": 2, "root_moves": None},
        candidates=[
            {"uci": "d2d4", "san": "d4", "pv": ["d2d4"], "score": {"kind": "cp", "value": 45}},
            {
                "uci": "e2e4",
                "san": "e4",
                "pv": ["e2e4", "e7e5"],
                "score": {"kind": "cp", "value": 40},
            },
        ],
    )
    with sessions() as db:
        game = Game(
            fingerprint="same-depth", white="A", black="B", learner_color=True, pgn="1. e4 *"
        )
        db.add_all([game, root])
        db.flush()
        # The review read e4 from the root MultiPV: both ids name the root search.
        report = {"before_analysis_id": root.id, "played_analysis_id": root.id, "depth": 22}
        db.add(GameReviewMove(game_id=game.id, ply=1, report=report))
        db.commit()
        # No engine is available: nothing may be searched again at other limits.
        decision = analyze_decision(units_for(db), None, settings, game, 1, board, move)
        played = db.get(EngineAnalysis, decision.played_analysis_id)
        assert (
            played.candidates[0]["uci"] == "e2e4" and played.candidates[0]["score"]["value"] == 40
        )
        assert played.config["depth"] == 22 and played.config["root_moves"] == ["e2e4"]
        assert played.config["view_of"] == root.id
        assert decision.loss_cp == 5 and decision.deep
        # Analysed again (the saved decision no longer matches the report's root
        # search), the same view is reused rather than saved twice.
        other = EngineAnalysis(
            cache_key="other-root",
            fen=board.fen(),
            engine_version="fixture",
            config=root.config,
            candidates=root.candidates,
        )
        db.add(other)
        db.flush()
        db.get(Decision, decision.id).before_analysis_id = other.id
        db.commit()
        again = analyze_decision(units_for(db), None, settings, game, 1, board, move)
        assert again.played_analysis_id == played.id
        assert db.scalar(select(func.count()).select_from(EngineAnalysis)) == 3


def test_a_refinement_adopted_later_updates_the_decision_not_its_exercise(settings, sessions):
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
        decision = analyze_decision(units_for(db), None, settings, game, 1, board, move)
        exercise = exercise_from_decision(db, decision, settings, scheduler)
        db.commit()
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

        again = analyze_decision(units_for(db), None, settings, game, 1, board, move)
        assert again.id == decision.id
        assert db.get(Decision, decision.id).before_analysis_id == rows["deep"].id
        assert again.loss_cp == 285
        kept = exercise_from_decision(db, again, settings, scheduler)
        db.commit()
        # The same exercise and schedule, never a second card: its answers (and any
        # graded during practice) stay as they were made.
        assert kept.id == exercise.id and db.get(SRSState, exercise.id) is not None
        answers = db.scalars(
            select(ExerciseAnswer).where(ExerciseAnswer.exercise_id == exercise.id)
        ).all()
        assert {answer.analysis_id for answer in answers} == {rows["base"].id}
        # A move the card has not seen is graded against the same search as its
        # answers, not the decision's newer one.
        from trainer.models import ReviewSession
        from trainer.reviews import answer_search

        session = ReviewSession(exercise_id=exercise.id)
        db.add(session)
        db.commit()
        assert answer_search(db, session.id, "g1f3").original.id == rows["base"].id
        # The card's feedback lists the candidates those answers came from too.
        from trainer.reviews import feedback

        listed = feedback(db, exercise)["candidates"]
        assert listed == rows["base"].candidates != rows["deep"].candidates


def test_a_card_leaves_the_queue_while_its_decision_is_no_longer_a_mistake(settings, sessions):
    import chess
    import pytest
    from trainer.analysis import analyze_decision
    from trainer.errors import InvalidInput
    from trainer.exercises import exercise_from_decision
    from trainer.models import EngineAnalysis, SRSState
    from trainer.retirement import require_active_review
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

    def adopt(db, game, key, before, played, baseline):
        task = ReviewRefinement(
            game_id=game.id,
            ply=1,
            task_key=key,
            triggers=[],
            adopted=True,
            status="completed",
            report=baseline | {"before_analysis_id": before.id, "played_analysis_id": played.id},
            config={
                "baseline_ids": [baseline["before_analysis_id"], baseline["played_analysis_id"]]
            },
        )
        db.add(task)
        db.flush()
        db.get(GameReviewMove, (game.id, 1)).refinement_id = task.id
        db.commit()

    with sessions() as db:
        game = Game(fingerprint="queue", white="A", black="B", learner_color=True, pgn="1. f3 *")
        rows = {
            "base": analysis("q-base", [("e2e4", 40), ("f2f3", -260)]),
            "base_played": analysis("q-base-played", [("f2f3", -260)]),
            # Deeper, the played move is as good as the best: no longer a mistake.
            "fine": analysis("q-fine", [("d2d4", 45), ("f2f3", 40)]),
            "fine_played": analysis("q-fine-played", [("f2f3", 40)]),
            # Deeper still, it is a mistake again, and the card's answer still holds.
            "worse": analysis("q-worse", [("d2d4", 45), ("e2e4", 40), ("f2f3", -200)]),
            "worse_played": analysis("q-worse-played", [("f2f3", -200)]),
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
        decision = analyze_decision(units_for(db), None, settings, game, 1, board, move)
        db.expire_all()  # The unit saved it in a session of its own.
        exercise = exercise_from_decision(db, decision, settings, scheduler)
        db.commit()
        assert decision.meaningful and db.get(SRSState, exercise.id).eligible

        adopt(db, game, "fine", rows["fine"], rows["fine_played"], baseline)
        again = analyze_decision(units_for(db), None, settings, game, 1, board, move)
        db.expire_all()  # The unit saved it in a session of its own.
        assert again.id == decision.id and not again.meaningful
        # The card keeps its answers and schedule but leaves the queue, and a
        # direct start is refused too.
        state = db.get(SRSState, exercise.id)
        assert state is not None and not state.eligible
        with pytest.raises(InvalidInput, match="no longer matches its game's review"):
            require_active_review(db, exercise.id)

        adopt(db, game, "worse", rows["worse"], rows["worse_played"], baseline)
        back = analyze_decision(units_for(db), None, settings, game, 1, board, move)
        db.expire_all()  # The unit saved it in a session of its own.
        assert back.id == decision.id and back.meaningful
        assert db.get(SRSState, exercise.id).eligible
        require_active_review(db, exercise.id)

        # The same mistake in another game shares the card: its meaningful decision
        # puts the card back even while this game's decision is no longer one.
        adopt(db, game, "fine-again", rows["fine"], rows["fine_played"], baseline)
        analyze_decision(units_for(db), None, settings, game, 1, board, move)
        db.expire_all()  # The unit saved it in a session of its own.
        assert not db.get(SRSState, exercise.id).eligible
        other = Game(fingerprint="queue-2", white="A", black="B", learner_color=True, pgn="1. f3 *")
        db.add(other)
        db.flush()
        db.add(GameReviewMove(game_id=other.id, ply=1, report=baseline))
        db.commit()
        shared = analyze_decision(units_for(db), None, settings, other, 1, board, move)
        db.expire_all()  # The unit saved it in a session of its own.
        assert shared.meaningful and shared.id != decision.id
        assert exercise_from_decision(db, shared, settings, scheduler).id == exercise.id
        db.commit()
        assert db.get(SRSState, exercise.id).eligible


@pytest.mark.parametrize(
    ("deeper", "eligible"),
    [
        # The card's answer is still within tolerance of the deeper best: it stays.
        ([("d2d4", 45), ("e2e4", 40), ("f2f3", -240)], True),
        # The deeper search refutes the card's answer: practice must not drill it.
        ([("d2d4", 45), ("e2e4", -150), ("f2f3", -240)], False),
        # The deeper search ranks better moves above it and does not list it.
        ([("d2d4", 45), ("g1f3", 30), ("f2f3", -240)], False),
    ],
)
def test_a_card_leaves_the_queue_when_the_deeper_search_no_longer_supports_its_answer(
    settings, sessions, deeper, eligible
):
    import chess
    from trainer.analysis import analyze_decision
    from trainer.errors import InvalidInput
    from trainer.exercises import exercise_from_decision
    from trainer.models import EngineAnalysis, ExerciseAnswer, SRSState
    from trainer.retirement import require_active_review
    from trainer.scheduling import FSRSScheduler

    board = chess.Board()
    move = chess.Move.from_uci("f2f3")

    def analysis(key, scores):
        return EngineAnalysis(
            cache_key=key,
            fen=board.fen(),
            engine_version="fixture",
            config={},
            candidates=[
                {"uci": uci, "san": board.san(chess.Move.from_uci(uci)), "pv": [uci]}
                | {"score": {"kind": "cp", "value": value}}
                for uci, value in scores
            ],
        )

    with sessions() as db:
        game = Game(fingerprint="answer", white="A", black="B", learner_color=True, pgn="1. f3 *")
        rows = {
            "base": analysis("a-base", [("e2e4", 40), ("f2f3", -260)]),
            "base_played": analysis("a-base-played", [("f2f3", -260)]),
            "deep": analysis("a-deep", deeper),
            "deep_played": analysis("a-deep-played", [("f2f3", -240)]),
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
        decision = analyze_decision(units_for(db), None, settings, game, 1, board, move)
        exercise = exercise_from_decision(db, decision, settings, scheduler)
        db.commit()
        task = ReviewRefinement(
            game_id=game.id,
            ply=1,
            task_key="answer",
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
        again = analyze_decision(units_for(db), None, settings, game, 1, board, move)
        # Still a mistake either way; the card keeps its answers and schedule.
        assert again.meaningful
        assert db.get(SRSState, exercise.id) is not None
        primary = db.scalar(
            select(ExerciseAnswer).where(
                ExerciseAnswer.exercise_id == exercise.id, ExerciseAnswer.primary.is_(True)
            )
        )
        assert (primary.uci, primary.analysis_id) == ("e2e4", rows["base"].id)
        assert db.get(SRSState, exercise.id).eligible is eligible
        if eligible:
            require_active_review(db, exercise.id)
        else:
            with pytest.raises(InvalidInput, match="no longer matches"):
                require_active_review(db, exercise.id)
        # A card kept by a decision refreshed before this rule is rechecked at startup.
        from trainer.analysis import resync_game_cards

        db.get(SRSState, exercise.id).eligible = True
        db.commit()
        assert resync_game_cards(db) == (0 if eligible else 1)
        assert db.get(SRSState, exercise.id).eligible is eligible


def test_only_the_refinement_the_review_shows_is_reread_and_an_empty_one_is_not_shown(sessions):
    from trainer.review_reports import stale_adopted

    baseline = {"before_analysis_id": "base", "played_analysis_id": "played", "depth": 16}
    old_lines = {"actual_line": {"horizon": "an older horizon"}, "depth": 20}
    with sessions() as db:
        game = Game(fingerprint="shown", white="A", black="B", learner_color=True, pgn="*")
        db.add(game)
        db.flush()

        def refinement(key, report):
            task = ReviewRefinement(
                game_id=game.id,
                ply=1,
                task_key=key,
                triggers=[],
                adopted=True,
                status="completed",
                report=report,
                config={"baseline_ids": ["base", "played"]},
            )
            db.add(task)
            db.flush()
            return task

        superseded = refinement("superseded", old_lines)
        newer = refinement("newer", old_lines | {"depth": 24})
        move = GameReviewMove(game_id=game.id, ply=1, report=baseline, refinement_id=newer.id)
        db.add(move)
        db.flush()
        # Both are adopted and stale, but the review shows only the newer one.
        assert [task.id for task in stale_adopted(db, game.id, None)] == [newer.id]
        assert superseded.id != newer.id

        empty = refinement("empty", {})
        move.refinement_id = empty.id
        db.flush()
        assert reports_for(db, game.id)[0][1]["depth"] == 16
        assert stale_adopted(db, game.id, None) == []
