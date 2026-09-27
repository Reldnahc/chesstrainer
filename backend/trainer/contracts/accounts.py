from trainer.contracts.common import Contract


class Account(Contract):
    id: str
    username: str
    admin: bool
    chesscom_username: str


class Identity(Contract):
    enabled: bool
    user: Account | None
    csrf: str | None = None


class AccountProfile(Contract):
    user: Account


class SyncStatus(Contract):
    username: str
    job_id: str | None
    status: str
    checked_at: str | None
    imported: int
    error: str | None
