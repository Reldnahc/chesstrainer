import importlib.util
import sqlite3
from pathlib import Path

import chess
from sqlalchemy import select
from trainer.accounts import Accounts
from trainer.chess_core import Candidate, Score
from trainer.exercises import exercise_from_decision, manual_exercise
from trainer.imports import import_games
from trainer.models import (
    Decision,
    EngineAnalysis,
    ExerciseAnswer,
    Game,
    GameReviewMove,
    HumanAnalysis,
    UserPreferences,
)
from trainer.ownership import account_sessions
from trainer.scheduling import FSRSScheduler

PGN = '[White "Learner"]\n[Black "Opponent"]\n\n1. f3 e5 2. g4 Qh4# 0-1'


def _script():
    spec = importlib.util.spec_from_file_location("clear_games", Path("scripts/clear_games.py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _engine(db, key):
    analysis = EngineAnalysis(
        cache_key=key,
        fen=chess.STARTING_FEN,
        engine_version="test",
        config={},
        candidates=[
            Candidate(
                uci="e2e4", san="e4", score=Score(kind="cp", value=0), pv=["e2e4"]
            ).model_dump()
        ],
    )
    db.add(analysis)
    db.flush()
    return analysis


def _counts(path):
    with sqlite3.connect(path) as db:
        tables = (
            "games",
            "game_imports",
            "decisions",
            "exercises",
            "srs_states",
            "exercise_answers",
            "engine_analyses",
            "user_preferences",
        )
        return {t: db.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0] for t in tables}


def test_clear_games_removes_game_data_and_keeps_everything_else(settings, sessions):
    scheduler = FSRSScheduler(settings)
    with sessions() as db:
        import_games(db, "fixture.pgn", PGN, ["Learner"], None)
        game_analysis = _engine(db, "game")
        decision = Decision(
            game_id=db.scalar(select(Game.id)),
            ply=1,
            fen=chess.STARTING_FEN,
            position_key="fixture",
            learner_color=True,
            move_uci="f2f3",
            move_san="f3",
            before_analysis_id=game_analysis.id,
            played_analysis_id=game_analysis.id,
            loss_cp=200,
            meaningful=True,
            facts={"verified_line": []},
        )
        db.add(decision)
        db.commit()
        exercise_from_decision(db, decision, settings, scheduler)
        manual = manual_exercise(db, scheduler, chess.STARTING_FEN, ["e2e4"], "white")
        # A cached position the kept exercise still uses must survive the cleanup.
        shared = _engine(db, "shared")
        db.scalar(
            select(ExerciseAnswer).where(ExerciseAnswer.exercise_id == manual.id)
        ).analysis_id = shared.id
        db.add(UserPreferences(coach_id="frog"))
        db.commit()
    before = _counts(settings.database_path)
    assert before["games"] == 1 and before["exercises"] == 2

    clear = _script().clear_games
    preview = clear(settings.database_path)
    assert preview["games"] == 1 and preview["engine_analyses"] == 1
    assert _counts(settings.database_path) == before

    removed = clear(settings.database_path, apply=True)
    assert removed == preview
    after = _counts(settings.database_path)
    assert after == {
        "games": 0,
        "game_imports": 0,
        "decisions": 0,
        "exercises": 1,
        "srs_states": 1,
        "exercise_answers": 1,
        "engine_analyses": 1,
        "user_preferences": 1,
    }
    with sqlite3.connect(settings.database_path) as db:
        assert db.execute("PRAGMA foreign_key_check").fetchone() is None
        assert db.execute("SELECT source FROM exercises").fetchone() == ("manual",)
        assert db.execute("SELECT coach_id FROM user_preferences").fetchone() == ("frog",)


def test_clear_games_keeps_maia_rows_another_account_still_uses(settings, sessions):
    owner = Accounts(settings.database_path).create("clubmate", "testing-password")
    clubmate = account_sessions(sessions.kw["bind"], owner["id"])
    with sessions() as db:
        shared = HumanAnalysis(cache_key="shared", request={}, policy={})
        unused = HumanAnalysis(cache_key="unused", request={}, policy={})
        db.add_all([shared, unused])
        db.commit()
        shared_id = shared.id
    for factory in (sessions, clubmate):
        with factory() as db:
            import_games(db, "fixture.pgn", PGN, ["Learner"], None)
            game_id = db.scalar(select(Game.id))
            db.add(GameReviewMove(game_id=game_id, ply=1, report={}, human_analysis_id=shared_id))
            db.commit()

    removed = _script().clear_games(settings.database_path, "clubmate", apply=True)
    assert removed["games"] == 1 and removed["human_analyses"] == 1
    with sqlite3.connect(settings.database_path) as db:
        assert db.execute("SELECT cache_key FROM human_analyses").fetchall() == [("shared",)]
        assert db.execute("PRAGMA foreign_key_check").fetchone() is None


def test_clear_games_removes_mined_puzzles_and_unlinks_play_games(settings, sessions):
    from test_migrations import fill

    with sessions() as db:
        import_games(db, "fixture.pgn", PGN, ["Learner"], None)
        game_id = db.scalar(select(Game.id))
    with sqlite3.connect(settings.database_path) as db:
        fill(db, "game_puzzle_searches", user_id="local", game_id=game_id)
        fill(db, "game_puzzles", user_id="local", game_id=game_id, decision_id=None)
        fill(db, "play_games", id="played", user_id="local", saved_game_id=game_id)

    removed = _script().clear_games(settings.database_path, apply=True)
    assert removed["game_puzzles"] == removed["game_puzzle_searches"] == 1
    assert removed["play_games (unlinked)"] == 1
    with sqlite3.connect(settings.database_path) as db:
        assert db.execute("SELECT id, saved_game_id FROM play_games").fetchall() == [
            ("played", None)
        ]
        assert db.execute("SELECT COUNT(*) FROM games").fetchone() == (0,)


def test_every_reference_to_a_cleared_row_is_cleared_or_unlinked():
    # A new table pointing at games, decisions or exercises must join the steps, or
    # clearing fails on its foreign key at commit.
    from trainer.models import Base

    module = _script()
    cleared = {table for table, _ in module.STEPS}
    unlinked = {(table, column) for table, column, _ in module.UNLINKED}
    shared_caches = {"engine_analyses", "human_analyses"}  # Only unreferenced rows go.
    missing = [
        f"{table.name}.{key.parent.name}"
        for table in Base.metadata.sorted_tables
        for key in table.foreign_keys
        if key.column.table.name in cleared - shared_caches
        and table.name not in cleared
        and (table.name, key.parent.name) not in unlinked
    ]
    assert missing == []
