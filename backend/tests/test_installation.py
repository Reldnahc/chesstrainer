"""Installer settings fail clearly before opening a database or starting engines."""

import pytest
from trainer.api import create_app


@pytest.mark.pristine_database
@pytest.mark.parametrize(
    "origin",
    [
        "example.com",
        "https://x/a",
        "https://user:secret@x",
    ],
)
def test_invalid_origin_fails_before_startup(settings, origin):
    settings.public_origin = origin
    with pytest.raises(ValueError, match="PUBLIC_ORIGIN must"):
        create_app(settings, workers=False)
    assert not settings.database_path.exists()


def test_http_accounts_explain_cookie_configuration(settings):
    settings.accounts_enabled = True
    settings.public_origin = "http://192.168.1.2:18000"
    with pytest.raises(ValueError, match="SESSION_SECURE=false"):
        create_app(settings, workers=False)
    settings.session_secure = False
    assert settings.for_runtime().accounts_enabled
    settings.public_origin = ""
    settings.session_secure = True
    assert settings.for_runtime().accounts_enabled


def test_https_origin_normalized_without_mutating_settings(settings):
    settings.accounts_enabled = True
    settings.public_origin = " https://chess.example.test/ "
    effective = settings.for_runtime()
    assert effective.public_origin == "https://chess.example.test"
    assert effective.accounts_enabled
    assert settings.public_origin.startswith(" ")


def test_container_refuses_no_login_mode(settings, monkeypatch, tmp_path):
    marker = tmp_path / "fieldwork-container"
    marker.touch()
    monkeypatch.setattr("trainer.config.CONTAINER_MARKER", marker)
    with pytest.raises(ValueError, match="requires ACCOUNTS_ENABLED=true"):
        settings.model_copy(update={"accounts_enabled": False}).for_runtime()
    assert settings.model_copy(update={"accounts_enabled": True}).for_runtime().accounts_enabled
    marker.unlink()
    assert (
        not settings.model_copy(update={"accounts_enabled": False}).for_runtime().accounts_enabled
    )
