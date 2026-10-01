"""Legal opening histories with synthetic searches and coherent human policies.

Opening recognition, departure events and reviewed prefix nodes come from the
production projection. No claims, priorities or derived assessments are edited.
"""

import json

import chess
import chess.pgn
from review_speech_combination_fixtures import witnessed
from review_speech_policy_fixtures import PROFILES, frames_for
from trainer.chess_core import digest
from trainer.contracts.games import GameDetail
from trainer.human_models.context import request_for
from trainer.human_models.types import HumanEvidence, HumanMove, ModelProvenance
from trainer.review_intelligence.presentation import present_game

BOOK_MOVES = [
    "e2e4",
    "e7e5",
    "g1f3",
    "b8c6",
    "f1b5",
    "a7a6",
    "b5a4",
    "g8f6",
    "e1g1",
]
POLICIES = {
    "hard-find": ("plausible", True),
    "unusual-strong": ("unusual", False),
    "natural-best": ("preferred", True),
    "natural-strong": ("preferred-plausible", False),
    "hard-defense-found": ("unusual", True),
}


def opening_game(human_state, departure=False):
    name = f"opening-{'departure' if departure else 'sequence'}-{human_state}"
    parsed = chess.pgn.Game()
    parsed.headers.update(
        Site="https://lichess.org",
        Event="Rated Blitz",
        TimeControl="180",
        WhiteElo="1200",
        BlackElo="1400",
    )
    board, parent, saved = parsed.board(), parsed, {}
    profile, same = POLICIES[human_state]
    moves = ["g1f3", "h7h5"] if departure else BOOK_MOVES
    for ply, uci in enumerate(moves, 1):
        move = chess.Move.from_uci(uci)
        assert move in board.legal_moves
        best = (
            uci
            if same
            else next(candidate.uci() for candidate in board.legal_moves if candidate != move)
        )
        # Both sides' alternating near-best moves lose 20cp, so each next
        # position's best score agrees with the preceding played score.
        before, after = (0, 0) if same else (10, -10)
        second = -200 if human_state == "hard-defense-found" else -20 if same else after
        raw = witnessed(board, uci, best=best, before=before, after=after, second=second)
        raw.update(
            before_analysis_id=f"{name}:root:{ply}", played_analysis_id=f"{name}:played:{ply}"
        )
        request = request_for(parsed, board, 1200)
        played_policy, best_policy = PROFILES[profile]
        if same:
            best_policy = played_policy
        raw["human"] = HumanEvidence(
            status="available",
            evidence_id=f"{name}:policy:{ply}",
            configuration_key="synthetic-opening-policy",
            history_key=digest(request.history.model_dump()),
            mover=request.mover,
            conditioning=request.conditioning,
            domain=request.domain,
            provenance=ModelProvenance(
                provider="maia3",
                model="synthetic-test-policy",
                model_revision="test",
                checkpoint_sha256="test",
                code_revision="test",
                adapter_version="test",
                inference={},
            ),
            played=HumanMove(uci=uci, rank=played_policy[0], probability=played_policy[1]),
            engine_best=HumanMove(uci=best, rank=best_policy[0], probability=best_policy[1]),
            legal_count=board.legal_moves.count(),
        ).model_dump(mode="json")
        assert max(played_policy[0], best_policy[0]) <= raw["legal_count"]
        saved[ply] = raw
        parent = parent.add_variation(move)
        board.push(move)
    reports, context = present_game(parsed, saved, 1200, completed=True)
    assert context.complete and not context.missing_plies
    frames = frames_for(parsed)
    for ply, report in reports.items():
        frames[ply]["report"] = report
        assert report["human"]["domain"]["history_from_start"]
        if not departure or ply == 1:
            assert report["opening"] and report["label"] == "Book", (name, ply)
    if departure:
        assert not reports[2]["opening"]
        assert any(
            event["kind"] == "opening_departure" for event in reports[2]["intelligence"]["events"]
        )
    return GameDetail.model_validate(
        dict(
            id=name,
            white="White",
            black="Black",
            orientation="black" if departure else "white",
            frames=frames,
            context=context,
            result="*",
            played_on=None,
            rating=1200,
            white_rating=1200,
            black_rating=1400,
            accuracy=None,
            job=None,
        )
    ).model_dump(mode="json")


def opening_games():
    result = {state: opening_game(state) for state in POLICIES}
    result.update(
        {
            f"departure-{state}": opening_game(state, True)
            for state in POLICIES
            if state != "hard-defense-found"
        }
    )
    return result


if __name__ == "__main__":
    print(json.dumps(opening_games()))
