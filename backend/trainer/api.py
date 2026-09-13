"""Application composition and lifecycle; endpoint groups live in trainer.routes."""

import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI

from trainer.chesscom import ChessComClient
from trainer.config import Settings
from trainer.db import database, migrate
from trainer.engine import EngineUnavailable, Stockfish
from trainer.jobs import JobRunner
from trainer.local_classifier import LocalClassifier
from trainer.retirement import retire_existing
from trainer.routes import classification, compatibility, imports, jobs, review, workspace
from trainer.routes.compatibility import ManualRequest as ManualRequest
from trainer.routes.review import MoveRequest as MoveRequest
from trainer.scheduling import FSRSScheduler
from trainer.taxonomy import seed_skills
from trainer.web import configure_http, serve_frontend


def create_app(
    settings=None,
    *,
    classifier=None,
    workers=True,
    engine_factory=Stockfish,
    chesscom_factory=ChessComClient,
):
    settings = settings or Settings()
    sql_engine, sessions = database(settings.database_path)
    scheduler = FSRSScheduler(settings)
    classifier = classifier if classifier is not None else LocalClassifier(settings)
    engine = engine_factory(settings, sessions)
    # Share the existing reentrant mutation lock across endpoint groups and jobs.
    # Network work releases it; composed compatibility operations can reacquire it.
    mutation_lock = threading.RLock()
    review_lock = mutation_lock
    runner = JobRunner(
        settings,
        sessions,
        scheduler,
        classifier,
        engine_factory,
        chesscom_factory=chesscom_factory,
        import_lock=mutation_lock,
    )
    health = {"engine_available": False, "engine_error": None, "engine_version": None}

    @asynccontextmanager
    async def lifespan(app):
        migrate(sql_engine)
        with sessions() as db:
            seed_skills(db)
            retire_existing(db, settings)
        try:
            engine.start()
            health.update(engine_available=True, engine_error=None, engine_version=engine.version)
        except EngineUnavailable as exc:
            health.update(engine_available=False, engine_error=str(exc))
        if workers:
            runner.start()
        yield
        runner.stop()
        engine.close()
        sql_engine.dispose()

    app = FastAPI(title="Local Chess Trainer", lifespan=lifespan)
    app.state.sessions, app.state.runner, app.state.settings = sessions, runner, settings

    configure_http(app, settings)
    app.include_router(
        workspace.create_router(
            settings=settings, sessions=sessions, health=health, classifier=classifier
        )
    )
    app.include_router(
        imports.create_router(settings=settings, sessions=sessions, mutation_lock=mutation_lock)
    )
    app.include_router(jobs.create_router(sessions=sessions, runner=runner))
    app.include_router(
        review.create_router(
            settings=settings,
            sessions=sessions,
            engine=engine,
            scheduler=scheduler,
            review_lock=review_lock,
        )
    )
    app.include_router(
        classification.create_router(
            settings=settings,
            sessions=sessions,
            engine=engine,
            classifier=classifier,
            runner=runner,
            mutation_lock=mutation_lock,
        )
    )
    app.include_router(
        compatibility.create_router(
            sessions=sessions, scheduler=scheduler, mutation_lock=mutation_lock
        )
    )
    serve_frontend(app)
    return app
