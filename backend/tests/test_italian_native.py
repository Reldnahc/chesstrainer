"""Optional engine audit of authored decisions; historical games may contain mistakes."""

import chess
import chess.engine
import pytest
from trainer.study_lessons.bundled import BundledCourses


@pytest.mark.stockfish
def test_italian_guided_decisions_do_not_teach_objective_blunders(stockfish_path):
    course = next(iter(BundledCourses().courses(None)))
    verified = set()
    with chess.engine.SimpleEngine.popen_uci(stockfish_path) as engine:
        engine.configure({"Threads": 1, "Hash": 32})
        for chapter in course.chapters:
            for step in chapter.steps:
                if step.kind != "decision":
                    continue
                board = step.position.board()
                best = engine.analyse(board, chess.engine.Limit(depth=18, nodes=200_000))
                best_score = best["score"].pov(board.turn).score(mate_score=100_000)
                for choice in step.choices:
                    identity = (board.fen(), choice.uci)
                    if identity in verified:
                        continue
                    verified.add(identity)
                    actual = engine.analyse(
                        board,
                        chess.engine.Limit(depth=18, nodes=200_000),
                        root_moves=[chess.Move.from_uci(choice.uci)],
                    )
                    actual_score = actual["score"].pov(board.turn).score(mate_score=100_000)
                    # This is a broad content-authoring check, not a product grading rule.
                    # A sound teaching choice need not be Stockfish's first preference.
                    assert best_score - actual_score <= 150, (
                        chapter.id,
                        step.id,
                        choice.uci,
                        best_score,
                        actual_score,
                    )
    assert verified, "The Italian pilot must contain guided learner decisions"
