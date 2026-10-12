from datetime import datetime

from pydantic import Field

from trainer.contracts.common import Contract


class Account(Contract):
    id: str
    username: str
    admin: bool
    chesscom_username: str
    onboarding_completed: bool
    password_change_required: bool


class Identity(Contract):
    enabled: bool
    user: Account | None
    csrf: str | None = None


class AccountProfile(Contract):
    user: Account


class ManagedAccount(Contract):
    """One row of the administrator's account list; never carries credentials."""

    id: str
    username: str
    admin: bool
    disabled: bool
    created: datetime


class ManagedAccounts(Contract):
    accounts: list[ManagedAccount]


class PasswordReset(Contract):
    """An administrator's temporary password; the account replaces it at next sign-in."""

    password: str = Field(min_length=10, max_length=128)


class PasswordChange(Contract):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=10, max_length=128)


class AccountAccess(Contract):
    disabled: bool


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


class WelcomeBack(Contract):
    """Set when the learner returns after a week away; polling paused meanwhile."""

    away_since: datetime | None
