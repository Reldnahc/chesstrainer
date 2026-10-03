"""Puzzles mined from the learner's own games: gates, persistence, ownership and jobs."""

import chess
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from trainer.accounts import COOKIE
from trainer.api import create_app
from trainer.chess_core import position_key
from trainer.contracts.puzzles import PuzzleQuery
from trainer.engine import Stockfish
from trainer.imports import import_games
from trainer.models import (
    AnalysisJob,
    Decision,
    EngineAnalysis,
    Game,
    GamePuzzle,
    GamePuzzleSearch,
    Review,
    SkillEvidence,
    SRSState,
    uid,
)
from trainer.puzzles.game_provider import GamePuzzleProvider
from trainer.puzzles.generation import (
    GENERATOR_VERSION,
    JOB_KIND,
    EngineSearch,
    Line,
    build_line,
    classify_scores,
    generate_for_game,
    root_board,
    unsearched_games,
)
from trainer.puzzles.providers import PuzzleProviders
from trainer.puzzles.sessions import library, next_puzzle
from trainer.puzzles.verification import MATE_SCORE

# White's knight forks king and rook with Nd5+; the learner played Ne4 instead. The
# pawn keeps the position won after the rook falls, instead of a bare-king draw.
FORK_FEN = "8/4k3/1r6/8/8/2N5/7P/4K3 w - - 0 1"
# The same idea for Black: Nd4+ forks king and rook.
BLACK_FORK_FEN = "4k3/7p/2n5/8/8/1R6/4K3/8 b - - 0 1"
MATE_FEN = "7k/5ppp/8/8/8/8/8/R5K1 w - - 0 1"
TWO_MATES_FEN = "7k/5ppp/8/8/8/8/8/R2R2K1 w - - 0 1"


def pgn(fen, moves, *, white="me", black="them"):
    return (
        f'[Event "Fixture"]\n[Site "?"]\n[Date "2026.10.01"]\n[Round "?"]\n'
        f'[White "{white}"]\n[Black "{black}"]\n[Result "*"]\n[FEN "{fen}"]\n[SetUp "1"]\n\n'
        f"{moves} *\n"
    )


def mate(n):
    return MATE_SCORE - n


def key(fen, *moves):
    board = chess.Board(fen)
    for uci in moves:
        board.push_uci(uci)
    return " ".join(board.fen().split()[:4])


# Scores are the mover's. After the fork and Kc7 the knight has several equal
# escapes, which ends the line after two unique learner decisions.
FORK = {
    key(FORK_FEN): [("c3d5", 520), ("c3e4", 40)],
    key(FORK_FEN, "c3d5"): [("e7d7", -500)],
    key(FORK_FEN, "c3d5", "e7d7"): [("d5b6", 610), ("d5c3", 90)],
    key(FORK_FEN, "c3d5", "e7d7", "d5b6"): [("d7c7", -605)],
    key(FORK_FEN, "c3d5", "e7d7", "d5b6", "d7c7"): [("b6a4", 600), ("b6c4", 590)],
    # The learner's second decision in the fixture game (after Ne4 Kd7) is harmless.
    key(FORK_FEN, "c3e4", "e7d7"): [("e1d2", 10), ("e1e2", 5)],
}
BLACK_FORK = {
    key(BLACK_FORK_FEN): [("c6d4", 520), ("c6e5", 40)],
    key(BLACK_FORK_FEN, "c6d4"): [("e2d2", -500)],
    key(BLACK_FORK_FEN, "c6d4", "e2d2"): [("d4b3", 610), ("d4c6", 90)],
    key(BLACK_FORK_FEN, "c6d4", "e2d2", "d4b3"): [("d2c2", -605)],
    key(BLACK_FORK_FEN, "c6d4", "e2d2", "d4b3", "d2c2"): [("b3a5", 600), ("b3c5", 590)],
}


