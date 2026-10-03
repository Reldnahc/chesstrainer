from pathlib import Path
from typing import Literal
from urllib.parse import urlsplit

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

# Host paths, the bound address and contact details stay with the administrator;
# every signed-in account can read the rest of the configuration.
PRIVATE_SETTINGS = frozenset(
    {
        "lan_access_token",
        "allowed_hosts",
        "server_host",
        "database_path",
        "public_origin",
        "stockfish_path",
        "human_model_path",
        "chesscom_user_agent",
    }
)


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
    # Seconds from one polling round's start to the next; 0 disables. A round longer
    # than this (many Chess.com players) starts the next one right away.
    sync_interval_seconds: int = Field(default=60, ge=0, le=86400)
    # Newest games each sync reads from a provider once a change is seen.
    sync_games: int = Field(default=10, ge=1, le=1000)
    # Lichess players per change-check request (its users endpoint allows 300).
    sync_lichess_batch: int = Field(default=300, ge=1, le=300)
    # Full sync per connection even without a change marker; 0 never forces one.
    sync_full_seconds: int = Field(default=600, ge=0, le=86400)
    # Days without a visit before polling pauses and a welcome back is shown.
    sync_away_days: int = Field(default=7, ge=1, le=365)
    # Most recently played games analyzed at fresh priority; older ones backfill.
    analysis_recent_games: int = Field(default=100, ge=1, le=10000)
    human_model_enabled: bool = True
    human_model_path: Path = Path("data/models/maia3-79m.pt")
    human_model_device: Literal["cpu", "cuda"] = "cpu"
    human_model_threads: int = Field(default=2, ge=1, le=16)
    human_model_workers: int = Field(default=1, ge=1, le=4)
    human_model_timeout: float = Field(default=30, ge=1, le=120)
    review_refinement_positions: int = Field(default=8, ge=0, le=128)
    review_refinement_queries: int = Field(default=4, ge=2, le=8)
    review_refinement_depth: int = Field(default=22, ge=1, le=50)
    review_refinement_time: float = Field(default=2, gt=0, le=10)
    review_refinement_multipv: int = Field(default=4, ge=2, le=8)
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
    min_independent_games: int = Field(default=2, ge=2, le=20)
    lan_access_token: SecretStr = SecretStr("")
    # Extra host names the local-mode API answers to; LAN addresses need no entry.
    allowed_hosts: str = ""
    max_import_bytes: int = Field(default=10_000_000, ge=1000, le=100_000_000)
    chesscom_timeout_seconds: float = Field(default=20, gt=0, le=60)
    chesscom_max_response_bytes: int = Field(default=25_000_000, ge=1000, le=100_000_000)
    chesscom_user_agent: str = "FieldworkChessTrainer/0.1 (local personal chess training)"
    provider_timeout_seconds: float = Field(default=20, gt=0, le=60)
    provider_max_response_bytes: int = Field(default=25_000_000, ge=1000, le=100_000_000)
    provider_max_scan_games: int = Field(default=10000, ge=1000, le=100000)
    puzzle_starter_pack: bool = True
    puzzle_pack_path: Path | None = None

    def for_runtime(self):
        """Validate installation settings, including callers that mutate Settings."""
        origin = self.public_origin.strip().rstrip("/")
        if origin:
            try:
                parts = urlsplit(origin)
                valid = (
                    parts.scheme in {"http", "https"}
                    and parts.hostname
                    and not parts.username
                    and not parts.password
                    and not parts.path
                    and not parts.query
                    and not parts.fragment
                    and not any(char.isspace() for char in origin)
                )
                parts.port  # Reject malformed ports as well as malformed hosts.
            except ValueError:
                valid = False
            if not valid:
                raise ValueError(
                    "PUBLIC_ORIGIN must be an http:// or https:// address with no path, "
                    "credentials, query or fragment. Leave it blank for local use without login."
                )
            if self.accounts_enabled and parts.scheme == "http" and self.session_secure:
                raise ValueError(
                    "HTTP account hosting requires SESSION_SECURE=false; secure cookies cannot "
                    "work over LAN HTTP. Prefer an HTTPS PUBLIC_ORIGIN, or leave PUBLIC_ORIGIN "
                    "blank for local use without login."
                )
        return self.model_copy(
            update={
                "public_origin": origin,
                "accounts_enabled": self.accounts_enabled and bool(origin),
            }
        )

    def public(self) -> dict:
        return self.model_dump(mode="json", exclude=set(PRIVATE_SETTINGS)) | {
            "lan_token_configured": bool(self.lan_access_token.get_secret_value()),
        }
