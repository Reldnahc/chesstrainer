import uuid
from datetime import date, datetime, timezone

from sqlalchemy import (
    JSON,
    DateTime,
    ForeignKey,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def now() -> datetime:
    return datetime.now(timezone.utc)


def uid() -> str:
    return uuid.uuid4().hex


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(primary_key=True, default=uid)
    username: Mapped[str] = mapped_column(unique=True)
    password: Mapped[str]
    admin: Mapped[bool] = mapped_column(default=False)
    disabled: Mapped[bool] = mapped_column(default=False)
    chesscom_username: Mapped[str] = mapped_column(default="")
    onboarding_completed: Mapped[bool] = mapped_column(default=False, server_default="0")
    created: Mapped[float]


class AuthSession(Base):
    __tablename__ = "auth_sessions"
    digest: Mapped[str] = mapped_column(primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    expires: Mapped[float]


class Owned:
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), default="local", index=True)


class UserPreferences(Owned, Base):
    __tablename__ = "user_preferences"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), primary_key=True)
    coach_id: Mapped[str] = mapped_column(default="classic", server_default="classic")
    coach_motion: Mapped[str] = mapped_column(default="system", server_default="system")
    interface_motion: Mapped[str] = mapped_column(default="system", server_default="system")
    audio_enabled: Mapped[bool] = mapped_column(default=True, server_default="1")
    audio_volume: Mapped[float] = mapped_column(default=0.35, server_default="0.35")
    audio_board: Mapped[bool] = mapped_column(default=True, server_default="1")
    audio_practice: Mapped[bool] = mapped_column(default=True, server_default="1")
    audio_voice: Mapped[str] = mapped_column(default="automatic", server_default="automatic")


class ImportBatch(Owned, Base):
    __tablename__ = "game_imports"
    id: Mapped[str] = mapped_column(primary_key=True, default=uid)
    filename: Mapped[str]
    original_pgn: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Game(Owned, Base):
    __tablename__ = "games"
    __table_args__ = (UniqueConstraint("user_id", "fingerprint"),)
    id: Mapped[str] = mapped_column(primary_key=True, default=uid)
    fingerprint: Mapped[str]
    white: Mapped[str]
    black: Mapped[str]
    learner_color: Mapped[bool]
    pgn: Mapped[str] = mapped_column(Text)
    played_on: Mapped[str | None]
    played_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Mainline half-moves, saved at import so the library never replays PGNs. Older
    # rows are filled in the first time they are listed.
    move_count: Mapped[int | None]
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class ImportGame(Owned, Base):
    __tablename__ = "import_games"
    import_id: Mapped[str] = mapped_column(ForeignKey("game_imports.id"), primary_key=True)
    game_id: Mapped[str] = mapped_column(ForeignKey("games.id"), primary_key=True)
    # Preserve duplicate provenance without scheduling the game in another import job.
    is_new: Mapped[bool] = mapped_column(default=True, server_default="1")


class AnalysisJob(Owned, Base):
    __tablename__ = "analysis_jobs"
    id: Mapped[str] = mapped_column(primary_key=True, default=uid)
    kind: Mapped[str] = mapped_column(default="analysis")
    import_id: Mapped[str | None] = mapped_column(ForeignKey("game_imports.id"))
    status: Mapped[str] = mapped_column(default="queued", index=True)
    games_total: Mapped[int] = mapped_column(default=0)
    games_processed: Mapped[int] = mapped_column(default=0)
    positions_triaged: Mapped[int] = mapped_column(default=0)
    deep_completed: Mapped[int] = mapped_column(default=0)
    mistakes_identified: Mapped[int] = mapped_column(default=0)
    classifications_completed: Mapped[int] = mapped_column(default=0)
    cancel_requested: Mapped[bool] = mapped_column(default=False)
    error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    # Lower runs sooner; see trainer.game_analysis for the per-game levels.
    priority: Mapped[int] = mapped_column(default=0, server_default="0")


