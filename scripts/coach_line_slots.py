"""Planned coach line slots and the import path for their written lines.

The planned slots live in frontend/src/audio/speech/planned-meanings.json, with
the lines imported so far. A slot enters the meaning catalogue, every coach's
script and the Walter/Rivet additions only once all 30 coaches have its line,
because each script must cover the catalogue exactly. Promoted slots stay listed
as awaiting recording until their clips are recorded; until then the voice bank
skips them and the existing line plays.

    python scripts/coach_line_slots.py plan              # (re)write the slot list
    python scripts/coach_line_slots.py list [--set colour] [--voice alfie]
    python scripts/coach_line_slots.py import lines/*.json

An import file is one coach's lines, as written by the line writer:

    {"voice": "alfie", "lines": {"positional-passed-actual-white": "...", ...}}
"""

import argparse
import json
import re
import sys
from pathlib import Path

SPEECH = Path(__file__).resolve().parents[1] / "frontend/src/audio/speech"
PLAN = SPEECH / "planned-meanings.json"
CATALOGUE = SPEECH / "meanings.json"
PILOT = SPEECH / "banks/pilot-additions.json"
PILOT_FIELDS = {"walter": "walterText", "rivet": "rivetText"}
# Coaches whose personality asks no questions (see test_coach_bank_scripts.QUESTIONLESS).
QUESTIONLESS = {"ziggy", "orin", "felix", "ember", "scout", "juniper", "waffles", "celeste"}
QUESTIONLESS |= {"jun", "fergus", "marisol", "monty", "ingrid", "tamar"}

SIDES = ("white", "black")
LINES = {
    "actual": "Move played:",
    "alternative": "Better move that was NOT played:",
}
COLOUR_MEANINGS = {
    "passed": "{line} {side} gets a new passed pawn",
    "isolated": "{line} {side} is left with an isolated pawn",
    "doubled": "{line} {side} is left with doubled pawns",
    "rook-open": "{line} {side}'s rook gets an open file (no pawns on it)",
    "rook-semi-open": (
        "{line} {side}'s rook gets a semi-open file (none of its own pawns, "
        "at least one enemy pawn)"
    ),
}
DEFENDER_MEANINGS = {
    "support": "{line} {side}'s {piece} gains a defender it did not have",
    "unsupported": "{line} {side}'s {piece} loses its last defender",
}
DEFENDER_PIECES = ("knight", "bishop", "rook", "queen")
DEVELOPMENT = "{line} a {piece} leaves its starting square for the first time"
DEVELOPMENT_TAKES = 4


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


def write(path, data):
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def voices():
    """Every coach voice that writes the catalogue, Walter and Rivet included."""
    registry = read(SPEECH / "banks/registry.json")["banks"]
    return sorted(bank["voiceId"] for bank in registry)


def slots():
    """The planned slots, in the order they join the catalogue."""
    rows = []
    for name, when in COLOUR_MEANINGS.items():
        for line, wording in LINES.items():
            for side in SIDES:
                rows.append(
                    {
                        "id": f"positional-{name}-{line}-{side}",
                        "colourOf": f"positional-{name}-{line}",
                        "side": side,
                        "set": "colour",
                        "when": when.format(line=wording, side=side.capitalize()),
                    }
                )
    # Defender lines name the colour and the piece. They join the recorded
    # piece-named lines as extra takes rather than replacing them.
    for name, when in DEFENDER_MEANINGS.items():
        for line, wording in LINES.items():
            for piece in DEFENDER_PIECES:
                for side in SIDES:
                    rows.append(
                        {
                            "id": f"positional-{name}-{line}-{piece}-{side}",
                            "takeOf": f"positional-{name}-{line}-{piece}",
                            "side": side,
                            "set": "colour",
                            "when": when.format(line=wording, side=side.capitalize(), piece=piece),
                        }
                    )
    for line, wording in LINES.items():
        for piece in ("knight", "bishop"):
            for take in range(2, DEVELOPMENT_TAKES + 2):
                rows.append(
                    {
                        "id": f"positional-development-{line}-{piece}-{take}",
                        "takeOf": f"positional-development-{line}-{piece}",
                        "set": "development",
                        "when": DEVELOPMENT.format(line=wording, piece=piece),
                    }
                )
    return rows


def plan(_args):
    catalogue = {row["id"]: row for row in read(CATALOGUE)["meanings"]}
    old = read(PLAN) if PLAN.exists() else {"slots": [], "awaitingRecording": []}
    texts = {row["id"]: row.get("texts", {}) for row in old["slots"]}
    rows = []
    for row in slots():
        base = catalogue.get(row.get("colourOf") or row["takeOf"])
        if base is None:
            sys.exit(f"{row['id']}: base meaning is not in the catalogue")
        if row["id"] in catalogue:
            continue  # Already promoted.
        rows.append({**row, "group": base["group"], "texts": texts.get(row["id"], {})})
    write(PLAN, {"schemaVersion": 1, "slots": rows, "awaitingRecording": old["awaitingRecording"]})
    print(f"{len(rows)} planned slots per coach")


def list_slots(args):
    for row in read(PLAN)["slots"]:
        if args.set and row["set"] != args.set:
            continue
        if args.voice and args.voice in row["texts"]:
            continue
        print(f"{row['id']}\t{row['when']}")


