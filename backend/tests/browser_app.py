"""Playwright-only app: real backend/Stockfish with deterministic public HTTP fixtures."""

import json
import re
from datetime import datetime, timezone

import httpx
from puzzle_fixtures import BrowserGamePuzzleProvider, BrowserPuzzleProvider
from study_lesson_fixtures import BrowserLessonProvider
from trainer.api import create_app as production_app
from trainer.chesscom import ChessComClient
from trainer.config import Settings
from trainer.game_providers.lichess import LichessClient
from trainer.study_lessons.bundled import bundled_providers
from trainer.workspaces import CurrentWorkspace

# Test servers run as they do on CI, whatever a developer's .env tunes for real use:
# a dozen parallel servers each taking that machine-sized engine pool, or loading an
# installed Maia model CI never has, starve one another and time tests out.
CI_DEFAULTS = (
    "engine_slots",
    "stockfish_workers",
    "stockfish_threads",
    "stockfish_hash_mb",
    "classification_workers",
)


def ci_settings():
    defaults = {name: Settings.model_fields[name].default for name in CI_DEFAULTS}
    return Settings(**defaults, human_model_path="data/models/not-installed-in-tests.pt")


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

    def lichess_factory(settings):
        def handler(request):
            username = request.url.path.rsplit("/", 1)[-1]
            if username == "missing-player":
                return httpx.Response(404)
            date = datetime.now(timezone.utc)
            pgn = f'[Site "https://lichess.org/abcd1234"]\n[White "{username}"]\n[Black "LichessOpponent"]\n[Date "{date:%Y.%m.%d}"]\n[TimeControl "180+2"]\n\n1. f3 e5 2. g4 Qh4# 0-1'
            return httpx.Response(
                200,
                content=json.dumps(
                    {
                        "id": "abcd1234",
                        "pgn": pgn,
                        "variant": "standard",
                        "speed": "blitz",
                        "status": "mate",
                        "lastMoveAt": int(date.timestamp() * 1000),
                        "players": {
                            "white": {"user": {"name": username}},
                            "black": {"user": {"name": "LichessOpponent"}},
                        },
                    }
                )
                + "\n",
            )

        return LichessClient(settings, transport=httpx.MockTransport(handler))

    puzzle_provider = BrowserPuzzleProvider()
    game_puzzle_provider = BrowserGamePuzzleProvider()
    lesson_provider = BrowserLessonProvider()
    app = production_app(
        ci_settings(),
        chesscom_factory=factory,
        provider_factories={"lichess": lichess_factory},
        puzzle_providers=(puzzle_provider, game_puzzle_provider),
        lesson_providers=(*bundled_providers(), lesson_provider),
    )

    # POST, like the other fixtures: the SPA fallback owns every unmatched GET.
    @app.post("/__test/active-jobs")
    def active_jobs(workspace: CurrentWorkspace):
        """Every queued or running job, including per-game reviews that /api/jobs omits."""
        from sqlalchemy import func, select
        from trainer.models import AnalysisJob

        with workspace.sessions() as db:
            return {
                "active": db.scalar(
                    select(func.count())
                    .select_from(AnalysisJob)
                    .where(AnalysisJob.status.in_(("queued", "running")))
                )
            }

    @app.post("/__test/lesson-fixture/{key}")
    def lesson_fixture(workspace: CurrentWorkspace, key: str):
        from trainer.contracts.study_lessons import LessonStart
        from trainer.study_lessons.providers import CourseProviders
        from trainer.study_lessons.sessions import start_session

        with workspace.mutation_lock, workspace.sessions() as db:
            course = lesson_provider.install(workspace.user_id, key)
            session = start_session(
                db,
                CourseProviders((lesson_provider,)),
                LessonStart(
                    course_id=course.id,
                    course_revision=course.revision,
                    chapter_id="connected",
                    request_id=f"lesson-fixture-{key}",
                ),
            )
            return {
                "session_id": session["id"],
                "course_id": course.id,
                "revision": course.revision,
                "chapter_id": "connected",
            }

    @app.post("/__test/puzzle-fixture/{key}")
    @app.post("/api/__test/puzzle-fixture/{key}")
    def puzzle_fixture(workspace: CurrentWorkspace, key: str):
        from trainer.contracts.puzzles import PuzzleStart
        from trainer.puzzles.providers import PuzzleProviders
        from trainer.puzzles.sessions import start_session

        provider = game_puzzle_provider if key.startswith("games-") else puzzle_provider
        with workspace.mutation_lock, workspace.sessions() as db:
            definition = provider.install(workspace.user_id, key)
            session = start_session(
                db,
                PuzzleProviders((provider,)),
                PuzzleStart(
                    provider_id=provider.id,
                    key=key,
                    version=definition.version,
                    request_id=f"fixture-{key}",
                ),
            )
            return {"session_id": session["id"], "key": key, "source": definition.source}

    @app.post("/__test/opening-recall-fixture/{key}")
    def opening_recall_fixture(workspace: CurrentWorkspace, key: str):
        import chess
        from sqlalchemy import select
        from trainer.contracts.opening_studies import OpeningEnrollment
        from trainer.models import OpeningStudyMove
        from trainer.opening_studies import service, sources
        from trainer.reviews import start_review
        from trainer.scheduling import FSRSScheduler
        from trainer.study_lessons.content import CourseDefinition
        from trainer.study_lessons.providers import CourseProviders

        with workspace.mutation_lock, workspace.sessions() as db:
            course = lesson_provider.install(workspace.user_id, f"recall-{key}")
            record = course.model_dump(mode="json")
            board = chess.Board()
            board.push_uci("e2e4")
            board.push_uci("e7e5")
            # Distinct from real catalogue cards in the shared disposable browser
            # account. Tests disable their studies after each scenario.
            board.castling_rights = 0
            record["lines"].extend(
                {
                    "id": line_id,
                    "title": title,
                    "position": {"initial_fen": board.fen()},
                    "moves": [move],
                    "repertoire": True,
                }
                for line_id, title, move in (
                    ("queenside", "Queenside knight", "b1c3"),
                    ("kingside", "Kingside knight", "g1f3"),
                )
            )
            lesson_provider._accounts[workspace.user_id][course.id] = (
                CourseDefinition.model_validate(record)
            )
            providers = CourseProviders((lesson_provider,))
            studies = [
                service.enroll_line(
                    db,
                    providers,
                    OpeningEnrollment(
                        source="course_line",
                        source_key=sources.course_key(course.id, line_id),
                        source_version=course.revision,
                        course_id=course.id,
                        line_id=line_id,
                        color="white",
                    ),
                    FSRSScheduler(app.state.settings),
                )
                for line_id in ("queenside", "kingside")
            ]
            exercise_id = db.scalar(
                select(OpeningStudyMove.exercise_id).where(
                    OpeningStudyMove.study_id == studies[0]["id"]
                )
            )
            session = start_review(db, exercise_id)
            return {
                "exercise_id": exercise_id,
                "session_id": session["session_id"],
                "study_ids": [study["id"] for study in studies],
                "names": [study["name"] for study in studies],
                "accepted_moves": ["b1c3", "g1f3"],
                "wrong": "d2d4",
            }

    @app.post("/__test/game-review-fixture/{key}")
    def game_review_fixture(key: str):
        from sqlalchemy import select
        from trainer.imports import import_games
        from trainer.models import Game

        with app.state.sessions() as db:
            white = f"Review-{key}"
            # Keep the tactical regression outside the opening catalogue. With
            # normal castling rights, this entire Fool's Mate line is Book.
            pgn = (
                f'[White "{white}"]\n[Black "CoachFixture"]\n[SetUp "1"]\n'
                '[FEN "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1"]\n\n'
                "1. f3 e5 2. g4 Qh4# 0-1"
            )
            import_games(db, "review-fixture.pgn", pgn, [white], None, queue_analysis=False)
            return {"id": db.scalar(select(Game.id).where(Game.white == white))}

    @app.post("/__test/book-review-fixture/{key}")
    def book_review_fixture(key: str):
        from sqlalchemy import select
        from trainer.imports import import_games
        from trainer.models import Game

        with app.state.sessions() as db:
            white = f"Book-{key}"
            pgn = f'[White "{white}"]\n[Black "OpeningFixture"]\n\n1. e4 e5 2. Ke2 Nc6 0-1'
            import_games(db, "book-fixture.pgn", pgn, [white], None, queue_analysis=False)
            return {"id": db.scalar(select(Game.id).where(Game.white == white))}

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