class ProviderImport(Owned, Base):
    __tablename__ = "chesscom_imports"
    job_id: Mapped[str] = mapped_column(ForeignKey("analysis_jobs.id"), primary_key=True)
    provider: Mapped[str] = mapped_column(default="chesscom", server_default="chesscom")
    username: Mapped[str]
    time_class: Mapped[str]
    months: Mapped[int]
    max_games: Mapped[int]
    start_date: Mapped[date | None]
    end_date: Mapped[date | None]
    archives_total: Mapped[int] = mapped_column(default=0)
    archives_processed: Mapped[int] = mapped_column(default=0)
    games_fetched: Mapped[int] = mapped_column(default=0)
    games_imported: Mapped[int] = mapped_column(default=0)
    duplicates: Mapped[int] = mapped_column(default=0)
    filtered: Mapped[int] = mapped_column(default=0)
    rejected: Mapped[int] = mapped_column(default=0)
    errors: Mapped[list] = mapped_column(JSON, default=list)
    fetch_completed: Mapped[bool] = mapped_column(default=False)


class ProviderCheckpoint(Owned, Base):
    __tablename__ = "chesscom_archives"
    job_id: Mapped[str] = mapped_column(ForeignKey("chesscom_imports.job_id"), primary_key=True)
    url: Mapped[str] = mapped_column(primary_key=True)
    games_selected: Mapped[int]
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


# Stable physical tables and aliases preserve existing jobs and offline tools.
ChessComImport = ProviderImport
ChessComArchive = ProviderCheckpoint


class ProviderConnection(Owned, Base):
    __tablename__ = "provider_connections"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), primary_key=True)
    provider: Mapped[str] = mapped_column(primary_key=True)
    username: Mapped[str]


class EngineAnalysis(Base):
    __tablename__ = "engine_analyses"
    id: Mapped[str] = mapped_column(primary_key=True, default=uid)
    cache_key: Mapped[str] = mapped_column(unique=True)
    fen: Mapped[str]
    engine_version: Mapped[str]
    config: Mapped[dict] = mapped_column(JSON)
    candidates: Mapped[list] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class GameReview(Owned, Base):
    __tablename__ = "game_reviews"
    game_id: Mapped[str] = mapped_column(ForeignKey("games.id"), primary_key=True)
    job_id: Mapped[str] = mapped_column(ForeignKey("analysis_jobs.id"), unique=True)
    rating: Mapped[int]
    revision: Mapped[int] = mapped_column(default=0, server_default="0")
    refinement_plan: Mapped[dict | None] = mapped_column(JSON)


class ReviewRefinement(Owned, Base):
    __tablename__ = "review_refinements"
    __table_args__ = (UniqueConstraint("user_id", "task_key"),)
    id: Mapped[str] = mapped_column(primary_key=True, default=uid)
    game_id: Mapped[str] = mapped_column(ForeignKey("games.id"), index=True)
    ply: Mapped[int]
    task_key: Mapped[str]
    triggers: Mapped[list] = mapped_column(JSON)
    config: Mapped[dict] = mapped_column(JSON)
    queries: Mapped[list] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(default="pending")
    reason: Mapped[str | None]
    report: Mapped[dict | None] = mapped_column(JSON)
    adopted: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class HumanAnalysis(Owned, Base):
    """Account-owned human move facts, never engine scores or character prose."""

    __tablename__ = "human_analyses"
    __table_args__ = (UniqueConstraint("user_id", "cache_key"),)
    id: Mapped[str] = mapped_column(primary_key=True, default=uid)
    cache_key: Mapped[str] = mapped_column(index=True)
    request: Mapped[dict] = mapped_column(JSON)
    policy: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class GameReviewMove(Owned, Base):
    __tablename__ = "game_review_moves"
    game_id: Mapped[str] = mapped_column(ForeignKey("games.id"), primary_key=True)
    ply: Mapped[int] = mapped_column(primary_key=True)
    report: Mapped[dict] = mapped_column(JSON)
    human_analysis_id: Mapped[str | None] = mapped_column(ForeignKey("human_analyses.id"))
    refinement_id: Mapped[str | None] = mapped_column(ForeignKey("review_refinements.id"))
    revision: Mapped[int] = mapped_column(default=0, server_default="0")


