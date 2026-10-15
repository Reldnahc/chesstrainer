"""Readable course files: SAN moves, steps in order, positions carried forward.

A course file is JSON that a person or the lesson editor can write. Loading it
produces the validated ``CourseDefinition`` that lessons, snapshots and content
hashes already use, so the file format can stay friendly without changing what
a saved lesson remembers.

Positions are implied wherever the course graph already determines them. A
step without ``position`` starts where the first step that leads to it (in file
order) ended; the first step of a chapter starts from the initial position. A
rehearsal starts where its line starts and a game excerpt where its game
reaches ``from``. ``next`` defaults to the following step in the chapter.
"""

import copy
from typing import Literal

import chess
from pydantic import ConfigDict, Field, ValidationError

from trainer.contracts.common import Contract
from trainer.errors import InvalidInput
from trainer.study_lessons.content import CourseDefinition, Position
from trainer.study_lessons.validation import step_result, step_start

FORMAT = "fieldwork-course-1"
DEFAULT_FEEDBACK = "That is a move taught in this lesson."


class CourseFileError(InvalidInput):
    """A course file that cannot become a lesson, or a course ledger that cannot be read.

    The message names the place; requests answer 422 with it.
    """


class FileModel(Contract):
    model_config = ConfigDict(extra="forbid", frozen=True)


class Credit(FileModel):
    text: str = Field(min_length=1)
    url: str | None = None
    license: str | None = None


class Marks(FileModel):
    squares: tuple[str, ...] = ()
    arrows: tuple[str, ...] = ()


class FileChoice(FileModel):
    move: str
    reply: str | None = None
    feedback: str = DEFAULT_FEEDBACK
    next: str | None = "__following__"


class FileStep(Marks):
    id: str
    title: str
    text: str = ""
    fen: str | None = None
    position: str | None = None
    next: str | None = "__following__"
    # Exactly one of these (or none, for an explanation) gives the step's kind.
    show: str | None = None
    move: str | None = None
    reply: str | None = None
    feedback: str | None = None
    hint: str | None = None
    choices: tuple[FileChoice, ...] | None = Field(default=None, min_length=1)
    branch: str | None = None
    game: str | None = None
    from_ply: int | None = Field(default=None, alias="from")
    to_ply: int | None = Field(default=None, alias="to")
    rehearse: str | None = None

    model_config = ConfigDict(extra="forbid", frozen=True, populate_by_name=True)


class FileChapter(FileModel):
    id: str
    title: str
    entry: str | None = None
    steps: tuple[FileStep, ...] = Field(min_length=1)


class FileLine(FileModel):
    id: str
    title: str
    fen: str | None = None
    position: str = ""
    moves: str
    repertoire: bool = False
    eco: str | None = None


class FileNote(Marks):
    ply: int
    text: str


class FileGame(FileModel):
    id: str
    title: str
    fen: str | None = None
    position: str = ""
    moves: str
    notes: tuple[FileNote, ...] = ()
    credits: tuple[Credit, ...] = Field(min_length=1)


class CourseFile(FileModel):
    format: Literal["fieldwork-course-1"]
    id: str
    revision: str
    title: str
    description: str = ""
    side: Literal["white", "black"]
    topic: Literal["opening", "skills"] = "opening"
    credits: tuple[Credit, ...] = Field(min_length=1)
    lines: tuple[FileLine, ...] = ()
    games: tuple[FileGame, ...] = ()
    chapters: tuple[FileChapter, ...] = Field(min_length=1)


# --- Reading ---------------------------------------------------------------


def san_moves(where, san, fen=None, history=()):
    """UCI for SAN tokens played after ``history`` from ``fen``."""
    try:
        board = chess.Board(fen or chess.STARTING_FEN)
    except ValueError as exc:
        raise CourseFileError(f"{where}: the FEN {fen!r} cannot be read") from exc
    if not board.is_valid():
        raise CourseFileError(f"{where}: the FEN {fen!r} is not a legal chess position")
    for uci in history:
        board.push_uci(uci)
    moves = []
    for token in (san or "").split():
        try:
            move = board.parse_san(token)
        except ValueError as exc:
            raise CourseFileError(f"{where}: {token} is not a legal move here") from exc
        moves.append(move.uci())
        board.push(move)
    return tuple(moves)


def marks(item):
    arrows = []
    for arrow in item.arrows:
        start, _, end = arrow.partition("-")
        arrows.append(dict(from_square=start, to_square=end))
    return dict(squares=list(item.squares), arrows=arrows)


