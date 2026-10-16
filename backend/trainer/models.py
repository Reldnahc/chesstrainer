import io
import uuid
from datetime import date, datetime

import chess.pgn
from sqlalchemy import (
    JSON,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    LargeBinary,
    MetaData,
    Text,
    TypeDecorator,
    UniqueConstraint,
    or_,
)
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from trainer import timeutil
from trainer.job_kinds import JobKind, JobStatus, allowed

# The app's clock, kept here for the many models and helpers that import it.
now = timeutil.now


def mainline_plies(context):
    """Default for Game.move_count: the half-moves in the row's PGN mainline."""
    game = chess.pgn.read_game(io.StringIO(context.get_current_parameters()["pgn"]))
    return 0 if game is None else sum(1 for _ in game.mainline_moves())


class UTCDateTime(TypeDecorator):
    """A UTC timestamp: stored as UTC wall time, always read back timezone-aware.

    SQLite keeps no offset, so plain DateTime columns came back naive (or aware,
    for rows a migration wrote as text with an offset). Every timestamp column
    uses this type, so comparisons and API output never mix the two.
    """

    impl = DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None or value.tzinfo is None:
            return value
        return timeutil.as_utc(value).replace(tzinfo=None)

    def process_result_value(self, value, dialect):
        return None if value is None else timeutil.as_utc(value)


def uid() -> str:
    return uuid.uuid4().hex


# Every index and constraint gets a predictable name that migrations can refer
# to; revision eb978e634f57 rebuilt the older tables so theirs carry these names
# too. Unique constraints are named by ``unique`` below rather than here: older
# revisions create unnamed ones and drop them by the names they gave them.
NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


def unique(table, *columns):
    """A unique constraint named as ``uq_<table>_<columns>``, like every other one."""
    return UniqueConstraint(*columns, name=f"uq_{table}_{'_'.join(columns)}")


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


class User(Base):
    __tablename__ = "users"
    __table_args__ = (unique("users", "username"),)
    id: Mapped[str] = mapped_column(primary_key=True, default=uid)
    username: Mapped[str] = mapped_column()
    password: Mapped[str]
    admin: Mapped[bool] = mapped_column(default=False)
    disabled: Mapped[bool] = mapped_column(default=False)
    onboarding_completed: Mapped[bool] = mapped_column(default=False, server_default="0")
    # Set by an administrator's reset; the account must choose its own password next.
    password_change_required: Mapped[bool] = mapped_column(default=False, server_default="0")
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=now)
    # Polling pauses after a week without requests; see trainer.presence.
    last_seen_at: Mapped[datetime | None] = mapped_column(UTCDateTime())
    away_since: Mapped[datetime | None] = mapped_column(UTCDateTime())


class AuthSession(Base):
    __tablename__ = "auth_sessions"
    digest: Mapped[str] = mapped_column(primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    expires_at: Mapped[datetime] = mapped_column(UTCDateTime())


class SiteSetting(Base):
    """One server-wide setting changed by administrators; absent means its default."""

    __tablename__ = "site_settings"
    key: Mapped[str] = mapped_column(primary_key=True)
    value: Mapped[str] = mapped_column(Text)  # JSON text


class Owned:
    # No default owner: an account session stamps its own, and anything else must say.
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)


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
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=now)