class Decision(Owned, Base):
    __tablename__ = "decisions"
    __table_args__ = (UniqueConstraint("game_id", "ply"),)
    id: Mapped[str] = mapped_column(primary_key=True, default=uid)
    game_id: Mapped[str] = mapped_column(ForeignKey("games.id"), index=True)
    ply: Mapped[int]
    fen: Mapped[str]
    position_key: Mapped[str] = mapped_column(index=True)
    learner_color: Mapped[bool]
    move_uci: Mapped[str]
    move_san: Mapped[str]
    before_analysis_id: Mapped[str] = mapped_column(ForeignKey("engine_analyses.id"))
    played_analysis_id: Mapped[str] = mapped_column(ForeignKey("engine_analyses.id"))
    loss_cp: Mapped[int | None]
    mate_lost: Mapped[bool] = mapped_column(default=False)
    allows_mate: Mapped[bool] = mapped_column(default=False)
    meaningful: Mapped[bool] = mapped_column(default=False, index=True)
    deep: Mapped[bool] = mapped_column(default=False)
    facts: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Skill(Base):
    __tablename__ = "skills"
    id: Mapped[str] = mapped_column(primary_key=True)
    category: Mapped[str]
    title: Mapped[str]


class ClassificationAnalysis(Owned, Base):
    """Supplemental engine evidence; never replaces exercise grading evidence."""

    __tablename__ = "classification_analyses"
    __table_args__ = (UniqueConstraint("user_id", "cache_key"),)
    id: Mapped[str] = mapped_column(primary_key=True, default=uid)
    decision_id: Mapped[str] = mapped_column(ForeignKey("decisions.id"), index=True)
    cache_key: Mapped[str]
    job_id: Mapped[str | None] = mapped_column(ForeignKey("analysis_jobs.id"))
    before_analysis_id: Mapped[str] = mapped_column(ForeignKey("engine_analyses.id"))
    played_analysis_id: Mapped[str] = mapped_column(ForeignKey("engine_analyses.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class ClassificationProbe(Owned, Base):
    """Immutable tail/defense evidence attached to a completed classification supplement."""

    __tablename__ = "classification_probes"
    __table_args__ = (UniqueConstraint("classification_analysis_id", "query_key"),)
    id: Mapped[str] = mapped_column(primary_key=True, default=uid)
    classification_analysis_id: Mapped[str] = mapped_column(
        ForeignKey("classification_analyses.id"), index=True
    )
    root_analysis_id: Mapped[str] = mapped_column(ForeignKey("engine_analyses.id"))
    analysis_id: Mapped[str] = mapped_column(ForeignKey("engine_analyses.id"))
    kind: Mapped[str]
    at_ply: Mapped[int]
    query_key: Mapped[str]
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class ClassificationTask(Owned, Base):
    __tablename__ = "classification_tasks"
    job_id: Mapped[str] = mapped_column(ForeignKey("analysis_jobs.id"), primary_key=True)
    decision_id: Mapped[str] = mapped_column(ForeignKey("decisions.id"), primary_key=True)
    cache_key: Mapped[str]


class ClassificationRun(Owned, Base):
    __tablename__ = "classification_runs"
    __table_args__ = (UniqueConstraint("user_id", "cache_key"),)
    provider: Mapped[str] = mapped_column(default="legacy_llm", server_default="legacy_llm")
    version: Mapped[str] = mapped_column(default="legacy", server_default="legacy")
    id: Mapped[str] = mapped_column(primary_key=True, default=uid)
    cache_key: Mapped[str]
    decision_id: Mapped[str] = mapped_column(ForeignKey("decisions.id"))
    model: Mapped[str]
    schema_version: Mapped[str]
    prompt_version: Mapped[str]
    status: Mapped[str]
    response: Mapped[dict | None] = mapped_column(JSON)
    confidence: Mapped[float | None]
    error: Mapped[str | None]
    input_tokens: Mapped[int] = mapped_column(default=0)
    output_tokens: Mapped[int] = mapped_column(default=0)
    attempts: Mapped[int] = mapped_column(default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class SkillEvidence(Owned, Base):
    __tablename__ = "skill_evidence"
    __table_args__ = (UniqueConstraint("decision_id", "skill_id"),)
    id: Mapped[str] = mapped_column(primary_key=True, default=uid)
    decision_id: Mapped[str] = mapped_column(ForeignKey("decisions.id"), index=True)
    skill_id: Mapped[str] = mapped_column(ForeignKey("skills.id"), index=True)
    classification_run_id: Mapped[str] = mapped_column(ForeignKey("classification_runs.id"))
    confidence: Mapped[float]
    explanation: Mapped[str] = mapped_column(Text)
    active: Mapped[bool] = mapped_column(default=True, server_default="1")


class Course(Owned, Base):
    __tablename__ = "courses"
    id: Mapped[str] = mapped_column(primary_key=True, default=uid)
    title: Mapped[str]
    target_rating: Mapped[int]
    active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class CourseUnit(Owned, Base):
    __tablename__ = "course_units"
    id: Mapped[str] = mapped_column(primary_key=True, default=uid)
    course_id: Mapped[str] = mapped_column(ForeignKey("courses.id"))
    skill_id: Mapped[str] = mapped_column(ForeignKey("skills.id"))
    title: Mapped[str]
    rationale: Mapped[str] = mapped_column(Text)
    ordinal: Mapped[int]
    provisional: Mapped[bool]
    group_key: Mapped[str] = mapped_column(default="", server_default="")
    active: Mapped[bool] = mapped_column(default=True, server_default="1")


class UnitEvidence(Owned, Base):
    __tablename__ = "unit_evidence"
    unit_id: Mapped[str] = mapped_column(ForeignKey("course_units.id"), primary_key=True)
    evidence_id: Mapped[str] = mapped_column(ForeignKey("skill_evidence.id"), primary_key=True)


class Lesson(Owned, Base):
    __tablename__ = "lessons"
    id: Mapped[str] = mapped_column(primary_key=True, default=uid)
    unit_id: Mapped[str] = mapped_column(ForeignKey("course_units.id"))
    stage: Mapped[str]
    ordinal: Mapped[int]
    completed: Mapped[bool] = mapped_column(default=False)
    check_rounds: Mapped[int] = mapped_column(default=0, server_default="0")
    last_check_correct: Mapped[int] = mapped_column(default=0, server_default="0")


class CourseRevision(Owned, Base):
    __tablename__ = "course_revisions"
    id: Mapped[str] = mapped_column(primary_key=True, default=uid)
    course_id: Mapped[str] = mapped_column(ForeignKey("courses.id"), index=True)
    fingerprint: Mapped[str]
    snapshot: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class LessonItem(Owned, Base):
    __tablename__ = "lesson_items"
    __table_args__ = (UniqueConstraint("lesson_id", "ordinal"),)
    id: Mapped[str] = mapped_column(primary_key=True, default=uid)
    lesson_id: Mapped[str] = mapped_column(ForeignKey("lessons.id"), index=True)
    exercise_id: Mapped[str] = mapped_column(ForeignKey("exercises.id"))
    ordinal: Mapped[int]
    completed: Mapped[bool] = mapped_column(default=False)
    clean: Mapped[bool] = mapped_column(default=False)


class TeachingRun(Owned, Base):
    __tablename__ = "teaching_runs"
    __table_args__ = (UniqueConstraint("user_id", "cache_key"),)
    id: Mapped[str] = mapped_column(primary_key=True, default=uid)
    unit_id: Mapped[str] = mapped_column(ForeignKey("course_units.id"), index=True)
    cache_key: Mapped[str]
    model: Mapped[str]
    schema_version: Mapped[str]
    prompt_version: Mapped[str]
    evidence_ids: Mapped[list] = mapped_column(JSON)
    response: Mapped[dict | None] = mapped_column(JSON)
    confidence: Mapped[float | None]
    status: Mapped[str]
    error: Mapped[str | None]
    input_tokens: Mapped[int] = mapped_column(default=0)
    output_tokens: Mapped[int] = mapped_column(default=0)
    attempts: Mapped[int] = mapped_column(default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Repertoire(Owned, Base):
    __tablename__ = "repertoires"
    id: Mapped[str] = mapped_column(primary_key=True, default=uid)
    name: Mapped[str]
    color: Mapped[bool]
    pgn: Mapped[str] = mapped_column(Text)


class Exercise(Owned, Base):
    __tablename__ = "exercises"
    __table_args__ = (UniqueConstraint("user_id", "identity"),)
    id: Mapped[str] = mapped_column(primary_key=True, default=uid)
    identity: Mapped[str]
    source: Mapped[str]
    decision_id: Mapped[str | None] = mapped_column(ForeignKey("decisions.id"))
    repertoire_id: Mapped[str | None] = mapped_column(ForeignKey("repertoires.id"))
    fen: Mapped[str]
    orientation: Mapped[str]
    explanation: Mapped[str] = mapped_column(Text, default="")
    policy: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class ExerciseTag(Owned, Base):
    __tablename__ = "exercise_tags"
    exercise_id: Mapped[str] = mapped_column(ForeignKey("exercises.id"), primary_key=True)
    tag: Mapped[str] = mapped_column(primary_key=True)


class ExerciseAnswer(Owned, Base):
    __tablename__ = "exercise_answers"
    exercise_id: Mapped[str] = mapped_column(ForeignKey("exercises.id"), primary_key=True)
    uci: Mapped[str] = mapped_column(primary_key=True)
    san: Mapped[str]
    grade: Mapped[str]
    primary: Mapped[bool] = mapped_column(default=False)
    analysis_id: Mapped[str | None] = mapped_column(ForeignKey("engine_analyses.id"))


class SRSState(Owned, Base):
    __tablename__ = "srs_states"
    exercise_id: Mapped[str] = mapped_column(ForeignKey("exercises.id"), primary_key=True)
    card: Mapped[dict] = mapped_column(JSON)
    due: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    reviews: Mapped[int] = mapped_column(default=0)
    lapses: Mapped[int] = mapped_column(default=0)
    eligible: Mapped[bool] = mapped_column(default=True, server_default="1")
    retired_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    retired_interval_days: Mapped[float | None]


class ReviewSession(Owned, Base):
    __tablename__ = "review_sessions"
    last_attempt_id: Mapped[str | None] = mapped_column(
        ForeignKey("exercise_attempts.id", use_alter=True, name="fk_review_sessions_last_attempt")
    )
    lesson_item_id: Mapped[str | None] = mapped_column(ForeignKey("lesson_items.id"))
    mode: Mapped[str] = mapped_column(default="review", server_default="review")
    focus_skill_id: Mapped[str | None] = mapped_column(ForeignKey("skills.id"))
    response_ms: Mapped[int | None]
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    id: Mapped[str] = mapped_column(primary_key=True, default=uid)
    exercise_id: Mapped[str] = mapped_column(ForeignKey("exercises.id"), index=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    failed: Mapped[bool] = mapped_column(default=False)
    revealed: Mapped[bool] = mapped_column(default=False)
    completed: Mapped[bool] = mapped_column(default=False)


class Attempt(Owned, Base):
    __tablename__ = "exercise_attempts"
    id: Mapped[str] = mapped_column(primary_key=True, default=uid)
    session_id: Mapped[str] = mapped_column(ForeignKey("review_sessions.id"))
    uci: Mapped[str]
    grade: Mapped[str]
    elapsed_ms: Mapped[int]


class Review(Owned, Base):
    __tablename__ = "reviews"
    id: Mapped[str] = mapped_column(primary_key=True, default=uid)
    session_id: Mapped[str] = mapped_column(ForeignKey("review_sessions.id"), unique=True)
    exercise_id: Mapped[str] = mapped_column(ForeignKey("exercises.id"), index=True)
    rating: Mapped[str]
    response_ms: Mapped[int]
    failed: Mapped[bool]
    revealed: Mapped[bool]
    policy_version: Mapped[str] = mapped_column(default="1")
    scheduler_version: Mapped[str]
    scheduler_log: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class PuzzleSession(Owned, Base):
    __tablename__ = "puzzle_sessions"
    __table_args__ = (UniqueConstraint("user_id", "request_id"),)
    id: Mapped[str] = mapped_column(primary_key=True, default=uid)
    request_id: Mapped[str]
    provider_id: Mapped[str]
    puzzle_key: Mapped[str]
    definition_version: Mapped[str]
    puzzle_source: Mapped[str]
    snapshot: Mapped[dict] = mapped_column(JSON)
    current_step: Mapped[int] = mapped_column(default=0)
    revision: Mapped[int] = mapped_column(default=0)
    status: Mapped[str] = mapped_column(default="active")
    failed: Mapped[bool] = mapped_column(default=False)
    first_response_ms: Mapped[int | None]
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class PuzzleAttempt(Owned, Base):
    __tablename__ = "puzzle_attempts"
    __table_args__ = (UniqueConstraint("session_id", "request_id"),)
    id: Mapped[str] = mapped_column(primary_key=True, default=uid)
    session_id: Mapped[str] = mapped_column(ForeignKey("puzzle_sessions.id"), index=True)
    request_id: Mapped[str]
    request: Mapped[dict] = mapped_column(JSON)
    step: Mapped[int]
    uci: Mapped[str | None]
    grade: Mapped[str]
    elapsed_ms: Mapped[int]
    response: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class StudyLessonSession(Owned, Base):
    __tablename__ = "study_lesson_sessions"
    __table_args__ = (UniqueConstraint("user_id", "request_id"),)
    id: Mapped[str] = mapped_column(primary_key=True, default=uid)
    request_id: Mapped[str]
    course_id: Mapped[str]
    course_revision: Mapped[str]
    course_title: Mapped[str]
    chapter_id: Mapped[str]
    chapter_title: Mapped[str]
    content_hash: Mapped[str]
    snapshot: Mapped[dict] = mapped_column(JSON)
    state: Mapped[dict] = mapped_column(JSON)
    revision: Mapped[int] = mapped_column(default=0)
    status: Mapped[str] = mapped_column(default="active")
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class StudyLessonCommand(Owned, Base):
    __tablename__ = "study_lesson_commands"
    __table_args__ = (UniqueConstraint("session_id", "request_id"),)
    id: Mapped[str] = mapped_column(primary_key=True, default=uid)
    session_id: Mapped[str] = mapped_column(ForeignKey("study_lesson_sessions.id"), index=True)
    request_id: Mapped[str]
    request: Mapped[dict] = mapped_column(JSON)
    response: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class StudyLessonProgress(Owned, Base):
    __tablename__ = "study_lesson_progress"
    __table_args__ = (UniqueConstraint("user_id", "course_id", "course_revision", "chapter_id"),)
    id: Mapped[str] = mapped_column(primary_key=True, default=uid)
    course_id: Mapped[str]
    course_revision: Mapped[str]
    chapter_id: Mapped[str]
    content_hash: Mapped[str]
    viewed_steps: Mapped[list] = mapped_column(JSON, default=list)
    attempted_steps: Mapped[list] = mapped_column(JSON, default=list)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class OpeningStudy(Owned, Base):
    __tablename__ = "opening_studies"
    __table_args__ = (
        UniqueConstraint("user_id", "source", "source_key", "source_version", "color"),
    )
    id: Mapped[str] = mapped_column(primary_key=True, default=uid)
    source: Mapped[str]
    source_key: Mapped[str]
    source_version: Mapped[str]
    name: Mapped[str]
    eco: Mapped[str | None]
    color: Mapped[str]
    snapshot: Mapped[dict] = mapped_column(JSON)
    active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class OpeningStudyMove(Owned, Base):
    __tablename__ = "opening_study_moves"
    study_id: Mapped[str] = mapped_column(ForeignKey("opening_studies.id"), primary_key=True)
    ordinal: Mapped[int] = mapped_column(primary_key=True)
    exercise_id: Mapped[str] = mapped_column(ForeignKey("exercises.id"), index=True)
    position_key: Mapped[str]
    fen: Mapped[str]
    ply: Mapped[int]
    move_uci: Mapped[str]
    move_san: Mapped[str]


class OpeningCard(Owned, Base):
    __tablename__ = "opening_cards"
    exercise_id: Mapped[str] = mapped_column(ForeignKey("exercises.id"), primary_key=True)
    revision: Mapped[int] = mapped_column(default=0)
    active: Mapped[bool] = mapped_column(default=False)
    last_active_answers: Mapped[list] = mapped_column(JSON, default=list)
    retirement_guard_revision: Mapped[int | None]


class OpeningRecallSnapshot(Owned, Base):
    __tablename__ = "opening_recall_snapshots"
    session_id: Mapped[str] = mapped_column(ForeignKey("review_sessions.id"), primary_key=True)
    answer_revision: Mapped[int]
    fen: Mapped[str]
    orientation: Mapped[str]
    answers: Mapped[list] = mapped_column(JSON)
    studies: Mapped[list] = mapped_column(JSON)
    non_scheduling_reason: Mapped[str | None]


class OpeningContentChange(Owned, Base):
    __tablename__ = "opening_content_changes"
    id: Mapped[str] = mapped_column(primary_key=True, default=uid)
    exercise_id: Mapped[str] = mapped_column(ForeignKey("exercises.id"), index=True)
    revision: Mapped[int]
    reason: Mapped[str]
    details: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