def credit(item):
    return item.model_dump(exclude_none=True)


def kind_of(step):
    kinds = [
        name
        for name, present in (
            ("demonstration", step.show is not None),
            ("decision", step.move is not None or step.choices is not None),
            ("branch", step.branch is not None),
            ("game_excerpt", step.game is not None),
            ("rehearsal", step.rehearse is not None),
        )
        if present
    ]
    if len(kinds) > 1:
        raise CourseFileError(f"Step {step.id} mixes {' and '.join(kinds)} fields")
    kind = kinds[0] if kinds else "explanation"
    if step.move is not None and step.choices is not None:
        raise CourseFileError(f"Step {step.id} has both move and choices")
    if kind != "decision" and any(
        value is not None for value in (step.reply, step.feedback, step.hint)
    ):
        raise CourseFileError(f"Step {step.id}: reply, feedback and hint belong to a decision")
    if kind != "game_excerpt" and (step.from_ply is not None or step.to_ply is not None):
        raise CourseFileError(f"Step {step.id}: from and to belong to a game excerpt")
    return kind


def parse(data):
    try:
        return CourseFile.model_validate(data)
    except ValidationError as exc:
        problem = exc.errors()[0]
        place = " → ".join(str(part) for part in problem["loc"])
        raise CourseFileError(f"{place}: {problem['msg']}") from exc


def sources(source):
    """Lines and games as course records, and both by id for steps that refer to them."""
    lines = []
    for line in source.lines:
        if not line.moves.split():
            raise CourseFileError(f"Line {line.id} needs at least one move")
        setup = san_moves(f"Line {line.id}", line.position, line.fen)
        lines.append(
            dict(
                id=line.id,
                title=line.title,
                position=dict(initial_fen=line.fen or chess.STARTING_FEN, moves=setup),
                moves=san_moves(f"Line {line.id}", line.moves, line.fen, setup),
                repertoire=line.repertoire,
                eco=line.eco or None,
            )
        )
    games = []
    for game in source.games:
        setup = san_moves(f"Game {game.id}", game.position, game.fen)
        games.append(
            dict(
                id=game.id,
                title=game.title,
                position=dict(initial_fen=game.fen or chess.STARTING_FEN, moves=setup),
                moves=san_moves(f"Game {game.id}", game.moves, game.fen, setup),
                annotations=[
                    dict(ply=note.ply, text=note.text, annotations=marks(note))
                    for note in game.notes
                ],
                attributions=[credit(item) for item in game.credits],
            )
        )
    known = dict(
        lines={line["id"]: line for line in lines}, games={game["id"]: game for game in games}
    )
    return lines, games, known


def load(data):
    """Return ``(CourseDefinition, topic)`` for a parsed JSON course file."""
    source = parse(data)
    lines, games, known = sources(source)
    record = dict(
        id=source.id,
        revision=source.revision,
        title=source.title,
        description=source.description,
        learner_color=source.side,
        attributions=[credit(item) for item in source.credits],
        lines=lines,
        games=games,
        chapters=[chapter_record(chapter, known) for chapter in source.chapters],
    )
    try:
        course = CourseDefinition.model_validate(record)
    except ValidationError as exc:
        problem = exc.errors()[0]
        raise CourseFileError(problem["msg"].removeprefix("Value error, ")) from exc
    return course, source.topic


