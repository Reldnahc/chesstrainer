import secrets
import threading
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal
from urllib.parse import urlsplit

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from sqlalchemy import func, select

from trainer.chesscom import ChessComClient, ChessComRequest
from trainer.classification import reject_run
from trainer.config import Settings
from trainer.coverage import coverage
from trainer.curriculum import priorities
from trainer.db import database, migrate
from trainer.engine import EngineUnavailable, Stockfish
from trainer.exercises import manual_exercise
from trainer.explanations import MoveExplanation, explain_review
from trainer.imports import import_games
from trainer.jobs import JobRunner
from trainer.local_classifier import LocalClassifier
from trainer.models import (
    AnalysisJob,
    ChessComImport,
    ClassificationRun,
    ClassificationTask,
    Decision,
    EngineAnalysis,
    Exercise,
    Review,
    ReviewSession,
    SkillEvidence,
    TeachingRun,
)
from trainer.practice import focus_queue
from trainer.retirement import retire_existing
from trainer.reviews import queue, reveal, start_review, submit_move
from trainer.scheduling import FSRSScheduler
from trainer.taxonomy import seed_skills


class MoveRequest(BaseModel):
    from_square: str = Field(pattern="^[a-h][1-8]$")
    to_square: str = Field(pattern="^[a-h][1-8]$")
    promotion: Literal["q", "r", "b", "n"] | None = None


