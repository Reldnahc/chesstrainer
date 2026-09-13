"""Build a public-source snapshot for the combined GPL/AGPL application's LAN users.

Only Git-listed source (or an exported snapshot manifest) is eligible. Never walk
the working directory to discover files: it also contains private games and data.
No runtime API, database access or network connection is involved.
"""

import hashlib
import json
import subprocess
import zipfile
from pathlib import Path, PurePosixPath

MANIFEST = "SOURCE_SNAPSHOT.json"
EXCLUDED = {
    ".git",
    ".env",
    ".venv",
    ".tools",
    "data",
    "backups",
    "node_modules",
    "__pycache__",
    ".pytest_cache",
    ".ruff_cache",
    "dist",
    "test-results",
    "playwright-report",
}


def source_paths(root: Path) -> list[str]:
    try:
        checkout = subprocess.run(
            ["git", "rev-parse", "--show-toplevel"],
            cwd=root,
            capture_output=True,
            check=True,
        )
        if Path(checkout.stdout.decode("utf-8").strip()).resolve() != root.resolve():
            raise ValueError("This directory is an exported snapshot, not the Git root")
        result = subprocess.run(
            ["git", "ls-files", "-z", "--cached"],
            cwd=root,
            capture_output=True,
            check=True,
        )
        return result.stdout.decode("utf-8").rstrip("\0").split("\0")
    except (OSError, ValueError, subprocess.CalledProcessError):
        # The downloaded corresponding source can rebuild without Git metadata.
        manifest = root / MANIFEST
        if not manifest.is_file():
            raise ValueError("Build from a Git source checkout or an exported source snapshot")
        return list(json.loads(manifest.read_text(encoding="utf-8"))["files"])


def safe_source(root: Path, name: str) -> Path | None:
    relative = PurePosixPath(name)
    if not name or relative.is_absolute() or ".." in relative.parts or "\\" in name:
        raise ValueError(f"Unsafe source path: {name!r}")
    parts = [p.lower() for p in relative.parts]
    filename = parts[-1]
    if (
        any(p in EXCLUDED or p.endswith(".egg-info") for p in parts)
        or filename.startswith(".env")
        and filename != ".env.example"
        or ".sqlite" in filename
        or filename.endswith((".db", ".db-wal", ".db-shm", ".pyc", ".log", ".zip", ".exe", ".dll"))
        or filename == MANIFEST.lower()
    ):
        return None
    path = root.joinpath(*relative.parts)
    if not path.is_file():
        return None  # Git may list a file deleted from the current worktree.
    if not path.resolve().is_relative_to(root.resolve()):
        raise ValueError(f"Source path resolves outside the checkout: {name!r}")
    if any(part.is_symlink() for part in [path, *path.parents] if part != root.parent):
        raise ValueError(f"Source symlinks are not supported: {name!r}")
    return path


def build_archive(root: Path, output: Path) -> dict:
    root = root.resolve()
    entries = {}
    for name in sorted(set(source_paths(root))):
        if path := safe_source(root, name):
            entries[name] = path.read_bytes()
    if not entries:
        raise ValueError("No public source files found")
    manifest = {
        "format": 1,
        "description": "Public source checkout snapshot; private data and secrets excluded.",
        "files": {name: hashlib.sha256(data).hexdigest() for name, data in entries.items()},
    }
    entries[MANIFEST] = (json.dumps(manifest, indent=2, sort_keys=True) + "\n").encode()
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_suffix(".zip.tmp")
    try:
        with zipfile.ZipFile(temporary, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for name, data in sorted(entries.items()):
                info = zipfile.ZipInfo(f"fieldwork/{name}", date_time=(1980, 1, 1, 0, 0, 0))
                info.compress_type = zipfile.ZIP_DEFLATED
                info.external_attr = 0o100644 << 16
                archive.writestr(info, data)
        temporary.replace(output)
    finally:
        temporary.unlink(missing_ok=True)
    return manifest


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[1]
    result = build_archive(root, root / "frontend/public/assets/fieldwork-source.zip")
    print(f"Source download prepared: {len(result['files'])} public files")
