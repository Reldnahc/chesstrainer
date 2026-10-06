"""Planned coach line slots and the import path for their written lines.

The planned slots live in frontend/src/audio/speech/planned-meanings.json, with
the lines imported so far. A slot enters the meaning catalogue, every coach's
script and the Walter/Rivet additions only once all 30 coaches have its line,
because each script must cover the catalogue exactly. Promoted slots stay listed
as awaiting recording until their clips are recorded; until then the voice bank
skips them and the existing line plays.

    python scripts/coach_line_slots.py plan              # (re)write the slot list
    python scripts/coach_line_slots.py list [--set colour] [--voice alfie]
    python scripts/coach_line_slots.py prompt --voice alfie [--set colour]
    python scripts/coach_line_slots.py prompt --voice all --out prompts/
    python scripts/coach_line_slots.py import lines/*.json

An import file is one coach's lines, as written by the line writer:

    {"voice": "alfie", "lines": {"positional-passed-actual-white": "...", ...}}
"""

import argparse
import json
import re
import sys
import unicodedata
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
# Extra takes for the most repeated lines: (meaning, new takes, when it plays, learner-only).
# Learner-only lines always speak to the learner, so they may say "you".
EXTRA_TAKES = [
    (
        "evaluation-loss",
        4,
        "the move played is worse than the engine's best move, with no specific tactic to name",
        False,
    ),
    (
        "immediate-capture",
        4,
        "after the move played, the other side has a capture straight away",
        False,
    ),
    (
        "chance-taken",
        3,
        "the learner's move makes use of the opponent's mistake on the move before",
        True,
    ),
    (
        "stronger-alternative",
        3,
        "the engine prefers a different move to the one played (it can play on its own, so it must make sense without an earlier sentence)",
        False,
    ),
    (
        "positional-passer-advance-actual",
        2,
        "the move played pushes a pawn that is already passed one step nearer promotion",
        False,
    ),
    ("reply-check", 2, "the strongest reply to the move played gives check", False),
    (
        "positional-castling-actual",
        1,
        "the move played is castling (either side, kingside or queenside); it plays when both sides castle on"
        " consecutive moves, so it must differ from the coach's existing castling line",
        False,
    ),
    (
        "only-playable-move",
        3,
        "of the moves checked, the move played was the only one that kept the position playable;"
        " every other move checked was losing",
        False,
    ),
    ("lesson-correct-move", 3, "in a lesson, the learner played the move the lesson teaches", True),
    (
        "puzzle-next-move",
        3,
        "in a puzzle, the learner found the right move and the puzzle continues",
        True,
    ),
    (
        "opening-recall-accepted",
        3,
        "in opening practice, the learner played the move from the opening they are studying",
        True,
    ),
]
# Grade takes are numbered per grade (grade-best-1 to -4 today) and play when a move
# has nothing more specific to say.
EXTRA_GRADE_TAKES = {
    "best": "the move is graded Best (the engine's top choice) and there is nothing more specific to say",
    "good": "the move is graded Good (a sound move, not the engine's top choice) and there is nothing more specific to say",
}
GRADE_TAKES, EXTRA_GRADE_COUNT = 4, 2


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
    for meaning, count, when, learner in EXTRA_TAKES:
        for take in range(2, count + 2):
            rows.append(
                {"id": f"{meaning}-{take}", "takeOf": meaning, "set": "takes", "when": when}
                | ({"learner": True} if learner else {})
            )
    for grade, when in EXTRA_GRADE_TAKES.items():
        for take in range(GRADE_TAKES + 1, GRADE_TAKES + EXTRA_GRADE_COUNT + 1):
            rows.append(
                {
                    "id": f"grade-{grade}-{take}",
                    "after": f"grade-{grade}-{take - 1}",
                    "set": "takes",
                    "when": when,
                    "examples": [f"grade-{grade}-{n}" for n in range(1, GRADE_TAKES + 1)],
                }
            )
    return rows


def base_of(row):
    """The meaning a slot belongs to, or (for numbered grade takes) the one it follows."""
    return row.get("colourOf") or row.get("takeOf") or row["after"]


def plan(_args):
    catalogue = {row["id"]: row for row in read(CATALOGUE)["meanings"]}
    old = read(PLAN) if PLAN.exists() else {"slots": [], "awaitingRecording": []}
    texts = {row["id"]: row.get("texts", {}) for row in old["slots"]}
    rows = []
    planned = {}
    for row in slots():
        # A slot may follow another planned slot (grade-best-6 after grade-best-5).
        base = catalogue.get(base_of(row)) or planned.get(base_of(row))
        planned[row["id"]] = row | {"group": base["group"]} if base else row
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


