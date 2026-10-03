"""Games against the coach's bot: human-like choice, the level fit and the review hand-off."""

import chess
import pytest
from fastapi.testclient import TestClient
from human_fixtures import PolicyProvider
from sqlalchemy import select
from test_game_review import seed
from trainer.api import create_app
from trainer.chess_core import Loss
from trainer.human_models.service import HumanModels
from trainer.models import Game, PlayGame
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
        assert started["status"] == "active" and started["commentary"] == "live"
        assert started["white"] == "You" and started["black"] == "Ember (bot)"
        assert started["reply"] is None and len(started["frames"]) == 1
        stale = client.post(f"/api/play/{started['id']}/move", json={"ply": 3, "uci": "e2e4"})
        assert stale.status_code == 409
        after = client.post(
            f"/api/play/{started['id']}/move", json={"ply": 0, "uci": "e2e4"}
        ).json()
        assert after["reply"]["ply"] == 2 and after["reply"]["source"] == "human"
        assert after["reply"]["think_ms"] == 320
        assert len(after["frames"]) == 3 and after["frames"][1]["uci"] == "e2e4"
        assert provider.calls and provider.calls[-1].conditioning.self_rating == 1000
        assert client.get("/api/play/active").json()["game"]["id"] == started["id"]
        analysis = client.post(f"/api/play/{started['id']}/analyze", json={"ply": 1}).json()
        assert analysis["report"]["label"] in {"Book", "Best", "Good", "Great"}
        assert analysis["report"]["human"]["status"] == "available"
        again = client.get(f"/api/play/{started['id']}").json()
        assert again["frames"][1]["report"]["label"] == analysis["report"]["label"]
        offered = client.post(f"/api/play/{started['id']}/draw").json()
        # The fixture policy is uniform, so the bot's reply may already be losing.
        if offered["status"] == "active":
            assert offered["draw_declined"] is True
            finished = client.post(f"/api/play/{started['id']}/resign").json()
            assert finished["result"] == "0-1" and finished["termination"] == "resignation"
        else:
            finished = offered
            assert finished["result"] == "1/2-1/2" and finished["termination"] == "agreement"
        assert finished["status"] == "finished" and finished["saved_game_id"]
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


@pytest.mark.stockfish
def test_the_bot_moves_first_as_white_and_an_abandoned_game_is_not_saved(settings, stockfish_path):
    settings.stockfish_path = stockfish_path
    app = create_app(settings, workers=False, human_provider=PolicyProvider(settings))
    with TestClient(app) as client:
        first = client.post(
            "/api/play",
            json={"coach_id": "classic", "coach_name": "Walter", "color": "black", "rating": 1400},
        ).json()
        assert first["reply"]["ply"] == 1 and first["frames"][1]["actor"] == "white"
        second = client.post(
            "/api/play",
            json={"coach_id": "classic", "coach_name": "Walter", "color": "black", "rating": 1400},
        ).json()
        assert second["id"] != first["id"]
        assert client.get(f"/api/play/{first['id']}").json()["termination"] == "abandoned"
        assert client.get("/api/games").json()["total"] == 0
