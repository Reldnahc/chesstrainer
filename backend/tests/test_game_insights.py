"""Library insights come from saved PGNs and completed reviews, never new engine work."""

from datetime import datetime, timedelta, timezone

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
        (" 300+2 ", "blitz"),  # The library label ignores the spaces too.
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
        import_games(db, "insights.pgn", pgn, ["Student"], None)
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


def test_each_game_is_replayed_once_until_it_or_its_review_changes(settings, monkeypatch):
    from trainer import game_insights
    from trainer.models import GameReview, InsightFacts
    from trainer.routes import insights

    built = []

    def counted(game, *args):
        built.append(game.id)
        return game_insights.game_facts(game, *args)

    monkeypatch.setattr(insights, "game_facts", counted)
    app = create_app(settings, workers=False, start_engine=False)
    with TestClient(app) as client:
        with app.state.sessions() as db:
            ids = seed(db)
        first = client.get("/api/insights").json()
        assert len(built) == 3
        # A filter change or a repeat replays nothing while the reviews are unchanged.
        assert client.get("/api/insights?speed=blitz").json()["games"] == 2
        assert client.get("/api/insights").json() == first
        assert len(built) == 3
        with app.state.sessions() as db:
            assert db.scalar(select(func.count()).select_from(InsightFacts)) == 3
            # A saved report or an adopted refinement bumps the review's revision.
            db.get(GameReview, ids[0]).revision += 1
            db.commit()
        built.clear()
        assert client.get("/api/insights").json() == first
        assert built == [ids[0]]

    # Saved facts outlive the process: a restarted server replays nothing.
    built.clear()
    app = create_app(settings, workers=False, start_engine=False)
    with TestClient(app) as client:
        assert client.get("/api/insights").json() == first
    assert built == []


def test_saved_facts_read_back_exactly():
    from trainer.game_insights import game_facts, pack_facts, unpack_facts

    for game, scores in (
        endgame_game([350, -400, -400, -400], [-350, 350, 400, -400]),
        endgame_game([-350, -400, -400, -400], [350, -350, 400, -400], result="1/2-1/2"),
    ):
        for facts in (game_facts(game, scores), game_facts(game)):
            assert unpack_facts(pack_facts(facts)) == facts


def test_facts_key_follows_everything_the_facts_read():
    from types import SimpleNamespace

    from trainer.game_insights import facts_key

    game = SimpleNamespace(
        pgn="1. e4 *",
        learner_color=True,
        white="A",
        black="B",
        played_on="2025-01-01",
        played_at=None,
    )
    base = facts_key(game, 1500, 3, True)
    assert facts_key(game, 1500, 3, True) == base
    # An unfinished review's revision does not matter; its scores are not read.
    assert facts_key(game, 1500, 3, False) == facts_key(game, 1500, 4, False)
    for changed in (
        facts_key(game, 1600, 3, True),
        facts_key(game, 1500, 4, True),
        facts_key(game, 1500, 3, False),
        facts_key(SimpleNamespace(**{**vars(game), "pgn": "1. d4 *"}), 1500, 3, True),
        facts_key(SimpleNamespace(**{**vars(game), "learner_color": False}), 1500, 3, True),
        facts_key(SimpleNamespace(**{**vars(game), "black": "C"}), 1500, 3, True),
    ):
        assert changed != base


def test_facts_keep_no_per_instance_dictionary():
    from trainer.game_insights import game_facts

    # Cached for the life of the process: slots keep each ply small.
    pgn = '[White "Student"]\n[Black "Rival"]\n[Result "*"]\n\n1. e4 e5 *'
    facts = game_facts(Game(id="slots", pgn=pgn, learner_color=True, white="Student"))
    assert not hasattr(facts, "__dict__")
    assert not any(hasattr(row, "__dict__") for row in facts.plies)


def test_empty_library(settings):
    app = create_app(settings, workers=False, start_engine=False)
    with TestClient(app) as client:
        data = client.get("/api/insights").json()
        assert data["games"] == 0
        assert data["records"]["best_win"] is None
        assert data["momentum"]["conversion"]["winning_games"] == 0


