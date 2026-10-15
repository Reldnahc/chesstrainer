"""Puzzles mined from the learner's own games: gates, persistence, ownership and jobs."""

import chess
import pytest
from fastapi.testclient import TestClient
from job_fixtures import queue_import_analysis
from sqlalchemy import select
from trainer.accounts import COOKIE
from trainer.api import create_app
from trainer.chess_core import position_key, replay_moves
from trainer.config import Settings
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
    EngineSearch,
    Line,
    build_line,
    classify_scores,
    generate_for_game,
    line_themes,
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
    result = import_games(db, "fixture.pgn", pgn(fen, moves, **headers), ["me"], None)
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
    # The defence after the last unique move may pass the cap; the line still fits.
    assert build_line(Scripted(FORK), chess.Board(FORK_FEN), max_plies=3) == (built, None)


BACK_RANK_FEN = "3r3k/6pp/8/8/8/8/R7/R5K1 w - - 0 1"


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
        # Any rival mate is ambiguous, however slow: a solver playing it also mates.
        (
            BACK_RANK_FEN,
            {key(BACK_RANK_FEN): [("a2a8", mate(2)), ("a2a7", mate(9))]},
            "ambiguous #2 vs #9",
        ),
        # A rival that still wins clearly is no wrong answer, though far worse.
        (
            FORK_FEN,
            FORK | {key(FORK_FEN): [("c3d5", 1190), ("c3e4", 250)]},
            "ambiguous +1190 vs +250",
        ),
    ],
)
def test_build_line_abstains_with_a_reason(fen, answers, reason):
    assert build_line(Scripted(answers), chess.Board(fen), max_plies=13) == (None, reason)


def test_rivals_are_judged_by_one_shared_rule():
    from trainer.puzzles.verification import rival_verdict

    assert rival_verdict(520, 40) == "unique"
    assert rival_verdict(520, 480) == "close"
    assert rival_verdict(1190, 250) == "still_winning"
    assert rival_verdict(mate(3), 199) == "unique"
    assert rival_verdict(mate(2), mate(9)) == "rival_mate"
    assert rival_verdict(300, mate(4)) == "rival_mate"
    assert rival_verdict(mate(2), -MATE_SCORE + 3) == "unique"
    # A mate puzzle asks for the mate; a rival that only wins does not compete.
    assert rival_verdict(mate(1), 617) == "unique"


BACK_RANK = {
    key(BACK_RANK_FEN): [("a2a8", mate(2)), ("g1f1", 0)],
    key(BACK_RANK_FEN, "a2a8"): [("d8a8", -mate(1))],
    key(BACK_RANK_FEN, "a2a8", "d8a8"): [("a1a8", mate(1)), ("g1f1", -500)],
}
# A learner's game (session b11d17d3): Black has a forced mate in 16. The old 13-ply
# cap cut the line on Qc2+, seven Black moves in, and still labeled it mate. Here the
# scripted line instead ends there because Black's next move is ambiguous. In the real
# game the rivals still won or mated too, which now makes the very first step
# ambiguous; the script gives every rival a level score so the line runs on.
CAPPED_MATE_FEN = "2b1kbnr/pp4pp/1q1p4/3p4/3P4/PP3P2/2n1K1PP/5R2 b k - 0 18"
CAPPED_MATE_LINE = (
    ("c2d4", 16, 0),
    ("e2e1", None, None),
    ("d4c2", 13, 0),
    ("e1d1", None, None),
    ("b6d4", 12, 0),
    ("d1c2", None, None),
    ("c8f5", 5, 0),
    ("c2c1", None, None),
    ("d4c3", 4, 0),
    ("c1d1", None, None),
    ("c3b3", 15, 0),
    ("d1e2", None, None),
    ("b3c2", 9, 0),
)


def capped_mate_answers():
    answers, played = {}, []
    for uci, mate_in, rival in CAPPED_MATE_LINE:
        board = key(CAPPED_MATE_FEN, *played)
        if mate_in is None:
            answers[board] = [(uci, -MATE_SCORE + 10)]
        else:
            rival_move = next(
                move.uci() for move in replay_board(played).legal_moves if move.uci() != uci
            )
            answers[board] = [(uci, mate(mate_in)), (rival_move, rival)]
        played.append(uci)
    answers[key(CAPPED_MATE_FEN, *played)] = [("e2e1", -mate(8))]
    first, second = list(replay_board([*played, "e2e1"]).legal_moves)[:2]
    answers[key(CAPPED_MATE_FEN, *played, "e2e1")] = [
        (first.uci(), mate(7)),
        (second.uci(), mate(7)),
    ]
    return answers