class Scripted:
    """Answers each position from a table instead of an engine."""

    def __init__(self, answers):
        self.answers = answers
        self.analysis_ids = []
        self.engine_version = "scripted"

    def __call__(self, board, *, multipv=1):
        self.analysis_ids.append(f"scripted-{len(self.analysis_ids)}")
        rows = self.answers[" ".join(board.fen().split()[:4])]
        return [Line(uci=uci, score=score, pv=(uci,), depth=18) for uci, score in rows[:multipv]]


class FakeEngine:
    """Serves the Stockfish adapter's role from a position table, persisting rows like it does."""

    version = "fake-engine"
    binary_hash = "fake"

    def __init__(self, settings, sessions, answers):
        self.sessions, self.answers, self.rows = sessions, answers, {}

    def start(self):
        pass

    def close(self):
        pass

    def analyze(self, board, deep=False, root_moves=None, multipv=None, **_):
        fen4 = " ".join(board.fen().split()[:4])
        roots = tuple(root_moves or ())
        lines = self.answers[fen4]
        if roots:
            lines = [line for line in lines if line[0] in roots]
        cache = (fen4, roots, multipv or 0)
        if cache not in self.rows:
            with self.sessions() as db:
                row = EngineAnalysis(
                    cache_key=uid(),
                    fen=board.fen(),
                    engine_version=self.version,
                    config={"depth": 18},
                    candidates=[
                        {
                            "uci": uci,
                            "san": board.san(board.parse_uci(uci)),
                            "score": {"kind": "cp", "value": cp, "mate_given": False},
                            "pv": [uci],
                            "depth": 18,
                        }
                        for uci, cp in lines
                    ],
                )
                db.add(row)
                db.commit()
                self.rows[cache] = row
        return self.rows[cache]


def seed_game(db, fen, moves, **headers):
    result = import_games(
        db, "fixture.pgn", pgn(fen, moves, **headers), ["me"], None, queue_analysis=False
    )
    assert result["imported"] == 1, result
    return db.scalar(select(Game).order_by(Game.created_at.desc(), Game.id.desc()))


def seed_decision(db, game, ply, played, before, *, meaningful=True):
    board = root_board(game, ply)

    def analysis(rows):
        row = EngineAnalysis(
            cache_key=uid(),
            fen=board.fen(),
            engine_version="fixture",
            config={},
            candidates=[
                {
                    "uci": uci,
                    "san": board.san(board.parse_uci(uci)),
                    "score": {"kind": "cp", "value": cp, "mate_given": False},
                    "pv": [uci],
                    "depth": 12,
                }
                for uci, cp in rows
            ],
        )
        db.add(row)
        db.flush()
        return row

    scores = dict(before)
    decision = Decision(
        game_id=game.id,
        ply=ply,
        fen=board.fen(),
        position_key=position_key(board),
        learner_color=board.turn,
        move_uci=played,
        move_san=board.san(board.parse_uci(played)),
        before_analysis_id=analysis(before).id,
        played_analysis_id=analysis([(played, scores[played])]).id,
        loss_cp=max(0, before[0][1] - scores[played]),
        meaningful=meaningful,
        deep=True,
        facts={},
    )
    db.add(decision)
    db.commit()
    return decision


def learning(db):
    return {
        model.__tablename__: [
            {column.name: getattr(row, column.name) for column in model.__table__.columns}
            for row in db.scalars(select(model))
        ]
        for model in (Review, SRSState, SkillEvidence)
    }


def test_build_line_keeps_unique_moves_and_the_best_defence():
    built, reason = build_line(Scripted(FORK), chess.Board(FORK_FEN), max_plies=13)
    assert reason is None
    assert built.solution == ("c3d5", "e7d7", "d5b6")
    assert [d["san"] for d in built.decisions] == ["Nd5+", "Nxb6+"]
    assert built.payoff == 605 and built.stop == "ambiguous"
    capped, _ = build_line(Scripted(FORK), chess.Board(FORK_FEN), max_plies=3)
    assert capped.solution == built.solution and capped.stop == "cap"


