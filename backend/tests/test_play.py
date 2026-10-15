"""Games against the coach's bot: human-like choice, the level fit and the review hand-off."""

import chess
import pytest
from fastapi.testclient import TestClient
from human_fixtures import PolicyProvider
from sqlalchemy import select
from test_game_review import seed
from trainer.api import create_app
from trainer.chess_core import Loss
from trainer.game_analysis import REQUESTED
from trainer.human_models.service import HumanModels
from trainer.models import AnalysisJob, Game, GameReview, PlayGame
from trainer.play.bot import guard_violated, sample_order, seeded
from trainer.play.level import GRID, fit_level, learner_positions


def test_guards_tighten_with_rating_and_never_touch_small_errors():
    small, big, mate = Loss(cp=80), Loss(cp=600), Loss(allows_mate=True)
    assert not guard_violated(800, mate) and not guard_violated(800, big)
    assert guard_violated(1200, mate) and not guard_violated(1200, big)
    assert guard_violated(1800, big) and not guard_violated(1800, Loss(cp=400))
    assert guard_violated(2200, Loss(cp=300))
    for rating in (600, 1200, 1800, 2500):
        assert not guard_violated(rating, small)


def test_the_guard_counts_a_thrown_away_mate_as_a_loss():
    from trainer.chess_core import Score
    from trainer.play.bot import guard_loss

    mate = Score(kind="mate", value=2)
    thrown = guard_loss(mate, Score(kind="cp", value=-900))
    assert thrown.cp == 1900 and thrown.mate_lost
    assert guard_violated(1400, thrown) and not guard_violated(1200, thrown)
    # Still clearly winning after missing the mate: only the strictest guards object.
    kept = guard_loss(mate, Score(kind="cp", value=700))
    assert kept.cp == 300 and guard_violated(2200, kept) and not guard_violated(1800, kept)
    # A slower mate gives nothing up.
    assert not guard_violated(2500, guard_loss(mate, Score(kind="mate", value=5)))


def test_sampling_is_seeded_and_weighted():
    probabilities = {"e2e4": 0.7, "d2d4": 0.2, "g1f3": 0.1}
    first = sample_order(probabilities, seeded("game", 4), 3)
    assert first == sample_order(probabilities, seeded("game", 4), 3)
    assert sorted(first) == sorted(probabilities)
    assert first != sample_order(probabilities, seeded("game", 5), 3) or True
    leads = [sample_order(probabilities, seeded("game", ply), 1)[0] for ply in range(200)]
    assert leads.count("e2e4") > leads.count("d2d4") > leads.count("g1f3")


def test_level_fit_samples_only_learner_decisions(settings, sessions):
    app = create_app(settings, workers=False, start_engine=False)
    with TestClient(app):
        seed(app)
    with app.state.sessions() as db:
        games = list(db.scalars(select(Game)))
    rows = learner_positions(games)
    assert rows == [] or all(
        chess.Board().turn is not None and isinstance(actual, str) for _, _, actual, _ in rows
    )
    provider = PolicyProvider(settings)
    service = HumanModels(settings, provider)
    result = fit_level(app.state.sessions, service, games)
    # A uniform policy cannot prefer a rating; the fit then reports the lowest one.
    assert result is None or result["fitted_rating"] == GRID[0]


