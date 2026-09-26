from pathlib import Path
from typing import Literal

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    server_host: str = "127.0.0.1"
    server_port: int = Field(default=8000, ge=1, le=65535)
    database_path: Path = Path("data/trainer.sqlite3")
    accounts_enabled: bool = False
    session_secure: bool = True
    public_origin: str = ""
    engine_slots: int = Field(default=4, ge=1, le=32)
    stockfish_path: str = "stockfish"
    stockfish_threads: int = Field(default=1, ge=1, le=32)
    stockfish_hash_mb: int = Field(default=64, ge=16, le=4096)
    stockfish_workers: int = Field(default=1, ge=1, le=4)
    triage_depth: int = Field(default=10, ge=1, le=40)
    triage_time: float = Field(default=0.15, gt=0, le=30)
    triage_nodes: int | None = Field(default=None, ge=1)
    deep_depth: int = Field(default=16, ge=1, le=50)
    deep_time: float = Field(default=0.8, gt=0, le=60)
    deep_nodes: int | None = Field(default=None, ge=1)
    multipv: int = Field(default=4, ge=1, le=20)
    classification_workers: int = Field(default=2, ge=1, le=4)
    classification_max_plies: int = Field(default=16, ge=4, le=32)
    classification_extension_plies: int = Field(default=16, ge=0, le=32)
    classification_tactic_plies: int = Field(default=8, ge=2, le=16)
    classification_min_loss_cp: int = Field(default=150, ge=50, le=1000)
    classification_min_material: int = Field(default=1, ge=1, le=9)
    classification_probe_positions: int = Field(default=40, ge=1, le=500)
    classification_probe_depth: int = Field(default=22, ge=1, le=40)
    classification_probe_time: float = Field(default=2.0, gt=0, le=10)
    classification_probe_queries: int = Field(default=6, ge=2, le=12)
    target_rating: int = Field(default=1500, ge=400, le=3000)
    acceptance_mode: Literal["best_only", "engine_tolerance", "practical", "custom"] = "practical"
    tolerance_cp: int = Field(default=50, ge=0, le=500)
    practical_tolerance_cp: int = Field(default=100, ge=0, le=500)
    mistake_threshold_cp: int = Field(default=150, ge=50, le=1000)
    slow_answer_seconds: float = Field(default=30, gt=0, le=600)
    retire_after_days: int = Field(default=100, ge=1, le=36500)
    desired_retention: float = Field(default=0.9, ge=0.7, le=0.99)
    course_max_units: int = Field(default=6, ge=1, le=12)
    lesson_max_positions: int = Field(default=8, ge=2, le=20)
    lesson_check_pass_fraction: float = Field(default=0.8, gt=0, le=1)
    min_independent_games: int = Field(default=2, ge=2, le=20)
    lan_access_token: SecretStr = SecretStr("")
    max_import_bytes: int = Field(default=10_000_000, ge=1000, le=100_000_000)
    chesscom_timeout_seconds: float = Field(default=20, gt=0, le=60)
    chesscom_max_response_bytes: int = Field(default=25_000_000, ge=1000, le=100_000_000)
    chesscom_user_agent: str = "FieldworkChessTrainer/0.1 (local personal chess training)"

    def public(self) -> dict:
        return self.model_dump(mode="json", exclude={"lan_access_token"}) | {
            "lan_token_configured": bool(self.lan_access_token.get_secret_value()),
        }
