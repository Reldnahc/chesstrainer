"""Consistent SQLite snapshots; restore always targets a new file, never live data."""

import argparse
import json
import sqlite3
import tempfile
import zipfile
from contextlib import closing
from pathlib import Path

from trainer.config import Settings


def export_backup(destination: Path, settings: Settings):
    source = settings.database_path.resolve()
    if not source.exists():
        raise ValueError(f"Database does not exist: {source}")
    if destination.exists():
        raise ValueError("Backup destination exists; choose a new filename")
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as directory:
        snapshot = Path(directory) / "trainer.sqlite3"
        with closing(sqlite3.connect(f"{source.as_uri()}?mode=ro", uri=True)) as original:
            with closing(sqlite3.connect(snapshot)) as backup:
                original.backup(backup)
        with zipfile.ZipFile(destination, "x", compression=zipfile.ZIP_DEFLATED) as archive:
            archive.write(snapshot, "trainer.sqlite3")
            archive.writestr(
                "manifest.json", json.dumps({"format": 1, "application": "local-chess-trainer"})
            )
            archive.writestr("settings.json", json.dumps(settings.public(), indent=2))
    return destination


def restore_backup(archive_path: Path, destination: Path):
    if destination.exists():
        raise ValueError(
            "Restore destination exists. Stop the server and choose a NEW database path."
        )
    with zipfile.ZipFile(archive_path) as archive:
        manifest = json.loads(archive.read("manifest.json"))
        if manifest.get("format") != 1 or manifest.get("application") != "local-chess-trainer":
            raise ValueError("Unsupported backup format")
        info = archive.getinfo("trainer.sqlite3")
        if info.file_size > 5_000_000_000:
            raise ValueError("Backup database exceeds the 5 GB restore limit")
        # Read only the expected named entry; never extract arbitrary archive paths.
        with tempfile.TemporaryDirectory() as directory:
            temporary = Path(directory) / "check.sqlite3"
            with archive.open(info) as source, temporary.open("wb") as output:
                import shutil

                shutil.copyfileobj(source, output)
            with closing(sqlite3.connect(f"{temporary.as_uri()}?mode=ro", uri=True)) as check:
                if check.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
                    raise ValueError("Backup database failed SQLite integrity validation")
                if check.execute("PRAGMA foreign_key_check").fetchone() is not None:
                    raise ValueError("Backup contains invalid foreign-key references")
                check.execute("SELECT version_num FROM alembic_version").fetchone()
            destination.parent.mkdir(parents=True, exist_ok=True)
            with temporary.open("rb") as source, destination.open("xb") as output:
                import shutil

                shutil.copyfileobj(source, output)
    return destination


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["export", "restore"])
    parser.add_argument("archive", type=Path)
    parser.add_argument("--destination", type=Path, help="New SQLite path for restore")
    args = parser.parse_args()
    try:
        if args.action == "export":
            result = export_backup(args.archive, Settings())
        else:
            if args.destination is None:
                parser.error("restore requires --destination NEW_DATABASE_PATH")
            result = restore_backup(args.archive, args.destination)
        print(f"{args.action.capitalize()} complete: {result}")
    except (ValueError, sqlite3.DatabaseError, zipfile.BadZipFile, KeyError) as exc:
        parser.exit(1, f"Backup error: {exc}\n")


if __name__ == "__main__":
    main()
