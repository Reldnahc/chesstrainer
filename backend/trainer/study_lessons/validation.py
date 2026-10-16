"""Reject ambiguous continuations before authored material can become a lesson."""

from trainer.study_lessons.content import (
    Branch,
    Decision,
    Explanation,
    GameExcerpt,
    Rehearsal,
)


class StepProblem(ValueError):
    """A problem in one chapter, and in one step when ``step`` is set, so the lesson
    editor can mark where it is without reading the message."""

    def __init__(self, message, chapter, step=None):
        super().__init__(message)
        self.chapter = chapter
        self.step = step


def unique(items, label):
    if len({item.id for item in items}) != len(items):
        raise ValueError(f"Duplicate {label} ID")


def first_duplicate(items):
    seen = set()
    for item in items:
        if item.id in seen:
            return item.id
        seen.add(item.id)
    return None


def step_start(course, step):
    """Where a rehearsal or game excerpt begins: its line, or its game at ``from_ply``."""
    if step.kind == "rehearsal":
        return course.line(step.line_id).position
    if step.kind == "game_excerpt":
        game = course.game(step.game_id)
        return game.position.after(game.moves[: step.from_ply])
    return step.position


def step_result(course, step, choice=None):
    """Where a step leaves the board: after its moves, or after ``choice`` and its reply.

    The validator and the course-file writer both read positions through this,
    so a course always saves to a file that loads back to the same positions.
    """
    if step.kind == "demonstration":
        return step.position.after(step.moves)
    if step.kind == "decision":
        return step.position if choice is None else step.position.after((choice.uci, *choice.reply))
    if step.kind == "rehearsal":
        line = course.line(step.line_id)
        return line.position.after(line.moves)
    if step.kind == "game_excerpt":
        game = course.game(step.game_id)
        return game.position.after(game.moves[: step.to_ply])
    return step.position


def validate_course(course):
    unique(course.chapters, "chapter")
    unique(course.lines, "line")
    unique(course.games, "game")
    for chapter in course.chapters:
        validate_chapter(course, chapter)


def validate_chapter(course, chapter):
    def problem(message, step_id=None):
        return StepProblem(message, chapter.id, step_id)

    duplicate = first_duplicate(chapter.steps)
    if duplicate is not None:
        raise problem("Duplicate step ID", duplicate)
    steps = {step.id: step for step in chapter.steps}
    if chapter.entry_step not in steps:
        raise problem("Unknown chapter entry step")
    links = {step.id: [] for step in chapter.steps}

    def connect(step, target, result, *, branch=False):
        if target is None:
            return
        if target not in steps:
            raise problem(f"Unknown lesson transition target: {target}", step.id)
        destination = steps[target]
        # These two kinds explicitly establish a new authored game/line context.
        reset = isinstance(destination, (GameExcerpt, Rehearsal)) and not branch
        # An explanation may introduce a separate example from another starting
        # position; within one starting position the history must still continue.
        reset |= (
            isinstance(destination, Explanation)
            and not branch
            and destination.position.initial_fen != result.initial_fen
        )
        if not reset and destination.position != result:
            raise problem(f"Lesson transition to {target} has incompatible chess history", step.id)
        links[step.id].append(target)

    for step in chapter.steps:
        result = step.position
        if isinstance(step, Decision):
            if result.board().turn != (course.learner_color == "white"):
                raise problem("Lesson decisions must belong to the learner", step.id)
            if step.next_step is not None:
                raise problem("Decision continuations belong to each accepted choice", step.id)
            if len({choice.uci for choice in step.choices}) != len(step.choices):
                raise problem("Duplicate decision answer", step.id)
            for choice in step.choices:
                connect(step, choice.next_step, step_result(course, step, choice))
            continue
        elif isinstance(step, Branch):
            connect(step, step.branch_start, result, branch=True)
        elif isinstance(step, GameExcerpt):
            try:
                game = course.game(step.game_id)
            except StopIteration as exc:
                raise problem("Unknown excerpt game", step.id) from exc
            if not step.from_ply < step.to_ply <= len(game.moves):
                raise problem("Invalid game excerpt bounds", step.id)
            if result != step_start(course, step):
                raise problem("Excerpt position must retain its source game history", step.id)
        elif isinstance(step, Rehearsal):
            try:
                line = course.line(step.line_id)
            except StopIteration as exc:
                raise problem("Unknown rehearsal line", step.id) from exc
            if result != line.position:
                raise problem("Rehearsal must begin at its selected line's position", step.id)
            board = result.board()
            if not any(
                board.turn == (course.learner_color == "white")
                if ply % 2 == 0
                else board.turn != (course.learner_color == "white")
                for ply in range(len(line.moves))
            ):
                raise problem("Rehearsal must include a learner decision", step.id)
        connect(step, step.next_step, step_result(course, step))

    visited, pending = set(), set()

    def walk(step_id, in_branch=False):
        identity = (step_id, in_branch)
        if step_id in pending:
            raise problem("Lesson transitions must not form a cycle", step_id)
        if identity in visited:
            return
        step = steps[step_id]
        if in_branch and isinstance(step, Branch):
            raise problem("Only one lesson branch may be active at a time", step_id)
        visited.add(identity)
        pending.add(step_id)
        for target in links[step_id]:
            walk(target, in_branch or (isinstance(step, Branch) and target == step.branch_start))
        pending.remove(step_id)

    walk(chapter.entry_step)
    reached = {item[0] for item in visited}
    unreached = [step.id for step in chapter.steps if step.id not in reached]
    if unreached:
        raise problem("Every authored lesson step must be reachable", unreached[0])