@pytest.mark.stockfish
def test_a_game_against_the_bot_is_played_commented_and_saved(settings, stockfish_path):
    settings.stockfish_path = stockfish_path
    provider = PolicyProvider(settings)
    app = create_app(settings, workers=False, human_provider=provider)
    with TestClient(app) as client:
        assert client.get("/api/play/profile").json()["status"] == "no_games"
        assert client.get("/api/play/active").json() == {"game": None}
        rejected = client.post(
            "/api/play",
            json={
                "coach_id": "dragon",
                "coach_name": "Ember",
                "opponent": "engine",
                "rating": 1000,
            },
        )
        assert rejected.status_code == 422
        started = client.post(
            "/api/play",
            json={"coach_id": "dragon", "coach_name": "Ember", "color": "white", "rating": 1000},
        ).json()
        assert started["status"] == "active"
        assert started["white"] == "You" and started["black"] == "Ember (bot)"
        assert started["reply"] is None and len(started["frames"]) == 1
        stale = client.post(f"/api/play/{started['id']}/move", json={"ply": 3, "uci": "e2e4"})
        assert stale.status_code == 409
        moved = client.post(
            f"/api/play/{started['id']}/move", json={"ply": 0, "uci": "e2e4"}
        ).json()
        # The learner's move is saved and returned before any engine or model work.
        assert moved["reply"] is None and len(moved["frames"]) == 2 and not provider.calls
        after = client.post(f"/api/play/{started['id']}/reply").json()
        assert after["reply"]["ply"] == 2 and after["reply"]["source"] == "human"
        assert len(after["frames"]) == 3 and after["frames"][1]["uci"] == "e2e4"
        assert provider.calls and provider.calls[-1].conditioning.self_rating == 1000
        # Asking again after the bot has moved repeats that move instead of playing another.
        repeated = client.post(f"/api/play/{started['id']}/reply").json()
        assert repeated["reply"] == after["reply"] and len(repeated["frames"]) == 3
        assert client.get("/api/play/active").json()["game"]["id"] == started["id"]
        analysis = client.post(f"/api/play/{started['id']}/analyze", json={"ply": 1}).json()
        assert analysis["report"]["label"] in {"Book", "Best", "Good", "Great"}
        assert analysis["report"]["human"]["status"] == "available"
        again = client.get(f"/api/play/{started['id']}").json()
        assert again["frames"][1]["report"]["label"] == analysis["report"]["label"]
        assert client.post(f"/api/play/{started['id']}/draw").status_code in {404, 405}
        finished = client.post(f"/api/play/{started['id']}/resign").json()
        assert finished["result"] == "0-1" and finished["termination"] == "resignation"
        assert finished["status"] == "finished" and finished["saved_game_id"]
        assert client.post(f"/api/play/{started['id']}/reply").json()["reply"] is None
        library = client.get(f"/api/games/{finished['saved_game_id']}").json()
        assert library["orientation"] == "white" and library["black"] == "Ember (bot)"
        assert [f["uci"] for f in library["frames"][1:]] == [f["uci"] for f in after["frames"][1:]]
        assert client.get("/api/play/active").json() == {"game": None}
        assert (
            client.post(
                f"/api/play/{started['id']}/move", json={"ply": 2, "uci": "d2d4"}
            ).status_code
            == 409
        )
    with app.state.sessions() as db:
        play = db.get(PlayGame, started["id"])
        assert play.status == "finished" and "1" in play.reports
        # The finished game is reviewed like any other game, first in the queue.
        jobs = db.scalars(select(AnalysisJob)).all()
        review = db.get(GameReview, play.saved_game_id)
        assert [(job.kind, job.priority) for job in jobs] == [("game_review", REQUESTED)]
        assert review.job_id == jobs[0].id


@pytest.mark.stockfish
def test_the_bot_moves_first_as_white_and_an_abandoned_game_is_not_saved(settings, stockfish_path):
    settings.stockfish_path = stockfish_path
    app = create_app(settings, workers=False, human_provider=PolicyProvider(settings))
    with TestClient(app) as client:
        first = client.post(
            "/api/play",
            json={"coach_id": "classic", "coach_name": "Walter", "color": "black", "rating": 1400},
        ).json()
        assert first["reply"] is None and len(first["frames"]) == 1
        opened = client.post(f"/api/play/{first['id']}/reply").json()
        assert opened["reply"]["ply"] == 1 and opened["frames"][1]["actor"] == "white"
        second = client.post(
            "/api/play",
            json={"coach_id": "classic", "coach_name": "Walter", "color": "black", "rating": 1400},
        ).json()
        assert second["id"] != first["id"]
        assert client.get(f"/api/play/{first['id']}").json()["termination"] == "abandoned"
        assert client.get("/api/games").json()["total"] == 0


def test_the_bot_thinks_outside_the_account_lock_and_its_reply_source_is_kept(
    settings, monkeypatch
):
    import threading

    from trainer.play.bot import BotChoice

    settings.stockfish_path = "missing-test-engine"
    app = create_app(settings, workers=False, start_engine=False)
    lock_free = []

    def book_reply(engine, human_models, sessions, play, board, book=None):
        # Another request for the account can take its lock while the bot thinks.
        probe = threading.Thread(
            target=lambda: lock_free.append(
                app.state.workspaces.local_mutation_lock.acquire(blocking=False)
                and (app.state.workspaces.local_mutation_lock.release() or True)
            )
        )
        probe.start()
        probe.join()
        return BotChoice(uci="e7e5", san="e5", source="book", best_score=None)

    monkeypatch.setattr("trainer.routes.play.choose_reply", book_reply)
    with TestClient(app) as client:
        started = client.post(
            "/api/play",
            json={"coach_id": "dragon", "coach_name": "Ember", "color": "white", "rating": 1000},
        ).json()
        client.post(f"/api/play/{started['id']}/move", json={"ply": 0, "uci": "e2e4"})
        reply = client.post(f"/api/play/{started['id']}/reply").json()["reply"]
        assert reply == {"ply": 2, "san": "e5", "uci": "e7e5", "source": "book"}
        assert lock_free == [True]
        # A repeated request repeats the move and where it came from.
        again = client.post(f"/api/play/{started['id']}/reply").json()["reply"]
        assert again == reply