def chapter_record(chapter, known):
    """Resolve one chapter of a course file into course records.

    This reads the file's own SAN records before any course exists, so it cannot
    share ``validation.step_result``; ``dump`` proves after every save that the
    two agree, by loading the written file back.
    """
    where = f"Chapter {chapter.id}"
    order = [step.id for step in chapter.steps]
    if len(set(order)) != len(order):
        raise CourseFileError(f"{where} has two steps with the same id")
    following = {
        step_id: order[index + 1] if index + 1 < len(order) else None
        for index, step_id in enumerate(order)
    }
    by_id = {step.id: step for step in chapter.steps}
    entry = chapter.entry or order[0]
    kinds = {step.id: kind_of(step) for step in chapter.steps}

    def target(step, value):
        return following[step.id] if value == "__following__" else value

    def decision_choices(step):
        if step.choices is not None:
            return [
                (choice.move, choice.reply, choice.feedback, target(step, choice.next))
                for choice in step.choices
            ]
        feedback = DEFAULT_FEEDBACK if step.feedback is None else step.feedback
        return [(step.move, step.reply, feedback, target(step, step.next))]

    # The first link into each step, in file order, decides an implied position.
    incoming = {}
    for step in chapter.steps:
        if kinds[step.id] == "decision":
            links = [
                (choice_next, index)
                for index, (*_, choice_next) in enumerate(decision_choices(step))
            ]
        else:
            links = [(target(step, step.next), None)]
            if kinds[step.id] == "branch":
                links.insert(0, (step.branch, "branch"))
        for destination, via in links:
            if destination is not None and destination in by_id:
                incoming.setdefault(destination, (step.id, via))

    positions, results, resolving = {}, {}, set()

    def position_of(step_id):
        if step_id in positions:
            return positions[step_id]
        if step_id in resolving:
            raise CourseFileError(f"{where}: step {step_id} leads back to itself")
        resolving.add(step_id)
        step = by_id[step_id]
        label = f"{where}, step {step_id}"
        if step.position is not None or step.fen is not None:
            fen = step.fen or chess.STARTING_FEN
            found = (fen, san_moves(label, step.position, step.fen))
        elif kinds[step_id] == "rehearsal":
            line = known["lines"].get(step.rehearse)
            if line is None:
                raise CourseFileError(f"{label} rehearses an unknown line {step.rehearse}")
            found = (line["position"]["initial_fen"], line["position"]["moves"])
        elif kinds[step_id] == "game_excerpt":
            game = known["games"].get(step.game)
            if game is None:
                raise CourseFileError(f"{label} shows an unknown game {step.game}")
            start = step.from_ply or 0
            found = (
                game["position"]["initial_fen"],
                (*game["position"]["moves"], *game["moves"][:start]),
            )
        elif step_id == entry:
            found = (chess.STARTING_FEN, ())
        elif step_id in incoming:
            found = result_of(*incoming[step_id])
        else:
            raise CourseFileError(f"{label} cannot be reached, so it needs its own position")
        resolving.discard(step_id)
        positions[step_id] = found
        return found

    def result_of(step_id, via):
        if (step_id, via) in results:
            return results[(step_id, via)]
        fen, history = position_of(step_id)
        step, kind = by_id[step_id], kinds[step_id]
        label = f"{where}, step {step_id}"
        if kind == "demonstration":
            history = (*history, *san_moves(label, step.show, fen, history))
        elif kind == "decision" and via is not None:
            move, reply, *_ = decision_choices(step)[via]
            played = san_moves(label, move, fen, history)
            history = (*history, *played)
            history = (*history, *san_moves(label, reply, fen, history))
        elif kind == "rehearsal":
            line = known["lines"].get(step.rehearse)
            if line is not None:
                history = (*line["position"]["moves"], *line["moves"])
        elif kind == "game_excerpt":
            game = known["games"].get(step.game)
            if game is not None:
                history = (*game["position"]["moves"], *game["moves"][: step.to_ply or 0])
        results[(step_id, via)] = (fen, history)
        return fen, history

    steps = []
    for step in chapter.steps:
        fen, history = position_of(step.id)
        label = f"{where}, step {step.id}"
        record = dict(
            kind=kinds[step.id],
            id=step.id,
            title=step.title,
            text=step.text,
            position=dict(initial_fen=fen, moves=history),
            annotations=marks(step),
        )
        kind = kinds[step.id]
        if kind == "decision":
            choices = []
            for move, reply, feedback, choice_next in decision_choices(step):
                played = san_moves(label, move, fen, history)
                if not played:
                    raise CourseFileError(f"{label} needs the learner's move")
                answer = san_moves(label, reply, fen, (*history, *played))
                if len(played) != 1 or len(answer) > 1:
                    raise CourseFileError(f"{label}: a decision is one move and one reply")
                choices.append(
                    dict(uci=played[0], reply=answer, next_step=choice_next, feedback=feedback)
                )
            record.update(choices=choices, hint=step.hint, next_step=None)
            if step.next != "__following__" and step.choices is not None:
                raise CourseFileError(f"{label}: with choices, next belongs to each choice")
        else:
            record["next_step"] = target(step, step.next)
            if kind == "demonstration":
                record["moves"] = san_moves(label, step.show, fen, history)
                if not record["moves"]:
                    raise CourseFileError(f"{label} needs at least one move to show")
            elif kind == "branch":
                record["branch_start"] = step.branch
            elif kind == "game_excerpt":
                record.update(game_id=step.game, from_ply=step.from_ply or 0, to_ply=step.to_ply)
            elif kind == "rehearsal":
                record["line_id"] = step.rehearse
        steps.append(record)
    return dict(id=chapter.id, title=chapter.title, entry_step=entry, steps=steps)


