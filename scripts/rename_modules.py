"""Rename frontend modules so their file names say what they hold (frontend audit L2).

Screens are named for the screen they export, and coach dialogue files for their
coach ID (the part after the family, as the other characters already are). The
script moves each file with ``git mv``, renames the identifiers that carried the
old name, and rewrites every import and path reference to it, so it can be run
again on a newer base: moves already made are skipped and only references are
rewritten.

Run from the repository root: python scripts/rename_modules.py [--dry-run]
"""

import argparse
import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = (ROOT / "frontend" / "src").absolute()

# Old path -> new path, relative to frontend/src.
MOVES = {
    "GameReview.tsx": "GamesScreen.tsx",
    "Review.tsx": "DueScreen.tsx",
    "Weaknesses.tsx": "InsightsScreen.tsx",
    "Import.tsx": "ImportSettings.tsx",
    "Settings.tsx": "SettingsScreen.tsx",
    "Home.tsx": "HomeScreen.tsx",
    "dialogue/characters/storyteller.ts": "dialogue/characters/classic.ts",
    "dialogue/characters/professor.ts": "dialogue/characters/gentle.ts",
    "dialogue/characters/velvet.ts": "dialogue/characters/black.ts",
    "dialogue/characters/youngBoy.ts": "dialogue/characters/boy.ts",
    "dialogue/characters/youngGirl.ts": "dialogue/characters/girl.ts",
}

# Identifiers renamed in the module that defines them and every file that imports
# it: (module after the move, old name, new name).
CHARACTERS = "dialogue/characters"
IDENTIFIERS = [
    ("DueScreen.tsx", "ReviewScreen", "DueScreen"),
    (f"{CHARACTERS}/classic.ts", "storyteller", "classic"),
    (f"{CHARACTERS}/gentle.ts", "professor", "gentle"),
    (f"{CHARACTERS}/black.ts", "velvet", "black"),
    (f"{CHARACTERS}/boy.ts", "youngBoy", "boy"),
    (f"{CHARACTERS}/girl.ts", "youngGirl", "girl"),
]

CODE_DIRS = [
    "src",
    "tests",
    "studio-tests",
    "audio-tests",
    "intelligence-tests",
    "type-tests",
    "coach-studio",
    "audio-studio",
    "intelligence-lab",
    "scripts",
]
CODE_SUFFIXES = {".ts", ".tsx", ".mts", ".js", ".mjs", ".cjs"}
# Recording records keep the paths they were made with.
TEXT_SKIP = ("/banks/", "/node_modules/", "/dist/")
SPECIFIER = re.compile(
    r"""(\bfrom\s+|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*)(["'])(\.{1,2}/[^"']+|/src/[^"']+)\2"""
)


def strip_extension(path: str) -> str:
    return re.sub(r"\.(tsx?|mts|jsx?|mjs|cjs)$", "", path)


MODULES = {strip_extension(old): strip_extension(new) for old, new in MOVES.items()}


def git(*args):
    subprocess.run(["git", *args], cwd=ROOT, check=True)


def move(dry_run):
    moved = []
    for old, new in MOVES.items():
        source, target = SRC / old, SRC / new
        if target.exists() and not source.exists():
            continue
        if not source.exists():
            sys.exit(f"Neither {old} nor {new} exists; check the mapping against this base.")
        if target.exists():
            sys.exit(f"Both {old} and {new} exist; resolve that by hand first.")
        moved.append(old)
        if not dry_run:
            git("mv", str(source.relative_to(ROOT)), str(target.relative_to(ROOT)))
    return moved


def specifier_path(file: Path, specifier: str) -> Path:
    """The file a specifier names: relative to its importer, or "/src/…" from the
    frontend root as the browser-test fixtures write it. Normalised, not resolved:
    resolving on a case-insensitive disk would turn "./GameReview" into gameReview/."""
    if specifier.startswith("/src/"):
        return Path(os.path.normpath(SRC / specifier[len("/src/") :]))
    return Path(os.path.normpath(file.parent.absolute() / specifier))


def rewrite_specifier(file: Path, specifier: str) -> str:
    resolved = specifier_path(file, specifier)
    try:
        relative = resolved.relative_to(SRC).as_posix()
    except ValueError:
        return specifier
    module = strip_extension(relative)
    if module not in MODULES:
        return specifier
    extension = relative[len(module) :]
    if specifier.startswith("/src/"):
        return f"/src/{MODULES[module]}{extension}"
    target = SRC / (MODULES[module] + extension)
    new = Path(os.path.relpath(target, file.parent.absolute())).as_posix()
    return new if new.startswith(".") else f"./{new}"


def tracked(*paths):
    """Files git tracks (or has staged) under these paths, so build output, test
    reports and dependencies are never read or rewritten."""
    output = subprocess.run(
        ["git", "ls-files", "--cached", "--", *paths],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    ).stdout
    for line in output.splitlines():
        path = ROOT / line
        if path.is_file() and not any(part in f"/{line}" for part in TEXT_SKIP):
            yield path


def code_files():
    for path in tracked(*(f"frontend/{name}" for name in CODE_DIRS)):
        if path.suffix in CODE_SUFFIXES:
            yield path


def rewrite_code(dry_run):
    changed = []
    for path in code_files():
        text = path.read_text(encoding="utf-8")
        new = SPECIFIER.sub(
            lambda m: f"{m.group(1)}{m.group(2)}{rewrite_specifier(path, m.group(3))}{m.group(2)}",
            text,
        )
        if new != text:
            changed.append(path)
            if not dry_run:
                path.write_text(new, encoding="utf-8", newline="")
    return changed