class ManualRequest(BaseModel):
    fen: str = Field(max_length=200)
    moves: list[str] = Field(min_length=1, max_length=100)
    orientation: Literal["white", "black"] = "white"
    explanation: str = Field(default="", max_length=5000)
    tags: list[str] = Field(default_factory=list, max_length=20)


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
    # Serialize domain mutations across review/course/import boundaries; network calls
    # release this lock, and reentrancy permits composed course operations.
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

    @app.middleware("http")
    async def local_access(request: Request, call_next):
        if request.url.path.startswith("/api/"):
            token = settings.lan_access_token.get_secret_value()
            if token and not secrets.compare_digest(
                request.headers.get("authorization", ""), f"Bearer {token}"
            ):
                return JSONResponse(
                    {"detail": "Enter the configured LAN access token."}, status_code=401
                )
            origin = request.headers.get("origin")
            if request.method not in {"GET", "HEAD", "OPTIONS"} and origin:
                if urlsplit(origin).netloc != request.headers.get("host"):
                    return JSONResponse(
                        {"detail": "Cross-origin writes are disabled."}, status_code=403
                    )
        response = await call_next(request)
        if request.url.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response

    @app.exception_handler(ValueError)
    async def invalid_input(request, exc):
        return JSONResponse({"detail": str(exc)}, status_code=422)

    @app.exception_handler(EngineUnavailable)
    async def unavailable_engine(request, exc):
        return JSONResponse({"detail": str(exc)}, status_code=503)

    @app.get("/api/health")
    def get_health():
        return {"database": "ready", **health, "classification_available": classifier is not None}

    @app.get("/api/settings")
    def get_settings():
        with sessions() as db:
            return (
                settings.public()
                | health
                | {
                    "classification_available": classifier is not None,
                    "coverage": coverage(db),
                    "classification_provider": "local_rules",
                    "classification_version": classifier.version
                    if hasattr(classifier, "version")
                    else "test",
                    "classification_runs": db.scalar(
                        select(func.count())
                        .select_from(ClassificationRun)
                        .where(ClassificationRun.provider == "local_rules")
                    ),
                    "classification_failed": db.scalar(
                        select(func.count())
                        .select_from(ClassificationRun)
                        .where(
                            ClassificationRun.provider == "local_rules",
                            ClassificationRun.status == "failed",
                        )
                    ),
                    "classification_rejected": db.scalar(
                        select(func.count())
                        .select_from(ClassificationRun)
                        .where(
                            ClassificationRun.provider == "local_rules",
                            ClassificationRun.status == "rejected",
                        )
                    ),
                    "classification_abstained": db.scalar(
                        select(func.count())
                        .select_from(ClassificationRun)
                        .where(
                            ClassificationRun.provider == "local_rules",
                            ClassificationRun.status == "completed",
                            ClassificationRun.confidence == 0,
                        )
                    ),
                }
            )

    async def read_pgn(file):
        content = await file.read(settings.max_import_bytes + 1)
        await file.close()
        if len(content) > settings.max_import_bytes:
            raise HTTPException(413, "PGN exceeds configured MAX_IMPORT_BYTES")
        try:
            return content.decode("utf-8-sig")
        except UnicodeDecodeError:
            raise HTTPException(422, "Save PGN as UTF-8 before importing")

    @app.post("/api/imports")
    async def upload_pgn(
        file: UploadFile = File(...),
        usernames: str = Form(""),
        side: Literal["auto", "white", "black"] = Form("auto"),
    ):
        pgn = await read_pgn(file)
        with mutation_lock, sessions() as db:
            return import_games(
                db,
                Path(file.filename or "games.pgn").name,
                pgn,
                usernames.split(","),
                None if side == "auto" else side,
            )

    @app.post("/api/imports/chesscom", status_code=202)
    def import_chesscom(data: ChessComRequest):
        with mutation_lock, sessions() as db:
            existing = db.scalar(
                select(AnalysisJob)
                .join(ChessComImport)
                .where(
                    AnalysisJob.status.in_(["queued", "running"]),
                    ChessComImport.username == data.username,
                    ChessComImport.time_class == data.time_class,
                    ChessComImport.months == data.months,
                    ChessComImport.max_games == data.max_games,
                    ChessComImport.start_date == data.start_date,
                    ChessComImport.end_date == data.end_date,
                )
            )
            if existing:
                return {"job_id": existing.id, "status": existing.status}
            job = AnalysisJob(kind="chesscom")
            db.add(job)
            db.flush()
            db.add(ChessComImport(job_id=job.id, **data.model_dump()))
            db.commit()
            return {"job_id": job.id, "status": job.status}

    @app.get("/api/jobs")
    def jobs():
        with sessions() as db:
            rows = db.scalars(
                select(AnalysisJob).order_by(AnalysisJob.created_at.desc()).limit(50)
            ).all()
            sources = {
                source.job_id: source
                for source in db.scalars(
                    select(ChessComImport).where(
                        ChessComImport.job_id.in_([row.id for row in rows])
                    )
                )
            }
            return [
                {c.name: getattr(row, c.name) for c in AnalysisJob.__table__.columns}
                | {
                    "probe_total": db.scalar(
                        select(func.count())
                        .select_from(ClassificationTask)
                        .where(ClassificationTask.job_id == row.id)
                    )
                    if row.kind == "enrichment"
                    else None,
                    "activity": runner.activity(row.id),
                    "chesscom": {
                        c.name: getattr(sources[row.id], c.name)
                        for c in ChessComImport.__table__.columns
                    }
                    if row.id in sources
                    else None,
                }
                for row in rows
            ]

    @app.post("/api/jobs/{job_id}/cancel")
    def cancel_job(job_id: str):
        with sessions() as db:
            job = db.get(AnalysisJob, job_id)
            if job is None:
                raise HTTPException(404, "Job not found")
            if job.status in {"queued", "running"}:
                job.cancel_requested = True
                if job.status == "queued":
                    job.status = "cancelled"
                db.commit()
            return {"status": job.status}

    @app.post("/api/jobs/{job_id}/retry")
    def retry_job(job_id: str):
        with sessions() as db:
            job = db.get(AnalysisJob, job_id)
            if job is None:
                raise HTTPException(404, "Job not found")
            if job.kind == "teaching":
                raise HTTPException(410, "Model teaching generation has been removed.")
            if job.status not in {"failed", "cancelled"}:
                raise HTTPException(409, "Only failed or cancelled jobs can be retried")
            job.status, job.cancel_requested, job.error = "queued", False, None
            db.commit()
            return {"status": job.status}

    @app.post("/api/classifications/retry")
    def retry_classifications():
        with mutation_lock, sessions() as db:
            existing = db.scalar(
                select(AnalysisJob).where(
                    AnalysisJob.kind == "classification",
                    AnalysisJob.status.in_(["queued", "running"]),
                )
            )
            if existing:
                return {"job_id": existing.id}
            job = AnalysisJob(kind="classification")
            db.add(job)
            db.commit()
            return {"job_id": job.id}

    @app.get("/api/review/queue")
    def review_queue(last_id: str | None = None):
        with sessions() as db:
            return queue(db, last_id)

    @app.post("/api/classifications/enrich", status_code=202)
    def enrich_classifications():
        with mutation_lock, sessions() as db:
            existing = db.scalar(
                select(AnalysisJob).where(
                    AnalysisJob.kind == "enrichment",
                    AnalysisJob.status.in_(["queued", "running"]),
                )
            )
            if existing:
                return {"job_id": existing.id}
            engine.start()
            job = AnalysisJob(kind="enrichment")
            db.add(job)
            db.commit()
            return {"job_id": job.id}

    @app.get("/api/practice/queue")
    def focused_queue(skill_id: str):
        with sessions() as db:
            return focus_queue(db, skill_id)

    def require_review_exercise(db, exercise_id):
        exercise = db.get(Exercise, exercise_id)
        if exercise is not None and exercise.source == "repertoire":
            raise HTTPException(
                410, "This repertoire position is archived. Review your game mistakes instead."
            )

    @app.post("/api/review/{exercise_id}/start")
    def begin_review(exercise_id: str, focus_skill_id: str | None = None):
        with review_lock, sessions() as db:
            require_review_exercise(db, exercise_id)
            return start_review(db, exercise_id, focus_skill_id=focus_skill_id)

    def require_review_session(db, session_id):
        session = db.get(ReviewSession, session_id)
        if session is not None:
            require_review_exercise(db, session.exercise_id)
        if session is not None and session.lesson_item_id is not None:
            raise HTTPException(410, "This lesson attempt is archived. Start a position in Review.")

    @app.post("/api/review/sessions/{session_id}/move")
    def move(session_id: str, data: MoveRequest):
        with review_lock, sessions() as db:
            require_review_session(db, session_id)
            return submit_move(
                db,
                session_id,
                data.from_square + data.to_square + (data.promotion or ""),
                engine,
                scheduler,
                settings,
            )

    @app.post("/api/review/sessions/{session_id}/reveal")
    def show_move(session_id: str):
        with review_lock, sessions() as db:
            require_review_session(db, session_id)
            return reveal(db, session_id, scheduler, settings)

    @app.get("/api/review/sessions/{session_id}/explanation", response_model=MoveExplanation)
    def review_explanation(session_id: str, attempt_id: str | None = None, solution: bool = False):
        with review_lock, sessions() as db:
            return explain_review(db, session_id, attempt_id, solution)

    @app.get("/api/weaknesses")
    def weaknesses():
        with sessions() as db:
            return {
                "skills": priorities(db, settings),
                "coverage": coverage(db),
                "unclassified": db.scalar(
                    select(func.count())
                    .select_from(Decision)
                    .where(
                        Decision.meaningful.is_(True),
                        ~Decision.id.in_(
                            select(SkillEvidence.decision_id).where(SkillEvidence.active.is_(True))
                        ),
                    )
                ),
                "classification_available": classifier is not None,
            }

    @app.get("/api/evidence/{decision_id}")
    def evidence(decision_id: str):
        with sessions() as db:
            decision = db.get(Decision, decision_id)
            if decision is None:
                raise HTTPException(404, "Decision not found")
            rows = db.scalars(
                select(SkillEvidence).where(
                    SkillEvidence.decision_id == decision_id, SkillEvidence.active.is_(True)
                )
            ).all()
            return {
                "id": decision.id,
                "fen": decision.fen,
                "ply": decision.ply,
                "played_san": decision.move_san,
                "loss_cp": decision.loss_cp,
                "mate_lost": decision.mate_lost,
                "allows_mate": decision.allows_mate,
                "facts": decision.facts,
                "candidates": db.get(EngineAnalysis, decision.before_analysis_id).candidates,
                "classifications": [
                    {
                        "skill": e.skill_id,
                        "explanation": e.explanation,
                        "confidence": e.confidence,
                        "run_id": e.classification_run_id,
                        "provider": db.get(ClassificationRun, e.classification_run_id).provider,
                        "findings": [
                            f
                            for f in (
                                db.get(ClassificationRun, e.classification_run_id).response or {}
                            ).get("findings", [])
                            if f["skill_id"] == e.skill_id
                        ],
                    }
                    for e in rows
                ],
            }

    @app.get("/api/classification-runs/{run_id}")
    def classification_run(run_id: str):
        with sessions() as db:
            run = db.get(ClassificationRun, run_id)
            if run is None:
                raise HTTPException(404, "Classification run not found")
            return {c.name: getattr(run, c.name) for c in ClassificationRun.__table__.columns}

    @app.get("/api/course", include_in_schema=False)
    @app.get("/api/course/revisions", include_in_schema=False)
    @app.post("/api/course/rebuild", include_in_schema=False)
    @app.post("/api/lessons/{lesson_id}/complete", include_in_schema=False)
    @app.post("/api/course/units/{unit_id}/next", include_in_schema=False)
    @app.post("/api/course/units/{unit_id}/extend", include_in_schema=False)
    @app.post("/api/lesson-items/{item_id}/acknowledge", include_in_schema=False)
    def archived_lessons():
        raise HTTPException(
            410, "Lessons have been removed. Use Review. Saved history is preserved."
        )

    @app.post("/api/classification-runs/{run_id}/reject")
    def reject_classification(run_id: str):
        with mutation_lock, runner.course_lock, sessions() as db:
            result = reject_run(db, run_id)
            return result

    @app.post("/api/course/teaching")
    def generate_lesson_teaching():
        raise HTTPException(
            410, "Model teaching generation has been removed. Saved lesson history is preserved."
        )

    @app.get("/api/teaching-runs/{run_id}")
    def teaching_audit(run_id: str):
        with sessions() as db:
            run = db.get(TeachingRun, run_id)
            if run is None:
                raise HTTPException(404, "Teaching run not found")
            return {
                column.name: getattr(run, column.name) for column in TeachingRun.__table__.columns
            }

    @app.post("/api/teaching-runs/{run_id}/reject")
    def reject_teaching(run_id: str):
        with mutation_lock, sessions() as db:
            run = db.get(TeachingRun, run_id)
            if run is None:
                raise HTTPException(404, "Teaching run not found")
            run.status = "rejected"
            db.commit()
            return {"rejected": True}

    @app.post("/api/exercises/manual")
    def add_manual(data: ManualRequest):
        with mutation_lock, sessions() as db:
            exercise = manual_exercise(db, scheduler, **data.model_dump())
            return {"id": exercise.id}

    @app.get("/api/repertoires", include_in_schema=False)
    @app.post("/api/repertoires", include_in_schema=False)
    def archived_repertoires():
        raise HTTPException(
            410, "Repertoire training has been removed. Saved history is preserved."
        )

    @app.get("/api/stats")
    def stats():
        with sessions() as db:
            return {
                "exercises": db.scalar(select(func.count()).select_from(Exercise)),
                "reviews": db.scalar(select(func.count()).select_from(Review)),
            }

    dist = Path(__file__).resolve().parents[2] / "frontend" / "dist"
    if dist.exists():
        app.mount("/assets", StaticFiles(directory=dist / "assets"), name="assets")

        @app.get("/{path:path}")
        def frontend(path: str):
            if path.startswith("api/"):
                raise HTTPException(404, "API endpoint not found")
            return FileResponse(dist / "index.html")

    return app