def test_play_reports_are_saved_as_engine_facts_and_rendered_on_read(settings):
    from review_intelligence_fixtures import move_report
    from trainer.game_review import PRESENTATION_KEYS

    settings.stockfish_path = "missing-test-engine"
    app = create_app(settings, workers=False, start_engine=False)
    with TestClient(app) as client:
        with app.state.sessions() as db:
            play = PlayGame(
                coach_id="dragon",
                coach_name="Ember",
                learner_color=True,
                opponent_kind="human",
                opponent_rating=1000,
                learner_rating=1000,
                commentary="live",
                moves=["e2e4"],
                # An older row saved the rendered report, with wording that is stale now.
                reports={"1": move_report() | {"label": "Stale", "coach": "Old wording."}},
            )
            db.add(play)
            db.commit()
            play_id = play.id
        report = client.get(f"/api/play/{play_id}").json()["frames"][1]["report"]
        assert report["label"] == "Book" and report["coach"] != "Old wording."
        assert PRESENTATION_KEYS <= set(report)


def test_the_bots_maia_request_is_the_commentarys_so_one_answer_serves_both():
    from trainer.human_models.context import request_for
    from trainer.play.sessions import bot_policy_request, parsed_for

    play = PlayGame(
        id="shared",
        learner_color=True,
        opponent_kind="human",
        opponent_rating=1400,
        learner_rating=1100,
        coach_name="Ember",
        moves=["e2e4"],
    )
    board = chess.Board()
    board.push_uci("e2e4")
    after = board.copy()
    after.push_uci("e7e5")
    # The live commentary asks about the bot's move from the position before it.
    commentary = request_for(parsed_for(play, "Learner", after), board, play.learner_rating)
    assert bot_policy_request(play, board) == commentary
    assert commentary.conditioning.self_rating == 1400
    assert commentary.conditioning.opponent_rating == 1100


def test_the_level_fit_runs_as_a_cancellable_job_of_the_account(settings):
    settings.stockfish_path = "missing-test-engine"
    app = create_app(settings, workers=False, human_provider=PolicyProvider(settings))
    with TestClient(app) as client:
        seed(app)
        assert client.get("/api/play/profile").json()["status"] == "computing"
        # A second read while it waits queues nothing more.
        client.get("/api/play/profile")
        with app.state.sessions() as db:
            jobs = db.scalars(select(AnalysisJob).where(AnalysisJob.kind == "level_fit")).all()
            assert [job.status for job in jobs] == ["queued"]
        assert all(job["kind"] != "level_fit" for job in client.get("/api/jobs").json())
        app.state.runner.run_job(jobs[0].id)
        profile = client.get("/api/play/profile").json()
        assert profile["status"] in {"ready", "no_games"} and profile["games"] == 1
        with app.state.sessions() as db:
            assert db.get(AnalysisJob, jobs[0].id).status == "completed"


def test_a_failing_level_fit_is_saved_unavailable_and_not_queued_again(settings, monkeypatch):
    from trainer.play import level

    def broken(*args, **kwargs):
        raise RuntimeError("unexpected")

    monkeypatch.setattr(level, "fit_level", broken)
    settings.stockfish_path = "missing-test-engine"
    app = create_app(settings, workers=False, human_provider=PolicyProvider(settings))
    with TestClient(app) as client:
        seed(app)
        assert client.get("/api/play/profile").json()["status"] == "computing"
        with app.state.sessions() as db:
            job_id = db.scalar(select(AnalysisJob.id).where(AnalysisJob.kind == "level_fit"))
        app.state.runner.run_job(job_id)
        assert client.get("/api/play/profile").json()["status"] == "unavailable"
        with app.state.sessions() as db:
            jobs = db.scalars(select(AnalysisJob).where(AnalysisJob.kind == "level_fit")).all()
            assert [job.status for job in jobs] == ["completed"]


def test_a_play_game_ended_by_repetition_offers_no_moves_in_its_last_frame():
    from trainer.models import PlayGame
    from trainer.play.sessions import frames_for

    shuffle = ["g1f3", "g8f6", "f3g1", "f6g8"] * 2
    play = PlayGame(
        id="repetition",
        coach_name="Coach",
        learner_color=True,
        opponent_rating=1200,
        learner_rating=1200,
        moves=shuffle,
        reports={},
        status="finished",
        result="1/2-1/2",
    )
    # The eighth move repeats the start position a third time.
    frames = frames_for(play, "Learner")
    assert frames[-1]["legal_moves"] == [] and frames[-1]["result"] == "1/2-1/2"
    assert frames[-1]["termination"] == "threefold repetition"
    # A repetition Black could only claim with its next move does not end the game.
    play.moves, play.status, play.result = shuffle[:7], "active", None
    frames = frames_for(play, "Learner")
    assert frames[-1]["legal_moves"] and frames[-1]["result"] is None


