"""Consistent SQLite snapshots; restore always targets a new file, never live data."""

import argparse
import json
import os
import shutil
import sqlite3
import tempfile
import zipfile
from contextlib import closing
from pathlib import Path

from trainer.config import Settings
from trainer.study_lessons.club import LEDGER, SAFE_ID, courses_folder

SIDECARS = ("-wal", "-shm", "-journal")


def write_atomically(write, destination: Path):
    """Write through a partial file so an interrupted copy never leaves a truncated target."""
    partial = destination.with_name(destination.name + ".partial")
    if partial.exists():
        raise ValueError(f"Remove the leftover partial file first: {partial}")
    try:
        write(partial)
        os.replace(partial, destination)
    except BaseException:
        partial.unlink(missing_ok=True)
        raise


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

        def write_archive(path):
            with zipfile.ZipFile(path, "x", compression=zipfile.ZIP_DEFLATED) as archive:
                archive.write(snapshot, "trainer.sqlite3")
                # The club's own Study course files and their revision ledger.
                folder = courses_folder(settings)
                if folder.is_dir():
                    for item in sorted(folder.glob("*.json")) + [folder / LEDGER]:
                        if item.is_file():
                            archive.write(item, f"courses/{item.name}")
                archive.writestr(
                    "manifest.json",
                    json.dumps({"format": 1, "application": "local-chess-trainer"}),
                )
                # The administrator's private reference copy: everything but the token.
                archive.writestr(
                    "settings.json",
                    json.dumps(
                        settings.model_dump(mode="json", exclude={"lan_access_token"}), indent=2
                    ),
                )

        write_atomically(write_archive, destination)
    return destination


def restore_backup(archive_path: Path, destination: Path):
    if destination.exists():
        raise ValueError(
            "Restore destination exists. Stop the server and choose a NEW database path."
        )
    # SQLite pairs a -wal/-shm file with a database by name alone. Leftovers from an
    # interrupted server would be replayed over the restored pages, silently mixing data.
    leftovers = [
        path.name
        for path in (destination.with_name(destination.name + suffix) for suffix in SIDECARS)
        if path.exists()
    ]
    if leftovers:
        raise ValueError(
            "Restore destination has leftover SQLite sidecar files ("
            + ", ".join(leftovers)
            + "). SQLite would replay them over the restored database. Stop the server and "
            "move them away, or choose a NEW database path."
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
                shutil.copyfileobj(source, output)
            with closing(sqlite3.connect(f"{temporary.as_uri()}?mode=ro", uri=True)) as check:
                if check.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
                    raise ValueError("Backup database failed SQLite integrity validation")
                if check.execute("PRAGMA foreign_key_check").fetchone() is not None:
                    raise ValueError("Backup contains invalid foreign-key references")
                check.execute("SELECT version_num FROM alembic_version").fetchone()
            destination.parent.mkdir(parents=True, exist_ok=True)

            def write_database(path):
                with temporary.open("rb") as source, path.open("xb") as output:
                    shutil.copyfileobj(source, output)

            write_atomically(write_database, destination)
        restore_courses(archive, destination)
    return destination


def restore_courses(archive, destination: Path):
    """Put the club's course files beside the restored database, never over existing ones."""
    names = [
        name
        for name in archive.namelist()
        if name.startswith("courses/")
        and (
            name == f"courses/{LEDGER}"
            or (name.endswith(".json") and SAFE_ID.match(name.removeprefix("courses/")[:-5]))
        )
    ]
    if not names:
        return None
    folder = destination.parent / "courses"
    if folder.exists() and any(folder.iterdir()):
        folder = destination.parent / f"{destination.stem}-courses"
        if folder.exists():
            raise ValueError(f"Course folder exists; move it away first: {folder}")
    folder.mkdir(parents=True, exist_ok=True)
    for name in names:
        (folder / name.removeprefix("courses/")).write_bytes(archive.read(name))
    print(f"Club course files restored to {folder}")
    return folder


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
