"""Legal synthetic authority fixtures for semantic rules; no engine-quality claims."""

import chess
from trainer.chess_core import Candidate, evaluation_loss
from trainer.explanations import replay_line


def move_report(board=None, played="e2e4", best=None, before=0, after=0, second=-20, pv=None):
    board = board or chess.Board()
    best = best or played

    def score(value):
        return value if isinstance(value, dict) else {"kind": "cp", "value": value}

    def candidate(uci, value, line):
        return Candidate(
            uci=uci, san=board.san(chess.Move.from_uci(uci)), score=score(value), pv=line, depth=16
        )

    actual = candidate(played, after, pv or [played])
    strongest = candidate(best, before, actual.pv if best == played else [best])

    def line(value):
        return dict(
            frames=[f.model_dump() for f in replay_line(board, value.pv)],
            findings=[],
            material_delta=None,
            settled=False,
        )

    return dict(
        version="game-review-1",
        before_analysis_id="root-evidence",
        played_analysis_id="played-evidence",
        best=strongest.model_dump(),
        actual=actual.model_dump(),
        second_score=score(second),
        previous_score=None,
        legal_count=board.legal_moves.count(),
        loss_cp=evaluation_loss(strongest.score, actual.score).cp,
        sacrifice=None,
        opportunity_missed=False,
        actual_line=line(actual),
        best_line=line(strongest),
        white_score=(actual.score if board.turn else actual.score.negate()).model_dump(),
        depth=16,
        engine_version="Synthetic authority",
    )