class Game(Owned, Base):
    __tablename__ = "games"
    # The library lists an account's games newest first; the unique constraint
    # already leads with user_id, so the column needs no index of its own.
    __table_args__ = (
        unique("games", "user_id", "fingerprint"),
        Index("ix_games_user_id_played_at", "user_id", "played_at", "created_at", "id"),
    )
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    id: Mapped[str] = mapped_column(primary_key=True, default=uid)
    fingerprint: Mapped[str]
    white: Mapped[str]
    black: Mapped[str]
    learner_color: Mapped[bool]
    pgn: Mapped[str] = mapped_column(Text)
    # When the game ended, in UTC. The PGN's own Date text, which may be partial
    # ("2024.??.??"), is read from ``pgn`` (``game_library.pgn_date``).
    played_at: Mapped[datetime | None] = mapped_column(UTCDateTime())
    # Mainline half-moves, saved at insert so the library never replays PGNs.
    move_count: Mapped[int] = mapped_column(default=mainline_plies)
    # True/False when the source says whether the game was rated; None when it does
    # not (most hand-made PGNs). Stats skip only games known to be unrated.
    rated: Mapped[bool | None]
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=now)

    @classmethod
    def counts_in_stats(cls):
        # Unknown (None) still counts: hand-made PGNs and older Chess.com imports.
        return or_(cls.rated.is_(None), cls.rated.is_(True))


class ImportGame(Owned, Base):
    __tablename__ = "import_games"
    import_id: Mapped[str] = mapped_column(ForeignKey("game_imports.id"), primary_key=True)
    game_id: Mapped[str] = mapped_column(ForeignKey("games.id"), primary_key=True, index=True)
    # Preserve duplicate provenance without scheduling the game in another import job.
    is_new: Mapped[bool] = mapped_column(default=True, server_default="1")


class AnalysisJob(Owned, Base):
    __tablename__ = "analysis_jobs"
    # An account's jobs by status (running cards, the train check), and the
    # workers' claim of the next queued job of a kind.
    __table_args__ = (
        Index("ix_analysis_jobs_user_id_status", "user_id", "status"),
        Index("ix_analysis_jobs_claim", "status", "kind", "priority", "created_at"),
        CheckConstraint(allowed("kind", JobKind), name="kind"),
        CheckConstraint(allowed("status", JobStatus), name="status"),
    )
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    id: Mapped[str] = mapped_column(primary_key=True, default=uid)
    kind: Mapped[str]  # trainer.job_kinds.JobKind
    import_id: Mapped[str | None] = mapped_column(ForeignKey("game_imports.id"), index=True)
    status: Mapped[str] = mapped_column(default=JobStatus.QUEUED)  # JobStatus
    games_total: Mapped[int] = mapped_column(default=0)
    games_processed: Mapped[int] = mapped_column(default=0)
    positions_triaged: Mapped[int] = mapped_column(default=0)
    deep_completed: Mapped[int] = mapped_column(default=0)
    mistakes_identified: Mapped[int] = mapped_column(default=0)
    classifications_completed: Mapped[int] = mapped_column(default=0)
    puzzles_found: Mapped[int] = mapped_column(default=0, server_default="0")
    cancel_requested: Mapped[bool] = mapped_column(default=False)
    error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=now)
    # Lower runs sooner; see trainer.game_analysis for the per-game levels.
    priority: Mapped[int] = mapped_column(default=0, server_default="0")


class ProviderImport(Owned, Base):
    __tablename__ = "provider_imports"
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
    __tablename__ = "provider_checkpoints"
    job_id: Mapped[str] = mapped_column(ForeignKey("provider_imports.job_id"), primary_key=True)
    url: Mapped[str] = mapped_column(primary_key=True)
    games_selected: Mapped[int]
    fetched_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=now)


class ProviderConnection(Owned, Base):
    __tablename__ = "provider_connections"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), primary_key=True)
    provider: Mapped[str] = mapped_column(primary_key=True)
    username: Mapped[str]
    # Provider change markers (archive ETag, game-count signature) for cheap polls.
    poll_state: Mapped[dict] = mapped_column(JSON, default=dict, server_default="{}")


class EngineAnalysis(Base):
    __tablename__ = "engine_analyses"
    __table_args__ = (unique("engine_analyses", "cache_key"),)
    id: Mapped[str] = mapped_column(primary_key=True, default=uid)
    cache_key: Mapped[str] = mapped_column()
    fen: Mapped[str]
    engine_version: Mapped[str]
    config: Mapped[dict] = mapped_column(JSON)
    candidates: Mapped[list] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=now)


