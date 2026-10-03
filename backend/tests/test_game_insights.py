"""Library insights come from saved PGNs and completed reviews, never new engine work."""

import chess
import chess.pgn
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from trainer.api import create_app
from trainer.game_insights import speed_of, termination_of
from trainer.imports import import_games
from trainer.models import AnalysisJob, EngineAnalysis, Game, GameReview, GameReviewMove


@pytest.mark.parametrize(
    "control,speed",
    [
        ("60", "bullet"),
        ("120+1", "bullet"),
        ("180+2", "blitz"),
        ("180", "blitz"),
        ("600", "rapid"),
        ("900+10", "rapid"),
        ("1800", "classical"),
        ("1/86400", "daily"),
        (None, "unknown"),
        ("broken", "unknown"),
    ],
)
def test_speed_uses_the_estimated_game_length(control, speed):
    assert speed_of(control) == speed


@pytest.mark.parametrize(
    "termination,result,expected",
    [
        ("Opponent won by resignation", "0-1", "resignation"),
        ("Student won on time", "1-0", "time"),
        ("Opponent won - game abandoned", "0-1", "abandoned"),
        ("Game drawn by repetition", "1/2-1/2", "repetition"),
        ("Game drawn by timeout vs insufficient material", "1/2-1/2", "insufficient_material"),
        ("Normal", "1-0", "resignation"),
        ("Normal", "1/2-1/2", "agreement"),
        ("Time forfeit", "0-1", "time"),
        ("", "1-0", "other"),
    ],
)
def test_termination_reads_provider_wording(termination, result, expected):
    headers = chess.pgn.Headers(Termination=termination)
    assert termination_of(headers, chess.Board(), result) == expected


def test_checkmate_on_the_board_wins_over_the_header():
    board = chess.Board()
    for san in ("f3", "e5", "g4", "Qh4#"):
        board.push_san(san)
    headers = chess.pgn.Headers(Termination="Normal")
    assert termination_of(headers, board, "0-1") == "checkmate"


GAMES = [
    # A: White learner leaves book with a hanging bishop and loses on resignation.
    (
        "Opponent0",
        "Student",
        "650",
        "700",
        "2026.09.20",
        "10:00:00",
        "180",
        "Opponent0 won by resignation",
        "1. e4 {[%clk 0:03:00]} e5 {[%clk 0:03:00]} 2. Nf3 {[%clk 0:02:55]} "
        "Nc6 {[%clk 0:02:58]} 3. Ba6 {[%clk 0:02:40]} bxa6 {[%clk 0:02:50]} 0-1",
    ),
    # B: the instant rematch as Black, from a lost position to mate.
    (
        "Opponent0",
        "Opponent0",
        "700",
        "660",
        "2026.09.20",
        "10:30:00",
        "600",
        "",
        "1. f3 e5 2. g4 Qh4# 0-1",
    ),
    # C: never reviewed; a win on time after the learner's clock ran low.
    (
        "Rival",
        "Student",
        "670",
        "900",
        "2026.09.21",
        "20:00:00",
        "180",
        "Student won on time",
        "1. e4 {[%clk 0:02:50]} e5 {[%clk 0:00:20]} 2. Nf3 {[%clk 0:00:25]} 1-0",
    ),
]


def score(value, kind="cp", given=False):
    return {"kind": kind, "value": value, "mate_given": given}


# (white_score after the ply, best score for the side that moved)
REVIEWS = {
    0: [(30, 30), (30, -30), (30, 30), (30, -30), (-300, 30), (-300, 300)],
    1: [(-50, 30), (400, 60), (score(-1, "mate"), 400), (score(0, "mate"), score(1, "mate"))],
}


def seed(db):
    for opponent, white, white_elo, black_elo, day, time, control, termination, moves in GAMES:
        black = opponent if white == "Student" else "Student"
        pgn = (
            f'[White "{white}"]\n[Black "{black}"]\n[UTCDate "{day}"]\n[UTCTime "{time}"]\n'
            f'[WhiteElo "{white_elo}"]\n[BlackElo "{black_elo}"]\n[TimeControl "{control}"]\n'
            f'[Termination "{termination}"]\n[Result "{moves.split()[-1]}"]\n\n{moves}'
        )
        import_games(db, "insights.pgn", pgn, ["Student"], None, queue_analysis=False)
    games = db.scalars(select(Game).order_by(Game.played_at)).all()
    for index, rows in REVIEWS.items():
        job = AnalysisJob(kind="game_review", status="completed")
        db.add(job)
        db.flush()
        db.add(GameReview(game_id=games[index].id, job_id=job.id, rating=1000))
        for ply, (white, best) in enumerate(rows, 1):
            db.add(
                GameReviewMove(
                    game_id=games[index].id,
                    ply=ply,
                    report={
                        "white_score": white if isinstance(white, dict) else score(white),
                        "best": {"score": best if isinstance(best, dict) else score(best)},
                    },
                )
            )
    db.commit()
    return [game.id for game in games]


