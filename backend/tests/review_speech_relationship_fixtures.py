"""Legal mainlines and coherent authority scores for relationship speech pairs.

Production present_game derives every practical assessment, event and relationship.
The synthetic searches establish presentation reachability, not engine strength.
"""

import json

import chess
import chess.pgn
from review_speech_combination_fixtures import projected_game, witnessed
from review_speech_policy_fixtures import PROFILES, frames_for
from trainer.contracts.games import GameDetail
from trainer.review_intelligence.presentation import present_game

QUIET_FEN = "6k1/4p3/8/8/8/8/6K1/R7 w - - 0 1"
QUIET_MOVES = ["a1a2", "g8h8", "a2a3", "h8g8", "a3a4", "g8h8", "a4a5"]
STRONG_POLICIES = {
    "hard-find": ("plausible", True),
    "unusual-strong": ("unusual", False),
    "natural-best": ("preferred", True),
    "natural-strong": ("preferred-plausible", False),
}


def family_inputs(family):
    """Scores are from each mover's perspective and adjacent roots agree."""
    if family == "recovery":
        return (
            QUIET_FEN,
            QUIET_MOVES,
            [
                (0, -300),
                (300, 210),
                (-210, -210),
                (210, 120),
                (-120, -120),
                (120, 30),
                (-30, -30),
            ],
            "*",
        )
    if family == "recovery-assisted":
        return QUIET_FEN, QUIET_MOVES[:3], [(0, -300), (300, 0), (0, 0)], "*"
    if family in {"chance-taken", "chance-missed"}:
        return (
            QUIET_FEN.replace(" w ", " b "),
            ["g8h8", "a1a2"],
            [
                (300, 0),
                (0, -300 if family == "chance-missed" else 0),
            ],
            "*",
        )
    if family == "support-restored":
        return (
            "6k1/4p3/8/8/3N4/8/6K1/R5B1 w - - 0 1",
            [
                "g1h2",
                "g8h8",
                "h2g1",
            ],
            [(0, 0)] * 3,
            "*",
        )
    if family == "advantage-converted":
        return (
            QUIET_FEN,
            QUIET_MOVES,
            [(300, 300) if ply % 2 else (-300, -300) for ply in range(1, 8)],
            "1-0",
        )
    raise ValueError(family)


def relationship_game(family, human_state):
    name = f"combo-{family}-{human_state}"
    fen, moves, scores, result = family_inputs(family)
    parsed = chess.pgn.Game()
    board = chess.Board(fen)
    assert board.is_valid() and not board.is_game_over()
    parsed.setup(board)
    parsed.headers["Result"] = result
    parent = parsed
    saved = {}
    for ply, uci in enumerate(moves, 1):
        move = chess.Move.from_uci(uci)
        assert move in board.legal_moves
        before, after = scores[ply - 1]
        final = ply == len(moves)
        same = before == after
        profile = None
        if final:
            if human_state in STRONG_POLICIES:
                profile, same = STRONG_POLICIES[human_state]
                # Distinct near-best choices stay strong without changing the
                # predecessor's saved score or its relationship classification.
                before = after if same else after + 10
            else:
                profile = (
                    "preferred-unusual"
                    if human_state == "hard-defense-missed"
                    else "preferred-plausible"
                )
                same = False
        alternative = next(candidate.uci() for candidate in board.legal_moves if candidate != move)
        best = uci if same else alternative
        second = -300 if final and human_state == "hard-defense-missed" else before - 20
        raw = witnessed(board, uci, best=best, before=before, after=after, second=second)
        assert not raw["actual_line"]["findings"] and not raw["best_line"]["findings"]
        raw.update(
            before_analysis_id=f"{name}:root:{ply}", played_analysis_id=f"{name}:played:{ply}"
        )
        if final:
            # Rebind a real validated human-evidence fixture to this legal move;
            # only the authority policy changes, never its derived labels.
            projected_game(raw, name)
            played_policy, best_policy = PROFILES[profile]
            if same:
                best_policy = played_policy
            human = raw["human"]
            human["evidence_id"] = f"{name}:policy:{ply}"
            human["played"].update(rank=played_policy[0], probability=played_policy[1])
            human["engine_best"].update(rank=best_policy[0], probability=best_policy[1])
            assert max(played_policy[0], best_policy[0]) <= raw["legal_count"]
        saved[ply] = raw
        parent = parent.add_variation(move)
        board.push(move)
    assert not board.is_game_over(), "Conversion must use declared resignation, not terminal intent"
    reports, context = present_game(parsed, saved, 1200, completed=True)
    assert context.complete and not context.missing_plies
    frames = frames_for(parsed)
    for ply, report in reports.items():
        frames[ply]["report"] = report
    learner = frames[-1]["actor"]
    assert learner == "white"
    expected_kind = {
        "recovery": "recovery",
        "recovery-assisted": "recovery",
        "chance-taken": "punishment",
        "chance-missed": "punishment",
        "support-restored": "support_restored",
        "advantage-converted": "advantage_run",
    }[family]
    matching = [
        item
        for item in context.relationships
        if item.kind == expected_kind and item.actor == learner and item.plies[-1] == len(moves)
    ]
    assert matching, (name, context.relationships)
    if family.startswith("recovery"):
        assert bool(matching[0].facts["opponent_errors"]) == (family == "recovery-assisted")
    if family.startswith("chance-"):
        assert matching[0].facts["outcome"] == (
            "capitalized" if family == "chance-taken" else "missed"
        )
    if family == "advantage-converted":
        assert matching[0].facts["outcome"] == "converted"
    return GameDetail.model_validate(
        dict(
            id=name,
            white="Learner",
            black="Opponent",
            orientation=learner,
            frames=frames,
            context=context,
            result=result,
            played_on=None,
            rating=1200,
            white_rating=1200,
            black_rating=1400,
            accuracy=None,
            job=dict(
                id=f"review:{name}",
                status="completed",
                completed=len(moves),
                total=len(moves),
                error=None,
                cancel_requested=False,
                phase="complete",
            ),
        )
    ).model_dump(mode="json")


def relationship_games():
    result = {}
    for family in (
        "recovery",
        "recovery-assisted",
        "chance-taken",
        "support-restored",
        "advantage-converted",
    ):
        for state in STRONG_POLICIES:
            game = relationship_game(family, state)
            result[game["id"]] = game
    for state in ("natural-error", "hard-defense-missed"):
        game = relationship_game("chance-missed", state)
        result[game["id"]] = game
    assert len(result) == 22
    return result


if __name__ == "__main__":
    print(json.dumps(relationship_games()))