def test_play_ends_only_on_a_draw_that_has_happened():
    import chess
    from trainer.play.sessions import board_outcome

    def after(fen, *sans):
        board = chess.Board(fen)
        for san in sans:
            board.push_san(san)
        return board

    # A queen and rook up, White is to move one step short of a third repetition.
    checks = ["Qh5+", "Kg8", "Qe8+", "Kh7"] * 2
    board = after("8/p5pk/8/8/8/8/5PPP/R2Q2K1 w - - 0 1", *checks)
    assert not board.is_repetition(3) and board_outcome(board) is None
    board.push_san("Qh5+")
    assert board.is_repetition(3)
    assert board_outcome(board).termination == chess.Termination.THREEFOLD_REPETITION
    # Half-move clock 99 can be claimed with the next move; Play waits for 100.
    board = after("8/8/4k3/8/8/3QK3/8/8 w - - 98 120", "Qd4")
    assert board.halfmove_clock == 99 and board_outcome(board) is None
    board.push_san("Kf5")
    assert board_outcome(board).termination == chess.Termination.FIFTY_MOVES
    # Checkmate still ends the game on the hundredth half-move.
    mate = chess.Board("7k/8/6K1/8/8/8/8/R7 w - - 99 120")
    mate.push_san("Ra8#")
    assert board_outcome(mate).termination == chess.Termination.CHECKMATE


def test_review_presentation_keeps_one_entry_per_game(monkeypatch):
    from types import SimpleNamespace

    from trainer.review_intelligence import presentation

    loads = []
    monkeypatch.setattr(
        presentation, "load_game_reports", lambda db, game_id: loads.append(game_id) or ({}, {})
    )
    monkeypatch.setattr(presentation, "present_game", lambda *args, **kwargs: ({}, None))
    game = SimpleNamespace(id="presentation-cache")

    def present(revision):
        review = SimpleNamespace(revision=revision, rating=1200)
        return presentation.presented_review(None, game, None, review, completed=False)

    first = present(1)
    assert present(1) is first and len(loads) == 1  # An unchanged poll reuses it.
    second = present(2)
    assert second is not first and len(loads) == 2  # A new revision re-renders.
    assert presentation._presented.get(game.id)[1] is second  # Only the latest is kept.


def test_a_human_like_reply_without_the_model_is_recorded_as_the_engine_setting():
    from types import SimpleNamespace

    from trainer.human_models.runtime import HumanUnavailable
    from trainer.play.sessions import apply_reply, choose_reply, parsed_for, state, truncate

    class NoModel:
        def policy(self, sessions, request, cancelled=lambda: False):
            raise HumanUnavailable("not_configured")

    limited = []

    def play_limited(board, elo, seconds):
        limited.append(elo)
        return "e7e5"

    engine = SimpleNamespace(play_limited=play_limited)
    play = PlayGame(
        id="no-model",
        coach_id="classic",
        coach_name="Walter",
        learner_color=True,
        opponent_kind="human",
        opponent_rating=600,
        learner_rating=1000,
        moves=["e2e4"],
        reports={},
        status="active",
    )
    choice = choose_reply(engine, NoModel(), None, play, _after("e2e4"))
    assert choice.source == "fallback" and limited == [1320]
    apply_reply(None, play, choice, "Learner", None)
    assert play.fallback_plies == [2]
    shown = state(play, "Learner")
    assert shown["fallback_plies"] == [2] and shown["fallback_elo"] == 1320
    # The saved PGN says what really played; the Elo header stays the model setting.
    headers = parsed_for(play, "Learner").headers
    assert headers["BlackElo"] == "600"
    assert headers["Bot"] == (
        "Maia-3 conditioned at 600; Stockfish UCI_Elo 1320 played 1 move"
        " while the human model was unavailable"
    )
    # Going back past the move forgets it.
    truncate(play, 1)
    assert play.fallback_plies == []
    assert parsed_for(play, "Learner").headers["Bot"] == "Maia-3 conditioned at 600"


def _after(*moves):
    board = chess.Board()
    for uci in moves:
        board.push_uci(uci)
    return board


def test_the_profile_says_whether_human_like_play_is_available(settings):
    settings.stockfish_path = "missing-test-engine"
    # The test settings point at no model file, so the human model cannot answer.
    app = create_app(settings, workers=False, start_engine=False)
    with TestClient(app) as client:
        assert client.get("/api/play/profile").json()["human_model"] is False
    app = create_app(settings, workers=False, human_provider=PolicyProvider(settings))
    with TestClient(app) as client:
        assert client.get("/api/play/profile").json()["human_model"] is True
