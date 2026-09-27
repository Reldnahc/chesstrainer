"""Account-owned corroboration from the existing active weakness projection."""

from collections import defaultdict
from typing import Literal

from trainer.chess_core import digest
from trainer.contracts.common import Contract
from trainer.review_intelligence.events_types import EvidenceReference
from trainer.taxonomy import SKILLS
from trainer.weaknesses import active_groups, recurrence

VERSION = "cross-game-1"


class HistoricalWeakness(Contract):
    skill_id: str
    title: str
    status: Literal["provisional", "supported"]
    independent_games: int
    occurrences: int
    related_plies: list[int]
    evidence: list[EvidenceReference]
    decision_ids: list[str]
    game_ids: list[str]


class CrossGameContext(Contract):
    version: Literal["cross-game-1"] = VERSION
    input_digest: str
    scope: Literal["other_saved_games"] = "other_saved_games"
    recurrence_threshold: int
    weaknesses: list[HistoricalWeakness]
    limitations: list[str]


def cross_game_context(db, settings, game, reports, context):
    relevant = defaultdict(set)
    learner = "white" if game.learner_color else "black"
    for node in context.nodes:
        if node.actor != learner:
            continue
        for event in reports[node.ply]["intelligence"]["events"]:
            fact = event["facts"]
            skill = None
            if event["kind"] == "tactic" and fact["role"] in {"allowed", "missed"}:
                skill = fact["motif"]
            elif event["kind"] == "mate":
                skill = "allowed_mate" if fact["transition"] == "allowed" else "missed_mate"
            if skill in SKILLS:
                relevant[skill].add(node.ply)
    items = []
    # Shared projection and exact same independent-game support threshold as Weaknesses.
    groups = active_groups(db, skills=set(relevant), exclude_game_id=game.id) if relevant else {}
    for skill, pairs in sorted(groups.items()):
        counts = recurrence(pairs, settings.min_independent_games)
        items.append(
            HistoricalWeakness(
                skill_id=skill,
                title=SKILLS[skill]["title"],
                status="provisional" if counts["provisional"] else "supported",
                independent_games=counts["independent_games"],
                occurrences=counts["occurrences"],
                related_plies=sorted(relevant[skill]),
                evidence=[
                    EvidenceReference(source="weakness", id=e.id, field=skill, ply=d.ply)
                    for e, d in pairs
                ],
                decision_ids=counts["decision_ids"],
                game_ids=sorted({d.game_id for _, d in pairs}),
            )
        )
    key = digest(
        dict(
            version=VERSION,
            owner=db.info["user_id"],
            game=game.id,
            context=context.input_digest,
            threshold=settings.min_independent_games,
            weaknesses=[item.model_dump(mode="json") for item in items],
        )
    )
    return CrossGameContext(
        input_digest=key,
        recurrence_threshold=settings.min_independent_games,
        weaknesses=items,
        limitations=[
            "current_game_excluded_from_corroboration",
            "saved_history_is_not_a_chronological_or_complete_game_sample",
            "recurrence_does_not_measure_training_transfer",
        ],
    )
