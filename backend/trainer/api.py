"""Application composition and lifecycle; endpoint groups live in trainer.routes."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from sqlalchemy.orm import sessionmaker

from trainer.chesscom import ChessComClient
from trainer.config import Settings
from trainer.contracts.accounts import Identity
from trainer.db import database, migrate
from trainer.engine import EngineUnavailable, Stockfish
from trainer.engine_health import EngineHealth
from trainer.engine_pool import EnginePool
from trainer.human_models.service import HumanModels
from trainer.jobs import JobRunner
from trainer.local_classifier import LocalClassifier
from trainer.multiuser import configure_accounts
from trainer.puzzles.packs import production_providers
from trainer.puzzles.providers import PuzzleProviders
from trainer.retirement import retire_existing
from trainer.routes import (
    classification,
    compatibility,
    games,
    imports,
    insights,
    jobs,
    opening_studies,
    play,
    puzzles,
    review,
    study_lessons,
    sync,
    workspace,
)
from trainer.routes.compatibility import ManualRequest as ManualRequest
from trainer.routes.review import MoveRequest as MoveRequest
from trainer.scheduling import FSRSScheduler
from trainer.study_lessons.bundled import bundled_providers
from trainer.study_lessons.providers import CourseProviders
from trainer.taxonomy import seed_skills
from trainer.web import configure_http, serve_frontend
from trainer.workspaces import Workspaces


def create_app(
    settings=None,
    *,
    classifier=None,
    workers=True,
    engine_factory=Stockfish,
    chesscom_factory=ChessComClient,
    start_engine=True,
    human_provider=None,
    provider_factories=None,
    puzzle_providers=None,
    lesson_providers=None,
):
    settings = (settings or Settings()).for_runtime()
    if puzzle_providers is None:
        puzzle_providers = production_providers(settings)
    courses = CourseProviders(bundled_providers() if lesson_providers is None else lesson_providers)
    sql_engine, sessions = database(settings.database_path)
    health = EngineHealth()
    engine_factory = health.observe(engine_factory)
    pool = EnginePool(engine_factory, settings.engine_slots) if settings.accounts_enabled else None
    engine_factory = pool.handle if pool else engine_factory
    engine = engine_factory(settings, sessions)
    scheduler = FSRSScheduler(settings)
    classifier = classifier if classifier is not None else LocalClassifier(settings)
    human_models = HumanModels(settings, human_provider)
    workspaces = Workspaces(
        sql_engine,
        settings,
        engine_factory,
        local_engine=None if pool else engine,
        human_models=human_models,
    )
    runner = JobRunner(
        settings,
        sessions,
        scheduler,
        classifier,
        engine_factory,
        chesscom_factory=chesscom_factory,
        provider_factories=provider_factories,
        workspaces=workspaces,
    )

    @asynccontextmanager
    async def lifespan(app):
        try:
            migrate(sql_engine)
            # Startup maintenance runs once for the database. Administrative
            # sessions never reach HTTP handlers or job execution.
            maintenance = sessionmaker(sql_engine) if settings.accounts_enabled else sessions
            with maintenance() as db:
                seed_skills(db)
                retire_existing(db, settings, enabled_accounts_only=settings.accounts_enabled)
            try:
                if start_engine and not pool:
                    engine.start()
            except EngineUnavailable:
                pass  # The observer records availability and the server-side exception.
            if workers:
                runner.start()
            yield
        finally:
            runner.stop()
            human_models.close()
            engine.close()
            if pool:
                pool.close()
            sql_engine.dispose()

    app = FastAPI(title="Fieldwork accounts" if pool else "Local Chess Trainer", lifespan=lifespan)
    app.state.sessions, app.state.runner, app.state.settings = sessions, runner, settings
    app.state.workspaces = workspaces
    app.state.human_models = human_models
    configure_http(app, settings)
    if settings.accounts_enabled:
        configure_accounts(app, settings)
    else:

        @app.get(
            "/api/auth/me",
            response_model=Identity,
            response_model_exclude_unset=True,
            operation_id="get_identity",
            summary="Identity",
        )
        def local_identity():
            return {"enabled": False, "user": None}

    app.include_router(
        workspace.create_router(settings=settings, health=health, classifier=classifier)
    )
    app.include_router(imports.create_router(settings=settings))
    app.include_router(jobs.create_router(runner=runner))
    app.include_router(sync.create_router())
    app.include_router(games.create_router(settings=settings, engine_factory=engine_factory))
    app.include_router(insights.create_router())
    app.include_router(review.create_router(settings=settings, scheduler=scheduler))
    app.include_router(play.create_router(settings=settings))
    app.state.puzzle_providers = PuzzleProviders(puzzle_providers)
    app.include_router(
        puzzles.create_router(providers=app.state.puzzle_providers, settings=settings)
    )
    app.include_router(study_lessons.create_router(providers=courses))
    app.include_router(opening_studies.create_router(providers=courses, scheduler=scheduler))
    app.include_router(classification.create_router(settings=settings, classifier=classifier))
    app.include_router(compatibility.create_router(scheduler=scheduler))
    serve_frontend(app)
    return app