def test_library_insights_from_saved_games(settings, monkeypatch):
    def forbidden_engine(*_):
        raise AssertionError("Insights must not start Stockfish")

    monkeypatch.setattr("trainer.engine.Stockfish.start", forbidden_engine)
    app = create_app(settings, workers=False, start_engine=False)
    with TestClient(app) as client:
        with app.state.sessions() as db:
            ids = seed(db)
        response = client.get("/api/insights")
        assert response.status_code == 200, response.text
        data = response.json()
        assert (data["games"], data["reviewed_games"]) == (3, 2)
        assert (data["wins"], data["draws"], data["losses"]) == (2, 0, 1)
        assert data["speeds"] == ["blitz", "rapid"]

        assert data["rhythm"]["cells"] == [
            {"weekday": 0, "part": "evening", "wins": 1, "draws": 0, "losses": 0},
            {"weekday": 6, "part": "morning", "wins": 1, "draws": 0, "losses": 1},
        ]
        assert data["endings"]["win"] == [
            {"termination": "checkmate", "games": 1},
            {"termination": "time", "games": 1},
        ]
        assert data["endings"]["loss"] == [{"termination": "resignation", "games": 1}]

        records = data["records"]
        assert (records["longest_win_streak"], records["longest_loss_streak"]) == (2, 1)
        assert records["current_win_streak"] == 2
        assert records["best_win"]["id"] == ids[2]
        assert records["best_win"]["opponent_rating"] == 900
        assert sorted((r["speed"], r["first"], r["last"]) for r in data["ratings"]) == [
            ("blitz", 650, 670),
            ("rapid", 660, 660),
        ]

        theory = data["theory"]
        assert (theory["exits"], theory["costly_exits"]) == (1, 1)
        assert theory["average_exit_move"] == 3
        assert theory["average_cost_cp"] == 330

        momentum = data["momentum"]
        assert momentum["conversion"]["winning_games"] == 1
        assert momentum["conversion"]["converted"] == 1
        assert momentum["escapes"]["lost_games"] == 2
        assert (momentum["escapes"]["won"], momentum["escapes"]["still_lost"]) == (1, 1)
        assert [save["id"] for save in momentum["escapes"]["saves"]] == [ids[1]]
        shapes = {shape["shape"]: shape["games"] for shape in data["shapes"]}
        assert shapes == {
            "wire_to_wire": 0,
            "back_and_forth": 0,
            "unsettled": 1,
            "slipped": 0,
            "comeback": 1,
        }

        phases = {row["phase"]: row for row in data["moves"]["by_phase"]}
        assert phases["opening"]["moves"] == 5
        assert phases["opening"]["blunders_per_100"] == 40.0

        tilt = data["tilt"]
        assert tilt["after_loss"] == {"games": 1, "blunders_per_100": 50.0}
        assert tilt["rematches_after_loss"] == {"games": 1, "wins": 1, "draws": 0, "losses": 0}

        clock = data["clock"]
        assert (clock["clocked_games"], clock["time_trouble_games"]) == (2, 1)

        assert data["punishment"] == {
            "opponent_errors": 1,
            "punished": 1,
            "own_errors": 2,
            "unpunished": 1,
        }

        blitz = client.get("/api/insights?speed=blitz").json()
        assert (blitz["games"], blitz["speed"]) == (2, "blitz")
        assert client.get("/api/insights?days=1").json()["games"] == 0
        evening = client.get("/api/insights?offset=300").json()["rhythm"]["cells"]
        assert {"weekday": 1, "part": "night", "wins": 1, "draws": 0, "losses": 0} in evening
        assert client.get("/api/insights?speed=hyper").status_code == 422
        with app.state.sessions() as db:
            assert db.scalar(select(func.count()).select_from(EngineAnalysis)) == 0


def test_empty_library(settings):
    app = create_app(settings, workers=False, start_engine=False)
    with TestClient(app) as client:
        data = client.get("/api/insights").json()
        assert data["games"] == 0
        assert data["records"]["best_win"] is None
        assert data["momentum"]["conversion"]["winning_games"] == 0
