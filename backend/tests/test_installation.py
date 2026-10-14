"""Installer settings fail clearly before opening a database or starting engines."""

import re
from pathlib import Path
from xml.etree import ElementTree

import pytest
from trainer import site_settings
from trainer.api import create_app
from trainer.config import Settings


@pytest.mark.parametrize(
    "origin",
    [
        "example.com",
        "ftp://example.com",
        "https://x/a",
        "https://x?query=1",
        "https://x#fragment",
        "https://user:secret@x",
        "https://x:bad",
        "https://bad host",
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


def test_unraid_template_defaults_select_accounts():
    root = Path(__file__).resolve().parents[2]
    template = ElementTree.parse(root / "unraid/fieldwork.xml").getroot()
    variables = {
        field.attrib["Target"].lower(): field.text or ""
        for field in template.findall("Config")
        if field.attrib["Type"] == "Variable"
    }
    config = Settings(_env_file=None, **variables).for_runtime()
    assert config.accounts_enabled
    assert template.findtext("WebUI") == "http://[IP]:[PORT:8000]"
    for field in template.findall("Config"):
        assert field.attrib["Description"]


def test_shipped_configs_leave_stored_settings_to_the_app():
    # Settings → Advanced → Server owns these; an environment value would only seed them.
    root = Path(__file__).resolve().parents[2]
    template = ElementTree.parse(root / "unraid/fieldwork.xml").getroot()
    compose = (root / "compose.yaml").read_text(encoding="utf-8")
    shipped = {
        field.attrib["Target"].lower()
        for field in template.findall("Config")
        if field.attrib["Type"] == "Variable"
    } | {name.lower() for name in re.findall(r"^ {6}([A-Z][A-Z0-9_]*):", compose, re.MULTILINE)}
    example = (root / ".env.example").read_text(encoding="utf-8")
    shipped |= {name.lower() for name in re.findall(r"^#? ?([A-Z][A-Z0-9_]*)=", example, re.M)}
    assert shipped & set(Settings.model_fields) <= site_settings.ENV_ONLY


def test_shipped_container_configs_keep_the_hardening():
    root = Path(__file__).resolve().parents[2]
    template = ElementTree.parse(root / "unraid/fieldwork.xml").getroot()
    extra = template.findtext("ExtraParams").split()
    assert template.findtext("Privileged") == "false"
    for flag in ("--read-only", "--pids-limit", "--cap-drop", "--security-opt", "--user"):
        assert flag in extra
    assert extra[extra.index("--cap-drop") + 1] == "ALL"
    assert extra[extra.index("--security-opt") + 1] == "no-new-privileges:true"
    # The only host path the container sees is its own data folder.
    paths = [field for field in template.findall("Config") if field.attrib["Type"] == "Path"]
    assert [field.attrib["Target"] for field in paths] == ["/data"]
    compose = (root / "compose.yaml").read_text(encoding="utf-8")
    for line in ("read_only: true", "pids_limit:", "no-new-privileges:true", "- ALL"):
        assert line in compose
    assert "docker.sock" not in compose and "privileged" not in compose