def check(data):
    """For the editor: the first problem, if any, and where each step starts and ends.

    Positions are reported for every chapter that resolves, even when another part
    of the course still has a problem, so the editor can keep showing boards.
    """
    unfinished, data = unfinished_steps(data)
    try:
        source = parse(data)
        _, _, known = sources(source)
    except CourseFileError as exc:
        return dict(error=str(exc), steps={})
    problem, steps = (unfinished[0] if unfinished else None), {}
    for chapter in source.chapters:
        try:
            record = chapter_record(chapter, known)
        except CourseFileError as exc:
            problem = problem or str(exc)
            continue
        for step in record["steps"]:
            start = Position(**step["position"]) if _legal(step["position"]) else None
            if start is None:
                continue
            board = start.board()
            end = board.copy()
            if step["kind"] == "decision" and step["choices"]:
                choice = step["choices"][0]
                played = (choice["uci"], *choice["reply"])
            elif step["kind"] == "rehearsal" and step["line_id"] in known["lines"]:
                played = known["lines"][step["line_id"]]["moves"]
            elif step["kind"] == "game_excerpt" and step["game_id"] in known["games"]:
                game = known["games"][step["game_id"]]["moves"]
                played = game[step["from_ply"] : step["to_ply"] or 0]
            else:
                played = step.get("moves", ())
            try:
                for uci in played:
                    end.push_uci(uci)
            except ValueError:
                end = board.copy()
            reached = (
                *start.moves,
                *(move.uci() for move in end.move_stack[len(board.move_stack) :]),
            )
            steps[f"{chapter.id}/{step['id']}"] = dict(
                fen=board.fen(),
                initial_fen=start.initial_fen,
                position=san_text(Position(initial_fen=start.initial_fen), start.moves),
                end_fen=end.fen(),
                end_position=san_text(Position(initial_fen=start.initial_fen), reached),
            )
    if problem is None:
        try:
            load(data)
        except CourseFileError as exc:
            problem = str(exc)
    return dict(error=problem, steps=steps)


def unfinished_steps(data):
    """Treat a decision or demonstration with no moves yet as an explanation.

    The editor creates these while a step is being written; the rest of the
    chapter keeps its boards, and the first one is reported as the problem.
    """
    problems = []
    if not isinstance(data, dict) or not isinstance(data.get("chapters"), list):
        return problems, data
    data = copy.deepcopy(data)
    for chapter in data["chapters"]:
        if not isinstance(chapter, dict) or not isinstance(chapter.get("steps"), list):
            continue
        for step in chapter["steps"]:
            if not isinstance(step, dict):
                continue
            where = f"Chapter {chapter.get('id')}, step {step.get('id')}"
            if step.get("move") == "" and "choices" not in step:
                for field in ("move", "reply", "hint", "feedback"):
                    step.pop(field, None)
                problems.append(f"{where} needs the learner's move")
            if step.get("rehearse") == "":
                step.pop("rehearse")
                problems.append(f"{where} needs a line to rehearse")
            if step.get("show") == "":
                step.pop("show")
                problems.append(f"{where} needs at least one move to show")
    return problems, data


def _legal(position):
    try:
        Position(**position)
    except (ValueError, ValidationError):
        return False
    return True


# --- Writing ---------------------------------------------------------------


def san_text(start, moves):
    board = start.board() if isinstance(start, Position) else start
    board = board.copy()
    tokens = []
    for uci in moves:
        move = chess.Move.from_uci(uci)
        tokens.append(board.san(move))
        board.push(move)
    return " ".join(tokens)


def position_fields(position):
    fields = {}
    if position.initial_fen != chess.STARTING_FEN:
        fields["fen"] = position.initial_fen
    fields["position"] = san_text(Position(initial_fen=position.initial_fen), position.moves)
    return fields


def mark_fields(annotations):
    fields = {}
    if annotations.squares:
        fields["squares"] = list(annotations.squares)
    if annotations.arrows:
        fields["arrows"] = [
            f"{arrow.from_square}-{arrow.to_square}" for arrow in annotations.arrows
        ]
    return fields


