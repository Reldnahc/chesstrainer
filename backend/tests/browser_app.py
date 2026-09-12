"""Playwright-only app: real backend/Stockfish with deterministic public HTTP fixtures."""

import re
from datetime import datetime, timezone

import httpx
from trainer.api import create_app as production_app
from trainer.chesscom import ChessComClient


def create_app():
    def factory(settings):
        def handler(request):
            match = re.fullmatch(
                r"/pub/player/([a-z0-9_-]+)/games/(archives|[0-9]{4}/[0-9]{2})", request.url.path
            )
            if not match or match[1] == "missing-player":
                return httpx.Response(404)
            username = match[1]
            date = datetime.now(timezone.utc)
            if match[2] == "archives":
                return httpx.Response(
                    200,
                    json={
                        "archives": [
                            f"https://api.chess.com/pub/player/{username}/games/{date:%Y/%m}"
                        ]
                    },
                )
            pgn = f'[White "{username}"]\n[Black "FixtureOpponent"]\n[Date "{date:%Y.%m.%d}"]\n\n1. f3 e5 2. g4 Qh4# 0-1'
            return httpx.Response(
                200,
                json={
                    "games": [
                        {
                            "pgn": pgn,
                            "rules": "chess",
                            "time_class": "rapid",
                            "end_time": int(date.timestamp()),
                            "white": {"username": username},
                            "black": {"username": "FixtureOpponent"},
                        }
                    ]
                },
            )

        return ChessComClient(settings, transport=httpx.MockTransport(handler))

    app = production_app(chesscom_factory=factory)

    @app.post("/__test/review-explanation-fixture/{key}")
    def explanation_fixture(key: str):
        from explanation_fixtures import seed_review

        with app.state.sessions() as db:
            return seed_review(db, app.state.settings, key=key)

    @app.post("/__test/classified-fixture/{key}")
    def classified_fixture(key: str):
        from test_focused_practice import seed_classified

        with app.state.sessions() as db:
            return seed_classified(db, app.state.settings, key=key)

    return app
