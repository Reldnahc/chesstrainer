"""Installer settings fail clearly before opening a database or starting engines."""

from pathlib import Path
from xml.etree import ElementTree

import pytest
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
    assert not settings.for_runtime().accounts_enabled


def test_https_origin_normalized_without_mutating_settings(settings):
    settings.accounts_enabled = True
    settings.public_origin = " https://chess.example.test/ "
    effective = settings.for_runtime()
    assert effective.public_origin == "https://chess.example.test"
    assert effective.accounts_enabled
    assert settings.public_origin.startswith(" ")


def test_unraid_template_defaults_select_local_mode():
    root = Path(__file__).resolve().parents[2]
    template = ElementTree.parse(root / "unraid/fieldwork.xml").getroot()
    variables = {
        field.attrib["Target"].lower(): field.text or ""
        for field in template.findall("Config")
        if field.attrib["Type"] == "Variable"
    }
    config = Settings(_env_file=None, **variables).for_runtime()
    assert not config.accounts_enabled
    assert template.findtext("WebUI") == "http://[IP]:[PORT:8000]"
    for field in template.findall("Config"):
        assert field.attrib["Description"]
        if field.attrib["Target"].startswith(("ENGINE_", "STOCKFISH_")):
            assert field.attrib["Display"] == "advanced"