class GameReview(Owned, Base):
    __tablename__ = "game_reviews"
    __table_args__ = (unique("game_reviews", "job_id"),)
    game_id: Mapped[str] = mapped_column(ForeignKey("games.id"), primary_key=True)
    job_id: Mapped[str] = mapped_column(ForeignKey("analysis_jobs.id"))
    rating: Mapped[int]
    revision: Mapped[int] = mapped_column(default=0, server_default="0")
    refinement_plan: Mapped[dict | None] = mapped_column(JSON)


class ReviewRefinement(Owned, Base):
    __tablename__ = "review_refinements"
    __table_args__ = (unique("review_refinements", "user_id", "task_key"),)
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
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=now)


class HumanAnalysis(Base):
    """Shared human move facts, never engine scores or character prose.

    Like engine analyses, a request depends only on the game (its moves and PGN
    ratings, or the review rating as a fallback), so members who import the same
    game reuse one prediction.
    """

    __tablename__ = "human_analyses"
    __table_args__ = (unique("human_analyses", "cache_key"),)
    id: Mapped[str] = mapped_column(primary_key=True, default=uid)
    cache_key: Mapped[str] = mapped_column()
    request: Mapped[dict] = mapped_column(JSON)
    policy: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=now)


class GameReviewMove(Owned, Base):
    __tablename__ = "game_review_moves"
    game_id: Mapped[str] = mapped_column(ForeignKey("games.id"), primary_key=True)
    ply: Mapped[int] = mapped_column(primary_key=True)
    report: Mapped[dict] = mapped_column(JSON)
    human_analysis_id: Mapped[str | None] = mapped_column(
        ForeignKey("human_analyses.id"), index=True
    )
    refinement_id: Mapped[str | None] = mapped_column(ForeignKey("review_refinements.id"))
    revision: Mapped[int] = mapped_column(default=0, server_default="0")


class PlayGame(Owned, Base):
    """A game against the coach's bot. Finished games are saved into the library."""

    __tablename__ = "play_games"
    id: Mapped[str] = mapped_column(primary_key=True, default=uid)
    coach_id: Mapped[str]
    coach_name: Mapped[str]
    learner_color: Mapped[bool]
    opponent_kind: Mapped[str]
    opponent_rating: Mapped[int]
    learner_rating: Mapped[int]
    commentary: Mapped[str]
    moves: Mapped[list] = mapped_column(JSON, default=list)
    # Engine facts for each move keyed by ply, produced on request or live during
    # play; rendered with the current review rules whenever the game is read.
    reports: Mapped[dict] = mapped_column(JSON, default=dict)
    # The bot's latest reply {ply, san, uci, source}, repeated to a retried request.
    last_reply: Mapped[dict | None] = mapped_column(JSON)
    # Plies a Human-like bot played with the engine because the human model was
    # unavailable; shown in the game and recorded in the saved PGN.
    fallback_plies: Mapped[list | None] = mapped_column(JSON)
    # Opening practice: the course whose repertoire is the bot's book, and where the
    # game stands against it. None for an ordinary game.
    practice: Mapped[dict | None] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(default="active", index=True)
    result: Mapped[str | None]
    termination: Mapped[str | None]
    saved_game_id: Mapped[str | None] = mapped_column(ForeignKey("games.id"), index=True)
    losing_streak: Mapped[int] = mapped_column(default=0, server_default="0")
    draw_declined: Mapped[bool] = mapped_column(default=False, server_default="0")
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=now)
    finished_at: Mapped[datetime | None] = mapped_column(UTCDateTime())


class PlayProfile(Owned, Base):
    """The Maia rating that best predicts this account's own moves, with its evidence size."""

    __tablename__ = "play_profiles"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), primary_key=True)
    status: Mapped[str] = mapped_column(default="computing")
    fitted_rating: Mapped[int | None]
    platform_rating: Mapped[int | None]
    platform: Mapped[str | None]
    positions: Mapped[int] = mapped_column(default=0, server_default="0")
    games: Mapped[int] = mapped_column(default=0, server_default="0")
    configuration_key: Mapped[str] = mapped_column(default="", server_default="")
    computed_at: Mapped[datetime | None] = mapped_column(UTCDateTime())


