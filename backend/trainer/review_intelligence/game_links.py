"""Relationships require contiguous actual play, never adjacent rows across gaps."""

from trainer.chess_core import evaluation_loss
from trainer.review_scores import BLUNDER_CP, is_mistake, is_poor


def loss(node):
    return evaluation_loss(node.before, node.after)


def strong(score):
    return score.outcome() == 1 or (score.kind == "cp" and score.value >= 200)


def playable(score):
    return score.outcome() == 1 or (score.kind == "cp" and score.value >= -100)


def blunder_sized(node):
    """A mate given up or allowed, or a loss a Blunder at any rating's threshold."""
    drop = loss(node)
    return drop.allows_mate or drop.mate_lost or (drop.cp or 0) >= BLUNDER_CP


def good(node):
    drop = loss(node)
    return not is_poor(drop)


def mistake(node):
    drop = loss(node)
    return is_mistake(drop)


def consistent(left, right):
    expected = left.after.negate()
    if expected.kind == right.before.kind == "cp":
        return abs(expected.value - right.before.value) <= 100
    return (
        expected.kind == right.before.kind == "mate"
        and expected.outcome() == right.before.outcome()
    )


def score_for(node, color):
    return node.after if node.actor == color else node.after.negate()


def sequential_links(segment, emit, finished, result):
    errors, runs = {}, {"white": [], "black": []}
    indices = {node.ply: index for index, node in enumerate(segment)}
    for index, node in enumerate(segment):
        if index:
            previous = segment[index - 1]
            benefit = strong(node.before) or (playable(node.before) and strong(previous.before))
            if mistake(previous) and benefit:
                retained = strong(node.after) if strong(node.before) else playable(node.after)
                outcome = (
                    "capitalized"
                    if good(node) and retained
                    else "missed"
                    if mistake(node) and not retained
                    else None
                )
                if outcome:
                    emit(
                        "punishment",
                        node.actor,
                        [previous, node],
                        outcome=outcome,
                        opportunity="advantage" if strong(node.before) else "equality",
                    )
        prior = errors.get(node.actor)
        if prior and good(node) and playable(node.after):
            between = segment[indices[prior.ply] : index + 1]
            emit(
                "recovery",
                node.actor,
                between,
                outcome="winning_chances" if strong(node.after) else "playable_position",
                opponent_errors=[n.ply for n in between if n.actor != node.actor and mistake(n)],
                # Only this move restored a playable game when the position before it
                # was not; usually the opponent's moves since the error already had.
                restored_by_move=not playable(node.before) and playable(node.after),
            )
            del errors[node.actor]
        if mistake(node) and strong(node.after.negate()):
            errors.setdefault(node.actor, node)
        for color in runs:
            if strong(score_for(node, color)):
                runs[color].append(node)
            else:
                finish_run(runs[color], color, emit, False, result)
                runs[color] = []
        own = [n for n in segment[max(0, index - 8) : index + 1] if n.actor == node.actor]
        concessions = [
            n
            for n in own
            if n.before.kind == n.after.kind == "cp" and 30 <= (loss(n).cp or 0) < 150
        ]
        if len(concessions) >= 3 and concessions[-1] == node:
            first = concessions[0]
            if first.before.value - node.after.value >= 150:
                emit(
                    "erosion",
                    node.actor,
                    concessions,
                    total_conceded_cp=sum(loss(n).cp for n in concessions),
                    net_deterioration_cp=first.before.value - node.after.value,
                    # Blunder-sized moves of the same side inside the run, which are
                    # not small concessions themselves.
                    own_blunder_plies=[
                        n.ply for n in own if n.ply >= first.ply and blunder_sized(n)
                    ],
                )
    for color, run in runs.items():
        finish_run(run, color, emit, finished, result)


def finish_run(run, color, emit, finished, result):
    if len(run) >= 6:
        won = result == ("1-0" if color == "white" else "0-1")
        emit(
            "advantage_run",
            color,
            run,
            outcome="converted" if finished and won else "maintained",
            result_source="pgn" if finished and won else None,
            threshold="200cp_or_searched_mate",
            reviewed_plies=len(run),
            # The run only keeps the evaluation above the threshold; these are the
            # side's own Mistake-sized moves inside it.
            own_mistake_plies=[n.ply for n in run if n.actor == color and mistake(n)],
        )


def repeated_links(nodes, reports, emit):
    occurrences = {}
    for node in nodes:
        seen = set()
        for event in reports[node.ply]["intelligence"]["events"]:
            if event["kind"] != "tactic" or event["facts"]["role"] == "alternative":
                continue
            fact = event["facts"]
            key = (node.actor, fact["motif"], fact["role"])
            if key in seen:
                continue
            seen.add(key)
            earlier = occurrences.setdefault(key, [])
            earlier.append((node, event))
            if len(earlier) > 1:
                emit(
                    "repeated_motif",
                    node.actor,
                    [n for n, _ in earlier[-2:]],
                    event_ids=[e["id"] for _, e in earlier[-2:]],
                    motif=fact["motif"],
                    role=fact["role"],
                    occurrence=len(earlier),
                    first_ply=earlier[0][0].ply,
                    scope="observed_reviewed_plies",
                )