@pytest.mark.parametrize(
    ("fen", "answers", "reason"),
    [
        (
            FORK_FEN,
            FORK | {key(FORK_FEN): [("c3d5", 520), ("c3e4", 480)]},
            "ambiguous +520 vs +480",
        ),
        (FORK_FEN, FORK | {key(FORK_FEN): [("c3d5", 120), ("c3e4", 0)]}, "not_winning +120"),
        (FORK_FEN, FORK | {key(FORK_FEN, "c3d5", "e7d7", "d5b6"): [("d7c7", -100)]}, "payoff +100"),
        (
            FORK_FEN,
            FORK | {key(FORK_FEN, "c3d5", "e7d7"): [("d5b6", 610), ("d5c3", 560)]},
            "ambiguous +610 vs +560",
        ),
        (MATE_FEN, {key(MATE_FEN): [("a1a8", mate(1)), ("a1a7", 0)]}, "too_short 1"),
        (
            TWO_MATES_FEN,
            {key(TWO_MATES_FEN): [("a1a8", mate(1)), ("d1d8", mate(1))]},
            "ambiguous #1 vs #1",
        ),
    ],
)
def test_build_line_abstains_with_a_reason(fen, answers, reason):
    assert build_line(Scripted(answers), chess.Board(fen), max_plies=13) == (None, reason)


def test_saved_scores_select_missed_mates_and_wins_only():
    assert classify_scores(mate(2), 300) == "missed_mate"
    assert classify_scores(mate(2), -MATE_SCORE + 3) == "missed_mate"
    assert classify_scores(mate(2), mate(5)) is None  # a slower mate is not a miss
    assert classify_scores(520, 40) == "missed_win"
    assert classify_scores(520, 400) is None  # not enough lost
    assert classify_scores(120, -200) is None  # never winning
    assert classify_scores(-50, -500) is None  # defences are a later generator


def test_generate_once_per_game_and_serve_only_ready_lines(settings, sessions):
    providers = PuzzleProviders((GamePuzzleProvider(),))
    with sessions() as db:
        game = seed_game(db, FORK_FEN, "1. Ne4 Kd7 2. Kd2")
        seed_decision(db, game, 1, "c3e4", [("c3d5", 520), ("c3e4", 40)])
        seed_decision(db, game, 3, "e1d2", [("e1d2", 10), ("e1e2", 5)], meaningful=False)
        assert generate_for_game(db, Scripted(FORK), settings, game, cancelled=lambda: True) is None
        assert db.scalar(select(GamePuzzleSearch)) is None
        assert generate_for_game(db, Scripted(FORK), settings, game) == {"candidates": 1, "kept": 1}
        assert generate_for_game(db, Scripted(FORK), settings, game) is None
        row = db.scalar(select(GamePuzzle))
        assert row.status == "ready" and row.kind == "missed_win" and row.reason is None
        assert row.evidence["decisions"][0]["san"] == "Nd5+" and row.evidence["saved_unique_first"]
        assert len(row.evidence["analysis_ids"]) == 6
        [(provider, definition)] = list(providers.catalog(db))
        assert provider.source == "games" and definition.key == f"{game.id}:1"
        assert definition.solution == ("c3d5", "e7d7", "d5b6") and definition.rating is None
        assert {"crushing", "short", "endgame", "fork"} <= set(definition.themes)
        assert definition.provenance.game_id == game.id and definition.provenance.source_ply == 1
        assert definition.provenance.attribution == (
            "Your game as White vs them · 2026.10.01 · move 1. You played Ne4."
        )
        assert providers.find(db, provider.id, definition.key, GENERATOR_VERSION) == definition
        assert providers.find(db, provider.id, definition.key, "games-v0") is None
        assert providers.find(db, provider.id, "not-a-key", GENERATOR_VERSION) is None

        # The same position from another game is one puzzle, and the search is still recorded.
        twin = seed_game(db, FORK_FEN, "1. Ne4 Kd7 2. Kd2", black="someone-else")
        seed_decision(db, twin, 1, "c3e4", [("c3d5", 520), ("c3e4", 40)])
        assert unsearched_games(db, 10) == [twin.id]
        assert generate_for_game(db, Scripted(FORK), settings, twin) == {"candidates": 1, "kept": 0}
        assert db.scalar(select(GamePuzzle.reason).where(GamePuzzle.game_id == twin.id)) == (
            "duplicate_position"
        )
        assert unsearched_games(db, 10) == []

        result = library(db, providers, settings)
        assert [(s["id"], s["count"], s["rating_min"]) for s in result["sources"]] == [
            ("your-games", 1, None)
        ]
        assert result["generation"] == {
            "automatic": True,
            "analyzed_games": 2,
            "searched_games": 2,
            "unsearched_games": 0,
            "puzzles": 1,
            "candidates": 2,
            "kept": 1,
            "last_searched_at": result["generation"]["last_searched_at"],
            "job_status": None,
        }
        assert result["generation"]["last_searched_at"]
        assert next_puzzle(db, providers, PuzzleQuery(source="games", goal="material")).key == (
            definition.key
        )
        assert next_puzzle(db, providers, PuzzleQuery(source="games", goal="mate")) is None
        assert next_puzzle(db, providers, PuzzleQuery(source="games", min_rating=1)) is None
        assert learning(db) == {"reviews": [], "srs_states": [], "skill_evidence": []}