class Decision(Owned, Base):
    __tablename__ = "decisions"
    __table_args__ = (unique("decisions", "game_id", "ply"),)
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
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=now)


class Skill(Base):
    __tablename__ = "skills"
    id: Mapped[str] = mapped_column(primary_key=True)
    category: Mapped[str]
    title: Mapped[str]


class ClassificationAnalysis(Owned, Base):
    """Supplemental engine evidence; never replaces exercise grading evidence."""

    __tablename__ = "classification_analyses"
    __table_args__ = (unique("classification_analyses", "user_id", "cache_key"),)
    id: Mapped[str] = mapped_column(primary_key=True, default=uid)
    decision_id: Mapped[str] = mapped_column(ForeignKey("decisions.id"), index=True)
    cache_key: Mapped[str]
    job_id: Mapped[str | None] = mapped_column(ForeignKey("analysis_jobs.id"))
    before_analysis_id: Mapped[str] = mapped_column(ForeignKey("engine_analyses.id"))
    played_analysis_id: Mapped[str] = mapped_column(ForeignKey("engine_analyses.id"))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=now)


class ClassificationProbe(Owned, Base):
    """Immutable tail/defense evidence attached to a completed classification supplement."""

    __tablename__ = "classification_probes"
    __table_args__ = (unique("classification_probes", "classification_analysis_id", "query_key"),)
    id: Mapped[str] = mapped_column(primary_key=True, default=uid)
    classification_analysis_id: Mapped[str] = mapped_column(
        ForeignKey("classification_analyses.id"), index=True
    )
    root_analysis_id: Mapped[str] = mapped_column(ForeignKey("engine_analyses.id"))
    analysis_id: Mapped[str] = mapped_column(ForeignKey("engine_analyses.id"))
    kind: Mapped[str]
    at_ply: Mapped[int]
    query_key: Mapped[str]
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=now)


class ClassificationTask(Owned, Base):
    __tablename__ = "classification_tasks"
    job_id: Mapped[str] = mapped_column(ForeignKey("analysis_jobs.id"), primary_key=True)
    decision_id: Mapped[str] = mapped_column(ForeignKey("decisions.id"), primary_key=True)
    cache_key: Mapped[str]


class ClassificationRun(Owned, Base):
    __tablename__ = "classification_runs"
    __table_args__ = (unique("classification_runs", "user_id", "cache_key"),)
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
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=now)


class SkillEvidence(Owned, Base):
    __tablename__ = "skill_evidence"
    __table_args__ = (unique("skill_evidence", "decision_id", "skill_id"),)
    id: Mapped[str] = mapped_column(primary_key=True, default=uid)
    decision_id: Mapped[str] = mapped_column(ForeignKey("decisions.id"), index=True)
    skill_id: Mapped[str] = mapped_column(ForeignKey("skills.id"), index=True)
    classification_run_id: Mapped[str] = mapped_column(ForeignKey("classification_runs.id"))
    confidence: Mapped[float]
    explanation: Mapped[str] = mapped_column(Text)
    active: Mapped[bool] = mapped_column(default=True, server_default="1")


class Exercise(Owned, Base):
    __tablename__ = "exercises"
    __table_args__ = (unique("exercises", "user_id", "identity"),)
    id: Mapped[str] = mapped_column(primary_key=True, default=uid)
    identity: Mapped[str]
    source: Mapped[str]
    decision_id: Mapped[str | None] = mapped_column(ForeignKey("decisions.id"), index=True)
    fen: Mapped[str]
    learner_color: Mapped[bool]  # True when the learner plays White, as everywhere.
    explanation: Mapped[str] = mapped_column(Text, default="")
    policy: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=now)


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
    due: Mapped[datetime] = mapped_column(UTCDateTime(), index=True)
    reviews: Mapped[int] = mapped_column(default=0)
    lapses: Mapped[int] = mapped_column(default=0)
    eligible: Mapped[bool] = mapped_column(default=True, server_default="1")
    retired_at: Mapped[datetime | None] = mapped_column(UTCDateTime())
    retired_interval_days: Mapped[float | None]