def dump(course, topic="opening"):
    """The course file for a ``CourseDefinition``; ``load`` reads it back unchanged."""
    data = dict(format=FORMAT, id=course.id, revision=course.revision, title=course.title)
    if course.description:
        data["description"] = course.description
    data.update(side=course.learner_color, topic=topic)
    data["credits"] = [item.model_dump(exclude_none=True) for item in course.attributions]
    if course.lines:
        data["lines"] = [
            {
                "id": line.id,
                "title": line.title,
                **{key: value for key, value in position_fields(line.position).items() if value},
                "moves": san_text(line.position, line.moves),
                **({"repertoire": True} if line.repertoire else {}),
                **({"eco": line.eco} if line.eco else {}),
            }
            for line in course.lines
        ]
    if course.games:
        data["games"] = [
            {
                "id": game.id,
                "title": game.title,
                **{key: value for key, value in position_fields(game.position).items() if value},
                "moves": san_text(game.position, game.moves),
                **(
                    {
                        "notes": [
                            {"ply": note.ply, "text": note.text, **mark_fields(note.annotations)}
                            for note in game.annotations
                        ]
                    }
                    if game.annotations
                    else {}
                ),
                "credits": [item.model_dump(exclude_none=True) for item in game.attributions],
            }
            for game in course.games
        ]
    data["chapters"] = [dump_chapter(course, chapter) for chapter in course.chapters]
    # Prove the round trip here, so a writer can never emit a file that loads differently.
    loaded, _ = load(data)
    if loaded != course:
        raise CourseFileError(f"Course {course.id} does not survive the file format unchanged")
    return data


def implied_positions(course, chapter):
    """The position the loader would give each step that has none written."""
    order = [step.id for step in chapter.steps]
    following = {
        step_id: order[index + 1] if index + 1 < len(order) else None
        for index, step_id in enumerate(order)
    }
    by_id = {step.id: step for step in chapter.steps}
    incoming = {}
    for step in chapter.steps:
        if step.kind == "decision":
            links = [
                (choice.next_step, step_result(course, step, choice)) for choice in step.choices
            ]
        else:
            links = [(step.next_step, step_result(course, step))]
            if step.kind == "branch":
                links.insert(0, (step.branch_start, step.position))
        for destination, result in links:
            if destination is not None and destination in by_id:
                incoming.setdefault(destination, result)
    implied = {}
    for step in chapter.steps:
        if step.kind in {"rehearsal", "game_excerpt"}:
            implied[step.id] = step_start(course, step)
        elif step.id == chapter.entry_step:
            implied[step.id] = Position()
        else:
            implied[step.id] = incoming.get(step.id)
    return following, implied


def dump_chapter(course, chapter):
    following, implied = implied_positions(course, chapter)
    data = dict(id=chapter.id, title=chapter.title)
    if chapter.entry_step != chapter.steps[0].id:
        data["entry"] = chapter.entry_step
    steps = []
    for step in chapter.steps:
        item = dict(id=step.id, title=step.title)
        if step.text:
            item["text"] = step.text
        if implied[step.id] != step.position:
            item.update(position_fields(step.position))
        item.update(mark_fields(step.annotations))
        if step.kind == "demonstration":
            item["show"] = san_text(step.position, step.moves)
        elif step.kind == "decision":
            board = step.position.board()
            choices = []
            for choice in step.choices:
                after = board.copy()
                move = after.parse_uci(choice.uci)
                entry = {"move": board.san(move)}
                after.push(move)
                if choice.reply:
                    entry["reply"] = after.san(after.parse_uci(choice.reply[0]))
                if choice.feedback != DEFAULT_FEEDBACK:
                    entry["feedback"] = choice.feedback
                if choice.next_step != following[step.id]:
                    entry["next"] = choice.next_step
                choices.append(entry)
            if len(choices) == 1:
                item.update(choices[0])
            else:
                item["choices"] = choices
            if step.hint is not None:
                item["hint"] = step.hint
        elif step.kind == "branch":
            item["branch"] = step.branch_start
        elif step.kind == "game_excerpt":
            item.update({"game": step.game_id, "from": step.from_ply, "to": step.to_ply})
        elif step.kind == "rehearsal":
            item["rehearse"] = step.line_id
        if step.kind != "decision" and step.next_step != following[step.id]:
            item["next"] = step.next_step
        steps.append(item)
    data["steps"] = steps
    return data
