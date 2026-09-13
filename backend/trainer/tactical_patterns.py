"""Lichess recognition plus application-specific evidence admission and rich witnesses."""

from trainer._vendor.lichess_puzzler import COMMIT
from trainer.chess_core import VALUES
from trainer.diagnosis_types import CUES, RULE_VERSION, Finding
from trainer.lichess_patterns import THEME_SKILLS, recognize
from trainer.tactical_geometry import tactical_plies
from trainer.verified_patterns import detect_patterns as verified_patterns


def recognized_patterns(
    boards, first, end, analysis_id, direction, *, max_tactic_plies=8, previous_move=None
):
    """Recognize facts in the relevant episode without asserting a material outcome."""
    if first >= len(boards) or end < first:
        return []
    allowed = set(tactical_plies(boards, first, end, max_tactic_plies))
    actor = boards[first - 1].turn
    observed = recognize(boards, first, end, analysis_id, previous_move=previous_move)
    found = []
    for item in observed.witnesses:
        # Upstream labels a whole solution. A later unrelated episode must not
        # become an explanation of this particular decision.
        actor_plies = {p for p in item.plies if boards[p - 1].turn == actor}
        if not actor_plies <= allowed:
            continue
        skill = THEME_SKILLS[item.theme]
        if item.theme == "hangingPiece" and direction == "allowed_opponent_tactic":
            skill = "hanging_piece"
        found.append(
            Finding(
                skill_id=skill,
                rule_id=f"lichess:{item.rule}:{COMMIT[:8]}:{RULE_VERSION}",
                direction=direction,
                actor="white" if actor else "black",
                analysis_id=analysis_id,
                plies=item.plies,
                moves=[boards[p].peek().uci() for p in item.plies],
                frame_ply=item.frame_ply,
                squares=sorted({s for squares in item.roles.values() for s in squares}),
                roles=item.roles,
                explanation=item.explanation,
                cue=CUES[skill],
                verification="verified_line",
            )
        )
    return list({(f.skill_id, tuple(f.plies), f.direction): f for f in found}.values())


def useful_cause(finding, boards):
    # This is an attribution safeguard, not an alteration of the upstream tag:
    # taking a free queen then cleaning up its pawn is not a defender-removal
    # lesson. Keep the existing reviewed value safeguard at the application edge.
    if finding.skill_id != "removing_defender":
        return True
    first, last = finding.plies[0], finding.plies[-1]
    if boards[last].is_checkmate():
        return True
    before = boards[first - 1]
    take = boards[first].peek()
    follow = boards[last].peek()
    defender = before.piece_at(take.to_square)
    victim = before.piece_at(follow.to_square)
    attacker = before.piece_at(take.from_square)
    if not all((defender, victim, attacker)):
        return False
    reply = boards[first + 1].peek()
    return VALUES[victim.piece_type] >= VALUES[defender.piece_type] or (
        boards[first].is_capture(reply)
        and reply.to_square == take.to_square
        and VALUES[attacker.piece_type] >= VALUES[defender.piece_type]
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
    previous_move=None,
):
    """Admit recognized motifs only after the caller verifies an adverse outcome.

    Review can call recognized_patterns directly for factual line annotations.
    Weakness evidence continues to require engine comparison and outcome support.
    """
    if not (material_supported or mate_supported):
        return []
    observed = recognized_patterns(
        boards,
        first,
        end,
        analysis_id,
        direction,
        max_tactic_plies=max_tactic_plies,
        previous_move=previous_move,
    )
    detailed = verified_patterns(
        boards,
        first,
        end,
        analysis_id,
        direction,
        material_supported=material_supported,
        mate_supported=mate_supported,
        max_tactic_plies=max_tactic_plies,
    )
    # Preserve established collection witnesses and independently verified
    # extensions (for example a nonchecking two-piece double attack). Upstream
    # owns the new broad recognition; old witness rules cannot veto those tags.
    detailed_skills = {f.skill_id for f in detailed}
    additions = [
        f for f in observed if f.skill_id not in detailed_skills and useful_cause(f, boards)
    ]
    return [*detailed, *additions]
