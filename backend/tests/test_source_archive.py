"""The network source offer must never publish the private workspace."""

import json
import zipfile

import pytest

from scripts import source_archive as source


def test_only_listed_public_files_are_archived_reproducibly(tmp_path, monkeypatch):
    files = {
        "README.md": "source",
        "backend/app.py": "print('hello')",
        ".env.example": "TOKEN=",
        ".env": "PRIVATE_TOKEN",
        ".ENV.local": "PRIVATE_TOKEN",
        "data/games.pgn": "PRIVATE_GAME",
        "backend/test.sqlite3-wal": "PRIVATE_DATABASE",
        "frontend/node_modules/dependency.js": "DEPENDENCY",
        "untracked.txt": "PRIVATE_NOTE",
        "backend/trainer/_vendor/lichess_puzzler/LICENSE": "upstream license",
    }
    for name, content in files.items():
        path = tmp_path / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content)
    monkeypatch.setattr(
        source, "source_paths", lambda root: [n for n in files if n != "untracked.txt"]
    )
    output = tmp_path / "source.zip"
    manifest = source.build_archive(tmp_path, output)
    assert set(manifest["files"]) == {
        "README.md",
        "backend/app.py",
        ".env.example",
        "backend/trainer/_vendor/lichess_puzzler/LICENSE",
    }
    with zipfile.ZipFile(output) as archive:
        assert json.loads(archive.read("fieldwork/SOURCE_SNAPSHOT.json")) == manifest
        assert all(b"PRIVATE_" not in archive.read(n) for n in archive.namelist())
    before = output.read_bytes()
    source.build_archive(tmp_path, output)
    assert output.read_bytes() == before


@pytest.mark.parametrize("name", ["../outside", "/absolute", "bad\\path"])
def test_unsafe_manifest_paths_fail(tmp_path, name):
    with pytest.raises(ValueError, match="Unsafe source path"):
        source.safe_source(tmp_path, name)


def test_exported_snapshot_can_be_rebuilt_without_git(tmp_path, monkeypatch):
    (tmp_path / source.MANIFEST).write_text(json.dumps({"files": {"README.md": "hash"}}))

    def no_git(*args, **kwargs):
        raise FileNotFoundError("Git absent")

    monkeypatch.setattr(source.subprocess, "run", no_git)
    assert source.source_paths(tmp_path) == ["README.md"]
