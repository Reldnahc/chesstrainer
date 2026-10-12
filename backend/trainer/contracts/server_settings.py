from typing import Literal

from trainer.contracts.common import Contract

SettingValue = bool | int | float | str | None


class ServerSetting(Contract):
    """One setting stored in the database; ``value`` applies at the next restart."""

    key: str
    label: str
    help: str
    kind: Literal["boolean", "integer", "number", "choice"]
    nullable: bool
    choices: list[str] | None
    minimum: float | None = None
    maximum: float | None = None
    default: SettingValue
    value: SettingValue
    running: SettingValue


class ServerSettingGroup(Contract):
    title: str
    settings: list[ServerSetting]


class ServerSettings(Contract):
    groups: list[ServerSettingGroup]
    # Only a server started with python -m trainer can restart itself.
    restart_available: bool
    # A new value after every start of the server.
    boot_id: str


class ServerSettingsChange(Contract):
    values: dict[str, SettingValue]