class ReviewSession(Owned, Base):
    __tablename__ = "review_sessions"
    last_attempt_id: Mapped[str | None] = mapped_column(
        ForeignKey("exercise_attempts.id", use_alter=True)
    )
    # "review" (scheduled recall), "focus" (skill practice) or "lesson" (an attempt
    # from the removed lessons, kept as archived history).
    mode: Mapped[str] = mapped_column(default="review", server_default="review")
    focus_skill_id: Mapped[str | None] = mapped_column(ForeignKey("skills.id"))
    response_ms: Mapped[int | None]
    completed_at: Mapped[datetime | None] = mapped_column(UTCDateTime())
    id: Mapped[str] = mapped_column(primary_key=True, default=uid)
    exercise_id: Mapped[str] = mapped_column(ForeignKey("exercises.id"), index=True)
    started_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=now)
    failed: Mapped[bool] = mapped_column(default=False)
    revealed: Mapped[bool] = mapped_column(default=False)
    completed: Mapped[bool] = mapped_column(default=False)


class Attempt(Owned, Base):
    __tablename__ = "exercise_attempts"
    id: Mapped[str] = mapped_column(primary_key=True, default=uid)
    session_id: Mapped[str] = mapped_column(ForeignKey("review_sessions.id"), index=True)
    uci: Mapped[str]
    grade: Mapped[str]
    elapsed_ms: Mapped[int]


class Review(Owned, Base):
    __tablename__ = "reviews"
    __table_args__ = (unique("reviews", "session_id"),)
    id: Mapped[str] = mapped_column(primary_key=True, default=uid)
    session_id: Mapped[str] = mapped_column(ForeignKey("review_sessions.id"))
    exercise_id: Mapped[str] = mapped_column(ForeignKey("exercises.id"), index=True)
    rating: Mapped[str]
    response_ms: Mapped[int]
    failed: Mapped[bool]
    revealed: Mapped[bool]
    policy_version: Mapped[str] = mapped_column(default="1")
    scheduler_version: Mapped[str]
    scheduler_log: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=now)


class PuzzleSession(Owned, Base):
    __tablename__ = "puzzle_sessions"
    __table_args__ = (unique("puzzle_sessions", "user_id", "request_id"),)
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
    started_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=now)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=now)
    completed_at: Mapped[datetime | None] = mapped_column(UTCDateTime())


class PuzzleAttempt(Owned, Base):
    __tablename__ = "puzzle_attempts"
    __table_args__ = (unique("puzzle_attempts", "session_id", "request_id"),)
    id: Mapped[str] = mapped_column(primary_key=True, default=uid)
    session_id: Mapped[str] = mapped_column(ForeignKey("puzzle_sessions.id"), index=True)
    request_id: Mapped[str]
    request: Mapped[dict] = mapped_column(JSON)
    step: Mapped[int]
    uci: Mapped[str | None]
    grade: Mapped[str]
    elapsed_ms: Mapped[int]
    response: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=now)


class InsightFacts(Owned, Base):
    """One game's Insights facts, saved so a library is replayed once, not per request."""

    __tablename__ = "insight_facts"
    game_id: Mapped[str] = mapped_column(ForeignKey("games.id"), primary_key=True)
    # What the facts were built from (game_insights.facts_key); a mismatch rebuilds them.
    key: Mapped[str]
    facts: Mapped[bytes] = mapped_column(LargeBinary)


