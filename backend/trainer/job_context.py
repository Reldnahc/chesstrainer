"""The one object a job's steps receive: its account's resources and the host's services."""

from collections.abc import Callable
from dataclasses import dataclass

from trainer.config import Settings


@dataclass(frozen=True)
class JobContext:
    """Everything one job uses, captured once when it starts.

    The host runner supplies the shared services: settings, the FSRS scheduler,
    the classifier, the engine factory and the provider gateway. The job's account
    supplies its sessions, its ``read()`` and ``write()`` units and its Maia
    models. Pipelines, reviews, refinements, fetches and level fits take this and
    nothing else of the runner or the workspace, so no step reaches into either.

    ``sessions`` is for the engine and Maia cache rows, which keep sessions of
    their own; account rows go through ``read()`` and ``write()``.
    """

    job_id: str
    user_id: str
    settings: Settings
    sessions: Callable
    read: Callable
    write: Callable
    engine_factory: Callable
    scheduler: object
    classifier: object
    human_models: object
    providers: object
    # Whether this job should stop: the runner is stopping, the job was cancelled
    # or it is no longer this process's to run.
    cancelled: Callable[[], bool]
    # Whether the runner itself is stopping (shutdown), independent of the job row.
    stopping: Callable[[], bool]
