"""Pure lesson state transitions; animation consumes already committed positions."""

from copy import deepcopy

from fastapi import HTTPException

from trainer.study_lessons.content import Decision, Position


def core(state):
    return deepcopy(
        {key: value for key, value in state.items() if key not in {"trail", "assisted", "failed"}}
    )


def enter_step(course, chapter, state, step_id):
    step = chapter.step(step_id)
    state.update(
        step_id=step.id,
        phase="ready",
        position=step.position.model_dump(mode="json"),
        cursor=0,
        next_step=step.next_step,
        feedback=None,
        game=None,
        status="active",
    )
    if step.kind == "rehearsal":
        line = course.line(step.line_id)
        if step.position.board().turn != (course.learner_color == "white"):
            playback = play(state, (line.moves[0],))
            state["cursor"] = 1
            return playback
    return []


def initial_state(course, chapter):
    state = {"trail": [], "branch": None, "assisted": False, "failed": False}
    enter_step(course, chapter, state, chapter.entry_step)
    return state


def play(state, moves):
    position = Position.model_validate(state["position"])
    result = position.after(moves)
    state["position"] = result.model_dump(mode="json")
    return [frame.model_dump(mode="json") for frame in result.frames()[len(position.moves) :]]


def advance(course, chapter, state):
    if state["next_step"] is not None:
        old = Position.model_validate(state["position"])
        playback = enter_step(course, chapter, state, state["next_step"])
        new = Position.model_validate(state["position"])
        if old.initial_fen == new.initial_fen and new.moves[: len(old.moves)] == old.moves:
            return [frame.model_dump(mode="json") for frame in new.frames()[len(old.moves) :]]
        return playback
    elif state["branch"] is None:
        state["status"] = "completed"
    return []


def available_actions(course, chapter, state):
    if state["game"]:
        return ["close_game", "game_seek"]
    step = chapter.step(state["step_id"])
    actions = ["back"] if state["trail"] else []
    if state["branch"]:
        actions.append("return_branch")
    if state["status"] != "completed":
        terminal_branch = (
            state["branch"] and state["phase"] == "complete" and state["next_step"] is None
        )
        if not terminal_branch and (
            state["phase"] == "complete" or step.kind not in {"decision", "rehearsal"}
        ):
            actions.append("continue")
        if state["phase"] == "ready" and step.kind in {"decision", "rehearsal"}:
            actions.extend(("move", "show_move"))
            if isinstance(step, Decision) and step.hint:
                actions.append("hint")
        if step.kind == "branch" and state["branch"] is None:
            actions.append("enter_branch")
        if step.kind == "game_excerpt":
            actions.append("open_game")
    return actions


def decision(course, step, state, uci, reveal):
    position = Position.model_validate(state["position"])
    if reveal:
        uci = (
            step.choices[0].uci
            if step.kind == "decision"
            else course.line(step.line_id).moves[state["cursor"]]
        )
    try:
        move = position.board().parse_uci(uci)
    except ValueError as exc:
        raise HTTPException(422, "Move is not legal in this lesson position") from exc
    if step.kind == "decision":
        choice = next((choice for choice in step.choices if choice.uci == uci), None)
        correct = choice is not None
    else:
        line = course.line(step.line_id)
        correct = line.moves[state["cursor"]] == uci
    if not correct:
        state["failed"] = True
        state["feedback"] = {
            "kind": "incorrect",
            "text": "That move is legal, but this lesson studies a different continuation. Try again.",
        }
        return []
    state["trail"].append(core(state))
    if reveal:
        state["assisted"] = True
    if step.kind == "decision":
        playback = play(state, (uci, *choice.reply))
        state["next_step"] = choice.next_step
        state["phase"] = "complete"
        text = choice.feedback
    else:
        end = min(state["cursor"] + 2, len(line.moves))
        playback = play(state, line.moves[state["cursor"] : end])
        state["cursor"] = end
        if end == len(line.moves):
            state["phase"] = "complete"
        text = "That is the move in this line."
    if reveal:
        text = f"The lesson plays {position.board().san(move)}."
    state["feedback"] = {"kind": "revealed" if reveal else "correct", "text": text}
    return playback


def transition(course, chapter, previous, request):
    state = deepcopy(previous)
    action = request.action
    if action not in available_actions(course, chapter, state):
        raise HTTPException(409, "That action is not available at this lesson step")
    if (action == "move") != (request.uci is not None) or (action == "game_seek") != (
        request.ply is not None
    ):
        raise HTTPException(422, "Lesson action parameters do not match the command")
    step = chapter.step(state["step_id"])
    if action == "back":
        state.update(state["trail"].pop())
        return state, []
    if action == "hint":
        state["assisted"] = True
        state["feedback"] = {"kind": "hint", "text": step.hint}
        return state, []
    if action in {"move", "show_move"}:
        return state, decision(course, step, state, request.uci, action == "show_move")
    if action in {"open_game", "close_game", "game_seek"}:
        return inspect_game(course, step, state, request)
    state["trail"].append(core(state))
    if action == "enter_branch":
        state["branch"] = {"anchor": core(state), "title": step.title}
        return state, enter_step(course, chapter, state, step.branch_start)
    if action == "return_branch":
        anchor = state["branch"]["anchor"]
        state.update(anchor)
        return state, []
    if state["phase"] == "complete" or step.kind in {"explanation", "branch"}:
        state["phase"] = "complete"
        return state, advance(course, chapter, state)
    if step.kind == "demonstration":
        playback = play(state, step.moves)
    else:
        game = course.game(step.game_id)
        playback = play(state, game.moves[step.from_ply : step.to_ply])
    state["phase"] = "complete"
    return state, playback


def inspect_game(course, step, state, request):
    game = course.game(step.game_id)
    if request.action == "open_game":
        position = Position.model_validate(state["position"])
        state["game"] = {
            "anchor": core(state),
            "id": game.id,
            "ply": len(position.moves),
        }
        state["feedback"] = None
        return state, []
    if request.action == "close_game":
        state.update(state["game"]["anchor"])
        return state, []
    full_moves = (*game.position.moves, *game.moves)
    if request.ply > len(full_moves):
        raise HTTPException(422, "Game position is outside the source game")
    previous_ply = state["game"]["ply"]
    state["game"]["ply"] = request.ply
    state["position"] = Position(
        initial_fen=game.position.initial_fen, moves=full_moves[: request.ply]
    ).model_dump(mode="json")
    frames = Position.model_validate(state["position"]).frames()
    playback = [frames[-1].model_dump(mode="json")] if request.ply == previous_ply + 1 else []
    return state, playback