def test_unrated_games_stay_out_of_insights(settings):
    app = create_app(settings, workers=False, start_engine=False)
    with TestClient(app) as client:
        with app.state.sessions() as db:
            for event, moves in (
                ("Rated Blitz game", "1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0"),
                ("Casual Blitz game", "1. f3 e5 2. g4 Qh4# 0-1"),
                ("Live Chess", "1. d4 d5 1/2-1/2"),
            ):
                pgn = (
                    f'[Event "{event}"]\n[White "Student"]\n[Black "Rival"]\n'
                    f'[Result "{moves.split()[-1]}"]\n\n{moves}'
                )
                import_games(db, "rated.pgn", pgn, ["Student"], None)
            saved = {game.pgn.split('"')[1]: game.rated for game in db.scalars(select(Game))}
        assert saved == {"Rated Blitz game": True, "Casual Blitz game": False, "Live Chess": None}
        data = client.get("/api/insights").json()
        # The casual loss is skipped; the game with no rated information still counts.
        assert (data["games"], data["wins"], data["draws"], data["losses"]) == (2, 1, 1, 0)


def test_blunders_use_the_movers_pgn_rating_like_the_review_badges():
    from trainer.chess_core import Score
    from trainer.game_insights import game_facts
    from trainer.game_review import blunder_kind

    # A 1500 learner loses 260 cp: a Blunder badge at 1200+ (200 cp), not at 1000 (300 cp).
    pgn = '[White "Student"]\n[Black "Rival"]\n[WhiteElo "1500"]\n[BlackElo "1480"]\n\n1. e4 e5 *'
    game = Game(id="rated", pgn=pgn, learner_color=True, white="Student", black="Rival")
    scores = {
        1: {"white_score": score(-180), "best": {"score": score(80)}},
        2: {"white_score": score(-180), "best": {"score": score(180)}},
    }
    facts = game_facts(game, scores, rating=1000)  # The review's stored fallback rating.
    best, actual = Score.model_validate(score(80)), Score.model_validate(score(-180))
    assert blunder_kind(best, actual, 1500) is not None
    assert blunder_kind(best, actual, 1000) is None
    assert facts.plies[0].learner and facts.plies[0].blunder


def test_play_games_keep_their_model_settings_out_of_rating_statistics():
    from trainer.game_insights import game_facts, ratings, streaks
    from trainer.models import PlayGame
    from trainer.play.level import learner_positions
    from trainer.play.sessions import parsed_for

    sans = "e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d4 exd4 cxd4 Bb4+ Bd2 Bxd2+ Nbxd2 d5".split()
    board = chess.Board()
    moves = [board.push_san(san).uci() for san in sans]
    play = PlayGame(
        coach_name="Walter",
        learner_color=True,
        opponent_kind="engine",
        opponent_rating=2600,
        learner_rating=1200,
        moves=moves,
        result="1-0",
        termination="resignation",
    )
    pgn = str(parsed_for(play, "Student"))
    assert '[BlackElo "2600"]' in pgn and '[WhiteElo "1200"]' in pgn
    game = Game(id="play", pgn=pgn, learner_color=True, white="Student", black="Walter (bot)")
    facts = game_facts(game)
    assert facts.result == "win"
    assert facts.learner_rating is None and facts.opponent_rating is None
    facts.played_at = datetime(2026, 10, 1, tzinfo=timezone.utc)
    assert streaks([facts])["best_win"] is None and ratings([facts]) == []
    # The level fit's "where you were rated" median ignores the fit's own number.
    rows = learner_positions([game])
    assert rows and all(rating is None for *_, rating in rows)


ENDGAME_FEN = "3r2k1/5pp1/2n5/8/1bB5/5N2/5PP1/3RR1K1 b - - 0 20"


