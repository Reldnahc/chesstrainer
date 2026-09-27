"""Bounded tactical episodes and ordered aggregation of concrete motif witnesses."""

from trainer.tactical_geometry import tactical_plies
from trainer.verified_motifs import (
    TacticalEvent,
    absolute_skewer,
    back_rank_mate,
    checking_attack,
    collected_fork,
    hanging_capture,
    pinned_defender,
    promotion,
    removed_defender,
)


def detect_patterns(
    boards,
    first,
    end,
    analysis_id,
    direction,
    *,
    material_supported,
    mate_supported,
    max_tactic_plies=8,
):
    from trainer.combination_patterns import combinations

    plies = tactical_plies(boards, first, end, max_tactic_plies)
    if not plies:
        return []
    found = []
    for ply in plies:
        found.extend(
            _detect_at(
                boards,
                ply,
                end,
                analysis_id,
                direction,
                material_supported=material_supported,
                mate_supported=mate_supported,
                witness_end=plies[-1],
                origin_first=first,
            )
        )
    if material_supported:
        found.extend(combinations(boards, plies, analysis_id, direction))
    # A pattern can have multiple concrete witnesses, but duplicate tests of the
    # same event must not manufacture extra evidence or duplicate playback buttons.
    return list({(f.skill_id, tuple(f.plies), f.direction): f for f in found}.values())


def _detect_at(
    boards,
    first,
    end,
    analysis_id,
    direction,
    *,
    material_supported,
    mate_supported,
    witness_end,
    origin_first,
):
    event = TacticalEvent(
        boards,
        first,
        end,
        analysis_id,
        direction,
        witness_end,
        origin_first,
    )
    if material_supported:
        hanging_capture(event)
        collected_fork(event)
        promotion(event)
    if material_supported or mate_supported:
        checking_attack(event)
    if material_supported:
        pinned_defender(event)
        absolute_skewer(event)
        removed_defender(event)
    if material_supported or mate_supported:
        back_rank_mate(event)
    return event.findings
