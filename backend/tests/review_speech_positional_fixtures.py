"""Legal positional moves and coherent search/policy inputs, fully projected.

These prove dialogue/recording reachability, not engine strength or calibrated
human difficulty. No practical flags, semantic events or rendered claims are set.
"""

import json
from copy import deepcopy

import chess
import chess.pgn
from review_speech_combination_fixtures import projected_game, witnessed
from review_speech_policy_fixtures import PROFILES, frames_for
from trainer.chess_core import Candidate, Score, digest
from trainer.contracts.games import GameDetail
from trainer.game_review import public_report
from trainer.human_models.context import request_for
from trainer.review_intelligence.context import move_contexts

CASES = {
    "doubled": ("7k/1p1p4/2p5/8/8/2p5/1PPP4/K5R1 w - - 0 1", "b2c3", "g1g2"),
    "isolated": ("7k/8/4p3/3p4/2P5/8/1P6/K5R1 w - - 0 1", "c4d5", "g1g2"),
    "passed": ("7k/8/3p4/4P3/8/8/8/K5R1 w - - 0 1", "e5d6", "g1g2"),
    "support": ("7k/p7/8/8/8/3N4/P7/4K3 w - - 0 1", "e1d2", "e1f1"),
    "unsupported": ("7k/p7/8/8/8/3N4/P2K4/8 w - - 0 1", "d2e1", "d2c1"),
    "castling": ("r3k2r/p6p/8/8/8/8/P6P/R3K2R w KQkq - 0 1", "e1g1", "e1c1"),
}
STATES = {
    "hard-find": ("plausible", True),
    "unusual-strong": ("unusual", False),
    "natural-best": ("preferred", True),
    "natural-strong": ("preferred", False),
}


def mirrored(uci):
    move = chess.Move.from_uci(uci)
    return chess.Move(
        chess.square_mirror(move.from_square), chess.square_mirror(move.to_square)
    ).uci()


def position_game(feature, black):
    parsed = chess.pgn.Game()
    if feature == "development":
        # Complete history from the standard start is essential: a setup FEN
        # alone cannot establish that a minor piece has never moved before.
        prefix = ["a2a4", "a7a5", "h2h4", "h7h5"] + (["g2g4"] if black else [])
        node = parsed
        for uci in prefix:
            node = node.add_variation(chess.Move.from_uci(uci))
        board = node.board()
        played, alternative = ("b8a6", "b8c6") if black else ("b1a3", "b1c3")
    else:
        fen, played, alternative = CASES[feature]
        board = chess.Board(fen)
        if black:
            board, played, alternative = board.mirror(), mirrored(played), mirrored(alternative)
        parsed.setup(board)
        node = parsed
    parsed.headers.update(
        Site="https://lichess.org",
        Event="Rated Blitz",
        TimeControl="180",
        WhiteElo="1200",
        BlackElo="1400",
    )
    assert board.is_valid()
    assert board.legal_moves.count() >= 8
    assert all(chess.Move.from_uci(uci) in board.legal_moves for uci in (played, alternative))
    node.add_variation(chess.Move.from_uci(played))
    return parsed, board, played, alternative


def positional_games():
    rows = []
    for feature in ("development", *CASES):
        for black in (False, True):
            parsed, board, played, alternative = position_game(feature, black)
            history = frames_for(parsed)
            ply = len(history) - 1
            context = move_contexts(parsed)[ply]
            request = request_for(parsed, board, 1200)
            for state, (profile, same_move) in STATES.items():
                name = f"speech-position-{feature}-{'black' if black else 'white'}-{state}"
                best = played if same_move else alternative
                # Distinct engine choices intentionally tie numerically. Policy
                # natural-strong must not depend on inventing a score deficit.
                raw = witnessed(
                    board, played, best=best, before=20, after=20, second=0 if same_move else 20
                )
                runner_up = Candidate(
                    uci=alternative,
                    san=board.san(chess.Move.from_uci(alternative)),
                    score=Score(kind="cp", value=0),
                    pv=[alternative],
                    depth=16,
                ).model_dump()
                raw["root_candidates"] = [raw["best"], runner_up if same_move else raw["actual"]]
                game = projected_game(raw, name, "natural_best").model_dump(mode="json")
                actual_policy, best_policy = PROFILES[profile]
                if same_move:
                    best_policy = actual_policy
                assert same_move or actual_policy[0] != best_policy[0]
                assert max(actual_policy[0], best_policy[0]) <= raw["legal_count"]
                human = raw["human"]
                human.update(
                    evidence_id=f"policy-{name}",
                    history_key=digest(request.history.model_dump()),
                    mover=request.mover,
                    conditioning=request.conditioning.model_dump(),
                    domain=request.domain.model_dump(),
                )
                human["played"].update(rank=actual_policy[0], probability=actual_policy[1])
                human["engine_best"].update(rank=best_policy[0], probability=best_policy[1])
                report = public_report(raw, 1200, context=context)
                assert not report.get("opening"), name
                assert not report["practical"]["components"]["only_good_move_at_depth"], name
                assert all(
                    not frame.get("termination") for frame in raw["actual_line"]["frames"]
                ), name
                game["frames"] = deepcopy(history)
                game["frames"][-1]["report"] = report
                rows.append(
                    dict(
                        feature=feature,
                        primary=f"positional-{feature}-actual",
                        secondary=f"human-{state}",
                        mover=request.mover,
                        without_history=public_report(raw, 1200)
                        if feature == "development"
                        else None,
                        game=GameDetail.model_validate(game).model_dump(mode="json"),
                    )
                )
    return rows


if __name__ == "__main__":
    print(json.dumps(positional_games()))
