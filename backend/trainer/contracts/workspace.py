from typing import Literal

from pydantic import create_model

from trainer.config import PRIVATE_SETTINGS, Settings
from trainer.contracts.common import Contract


class EngineHealth(Contract):
    engine_status: Literal["unchecked", "ready", "unavailable"]
    engine_available: bool | None
    engine_error: str | None
    engine_version: str | None


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


class WorkspaceExtras(EngineHealth):
    lan_token_configured: bool
    coverage: Coverage
    classification_provider: str
    classification_version: str
    classification_runs: int
    classification_failed: int
    classification_rejected: int
    classification_abstained: int


# Every setting an account may read, typed exactly as Settings declares it, so a
# new setting reaches the contract without a hand-kept copy.
WorkspaceSettings = create_model(
    "WorkspaceSettings",
    __base__=WorkspaceExtras,
    **{
        name: (field.annotation, ...)
        for name, field in Settings.model_fields.items()
        if name not in PRIVATE_SETTINGS
    },
)
