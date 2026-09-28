from trainer.contracts.common import Contract


class Account(Contract):
    id: str
    username: str
    admin: bool
    chesscom_username: str
    onboarding_completed: bool


class Identity(Contract):
    enabled: bool
    user: Account | None
    csrf: str | None = None


class AccountProfile(Contract):
    user: Account


class SyncStatus(Contract):
    provider: str = "chesscom"
    username: str
    job_id: str | None
    status: str
    checked_at: str | None
    imported: int
    error: str | None


class GameProvider(Contract):
    id: str
    name: str
    time_classes: list[str]


class ProviderConnectionRequest(Contract):
    username: str
