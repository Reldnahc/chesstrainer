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
from trainer.config import Settings
from trainer.curriculum import build_course, priorities
from trainer.db import database, migrate
from trainer.engine import EngineUnavailable, Stockfish
from trainer.exercises import import_repertoire, manual_exercise
from trainer.imports import import_games
from trainer.jobs import JobRunner
from trainer.models import (
    AnalysisJob,
    ChessComImport,
    Course,
    CourseUnit,
    Decision,
    EngineAnalysis,
    Exercise,
    Lesson,
    LLMRun,
    Repertoire,
    Review,
    SkillEvidence,
    UnitEvidence,
)
from trainer.pedagogy import OpenAIClassifier
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
    if classifier is None and settings.llm_enabled and settings.openai_api_key.get_secret_value():
        classifier = OpenAIClassifier(settings)
    engine = engine_factory(settings, sessions)
    review_lock = threading.Lock()
    mutation_lock = threading.Lock()
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
                    "llm_runs": db.scalar(select(func.count()).select_from(LLMRun)),
                    "llm_attempts": db.scalar(select(func.coalesce(func.sum(LLMRun.attempts), 0))),
                    "llm_failed": db.scalar(
                        select(func.count()).select_from(LLMRun).where(LLMRun.status == "failed")
                    ),
                    "llm_input_tokens": db.scalar(
                        select(func.coalesce(func.sum(LLMRun.input_tokens), 0))
                    ),
                    "llm_output_tokens": db.scalar(
                        select(func.coalesce(func.sum(LLMRun.output_tokens), 0))
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
            if job.status not in {"failed", "cancelled"}:
                raise HTTPException(409, "Only failed or cancelled jobs can be retried")
            job.status, job.cancel_requested, job.error = "queued", False, None
            db.commit()
            return {"status": job.status}

    @app.post("/api/classifications/retry")
    def retry_classifications():
        if classifier is None:
            raise HTTPException(
                503, "Configure OPENAI_API_KEY and set LLM_ENABLED=true, then restart."
            )
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

    @app.post("/api/review/{exercise_id}/start")
    def begin_review(exercise_id: str):
        with review_lock, sessions() as db:
            return start_review(db, exercise_id)

    @app.post("/api/review/sessions/{session_id}/move")
    def move(session_id: str, data: MoveRequest):
        with review_lock, sessions() as db:
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
            return reveal(db, session_id, scheduler, settings)

    @app.get("/api/weaknesses")
    def weaknesses():
        with sessions() as db:
            return {
                "skills": priorities(db, settings),
                "unclassified": db.scalar(
                    select(func.count())
                    .select_from(Decision)
                    .where(
                        Decision.meaningful.is_(True),
                        ~Decision.id.in_(select(SkillEvidence.decision_id)),
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
                select(SkillEvidence).where(SkillEvidence.decision_id == decision_id)
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
                        "run_id": e.llm_run_id,
                    }
                    for e in rows
                ],
            }

    @app.get("/api/llm-runs/{run_id}")
    def llm_run(run_id: str):
        with sessions() as db:
            run = db.get(LLMRun, run_id)
            if run is None:
                raise HTTPException(404, "Classification run not found")
            return {c.name: getattr(run, c.name) for c in LLMRun.__table__.columns}

    @app.get("/api/course")
    def course():
        with sessions() as db:
            current = db.scalar(
                select(Course).where(Course.active.is_(True)).order_by(Course.created_at.desc())
            )
            if current is None:
                return {"course": None, "units": []}
            units = db.scalars(
                select(CourseUnit)
                .where(CourseUnit.course_id == current.id)
                .order_by(CourseUnit.ordinal)
            ).all()
            data = []
            for unit in units:
                decision_ids = db.scalars(
                    select(SkillEvidence.decision_id)
                    .join(UnitEvidence)
                    .where(UnitEvidence.unit_id == unit.id)
                ).all()
                exercise_ids = db.scalars(
                    select(Exercise.id).where(Exercise.decision_id.in_(decision_ids))
                ).all()
                lessons = db.scalars(
                    select(Lesson).where(Lesson.unit_id == unit.id).order_by(Lesson.ordinal)
                ).all()
                data.append(
                    {
                        "id": unit.id,
                        "title": unit.title,
                        "rationale": unit.rationale,
                        "provisional": unit.provisional,
                        "decision_ids": decision_ids,
                        "exercise_ids": exercise_ids,
                        "lessons": [
                            {"id": lesson.id, "stage": lesson.stage, "completed": lesson.completed}
                            for lesson in lessons
                        ],
                    }
                )
            return {
                "course": {
                    "id": current.id,
                    "title": current.title,
                    "target_rating": current.target_rating,
                },
                "units": data,
            }

    @app.post("/api/course/rebuild")
    def rebuild_course():
        with runner.course_lock, sessions() as db:
            result = build_course(db, settings)
            return {"course_id": result.id if result else None}

    @app.post("/api/lessons/{lesson_id}/complete")
    def complete_lesson(lesson_id: str):
        with sessions() as db:
            lesson = db.get(Lesson, lesson_id)
            if lesson is None:
                raise HTTPException(404, "Lesson not found")
            lesson.completed = True
            db.commit()
            return {"completed": True}

    @app.post("/api/exercises/manual")
    def add_manual(data: ManualRequest):
        with mutation_lock, sessions() as db:
            exercise = manual_exercise(db, scheduler, **data.model_dump())
            return {"id": exercise.id}

    @app.get("/api/repertoires")
    def repertoires():
        with sessions() as db:
            return [
                {
                    "id": r.id,
                    "name": r.name,
                    "color": "white" if r.color else "black",
                    "exercises": db.scalar(
                        select(func.count())
                        .select_from(Exercise)
                        .where(Exercise.repertoire_id == r.id)
                    ),
                }
                for r in db.scalars(select(Repertoire)).all()
            ]

    @app.post("/api/repertoires")
    async def add_repertoire(
        file: UploadFile = File(...),
        name: str = Form(...),
        side: Literal["white", "black"] = Form(...),
    ):
        pgn = await read_pgn(file)
        with mutation_lock, sessions() as db:
            return import_repertoire(db, scheduler, name[:200], pgn, side == "white")

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