def replay_board(moves):
    board = chess.Board(CAPPED_MATE_FEN)
    for uci in moves:
        board.push_uci(uci)
    return board


def test_mate_themes_need_a_line_that_ends_in_checkmate():
    root = chess.Board(BACK_RANK_FEN)
    built, _ = build_line(Scripted(BACK_RANK), root, max_plies=13)
    assert built.stop == "mate"
    themes = line_themes(replay_moves(root, built.solution), built, "back-rank")
    assert {"mate", "mateIn2"} <= set(themes)

    root = chess.Board(CAPPED_MATE_FEN)
    built, reason = build_line(Scripted(capped_mate_answers()), root, max_plies=13)
    assert reason is None and built.stop == "ambiguous" and built.payoff == mate(8)
    boards = replay_moves(root, built.solution)
    assert not boards[-1].is_checkmate()
    themes = line_themes(boards, built, "capped")
    assert "mate" not in themes and not any(theme.startswith("mateIn") for theme in themes)
    assert "crushing" in themes


def test_lines_longer_than_five_learner_moves_abstain_instead_of_being_cut():
    max_plies = Settings.model_fields["puzzle_generation_max_plies"].default
    assert max_plies == 9
    root = chess.Board(CAPPED_MATE_FEN)
    answers = capped_mate_answers()
    assert build_line(Scripted(answers), root, max_plies=max_plies) == (None, "too_long")


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
            imported = import_games(db, "f.pgn", pgn(FORK_FEN, "1. Ne4 Kd7 2. Kd2"), ["me"], None)
            job_id = queue_import_analysis(db, imported)
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
            assert job.kind == "puzzle_generation" and job.status == "completed"
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


def test_review_candidates_read_the_report_the_review_shows(sessions):
    from trainer.models import GameReviewMove, ReviewRefinement
    from trainer.puzzles.generation import review_prospects

    def cp(value):
        return {"kind": "cp", "value": value, "mate_given": False}

    # The baseline saw nothing to find; the adopted deeper search found the fork.
    baseline = {
        "before_analysis_id": "before",
        "played_analysis_id": "played",
        "depth": 12,
        "best": {"san": "Ne4", "uci": "c3e4", "score": cp(40)},
        "actual": {"san": "Ne4", "uci": "c3e4", "score": cp(40)},
        "actual_line": {"frames": [{"fen": FORK_FEN}]},
        "second_score": None,
    }
    refined = baseline | {
        "depth": 22,
        "best": {"san": "Nd5+", "uci": "c3d5", "score": cp(520)},
        "second_score": cp(40),
    }
    with sessions() as db:
        game = seed_game(db, FORK_FEN, "1. Ne4 Kd7 2. Kd2")
        task = ReviewRefinement(
            game_id=game.id,
            ply=1,
            task_key="fork",
            triggers=[],
            config={"baseline_ids": ["before", "played"]},
            adopted=True,
            status="completed",
            report=refined,
        )
        db.add(task)
        db.flush()
        db.add(GameReviewMove(game_id=game.id, ply=1, report=baseline, refinement_id=task.id))
        db.commit()
        [prospect] = review_prospects(db, game, set())
        assert (prospect.kind, prospect.saved_best_san, prospect.saved_unique) == (
            "missed_win",
            "Nd5+",
            True,
        )
        # Without an adopted refinement the baseline stands, and there is nothing to mine.
        task.adopted = False
        db.commit()
        assert list(review_prospects(db, game, set())) == []


@pytest.mark.parametrize(
    ("payoff", "goal"), [(605, "crushing"), (601, "crushing"), (450, "advantage"), (180, None)]
)
def test_goal_themes_use_lichess_ranges(payoff, goal):
    from dataclasses import replace

    from trainer.puzzles.sessions import _matches

    root = chess.Board(FORK_FEN)
    built, _ = build_line(Scripted(FORK), root, max_plies=13)
    built = replace(built, payoff=payoff)
    themes = set(line_themes(replay_moves(root, built.solution), built, "goal"))
    assert themes & {"crushing", "advantage", "equality"} == ({goal} if goal else set())
    definition = type("Definition", (), {"source": "games", "themes": tuple(themes)})()
    query = PuzzleQuery(source="games", goal="material")
    assert _matches(definition, query) is (goal is not None)
    assert not _matches(definition, PuzzleQuery(source="games", goal="mate"))
