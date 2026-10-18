"""The Black Italian's recall lines rehearse exactly what its chapters teach."""

import chess
from course_claims import built_in


def course():
    return built_in("italian-black-foundations")


# Each optional side trip, by chapter and first step, and the recall line that rehearses it.
TRIP_LINES = {
    ("quiet-development", "early-castle"): "black-castled-first",
    ("quiet-development", "early-knight"): "black-knight-first",
    ("quiet-development", "early-attack"): "black-early-attack",
    ("quiet-development", "early-center"): "black-early-center",
    ("quiet-development", "quiet-knight-threat"): "black-knight-attack",
    ("central-break", "central-push"): "black-central-push",
    ("central-break", "central-queen"): "black-central-queen",
    ("central-break", "central-queen-check"): "black-central-check",
    ("central-break", "central-queen-b3"): "black-central-pressure",
    ("knight-block", "block-queen"): "black-knight-block-queen",
    ("knight-block", "block-moller"): "black-moller-attack",
    ("evans-declined", "evans-flank"): "black-evans-flank",
}


def _after(chapter, identity):
    step = course().chapter(chapter).step(identity)
    return step.position.after((step.choices[0].uci, *step.choices[0].reply)).board()


def _trip_end(chapter, start):
    step = chapter.step(start)
    result = step.position.after(step.moves)
    identity = step.next_step
    while identity is not None:
        step = chapter.step(identity)
        if step.kind == "decision":
            assert step.position == result
            choice = step.choices[0]
            result = result.after((choice.uci, *choice.reply))
            identity = choice.next_step
        else:
            identity = step.next_step
    return result


def test_quiet_plan_rehearses_new_decisions_from_the_learned_castled_position():
    definition = course()
    old_setup = definition.line("black-quiet-italian")
    plan = definition.line("black-quiet-bishop-plan")
    assert plan.position == old_setup.position.after(old_setup.moves)
    chapter = definition.chapter("quiet-bishop-plan")
    assert chapter.step("plan-recall").position == plan.position
    board = plan.position.board()
    decisions = []
    for uci in plan.moves:
        if board.turn == chess.BLACK:
            decisions.append((board.fen(), uci))
        board.push_uci(uci)
    assert decisions == [
        (step.position.board().fen(), step.choices[0].uci)
        for step in chapter.steps
        if step.kind == "decision"
    ]
    assert board.fen() == chapter.step("plan-summary").position.board().fen()


def test_evans_rehearsal_does_not_introduce_untaught_development_decisions():
    definition = course()
    chapter = definition.chapter("evans-declined")
    guided = {
        (step.position.board().fen(), choice.uci)
        for step in chapter.steps
        if step.kind == "decision"
        for choice in step.choices
    }
    line = definition.line("black-evans-declined")
    board = line.position.board()
    evans_seen = False
    for uci in line.moves:
        if uci == "b2b4":
            evans_seen = True
        if evans_seen and board.turn == chess.BLACK:
            assert (board.fen(), uci) in guided
        board.push_uci(uci)
    developed = _after("evans-declined", "evans-develop")
    assert chess.F6 in developed.attackers(chess.BLACK, chess.E4)
    assert chess.D3 in developed.attackers(chess.WHITE, chess.E4)
    assert _after("evans-declined", "evans-castle").fen() == board.fen()


def test_every_side_trip_has_a_recall_line_that_follows_it():
    lesson = course()
    trips = {
        (chapter.id, step.branch_start)
        for chapter in lesson.chapters
        for step in chapter.steps
        if step.kind == "branch"
    }
    assert trips == set(TRIP_LINES)
    for (chapter_id, start), line_id in TRIP_LINES.items():
        line = lesson.line(line_id)
        assert line.position.after(line.moves) == _trip_end(lesson.chapter(chapter_id), start)
        # Recall ends on the learner's own move.
        assert line.position.after(line.moves).board().turn == chess.WHITE