def existing_lines(voice):
    """A coach's current line for each meaning it has written."""
    if voice in PILOT_FIELDS:
        manifest = "bank/manifest.json" if voice == "walter" else "banks/rivet/manifest.json"
        lines = {row["id"]: row["text"] for row in read(SPEECH / manifest)["recordings"]}
        field = PILOT_FIELDS[voice]
        return lines | {row["id"]: row[field] for row in read(PILOT)["recordings"]}
    return {
        row["id"]: row["text"] for row in read(SPEECH / f"banks/{voice}/scripts.json")["records"]
    }


def section(path, heading, level):
    """The text under a heading, up to the next heading of the same or higher level."""
    found, out = False, []
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.startswith("#") and len(line) - len(line.lstrip("#")) <= level and found:
            break
        found = found or heading(line)
        if found:
            out.append(line)
    return "\n".join(out).strip()


def prompt_text(voice, only_set=None):
    """A ready-to-paste writing request for one coach, or None when it has nothing left."""
    docs = SPEECH.parents[3] / "docs"
    plain = unicodedata.normalize("NFKD", voice).encode("ascii", "ignore").decode()

    def is_coach(line):
        name = unicodedata.normalize("NFKD", line).encode("ascii", "ignore").decode().lower()
        return re.match(rf"### \d+\. {re.escape(plain.lower())}\b", name) is not None

    bible = section(docs / "COACH_CAST_BIBLE.md", is_coach, 3)
    rules = section(
        docs / "COACH_CREATION_GUIDE.md",
        lambda line: "Dialogue writing and review rules" in line,
        3,
    )
    rows = [
        row
        for row in read(PLAN)["slots"]
        if voice not in row["texts"] and (not only_set or row["set"] == only_set)
    ]
    if not bible:
        sys.exit(f"{voice}: no such coach in docs/COACH_CAST_BIBLE.md")
    if not rows:
        return None
    current = existing_lines(voice)
    bases = list(dict.fromkeys(key for row in rows for key in row.get("examples", [base_of(row)])))
    examples = "\n".join(f"- {key}: {current[key]}" for key in bases if key in current)
    slots_text = "\n".join(
        f"- {row['id']}: {row['when']}{' (learner line)' if row.get('learner') else ''}"
        for row in rows
    )
    return f"""You are writing spoken lines for a chess coach in a chess training app.
Each line is recorded as audio and played when a move in a reviewed game matches its slot.

THE COACH
{bible}

THE RULES (follow all of them)
{rules}

EXTRA RULES
- One to three short sentences, as this coach would say them out loud.
- Never name a square (like e4), a number, or a move number.
- Never say "you", "your" or "our": the line can play on either player's move.
  Only slots marked (learner line) always speak to the learner and may say "you".
- Name the colour (White or Black) when the slot names it, and the piece when it names one.
- Every line must be different from every other line, and from the coach's current lines below.
- Only claim what is true every time the slot can play.

THE COACH'S CURRENT LINE FOR EACH MOMENT (match this voice; do not copy the wording)
{examples}

SLOTS TO WRITE (one line each)
{slots_text}

Reply with only this JSON and nothing else:
{{"voice": "{voice}", "lines": {{"<slot id>": "<line>", ...}}}}
"""


def prompt(args):
    """Prints one coach's request, or writes every coach's into a folder."""
    if args.voice != "all":
        sys.stdout.reconfigure(encoding="utf-8")
        print(prompt_text(args.voice, args.set) or "Nothing left for this coach to write.")
        return
    out = Path(args.out or "coach-line-prompts")
    out.mkdir(parents=True, exist_ok=True)
    for voice in voices():
        text = prompt_text(voice, args.set)
        if text:
            (out / f"{voice}.txt").write_text(text, encoding="utf-8")
    print(f"Wrote the prompts to {out.resolve()}")


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
        base = base_of(row)
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
    listing.add_argument("--set", choices=["colour", "development", "takes"])
    listing.add_argument("--voice", help="only slots this coach has not written yet")
    listing.set_defaults(run=list_slots)
    writing = commands.add_parser("prompt")
    writing.add_argument("--voice", required=True, help="coach voice id such as alfie, or all")
    writing.add_argument("--out", help="folder for --voice all (default coach-line-prompts)")
    writing.add_argument("--set", choices=["colour", "development", "takes"])
    writing.set_defaults(run=prompt)
    importing = commands.add_parser("import")
    importing.add_argument("files", nargs="+")
    importing.set_defaults(run=import_lines)
    args = parser.parse_args()
    args.run(args)


if __name__ == "__main__":
    main()
