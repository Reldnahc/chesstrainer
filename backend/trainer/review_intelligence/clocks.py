"""Conservative observations from actual PGN annotations, never guessed thinking time."""

import math
import re

import chess
import chess.pgn

from trainer.review_intelligence.events_types import ClockFacts

_CONTROL = re.compile(
    r"(?:\d+/)?\d+(?:\+\d+(?:\.\d+)?d?)?(?::(?:\d+/)?\d+(?:\+\d+(?:\.\d+)?d?)?)*", re.I
)
_DURATION = re.compile(r"\d{1,6}:([0-5]?\d):([0-5]?\d(?:\.\d{1,6})?)")


def annotation(node, tag):
    matches = re.findall(r"\[%" + tag + r"\s+([^\]\r\n]*)\]", node.comment)
    mentioned = "[%" + tag in node.comment
    if len(matches) != 1 or not _DURATION.fullmatch(matches[0].strip()):
        return None, f"invalid_{tag}_annotation" if mentioned else None
    value = node.clock() if tag == "clk" else node.emt()
    return value, None if value is not None else f"invalid_{tag}_annotation"


def control(value):
    if not value or len(value) > 100 or not _CONTROL.fullmatch(value):
        return "unknown", None, None
    try:
        parsed = chess.pgn.parse_time_control(value)
    except (ValueError, IndexError, OverflowError):
        return "unknown", None, None
    if not parsed.parts or any(
        p.time < 0
        or p.moves < 0
        or not math.isfinite(p.increment + p.delay)
        or p.increment < 0
        or p.delay < 0
        for p in parsed.parts
    ):
        return "unknown", None, None
    if len(parsed.parts) != 1 or parsed.parts[0].moves:
        return "staged", None, None
    part = parsed.parts[0]
    if part.delay:
        return "delay", part.time, None
    return "increment" if part.increment else "sudden_death", part.time, part.increment


def band(seconds):
    if seconds is None:
        return "unknown"
    return "critical" if seconds <= 10 else "low" if seconds <= 30 else "ample"


def clock_facts(parsed):
    raw = parsed.headers.get("TimeControl")
    kind, initial, increment = control(raw)
    from_start = parsed.board().fen() == chess.STARTING_FEN
    previous = {True: None, False: None}
    seen = {True: False, False: False}
    board = parsed.board()
    output = {}
    for ply, node in enumerate(parsed.mainline(), 1):
        actor = board.turn
        after, clock_error = annotation(node, "clk")
        elapsed, elapsed_error = annotation(node, "emt")
        issues = [error for error in (clock_error, elapsed_error) if error]
        before, source = previous[actor], "previous_clock"
        if not seen[actor] and from_start and initial is not None:
            before, source = initial, "initial_control"
        if before is None:
            source = "unknown"
        elapsed_source = "annotation" if elapsed is not None else "unknown"
        if before is not None and after is not None and increment is not None:
            delta = before + increment - after
            if delta < -0.05:
                issues.append("clock_increased_unexpectedly")
                elapsed, elapsed_source = None, "unknown"
            elif elapsed is not None and abs(delta - elapsed) > 1:
                issues.append("elapsed_annotation_disagrees_with_clocks")
                elapsed, elapsed_source = None, "unknown"
            elif elapsed is None and elapsed_error is None:
                elapsed, elapsed_source = round(max(0, delta), 6), "clock_delta"
                if increment:
                    issues.append("assumes_post_increment_clocks")
        elif after is not None and increment is None:
            issues.append("elapsed_not_derivable_from_this_time_control")
        tempo = "unknown"
        if elapsed is not None:
            tempo = "ordinary"
            if before is not None and before >= 60 and elapsed <= 2:
                tempo = "fast_with_time"
            elif elapsed >= 30 and (before is None or elapsed >= before * 0.15):
                tempo = "long_think"
        observed = (
            after is not None
            or elapsed is not None
            or (before is not None and source == "previous_clock")
        )
        facts = ClockFacts(
            status="annotated"
            if observed
            else "invalid"
            if clock_error or elapsed_error
            else "absent",
            time_control=raw,
            control_kind=kind,
            before_seconds=before if observed else None,
            after_seconds=after,
            elapsed_seconds=elapsed,
            increment_seconds=increment,
            before_source=source if observed else "unknown",
            elapsed_source=elapsed_source,
            before_band=band(before) if observed else "unknown",
            after_band=band(after),
            tempo=tempo,
            limitations=issues,
        )
        output[ply] = facts
        previous[actor], seen[actor] = after, True
        board.push(node.move)
    return output
