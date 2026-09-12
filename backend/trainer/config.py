from pathlib import Path
from typing import Literal

from pydantic import Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    server_host: str = "127.0.0.1"
    server_port: int = Field(default=8000, ge=1, le=65535)
    database_path: Path = Path("data/trainer.sqlite3")
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
    openai_api_key: SecretStr = SecretStr("")
    openai_model: str = "gpt-4.1-mini"
    llm_enabled: bool = False
    llm_workers: int = Field(default=2, ge=1, le=16)
    target_rating: int = Field(default=1500, ge=400, le=3000)
    acceptance_mode: Literal["best_only", "engine_tolerance", "practical", "custom"] = "practical"
    tolerance_cp: int = Field(default=50, ge=0, le=500)
    practical_tolerance_cp: int = Field(default=100, ge=0, le=500)
    mistake_threshold_cp: int = Field(default=150, ge=50, le=1000)
    slow_answer_seconds: float = Field(default=30, gt=0, le=600)
    desired_retention: float = Field(default=0.9, ge=0.7, le=0.99)
    min_independent_games: int = Field(default=2, ge=2, le=20)
    classification_confidence: float = Field(default=0.7, ge=0, le=1)
    lan_access_token: SecretStr = SecretStr("")
    max_import_bytes: int = Field(default=10_000_000, ge=1000, le=100_000_000)
    chesscom_timeout_seconds: float = Field(default=20, gt=0, le=60)
    chesscom_max_response_bytes: int = Field(default=25_000_000, ge=1000, le=100_000_000)
    chesscom_user_agent: str = "FieldworkChessTrainer/0.1 (local personal chess training)"

    @model_validator(mode="after")
    def validate_model(self):
        if self.llm_enabled and not self.openai_model.strip():
            raise ValueError("OPENAI_MODEL is required when LLM_ENABLED=true")
        return self

    def public(self) -> dict:
        return self.model_dump(mode="json", exclude={"openai_api_key", "lan_access_token"}) | {
            "openai_key_configured": bool(self.openai_api_key.get_secret_value()),
            "lan_token_configured": bool(self.lan_access_token.get_secret_value()),
        }
