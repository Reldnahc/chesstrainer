"""Legal moves with synthetic objective/policy inputs, projected by production rules."""

import json

import chess
import chess.pgn
from review_intelligence_fixtures import move_report
from trainer.chess_core import digest
from trainer.contracts.games import GameDetail
from trainer.game_review import position, public_report
from trainer.human_models.context import request_for
from trainer.human_models.types import HumanEvidence, HumanMove, ModelProvenance

CASES = {
    "natural_error": ("d2d4", -340, -20, 1, 0.4, 4, 0.06),
    "hard_find": ("e2e4", 0, -20, 4, 0.06, 4, 0.06),
    "unusual_strong": ("e2e4", 0, -20, 9, 0.01, 9, 0.01),
    "natural_best": ("e2e4", 0, -20, 1, 0.4, 1, 0.4),
    "natural_strong": ("d2d4", -10, -20, 2, 0.25, 1, 0.4),
    "missed_defense": ("d2d4", -340, -200, 4, 0.06, 9, 0.01),
    "defense_found": ("e2e4", 0, -200, 9, 0.01, 9, 0.01),
}


def human_game(kind, color="white", shifted=True):
    best, after, second, rank, probability, best_rank, best_probability = CASES[kind]
    board = chess.Board()
    if color == "black":
        board = board.mirror()
        best = best.replace("2", "7").replace("4", "5")
    played = "e2e4" if color == "white" else "e7e5"
    parsed = chess.pgn.Game()
    parsed.setup(board)
    parsed.headers.update(
        Site="https://chess.com" if shifted else "https://lichess.org",
        Event="Rated Rapid" if shifted else "Rated Blitz",
        TimeControl="600" if shifted else "180",
        WhiteElo="1200",
        BlackElo="1400",
    )
    request = request_for(parsed, board, 1000)
    raw = move_report(board, played, best=best, after=after, second=second)
    raw["human"] = HumanEvidence(
        status="available",
        evidence_id=f"human-{kind}-{color}",
        configuration_key="synthetic-policy",
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
        played=HumanMove(uci=played, rank=rank, probability=probability),
        engine_best=HumanMove(uci=best, rank=best_rank, probability=best_probability),
        legal_count=board.legal_moves.count(),
    ).model_dump(mode="json")
    report = public_report(raw, 1200)
    # The initial move remains a book move for White: human insight must remain
    # visible even when recognized opening prose takes priority in the bubble.
    start = position(board) | dict(san="Start", uci=None, actor=None, number=1, report=None)
    board.push_uci(played)
    end = position(board) | dict(
        san=report["actual"]["san"], uci=played, actor=color, number=1, report=report
    )
    return GameDetail.model_validate(
        dict(
            id=f"human-{kind}-{color}",
            white="Learner" if color == "white" else "Opponent",
            black="Learner" if color == "black" else "Opponent",
            orientation=color,
            frames=[start, end],
            result="*",
            played_on=None,
            rating=1200,
            white_rating=1200,
            black_rating=1400,
            accuracy=None,
            job=dict(
                id=f"review-{kind}-{color}",
                status="completed",
                completed=1,
                total=1,
                error=None,
                cancel_requested=False,
                phase="complete",
            ),
        )
    )


if __name__ == "__main__":
    print(json.dumps({kind: human_game(kind).model_dump(mode="json") for kind in CASES}))