def test_analysis_jobs_mine_new_games_and_the_backfill_job_mines_the_rest(settings):
    settings.puzzle_starter_pack = False
    app = create_app(
        settings,
        workers=False,
        engine_factory=lambda settings, sessions: FakeEngine(settings, sessions, FORK | BLACK_FORK),
    )
    with TestClient(app) as client:
        with app.state.sessions() as db:
            job_id = import_games(db, "f.pgn", pgn(FORK_FEN, "1. Ne4 Kd7 2. Kd2"), ["me"], None)[
                "job_id"
            ]
        app.state.runner.run_job(job_id)
        with app.state.sessions() as db:
            job = db.get(AnalysisJob, job_id)
            assert (job.status, job.games_processed, job.mistakes_identified) == ("completed", 1, 1)
            assert job.puzzles_found == 1
            assert db.scalar(select(GamePuzzleSearch)).kept == 1
            before = learning(db)
            assert before["srs_states"]  # the ordinary training card still exists
            # A game analyzed earlier, before generation existed, waits for the backfill.
            older = seed_game(db, BLACK_FORK_FEN, "1... Ne5 2. Kd2 Kd7", white="them", black="me")
            seed_decision(db, older, 1, "c6e5", [("c6d4", 520), ("c6e5", 40)])
        puzzles = client.get("/api/puzzles").json()
        assert puzzles["available"] == 1 and puzzles["generation"]["unsearched_games"] == 1
        queued = client.post("/api/puzzles/generate")
        assert queued.status_code == 202
        assert client.post("/api/puzzles/generate").json() == queued.json()
        assert client.get("/api/puzzles").json()["generation"]["job_status"] == "queued"
        app.state.runner.run_job(queued.json()["job_id"])
        with app.state.sessions() as db:
            job = db.get(AnalysisJob, queued.json()["job_id"])
            assert job.kind == JOB_KIND and job.status == "completed"
            assert (job.games_total, job.games_processed, job.puzzles_found) == (1, 1, 1)
        puzzles = client.get("/api/puzzles").json()
        assert puzzles["available"] == 2 and puzzles["generation"]["unsearched_games"] == 0
        assert puzzles["generation"]["job_status"] is None
        assert client.post("/api/puzzles/generate").status_code == 202  # nothing left: a short job
        key = client.get("/api/puzzles/next?source=games&goal=material").json()
        state = client.post("/api/puzzle-sessions", json=key | {"request_id": "s"}).json()
        assert state["source"] == "games" and state["completion"] is None
        first = state["history"] or []
        assert first == [] and "attribution" not in str(state)
        solver_moves = ("c3d5", "d5b6") if state["orientation"] == "white" else ("c6d4", "d4b3")
        for uci in solver_moves:
            response = client.post(
                f"/api/puzzle-sessions/{state['id']}/move",
                json={"request_id": f"m-{uci}", "revision": state["revision"], "uci": uci},
            )
            assert response.status_code == 200, response.text
            state = response.json()
        assert state["status"] == "solved" and not state["failed"]
        assert state["completion"]["provenance"]["source_ply"] == 1
        assert state["completion"]["provenance"]["attribution"].startswith("Your game as ")
        with app.state.sessions() as db:
            assert learning(db) == before


