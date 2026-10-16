"""The one object a job's steps receive: its account's resources and the host's services."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import TYPE_CHECKING

from trainer.config import Settings

if TYPE_CHECKING:
    from trainer.game_providers.gateway import ProviderGateway
    from trainer.human_models.service import HumanModels
    from trainer.local_classifier import LocalClassifier
    from trainer.scheduling import FSRSScheduler


@dataclass(frozen=True)
class JobContext:
    """Everything one job uses, captured once when it starts.

    The host runner supplies the shared services: settings, the FSRS scheduler,
    the classifier, the engine factory and the provider gateway. The job's account
    supplies its sessions, its ``read()`` and ``write()`` units and its Maia
    models. Pipelines, reviews, refinements, fetches and level fits take this and
    nothing else of the runner or the workspace, so no step reaches into either.

    ``sessions`` is for the engine and Maia cache rows, which keep sessions of
    their own; account rows go through ``read()`` and ``write()``. The
    per-decision helpers (``analyze_decision``, ``classify_decision``,
    ``enrich_decision``, ``generate_for_game``) take only those units, so a job
    passes its context and other callers a ``db.Units``.
    """

    job_id: str
    user_id: str
    settings: Settings
    sessions: Callable
    read: Callable
    write: Callable
    engine_factory: Callable
    scheduler: FSRSScheduler
    # The local rules by default; tests and tools may pass another classifier.
    classifier: LocalClassifier
    human_models: HumanModels | None
    providers: ProviderGateway
    # Whether this job should stop: the runner is stopping, the job was cancelled
    # or it is no longer this process's to run.
    cancelled: Callable[[], bool]
    # Whether the runner itself is stopping (shutdown), independent of the job row.
    stopping: Callable[[], bool]
