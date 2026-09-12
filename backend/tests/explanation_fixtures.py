"""Legal lines with synthetic scores, solely for explanation contract tests."""

import chess
import chess.pgn
from trainer.chess_core import Candidate, Score, position_key
from trainer.exercises import exercise_from_decision
from trainer.models import Decision, EngineAnalysis, ExerciseAnswer, Game
from trainer.scheduling import FSRSScheduler


def seed_review(db, settings, black=False, key="explanation"):
    board = chess.Board("6k1/8/8/q7/1B6/8/8/R5K1 w - - 0 1")
    if black:
        board = board.mirror()

    def transform(uci):
        if not black:
            return uci
        return chess.Move(
            chess.square_mirror(chess.parse_square(uci[:2])),
            chess.square_mirror(chess.parse_square(uci[2:])),
        ).uci()

    best, alternative, wrong, reply = map(transform, ["a1a5", "b4a5", "g1f1", "a5a1"])

    def candidate(uci, pv, score):
        return Candidate(
            uci=uci,
            san=board.san(chess.Move.from_uci(uci)),
            pv=pv,
            score=Score(kind="cp", value=score),
        ).model_dump()

    before = EngineAnalysis(
        cache_key=f"{key}-before-{black}",
        fen=board.fen(),
        engine_version="fixture",
        config={},
        candidates=[
            candidate(best, [best, transform("g8f7")], 900),
            candidate(alternative, [alternative, transform("g8f7")], 880),
        ],
    )
    played = EngineAnalysis(
        cache_key=f"{key}-played-{black}",
        fen=board.fen(),
        engine_version="fixture",
        config={},
        candidates=[candidate(wrong, [wrong, reply, transform("f1e2")], -500)],
    )
    game = chess.pgn.Game.from_board(board)
    game.add_variation(chess.Move.from_uci(wrong))
    saved = Game(
        fingerprint=f"{key}-{black}",
        white="Fixture",
        black="Fixture",
        learner_color=board.turn,
        pgn=str(game),
    )
    db.add_all([before, played, saved])
    db.flush()
    decision = Decision(
        game_id=saved.id,
        ply=1,
        fen=board.fen(),
        position_key=position_key(board),
        learner_color=board.turn,
        move_uci=wrong,
        move_san=board.san(chess.Move.from_uci(wrong)),
        before_analysis_id=before.id,
        played_analysis_id=played.id,
        loss_cp=1400,
        meaningful=True,
        deep=True,
        facts={},
    )
    db.add(decision)
    db.flush()
    exercise = exercise_from_decision(db, decision, settings, FSRSScheduler(settings))
    db.add(
        ExerciseAnswer(
            exercise_id=exercise.id,
            uci=wrong,
            san=decision.move_san,
            grade="failure",
            primary=False,
            analysis_id=played.id,
        )
    )
    db.commit()
    return {
        "exercise_id": exercise.id,
        "wrong": wrong,
        "reply": reply,
        "best": best,
        "alternative": alternative,
    }