def test_own_game_puzzles_are_private_to_the_account(settings):
    settings.accounts_enabled = True
    settings.public_origin = "http://testserver"
    settings.session_secure = False
    settings.puzzle_starter_pack = False
    app = create_app(settings, workers=False, start_engine=False)
    origin = {"Origin": "http://testserver"}
    with TestClient(app) as client:

        def signup(name):
            response = client.post(
                "/api/auth/signup",
                headers=origin,
                json={"username": name, "password": "testing-password"},
            )
            assert response.status_code == 201
            headers = origin | {"X-CSRF-Token": response.json()["csrf"]}
            return (
                headers,
                client.cookies.get(COOKIE),
                client.get("/api/auth/me").json()["user"]["id"],
            )

        alice_headers, alice_cookie, alice_id = signup("alice")
        with app.state.workspaces.open(alice_id) as workspace, workspace.sessions() as db:
            game = seed_game(db, FORK_FEN, "1. Ne4 Kd7 2. Kd2")
            seed_decision(db, game, 1, "c3e4", [("c3d5", 520), ("c3e4", 40)])
            assert generate_for_game(db, Scripted(FORK), settings, game) == {
                "candidates": 1,
                "kept": 1,
            }
        alice_key = client.get("/api/puzzles/next?source=games").json()
        assert alice_key["provider_id"] == "your-games"
        cold = client.post(
            "/api/puzzle-sessions", json=alice_key | {"request_id": "a"}, headers=alice_headers
        ).json()

        bob_headers, _, _ = signup("bobby")
        bob = client.get("/api/puzzles").json()
        assert bob["sources"] == [] and bob["generation"]["puzzles"] == 0
        assert bob["generation"]["analyzed_games"] == 0
        assert client.get("/api/puzzles/next?source=games").json() is None
        assert (
            client.post(
                "/api/puzzle-sessions", json=alice_key | {"request_id": "b"}, headers=bob_headers
            ).status_code
            == 404
        )
        assert client.get(f"/api/puzzle-sessions/{cold['id']}").status_code == 404

        client.cookies.set(COOKIE, alice_cookie)
        assert client.get(f"/api/puzzle-sessions/{cold['id']}").json() == cold
        assert client.get("/api/puzzles").json()["generation"]["puzzles"] == 1


@pytest.mark.stockfish
def test_native_engine_builds_the_fork_line(settings, sessions, stockfish_path):
    settings.stockfish_path = stockfish_path
    settings.puzzle_generation_depth = 12
    settings.puzzle_generation_time = 0.5
    engine = Stockfish(settings, sessions)
    try:
        search = EngineSearch(engine, settings)
        built, reason = build_line(search, chess.Board(FORK_FEN), max_plies=7)
        assert reason is None, reason
        assert built.solution[0] == "c3d5" and built.solution[2] == "d5b6"
        assert built.payoff >= 150 and len(built.decisions) >= 2
        assert search.engine_version.lower().startswith("stockfish")
        with sessions() as db:
            cached = db.scalars(
                select(EngineAnalysis.id).where(EngineAnalysis.id.in_(search.analysis_ids))
            ).all()
        assert len(cached) == len(set(search.analysis_ids))
    finally:
        engine.close()
