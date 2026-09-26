"""History metadata and saved accuracy stay cheap, account-scoped and engine-free."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event, func, select
from trainer.api import create_app
from trainer.game_accuracy import review_accuracy
from trainer.game_library import time_control_label
from trainer.game_review import parsed_game
from trainer.imports import import_games
from trainer.models import AnalysisJob, EngineAnalysis, Game, GameReview, GameReviewMove


@pytest.mark.parametrize(
    "raw,label",
    [
        (None, None),
        ("?", None),
        ("", None),
        ("-", "Unlimited"),
        ("600", "10 min"),
        (" 180+2 ", "3 min + 2 sec"),
        ("30", "30 sec"),
        ("90", "1.5 min"),
        ("1/86400", "1 day / move"),
        ("1/259200", "3 days / move"),
        ("40/7200:3600", "40 moves / 120 min; then 60 min"),
        ("300+2d", "5 min + 2 sec delay"),
        ("600+0.5", "10 min + 0.5 sec"),
        ("broken", None),
        ("600+NaN", None),
        ("600+inf", None),
        ("600+-2", None),
    ],
)
def test_time_control_display(raw, label):
    assert time_control_label(raw) == label


def seed_history(db):
    for index in range(4):
        pgn = (
            f'[White "Student"]\n[Black "Opponent{index}"]\n'
            f'[Date "2026.09.{26 - index}"]\n[TimeControl "180+2"]\n'
            '[WhiteElo "637"]\n[BlackElo "630"]\n\n1. f3 e5 2. g4 Qh4# 0-1'
        )
        import_games(db, "synthetic.pgn", pgn, ["Student"], None, queue_analysis=False)
    games = db.scalars(select(Game).order_by(Game.played_at.desc())).all()
    for index, game in enumerate(games[:3]):
        job = AnalysisJob(kind="game_review", status="completed" if index < 2 else "cancelled")
        db.add(job)
        db.flush()
        db.add(GameReview(game_id=game.id, job_id=job.id, rating=1000))
        for ply, cp in enumerate([10, 20, -900, -900], 1):
            db.add(
                GameReviewMove(
                    game_id=game.id,
                    ply=ply,
                    report={
                        "white_score": {"kind": "cp", "value": cp},
                        "best": {"score": {"kind": "cp", "value": 15}},
                        "actual_line": {"unused_large_evidence": "x" * 10000},
                    },
                )
            )
    db.commit()
    return [game.id for game in games]


def test_history_metadata_accuracy_pagination_and_batched_reads(settings, monkeypatch):
    def forbidden_engine(*_):
        raise AssertionError("Reading history must not start Stockfish")

    monkeypatch.setattr("trainer.engine.Stockfish.start", forbidden_engine)
    app = create_app(settings, workers=False, start_engine=False)
    with TestClient(app) as client:
        with app.state.sessions() as db:
            ids = seed_history(db)
            expected = review_accuracy(
                {
                    row.ply: row.report
                    for row in db.scalars(
                        select(GameReviewMove).where(GameReviewMove.game_id == ids[0])
                    )
                },
                total=4,
                starting_board=parsed_game(db.get(Game, ids[0])).board(),
                completed=True,
            )
        statements = []
        engine = app.state.sessions.kw["bind"]

        def record(_connection, _cursor, statement, *_):
            statements.append(statement)

        event.listen(engine, "before_cursor_execute", record)
        try:
            response = client.get("/api/games")
        finally:
            event.remove(engine, "before_cursor_execute", record)
        assert response.status_code == 200, response.text
        data = response.json()
        assert data["total"] == 4
        assert [item["id"] for item in data["items"]] == ids
        first = data["items"][0]
        assert (first["white_rating"], first["black_rating"]) == (637, 630)
        assert first["learner_color"] == "white"
        assert first["time_control_label"] == "3 min + 2 sec"
        assert first["time_control"] == "180+2"
        assert first["move_count"] == 2
        assert first["result"] == "0-1"
        assert first["played_at"] == "2026-09-26T00:00:00+00:00"
        assert first["accuracy"] == data["items"][1]["accuracy"] == expected
        assert data["items"][2]["accuracy"] is None  # All plies, but paused.
        assert data["items"][3]["accuracy"] is None  # Never reviewed.
        reads = [sql for sql in statements if sql.lstrip().upper().startswith("SELECT")]
        assert len(reads) == 3  # Page + batched score projection + total.
        assert "JSON_EXTRACT" in reads[1] and "actual_line" not in reads[1]
        assert "actual_line" not in response.text
        page = client.get("/api/games?offset=1&limit=2").json()
        assert [item["id"] for item in page["items"]] == ids[1:3]
        assert page["total"] == 4
        assert client.get("/api/games?offset=30").json() == {"items": [], "total": 4}
        with app.state.sessions() as db:
            assert db.scalar(select(func.count()).select_from(EngineAnalysis)) == 0
            assert db.scalar(select(func.count()).select_from(AnalysisJob)) == 3


def test_missing_metadata_black_learner_and_odd_move_count(settings):
    app = create_app(settings, workers=False, start_engine=False)
    with TestClient(app) as client:
        with app.state.sessions() as db:
            import_games(
                db,
                "synthetic.pgn",
                '[White "Opponent"]\n[Black "Student"]\n[WhiteElo "?"]\n'
                '[BlackElo "630"]\n[UTCDate "2026.09.26"]\n[UTCTime "15:30:00"]\n'
                "\n1. e4 e5 2. Nf3 1/2-1/2",
                ["Student"],
                None,
                queue_analysis=False,
            )
        item = client.get("/api/games").json()["items"][0]
        assert item["learner_color"] == "black"
        assert item["white_rating"] is None and item["black_rating"] == 630
        assert item["move_count"] == 2
        assert item["time_control_label"] is None and item["accuracy"] is None
        assert item["played_at"] == "2026-09-26T15:30:00+00:00"
        assert item["result"] == "1/2-1/2"
