"""Authorized current lesson presentation; hidden rehearsal moves stay server-side."""

from trainer.chess_core import legal_move_options
from trainer.contracts.study_lessons import LessonAnnotations, LessonSessionView
from trainer.study_lessons.bundled import course_topic
from trainer.study_lessons.content import CourseDefinition, Position
from trainer.study_lessons.player import available_actions


def view(session, playback=()):
    course = CourseDefinition.model_validate(session.snapshot)
    chapter = course.chapter(session.chapter_id)
    state = session.state
    step = chapter.step(state["step_id"])
    position = Position.model_validate(state["position"])
    actions = available_actions(course, chapter, state)
    text, annotations = step.text, step.annotations
    game_view = None
    if step.kind == "rehearsal" and state["phase"] == "ready":
        text, annotations = "Play this line from memory.", LessonAnnotations()
    if step.kind == "game_excerpt":
        game = course.game(step.game_id)
        ply = len(position.moves) - len(game.position.moves)
        note = next((note for note in game.annotations if note.ply == ply), None)
        if state["game"]:
            text, annotations = "Explore the source game.", LessonAnnotations()
            game_view = {
                "title": game.title,
                "ply": len(position.moves),
                "total_plies": len(game.position.moves) + len(game.moves),
                "attributions": [item.model_dump() for item in game.attributions],
                "note": {"text": note.text, "annotations": note.annotations} if note else None,
            }
        elif note:
            text, annotations = note.text, note.annotations
    return LessonSessionView(
        id=session.id,
        revision=session.revision,
        course_id=course.id,
        course_revision=course.revision,
        course_title=course.title,
        course_topic=course_topic(course.id),
        chapter_id=chapter.id,
        chapter_title=chapter.title,
        orientation=course.learner_color,
        fen=position.board().fen(),
        history=position.frames(),
        playback=list(playback),
        legal_moves=legal_move_options(position.board()) if "move" in actions else [],
        step={
            "id": step.id,
            "kind": step.kind,
            "title": step.title,
            "text": text,
            "phase": state["phase"],
            "annotations": annotations,
        },
        actions=actions,
        feedback=state["feedback"],
        branch={"title": state["branch"]["title"]} if state["branch"] else None,
        game=game_view,
        status=state["status"],
        assisted=state["assisted"],
        failed=state["failed"],
    ).model_dump(mode="json")