class GamePuzzleSearch(Owned, Base):
    """One generator pass over a game, recorded even when nothing qualified."""

    __tablename__ = "game_puzzle_searches"
    __table_args__ = (unique("game_puzzle_searches", "user_id", "game_id", "generator_version"),)
    id: Mapped[str] = mapped_column(primary_key=True, default=uid)
    game_id: Mapped[str] = mapped_column(ForeignKey("games.id"), index=True)
    generator_version: Mapped[str]
    engine_version: Mapped[str]
    candidates: Mapped[int] = mapped_column(default=0)
    kept: Mapped[int] = mapped_column(default=0)
    searched_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=now)


class GamePuzzle(Owned, Base):
    """A verified line mined from one of the account's games, or why it was set aside."""

    __tablename__ = "game_puzzles"
    __table_args__ = (unique("game_puzzles", "user_id", "game_id", "ply", "generator_version"),)
    id: Mapped[str] = mapped_column(primary_key=True, default=uid)
    game_id: Mapped[str] = mapped_column(ForeignKey("games.id"), index=True)
    ply: Mapped[int]
    decision_id: Mapped[str | None] = mapped_column(ForeignKey("decisions.id"))
    generator_version: Mapped[str]
    position_key: Mapped[str] = mapped_column(index=True)
    kind: Mapped[str]
    status: Mapped[str] = mapped_column(index=True)
    reason: Mapped[str | None]
    definition: Mapped[dict | None] = mapped_column(JSON)
    evidence: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=now)


class StudyLessonSession(Owned, Base):
    __tablename__ = "study_lesson_sessions"
    __table_args__ = (unique("study_lesson_sessions", "user_id", "request_id"),)
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
    started_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=now)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=now)
    completed_at: Mapped[datetime | None] = mapped_column(UTCDateTime())


class StudyLessonCommand(Owned, Base):
    __tablename__ = "study_lesson_commands"
    __table_args__ = (unique("study_lesson_commands", "session_id", "request_id"),)
    id: Mapped[str] = mapped_column(primary_key=True, default=uid)
    session_id: Mapped[str] = mapped_column(ForeignKey("study_lesson_sessions.id"), index=True)
    request_id: Mapped[str]
    request: Mapped[dict] = mapped_column(JSON)
    response: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=now)


class StudyLessonProgress(Owned, Base):
    __tablename__ = "study_lesson_progress"
    __table_args__ = (
        unique("study_lesson_progress", "user_id", "course_id", "course_revision", "chapter_id"),
    )
    id: Mapped[str] = mapped_column(primary_key=True, default=uid)
    course_id: Mapped[str]
    course_revision: Mapped[str]
    chapter_id: Mapped[str]
    content_hash: Mapped[str]
    viewed_steps: Mapped[list] = mapped_column(JSON, default=list)
    attempted_steps: Mapped[list] = mapped_column(JSON, default=list)
    completed_at: Mapped[datetime | None] = mapped_column(UTCDateTime())
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=now)


class OpeningStudy(Owned, Base):
    __tablename__ = "opening_studies"
    __table_args__ = (
        unique(
            "opening_studies", "user_id", "source", "source_key", "source_version", "learner_color"
        ),
    )
    id: Mapped[str] = mapped_column(primary_key=True, default=uid)
    source: Mapped[str]
    source_key: Mapped[str]
    source_version: Mapped[str]
    name: Mapped[str]
    eco: Mapped[str | None]
    learner_color: Mapped[bool]
    snapshot: Mapped[dict] = mapped_column(JSON)
    active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=now)


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
    learner_color: Mapped[bool]
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
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=now)


def keep_shared(model, key, **values):
    """Insert one shared cache row (engine or Maia) unless any account saved it first.

    Execute it, then read the row back by ``cache_key``: concurrent jobs and
    accounts never duplicate a shared row, and every one gets the saved id.
    """
    return (
        sqlite_insert(model)
        .values(id=uid(), cache_key=key, **values)
        .on_conflict_do_nothing(index_elements=["cache_key"])
    )
