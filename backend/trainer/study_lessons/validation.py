"""Reject ambiguous continuations before authored material can become a lesson."""

from trainer.study_lessons.content import (
    Branch,
    Decision,
    Demonstration,
    Explanation,
    GameExcerpt,
    Rehearsal,
)


def unique(items, label):
    if len({item.id for item in items}) != len(items):
        raise ValueError(f"Duplicate {label} ID")


def validate_course(course):
    unique(course.chapters, "chapter")
    unique(course.lines, "line")
    unique(course.games, "game")
    for chapter in course.chapters:
        validate_chapter(course, chapter)


def validate_chapter(course, chapter):
    unique(chapter.steps, "step")
    steps = {step.id: step for step in chapter.steps}
    if chapter.entry_step not in steps:
        raise ValueError("Unknown chapter entry step")
    links = {step.id: [] for step in chapter.steps}

    def connect(step, target, result, *, branch=False):
        if target is None:
            return
        if target not in steps:
            raise ValueError(f"Unknown lesson transition target: {target}")
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
            raise ValueError(f"Lesson transition to {target} has incompatible chess history")
        links[step.id].append(target)

    for step in chapter.steps:
        result = step.position
        if isinstance(step, Demonstration):
            result = result.after(step.moves)
        elif isinstance(step, Decision):
            if result.board().turn != (course.learner_color == "white"):
                raise ValueError("Lesson decisions must belong to the learner")
            if step.next_step is not None:
                raise ValueError("Decision continuations belong to each accepted choice")
            if len({choice.uci for choice in step.choices}) != len(step.choices):
                raise ValueError("Duplicate decision answer")
            for choice in step.choices:
                connect(step, choice.next_step, result.after((choice.uci, *choice.reply)))
            continue
        elif isinstance(step, Branch):
            connect(step, step.branch_start, result, branch=True)
        elif isinstance(step, GameExcerpt):
            try:
                game = course.game(step.game_id)
            except StopIteration as exc:
                raise ValueError("Unknown excerpt game") from exc
            if not step.from_ply < step.to_ply <= len(game.moves):
                raise ValueError("Invalid game excerpt bounds")
            if result != game.position.after(game.moves[: step.from_ply]):
                raise ValueError("Excerpt position must retain its source game history")
            result = game.position.after(game.moves[: step.to_ply])
        elif isinstance(step, Rehearsal):
            try:
                line = course.line(step.line_id)
            except StopIteration as exc:
                raise ValueError("Unknown rehearsal line") from exc
            if result != line.position:
                raise ValueError("Rehearsal must begin at its selected line's position")
            board = result.board()
            if not any(
                board.turn == (course.learner_color == "white")
                if ply % 2 == 0
                else board.turn != (course.learner_color == "white")
                for ply in range(len(line.moves))
            ):
                raise ValueError("Rehearsal must include a learner decision")
            result = result.after(line.moves)
        connect(step, step.next_step, result)

    visited, pending = set(), set()

    def walk(step_id, in_branch=False):
        identity = (step_id, in_branch)
        if step_id in pending:
            raise ValueError("Lesson transitions must not form a cycle")
        if identity in visited:
            return
        step = steps[step_id]
        if in_branch and isinstance(step, Branch):
            raise ValueError("Only one lesson branch may be active at a time")
        visited.add(identity)
        pending.add(step_id)
        for target in links[step_id]:
            walk(target, in_branch or (isinstance(step, Branch) and target == step.branch_start))
        pending.remove(step_id)

    walk(chapter.entry_step)
    if {item[0] for item in visited} != set(steps):
        raise ValueError("Every authored lesson step must be reachable")