def check_text(voice, key, text):
    problems = []
    if not isinstance(text, str) or not text.strip():
        return [f"{voice}/{key}: empty line"]
    if text.strip() != text or not text.endswith((".", "?", "!")):
        problems.append(f"{voice}/{key}: must end with . ? or ! and have no outer spaces")
    if len(text) > 1000 or any(mark in text for mark in ("{", "}", "TODO", "TBD")):
        problems.append(f"{voice}/{key}: too long or has a placeholder")
    # The same checks the bank tests make (backend/tests/test_coach_bank_scripts.py).
    if re.search(r"\b[a-h][1-8]\b|\d", text):
        problems.append(f"{voice}/{key}: no squares, digits or move numbers")
    if re.search(
        r"\bseparate(?:ly)?\b|continuation|\b(?:the|model) evidence\b", text, re.IGNORECASE
    ):
        problems.append(f"{voice}/{key}: avoid 'separate', 'continuation' and 'the evidence'")
    if "?" in text and voice in QUESTIONLESS:
        problems.append(f"{voice}/{key}: this coach never asks questions")
    return problems


def promote(plan_data):
    """Moves every slot that all coaches have written into the catalogue and scripts."""
    everyone = voices()
    ready = [row for row in plan_data["slots"] if set(everyone) <= row["texts"].keys()]
    if not ready:
        return 0
    catalogue = read(CATALOGUE)
    meanings = catalogue["meanings"]
    for row in ready:
        base = row.get("colourOf") or row["takeOf"]
        family = {base}
        index = next(i for i, item in enumerate(meanings) if item["id"] == base)
        # After the base and everything already hanging off it.
        while index + 1 < len(meanings):
            item = meanings[index + 1]
            parent = item.get("variantOf") or item.get("colourOf") or item.get("takeOf")
            if parent not in family:
                break
            family.add(item["id"])
            index += 1
        entry = {"id": row["id"], "group": row["group"]}
        entry |= {key: row[key] for key in ("colourOf", "takeOf", "side") if key in row}
        meanings.insert(index + 1, entry)
    write(CATALOGUE, catalogue)
    order = [item["id"] for item in meanings]
    texts = {row["id"]: row["texts"] for row in ready}
    for voice in everyone:
        if voice in PILOT_FIELDS:
            continue
        path = SPEECH / f"banks/{voice}/scripts.json"
        scripts = read(path)
        records = {record["id"]: record for record in scripts["records"]}
        for row in ready:
            records[row["id"]] = {
                "id": row["id"],
                "group": row["group"],
                "text": texts[row["id"]][voice],
            }
        scripts["records"] = [records[key] for key in order]
        write(path, scripts)
    pilot = read(PILOT)
    for row in ready:
        pilot["recordings"].append(
            {"id": row["id"], "group": row["group"]}
            | {field: texts[row["id"]][voice] for voice, field in PILOT_FIELDS.items()}
        )
    write(PILOT, pilot)
    promoted = {row["id"] for row in ready}
    plan_data["slots"] = [row for row in plan_data["slots"] if row["id"] not in promoted]
    plan_data["awaitingRecording"] += [row["id"] for row in ready]
    return len(ready)


def import_lines(args):
    plan_data = read(PLAN)
    slots_by_id = {row["id"]: row for row in plan_data["slots"]}
    everyone = set(voices())
    problems, count = [], 0
    for name in args.files:
        data = read(Path(name))
        voice, lines = data.get("voice"), data.get("lines")
        if voice not in everyone or not isinstance(lines, dict):
            problems.append(f"{name}: needs a known 'voice' and a 'lines' object")
            continue
        for key, text in lines.items():
            if key not in slots_by_id:
                problems.append(f"{voice}/{key}: not a planned slot")
                continue
            problems += check_text(voice, key, text)
            slots_by_id[key]["texts"][voice] = text
            count += 1
    # Each coach's lines must all differ, from each other and from its script.
    for voice in everyone:
        texts = [row["texts"][voice] for row in plan_data["slots"] if voice in row["texts"]]
        if voice in PILOT_FIELDS:
            texts += [row[PILOT_FIELDS[voice]] for row in read(PILOT)["recordings"]]
        else:
            texts += [
                row["text"] for row in read(SPEECH / f"banks/{voice}/scripts.json")["records"]
            ]
        repeated = sorted({text for text in texts if texts.count(text) > 1})
        problems += [f"{voice}: line used twice: {text}" for text in repeated]
    if problems:
        sys.exit("Nothing imported:\n" + "\n".join(problems))
    promoted = promote(plan_data)
    write(PLAN, plan_data)
    print(
        f"Imported {count} lines; {promoted} slots now have every coach and joined the catalogue."
    )


def main():
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    commands = parser.add_subparsers(required=True)
    commands.add_parser("plan").set_defaults(run=plan)
    listing = commands.add_parser("list")
    listing.add_argument("--set", choices=["colour", "development"])
    listing.add_argument("--voice", help="only slots this coach has not written yet")
    listing.set_defaults(run=list_slots)
    importing = commands.add_parser("import")
    importing.add_argument("files", nargs="+")
    importing.set_defaults(run=import_lines)
    args = parser.parse_args()
    args.run(args)


if __name__ == "__main__":
    main()
