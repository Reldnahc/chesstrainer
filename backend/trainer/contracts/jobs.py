from datetime import date, datetime

from trainer.contracts.common import Contract


class ImportError(Contract):
    error: str
    game: int | None = None
    archive: str | None = None


class PgnImportResult(Contract):
    import_id: str
    processed: int
    imported: int
    duplicates: int
    job_id: str | None
    errors: list[ImportError]


class ChessComImportProgress(Contract):
    provider: str = "chesscom"
    provider_name: str = "Chess.com"
    job_id: str
    user_id: str
    username: str
    time_class: str
    months: int
    max_games: int
    start_date: date | None
    end_date: date | None
    archives_total: int
    archives_processed: int
    games_fetched: int
    games_imported: int
    duplicates: int
    filtered: int
    rejected: int
    errors: list[ImportError]
    fetch_completed: bool


class WorkerActivity(Contract):
    active: int
    pending: int


class JobActivity(Contract):
    games: WorkerActivity
    classifications: WorkerActivity


class Job(Contract):
    id: str
    user_id: str
    kind: str
    import_id: str | None
    status: str
    games_total: int
    games_processed: int
    positions_triaged: int
    deep_completed: int
    mistakes_identified: int
    classifications_completed: int
    puzzles_found: int = 0
    cancel_requested: bool
    error: str | None
    created_at: datetime
    priority: int = 0
    probe_total: int | None
    activity: JobActivity | None
    chesscom: ChessComImportProgress | None
    provider_import: ChessComImportProgress | None = None


class AnalysisQueueGame(Contract):
    id: str
    white: str
    black: str
    played_at: datetime | None


class AnalysisQueue(Contract):
    """Per-game analysis: one job per saved game, run one at a time per account."""

    running: AnalysisQueueGame | None
    requested: int
    fresh: int
    backfill: int
    completed: int
    failed: int