def endgame_game(white_after, best_for_mover, result="0-1"):
    """20...Bxe1 21.Rxd8+ Nxd8 22.Nxe1 with the learner as White."""
    pgn = (
        f'[White "Student"]\n[Black "Rival"]\n[FEN "{ENDGAME_FEN}"]\n[SetUp "1"]\n'
        f'[Result "{result}"]\n\n20... Bxe1 21. Rxd8+ Nxd8 22. Nxe1 {result}'
    )
    game = Game(id="endgame", pgn=pgn, learner_color=True, white="Student", black="Rival")
    scores = {
        ply: {"white_score": score(white), "best": {"score": score(best)}}
        for ply, (white, best) in enumerate(zip(white_after, best_for_mover, strict=True), 1)
    }
    return game, scores


def test_an_endgame_is_held_against_the_evaluation_where_it_began():
    from trainer.game_insights import endgames, game_facts

    # White enters the endgame at +3.50, then throws it away with the first endgame
    # move and loses: that endgame was not held.
    game, scores = endgame_game([350, -400, -400, -400], [-350, 350, 400, -400])
    facts = game_facts(game, scores)
    assert facts.reviewed and facts.endgame_entry == 2 and facts.endgame == "mixed"
    assert {row["kind"]: row["held"] for row in endgames([facts])}["mixed"] == 0
    # A loss from an endgame entered already lost is held.
    game, scores = endgame_game([-350, -400, -400, -400], [350, -350, 400, -400])
    assert {row["kind"]: row["held"] for row in endgames([game_facts(game, scores)])}["mixed"] == 1


def test_slip_links_give_the_move_number_the_game_uses():
    from trainer.game_insights import example, game_facts

    game, scores = endgame_game([350, -400, -400, -400], [-350, 350, 400, -400])
    facts = game_facts(game, scores)
    assert example(facts, 2)["move"] == 21 and example(facts)["move"] is None


@pytest.mark.parametrize(
    "fen,kind",
    [
        ("6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1", "rook"),
        ("6k1/5ppp/2n5/8/8/8/5PPP/3R2K1 w - - 0 1", "mixed"),
        ("6k1/5ppp/2n5/8/8/5B2/5PPP/6K1 w - - 0 1", "minor"),
        ("3q2k1/5ppp/8/8/8/8/5PPP/3Q2K1 w - - 0 1", "queen"),
        ("3r2k1/5ppp/8/8/8/8/5PPP/3Q2K1 w - - 0 1", "mixed"),
        ("6k1/5ppp/8/8/8/8/5PPP/6K1 w - - 0 1", "pawn"),
    ],
)
def test_endgame_classes_name_only_the_pieces_on_the_board(fen, kind):
    from trainer.game_insights import endgame_class

    assert endgame_class(chess.Board(fen)) == kind


def test_led_throughout_needs_the_lead_kept_once_reached():
    from trainer.game_insights import kept_lead

    assert kept_lead([20, 160, 90, 300])
    # Back to level after going ahead is not keeping the lead.
    assert not kept_lead([20, 160, -20, 300])
    assert not kept_lead([20, 140, 120])


@pytest.mark.parametrize(
    "control,site,speed",
    [
        ("300+5", "Chess.com", "blitz"),
        ("300+5", "Lichess", "rapid"),
        ("600", "Chess.com", "rapid"),
        ("120+1", "Chess.com", "bullet"),
        ("1800", "Chess.com", "rapid"),
        ("1/86400", "Chess.com", "daily"),
    ],
)
def test_speed_follows_each_providers_own_classes(control, site, speed):
    assert speed_of(control, site) == speed


def test_termination_keywords_ignore_the_players_names():
    headers = chess.pgn.Headers(
        White="Timeless_Tal", Black="Rival", Termination="Timeless_Tal won by resignation"
    )
    assert termination_of(headers, chess.Board(), "1-0") == "resignation"
    # A name inside a keyword ("Tim" in "time") must not hide it.
    for white, termination, result, expected in [
        ("Tim", "Time forfeit", "0-1", "time"),
        ("Rival", "Tim won on time", "0-1", "time"),
        ("Me", "Time forfeit", "1-0", "time"),
        ("Res", "Rival won by resignation", "0-1", "resignation"),
    ]:
        headers = chess.pgn.Headers(White=white, Black="Tim", Termination=termination)
        assert termination_of(headers, chess.Board(), result) == expected


