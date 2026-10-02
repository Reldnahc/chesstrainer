from typing import Literal

from trainer.contracts.common import Contract


class EngineHealth(Contract):
    engine_status: Literal["unchecked", "ready", "unavailable"]
    engine_available: bool | None
    engine_error: str | None
    engine_version: str | None
    classification_available: bool


class Health(EngineHealth):
    database: str


class Coverage(Contract):
    total: int
    labeled: int
    outcomes: int
    mechanisms: int
    outcome_only: int
    unclassified: int
    pending: int
    abstention_reasons: dict[str, int]


class Stats(Contract):
    exercises: int
    reviews: int


class WorkspaceSettings(EngineHealth):
    server_host: str
    server_port: int
    database_path: str
    accounts_enabled: bool
    session_secure: bool
    public_origin: str
    engine_slots: int
    human_model_enabled: bool
    human_model_path: str
    human_model_device: Literal["cpu", "cuda"]
    human_model_threads: int
    human_model_workers: int
    human_model_timeout: float
    review_refinement_positions: int
    review_refinement_queries: int
    review_refinement_depth: int
    review_refinement_time: float
    review_refinement_multipv: int
    stockfish_path: str
    stockfish_threads: int
    stockfish_hash_mb: int
    stockfish_workers: int
    triage_depth: int
    triage_time: float
    triage_nodes: int | None
    deep_depth: int
    deep_time: float
    deep_nodes: int | None
    multipv: int
    classification_workers: int
    classification_max_plies: int
    classification_extension_plies: int
    classification_tactic_plies: int
    classification_min_loss_cp: int
    classification_min_material: int
    classification_probe_positions: int
    classification_probe_depth: int
    classification_probe_time: float
    classification_probe_queries: int
    target_rating: int
    acceptance_mode: Literal["best_only", "engine_tolerance", "practical", "custom"]
    tolerance_cp: int
    practical_tolerance_cp: int
    mistake_threshold_cp: int
    slow_answer_seconds: float
    retire_after_days: int
    desired_retention: float
    min_independent_games: int
    max_import_bytes: int
    chesscom_timeout_seconds: float
    chesscom_max_response_bytes: int
    chesscom_user_agent: str
    provider_timeout_seconds: float
    provider_max_response_bytes: int
    provider_max_scan_games: int
    puzzle_starter_pack: bool
    puzzle_pack_path: str | None
    lan_token_configured: bool
    coverage: Coverage
    classification_provider: str
    classification_version: str
    classification_runs: int
    classification_failed: int
    classification_rejected: int
    classification_abstained: int