def imports_module(path: Path, text: str, modules: set) -> bool:
    for match in SPECIFIER.finditer(text):
        resolved = specifier_path(path, match.group(3))
        try:
            if strip_extension(resolved.relative_to(SRC).as_posix()) in modules:
                return True
        except ValueError:
            continue
    return False


# String literals and comments, which keep their words: only code between them is renamed.
LITERALS = re.compile(
    r"""("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`|//[^\n]*|/\*[\s\S]*?\*/)"""
)


def rename_in_code(text: str, old: str, new: str) -> str:
    """Renames `old` and names built on it (`professorOpeningTemplates`) in code only:
    a string such as the personality version "professor-4" or dialogue prose stays,
    since stored dialogue and recordings refer to it."""
    name = re.compile(rf"(?<![\w$]){re.escape(old)}(?=(?:[A-Z]\w*)?\b)")
    parts = LITERALS.split(text)
    # Odd parts are the literals and comments the split captured.
    return "".join(part if index % 2 else name.sub(new, part) for index, part in enumerate(parts))


def rewrite_identifiers(dry_run):
    changed = []
    files = list(code_files())
    old_paths = {new: old for old, new in MOVES.items()}
    for module_path, old, new in IDENTIFIERS:
        # Importers are found by the module's new path or, in a dry run before the
        # imports are rewritten, its old one.
        modules = {
            strip_extension(module_path),
            strip_extension(old_paths.get(module_path, module_path)),
        }
        defining = {
            (SRC / module_path).absolute(),
            (SRC / old_paths.get(module_path, module_path)).absolute(),
        }
        for path in files:
            if not path.exists():
                continue
            text = path.read_text(encoding="utf-8")
            if path.absolute() not in defining and not imports_module(path, text, modules):
                continue
            updated = rename_in_code(text, old, new)
            # A registry entry whose key and value now match is written shorthand.
            updated = re.sub(
                rf"(?<![\w\"'-]){re.escape(new)}: {re.escape(new)}(?=[,\s}}])", new, updated
            )
            if path.name == "index.ts" and path.parent == SRC / CHARACTERS:
                updated = sort_imports(updated)
            if updated != text:
                changed.append(path)
                if not dry_run:
                    path.write_text(updated, encoding="utf-8", newline="")
    return changed


def sort_imports(text: str) -> str:
    """Keeps the character registry's run of one-line imports in alphabetical order."""
    lines = text.split("\n")
    start = next(i for i, line in enumerate(lines) if line.startswith("import {") and '"./' in line)
    end = start
    while end < len(lines) and lines[end].startswith("import {") and '"./' in lines[end]:
        end += 1
    lines[start:end] = sorted(lines[start:end], key=str.lower)
    return "\n".join(lines)


def text_files():
    """Docs, records and repository scripts and tests that name frontend files (the
    CI plan and its tests, workflows), never this script."""
    this = Path(__file__).resolve()
    for path in tracked("docs", "*.md", "frontend", "scripts", "backend/tests", ".github"):
        if path.suffix in {".md", ".json", ".py", ".yml", ".yaml"} and path.resolve() != this:
            yield path


def rewrite_paths(dry_run):
    """Path mentions in docs and records: any `…src/<old>` and a backticked file name."""
    changed = []
    patterns = []
    for old, new in MOVES.items():
        patterns.append((re.compile(rf"(src/){re.escape(old)}\b"), rf"\g<1>{new}"))
        name, new_name = Path(old).name, Path(new).name
        if "/" in old:
            patterns.append((re.compile(rf"`{re.escape(name)}`"), f"`{new_name}`"))
        else:
            # A top-level screen's file name anywhere on its own (tables, prose),
            # never inside a longer name such as GameReview.tsx or srsReview/.
            patterns.append((re.compile(rf"(?<![\w/.-]){re.escape(name)}\b"), new_name))
        if "/" in old:
            folder = Path(old).parent.name
            patterns.append(
                (re.compile(rf"\b{folder}/{re.escape(name)}\b"), f"{folder}/{new_name}")
            )
    for path in text_files():
        if not path.is_file():
            continue
        text = path.read_text(encoding="utf-8")
        new = text
        for pattern, replacement in patterns:
            new = pattern.sub(replacement, new)
        if new != text:
            changed.append(path)
            if not dry_run:
                path.write_text(new, encoding="utf-8", newline="")
    return changed


def main(argv=None):
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument(
        "--dry-run", action="store_true", help="List what would change without changing it"
    )
    parser.add_argument(
        "--allow-dirty",
        action="store_true",
        help="Run over uncommitted changes (its rewrites then mix with them)",
    )
    args = parser.parse_args(argv)
    dirty = subprocess.run(
        ["git", "status", "--porcelain", "--untracked-files=no"],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()
    if dirty and not args.dry_run and not args.allow_dirty:
        sys.exit("Commit or stash your changes first, so the renames are a commit of their own.")
    moved = move(args.dry_run)
    code = rewrite_code(args.dry_run)
    names = rewrite_identifiers(args.dry_run)
    paths = rewrite_paths(args.dry_run)
    verb = "Would change" if args.dry_run else "Changed"
    print(f"Moved {len(moved)} of {len(MOVES)} files" + (" (dry run)" if args.dry_run else ""))
    for label, files in (
        ("imports in", code),
        ("identifiers in", names),
        ("path mentions in", paths),
    ):
        print(f"{verb} {label} {len(files)} files")
        for path in sorted(set(files)):
            print(f"  {path.relative_to(ROOT).as_posix()}")


if __name__ == "__main__":
    main()