def test_lichess_normal_draws_are_checked_on_the_board():
    headers = chess.pgn.Headers(Termination="Normal")
    board = chess.Board()
    for san in ["Nf3", "Nf6", "Ng1", "Ng8"] * 2:
        board.push_san(san)
    assert termination_of(headers, board, "1/2-1/2") == "repetition"
    fifty = chess.Board("8/8/4k3/8/8/3QK3/8/8 w - - 99 120")
    fifty.push_san("Qd4")
    assert termination_of(headers, fifty, "1/2-1/2") == "fifty_moves"
    assert termination_of(headers, chess.Board(), "1/2-1/2") == "agreement"


def test_a_mistakes_swing_is_measured_from_its_own_search():
    from trainer.game_insights import game_facts, punishment

    # Black's 1...f6 is judged from its own search (+0.20 for Black before it) to
    # -2.00; the earlier ply's stored evaluation (+3.00 for White) is not the baseline.
    pgn = '[White "Student"]\n[Black "Rival"]\n[Result "*"]\n\n1. e4 f6 2. d4 *'
    game = Game(id="swing", pgn=pgn, learner_color=True, white="Student", black="Rival")
    scores = {
        1: {"white_score": score(300), "best": {"score": score(30)}},
        2: {"white_score": score(200), "best": {"score": score(20)}},
        3: {"white_score": score(150), "best": {"score": score(200)}},
    }
    facts = game_facts(game, scores)
    assert facts.plies[1].mistake and facts.plies[1].before_cp == -20
    # Swing 220 from -20 to +200; the reply keeps 170 of it, so it punishes.
    assert punishment([facts])["punished"] == 1


def test_the_next_game_counts_by_start_time_for_synced_games():
    from trainer.game_insights import game_facts, tilt

    def synced(id, start, end):
        pgn = (
            f'[White "Student"]\n[Black "Rival"]\n[UTCDate "2026.10.01"]\n[UTCTime "{start}"]\n'
            '[Result "0-1"]\n\n1. f3 e5 2. g4 Qh4# 0-1'
        )
        game = Game(id=id, pgn=pgn, learner_color=True, white="Student", black="Rival")
        game.played_at = datetime.fromisoformat(f"2026-10-01T{end}+00:00")
        return game_facts(game)

    # The second game started 40 minutes after the first, but ended two hours later.
    first, second = synced("a", "10:00:00", "10:30:00"), synced("b", "10:40:00", "12:30:00")
    assert tilt([first, second])["rematches_after_loss"]["games"] == 1
    # A daily game started a day earlier but finished later does not follow it.
    daily = synced("c", "09:00:00", "13:00:00")
    daily.started_at -= timedelta(days=1)
    assert tilt([first, daily])["rematches_after_loss"]["games"] == 0


def test_insights_phases_use_the_shared_phase_rule():
    from trainer.chess_core import game_phase
    from trainer.game_insights import game_facts

    # Six pieces besides kings and pawns, but 50 points of material: a middlegame.
    fen = "2bqr1k1/pppppppp/8/8/8/8/PPPPPPPP/2BQR1K1 w - - 0 20"
    pgn = (
        f'[White "Student"]\n[Black "Rival"]\n[FEN "{fen}"]\n[SetUp "1"]\n'
        '[Result "*"]\n\n20. a3 a6 *'
    )
    game = Game(id="phases", pgn=pgn, learner_color=True, white="Student", black="Rival")
    facts = game_facts(game)
    board = chess.Board(fen)
    assert [row.phase for row in facts.plies] == ["middlegame", "middlegame"]
    for row, uci in zip(facts.plies, ["a2a3", "a7a6"], strict=True):
        assert row.phase == game_phase(board)
        board.push_uci(uci)
    assert facts.endgame is None
