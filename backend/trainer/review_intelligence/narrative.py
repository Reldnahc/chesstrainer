"""Select supported game-story slots; language and character remain downstream."""

from typing import Literal

import chess
from pydantic import Field, JsonValue

from trainer.chess_core import digest
from trainer.contracts.common import Contract
from trainer.review_intelligence.events_types import EvidenceReference

VERSION = "game-narrative-1"


class NarrativeMoment(Contract):
    id: str
    kind: Literal[
        "opening",
        "turning_point",
        "best_find",
        "hard_find",
        "missed_opportunity",
        "defense",
        "recovery",
        "repeated_issue",
        "conversion",
        "erosion",
        "conclusion",
    ]
    plies: list[int]
    event_ids: list[str]
    relationship_ids: list[str]
    evidence: list[EvidenceReference] = Field(min_length=1)
    facts: dict[str, JsonValue]
    importance: int


class GameNarrative(Contract):
    version: Literal["game-narrative-1"] = VERSION
    input_digest: str
    context_digest: str
    complete: bool
    moments: list[NarrativeMoment]
    key_plies: list[int]
    takeaways: list[str]
    limitations: list[str]


def game_narrative(parsed, reports, context):
    moments = []
    nodes = {n.ply: n for n in context.nodes}
    pgn_id = digest(str(parsed))

    def add(kind, plies, importance, *, events=(), relations=(), references=(), **facts):
        payload = dict(
            kind=kind,
            plies=plies,
            importance=importance,
            event_ids=list(events),
            relationship_ids=list(relations),
            evidence=[
                EvidenceReference(source="pgn", id=pgn_id, field="mainline/result").model_dump(),
                *[r.model_dump() for r in references],
            ],
            facts=facts,
        )
        moments.append(NarrativeMoment(id=digest(dict(version=VERSION, **payload)), **payload))

    events = [
        (ply, event)
        for ply, report in sorted(reports.items())
        if ply in nodes
        for event in report["intelligence"]["events"]
    ]
    departure = next(((ply, e) for ply, e in events if e["kind"] == "opening_departure"), None)
    if parsed.board().fen() == chess.STARTING_FEN:
        limit = departure[0] if departure else context.total_plies + 1
        named = [
            (ply, report["opening"])
            for ply, report in sorted(reports.items())
            if ply < limit and report.get("opening") and report["opening"].get("name")
        ]
        if named or departure:
            add(
                "opening",
                [departure[0] if departure else named[-1][0]],
                20,
                events=[departure[1]["id"]] if departure else [],
                name=named[-1][1]["name"] if named else None,
                eco=named[-1][1]["eco"] if named else None,
                departure_ply=departure[0] if departure else None,
                meaning="catalogue_recognition_not_quality",
                references=[
                    EvidenceReference(
                        source="book",
                        id=named[-1][1]["version"],
                        field="recognized_opening",
                        ply=named[-1][0],
                    )
                ]
                if named
                else [],
            )
    if context.turning_points:
        point = context.turning_points[0]
        add(
            "turning_point",
            [point.ply],
            100,
            events=point.event_ids,
            side=point.actor,
            loss_cp=point.loss_cp,
            mate_transition=point.mate_transition,
            scope="largest_reviewed_concession",
        )
    strong = [
        (ply, report)
        for ply, report in sorted(reports.items())
        if ply in nodes and report["engine_label"] in {"Brilliant", "Great", "Best", "Good"}
    ]
    concrete = [
        (ply, r)
        for ply, r in strong
        if any(
            e["kind"] in {"sacrifice", "critical_resource"}
            or (e["kind"] == "tactic" and e["facts"]["role"] == "played")
            or (
                e["kind"] == "positional"
                and e["facts"]["line"] == "actual"
                and e["facts"]["feature"]
                in {"passed_pawn_advance", "king_flights", "rook_file", "first_development"}
            )
            for e in r["intelligence"]["events"]
        )
    ]
    if concrete:
        ply, report = max(
            concrete,
            key=lambda item: (
                {"Brilliant": 4, "Great": 3, "Best": 2, "Good": 1}[item[1]["engine_label"]],
                -item[0],
            ),
        )
        add(
            "best_find",
            [ply],
            92,
            events=nodes[ply].event_ids,
            side=nodes[ply].actor,
            quality=report["engine_label"],
            san=report["actual"]["san"],
        )
    hard = [
        (ply, r)
        for ply, r in strong
        if r["actual"]["uci"] == r["best"]["uci"]
        and r["practical"]["best_find_difficulty"] in {"challenging", "difficult"}
    ]
    if hard:
        ply, report = max(
            hard,
            key=lambda item: (
                item[1]["practical"]["best_find_difficulty"] == "difficult",
                -item[0],
            ),
        )
        add(
            "hard_find",
            [ply],
            80,
            events=nodes[ply].event_ids,
            side=nodes[ply].actor,
            difficulty=report["practical"]["best_find_difficulty"],
            confidence=report["practical"]["confidence"],
            domain_calibration="unvalidated",
        )
    for kind, predicate, importance in [
        (
            "missed_opportunity",
            lambda e: (
                e["kind"] == "mate"
                and e["facts"]["transition"] == "missed"
                or e["kind"] == "tactic"
                and e["facts"]["role"] == "missed"
            ),
            88,
        ),
        (
            "defense",
            lambda e: e["kind"] == "critical_resource" and e["facts"]["purpose"] == "defense",
            83,
        ),
    ]:
        candidates = [(p, e) for p, e in events if predicate(e)]
        if candidates:
            ply, event = max(candidates, key=lambda item: (item[1]["importance"], -item[0]))
            add(
                kind,
                [ply],
                importance,
                events=[event["id"]],
                side=nodes[ply].actor,
                event=event["facts"],
            )
    for source, target, importance in [
        ("recovery", "recovery", 85),
        ("repeated_motif", "repeated_issue", 72),
        ("advantage_run", "conversion", 76),
        ("erosion", "erosion", 74),
    ]:
        available = [
            r
            for r in context.relationships
            if r.kind == source
            and (source != "repeated_motif" or r.facts["role"] in {"allowed", "caused", "missed"})
            and (source != "advantage_run" or r.facts["outcome"] == "converted")
        ]
        if available:
            relation = max(available, key=lambda r: (len(r.plies), r.plies[-1]))
            add(
                target,
                relation.plies,
                importance,
                events=relation.event_ids,
                relations=[relation.id],
                side=relation.actor,
                **relation.facts,
            )
    if context.complete:
        board = parsed.end().board()
        outcome = board.outcome(claim_draw=False)
        result = parsed.headers.get("Result", "*")
        source = "board" if outcome else "pgn" if result != "*" else "unknown"
        add(
            "conclusion",
            [context.total_plies] if context.total_plies else [],
            10,
            result=outcome.result() if outcome else result,
            source=source,
            termination=outcome.termination.name.lower() if outcome else None,
            result_conflict=bool(outcome and result not in {"*", outcome.result()}),
            references=[
                EvidenceReference(
                    source="position", id=digest(board.fen()), field="automatic_outcome"
                )
            ]
            if outcome
            else [],
        )
    moments.sort(key=lambda m: (-m.importance, m.plies[-1] if m.plies else 0, m.id))
    key_plies = list(dict.fromkeys(m.plies[-1] for m in moments if m.plies))[:4]
    teachable = [m.id for m in moments if m.kind not in {"opening", "conclusion"}][:2]
    key = digest(
        dict(
            version=VERSION,
            context=context.input_digest,
            moments=[m.model_dump(mode="json") for m in moments],
        )
    )
    return GameNarrative(
        input_digest=key,
        context_digest=context.input_digest,
        complete=context.complete,
        moments=moments,
        key_plies=key_plies,
        takeaways=teachable,
        limitations=context.limitations,
    )
