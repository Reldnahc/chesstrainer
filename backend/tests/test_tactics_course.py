"""The tactics course: separate example positions, exact board claims and a pinned revision."""

import chess
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from test_italian_course import installed_course, walk_chapter
from test_opening_journey import response_json
from trainer.api import create_app
from trainer.contracts.study_lessons import LessonCommand
from trainer.study_lessons.content import CourseDefinition, Position
from trainer.study_lessons.courses import tactics
from trainer.study_lessons.player import enter_step, initial_state, transition
from trainer.study_lessons.queries import fingerprint

COURSE_ID = "tactics-foundations"
VALUES = {chess.PAWN: 1, chess.KNIGHT: 3, chess.BISHOP: 3, chess.ROOK: 5, chess.QUEEN: 9}


def board(fen=chess.STARTING_FEN, san=""):
    result = chess.Board(fen)
    for move in san.split():
        result.push_san(move)
    return result


def replies(position):
    return sorted(position.san(move) for move in position.legal_moves)


def material(position, color):
    return sum(
        VALUES.get(piece.piece_type, 0)
        for piece in position.piece_map().values()
        if piece.color == color
    )


def guards(position, color, square):
    return {
        chess.square_name(item) for item in position.attackers(color, chess.parse_square(square))
    }


def mated_after_every_reply(position):
    def mates(reply):
        after = position.copy()
        after.push(reply)
        for move in after.legal_moves:
            after.push(move)
            if after.is_checkmate():
                return True
            after.pop()
        return False

    return all(mates(reply) for reply in position.legal_moves)


def test_every_chapter_plays_through_its_separate_examples(settings):
    course = installed_course(COURSE_ID)
    assert [chapter.id for chapter in course.chapters] == [
        "forks",
        "pins",
        "skewers",
        "discovered-attacks",
        "remove-the-defender",
        "back-rank",
    ]
    with TestClient(create_app(settings, workers=False, start_engine=False)) as client:
        for chapter in course.chapters:
            state, seen, _ = walk_chapter(client, course, chapter)
            assert state["status"] == "completed"
            assert seen == {step.id for step in chapter.steps}
        library = response_json(client.get("/api/study/courses"))
        summary = next(item for item in library["courses"] if item["id"] == COURSE_ID)
        assert summary["completed_chapters"] == len(course.chapters)


def test_a_new_example_replaces_the_board_without_playback_and_back_restores_it():
    course = installed_course(COURSE_ID)
    chapter = course.chapter("forks")
    state = initial_state(course, chapter)
    enter_step(course, chapter, state, "fork-knight-collect")
    played, _ = transition(
        course,
        chapter,
        state,
        LessonCommand(request_id="move", revision=0, action="move", uci="e7c6"),
    )
    advanced, playback = transition(
        course, chapter, played, LessonCommand(request_id="next", revision=1, action="continue")
    )
    assert advanced["step_id"] == "fork-pawn" and playback == []
    assert advanced["position"] == Position(initial_fen=tactics.PAWN_FORK).model_dump(mode="json")
    rewound, _ = transition(
        course, chapter, advanced, LessonCommand(request_id="back", revision=2, action="back")
    )
    assert rewound["step_id"] == "fork-knight-collect"
    assert rewound["position"] == played["position"]


def test_lesson_text_matches_the_boards():
    # Forks: one knight square hits king and queen; the pawn fork is defended.
    fork = board(tactics.KNIGHT_FORK)
    targets = chess.SquareSet([chess.G8, chess.C6])
    assert [
        square
        for square in chess.SQUARES
        if not fork.piece_at(square) and targets.issubset(chess.BB_KNIGHT_ATTACKS[square])
    ] == [chess.E7]
    assert replies(board(tactics.KNIGHT_FORK, "Ne7+")) == ["Kh8"]
    pawn = board(tactics.PAWN_FORK, "e5")
    assert guards(pawn, chess.WHITE, "e5") == {"d4", "f3"}
    assert "d7" in guards(board(tactics.PAWN_FORK, "e5 Nd7"), chess.BLACK, "e5")
    won = board(tactics.PAWN_FORK, "e5 Nd7 exd6 cxd6")
    assert material(won, chess.WHITE) - material(won, chess.BLACK) == 1
    queen = board(tactics.QUEEN_FORK)
    assert not guards(queen, chess.BLACK, "b4")
    assert not any(queen.piece_at(chess.parse_square(square)) for square in ("b5", "c6", "d7"))
    check = board(tactics.QUEEN_FORK, "Qa4+")
    for reply in check.legal_moves:
        check.push(reply)
        assert not guards(check, chess.BLACK, "b4")
        check.pop()
    assert "a4" in {
        chess.square_name(item) for item in board(tactics.QUEEN_FORK, "Qa4+ Bd7").attacks(chess.D7)
    }

    # Pins: the knight cannot move, the queen can only move along the pin, and
    # the Caro-Kann mate relies on the pinned e7-pawn.
    pinned = board(tactics.PINNED_KNIGHT)
    pinned.turn = chess.BLACK
    assert not [move for move in pinned.legal_moves if move.from_square == chess.E6]
    assert board(tactics.PINNED_KNIGHT, "d5 Ke7").is_pinned(chess.BLACK, chess.E6)
    pinned_queen = board(tactics.PINNED_QUEEN, "Bb5")
    assert {
        pinned_queen.san(move) for move in pinned_queen.legal_moves if move.from_square == chess.D7
    } == {"Qc6", "Qxb5"}
    assert guards(pinned_queen, chess.WHITE, "b5") == {"c3", "e2"}
    trap = board(san=tactics.CARO_KANN_TRAP)
    assert [
        chess.square_name(square)
        for square in chess.SquareSet.between(chess.E2, chess.E8)
        if trap.piece_at(square)
    ] == ["e4", "e7"]
    trap.push_san("Nd6#")
    assert trap.is_checkmate() and trap.is_pinned(chess.BLACK, chess.E7)

    # Skewers: every king move leaves the line and nothing recaptures.
    for fen, check, capture, square in (
        (tactics.RANK_SKEWER, "Ra7+", "Ra7+ Kd6 Rxh7", "h7"),
        (tactics.DIAGONAL_SKEWER, "Bd3+", "Bd3+ Ke5 Bxh7", "h7"),
        (tactics.FILE_SKEWER, "Re1+", "Re1+ Kd5 Rxe8", "e8"),
    ):
        checked = board(fen, check)
        assert all(
            checked.piece_at(move.from_square).piece_type == chess.KING
            for move in checked.legal_moves
        )
        assert not guards(board(fen, capture), chess.BLACK, square)
    rook_up = board(tactics.RANK_SKEWER, "Ra7+ Kd6 Rxh7")
    assert (material(rook_up, chess.WHITE), material(rook_up, chess.BLACK)) == (8, 2)
    diagonal = board(tactics.DIAGONAL_SKEWER)
    assert material(diagonal, chess.BLACK) - material(diagonal, chess.WHITE) == 1
    assert not diagonal.piece_at(chess.G6)
    queen_won = board(tactics.DIAGONAL_SKEWER, "Bd3+ Ke5 Bxh7")
    assert material(queen_won, chess.WHITE) - material(queen_won, chess.BLACK) == 8

    # Discovered attacks: the moving piece uncovers a second attacker.
    petrov = board(san=tactics.PETROV_TRAP + " Nc6+")
    assert {chess.square_name(item) for item in petrov.checkers()} == {"e2"}
    assert chess.D8 in petrov.attacks(chess.C6)
    uncovered = board(tactics.DISCOVERED_CHECK, "Bxh7+")
    assert chess.D6 in uncovered.attacks(chess.D1)
    assert replies(uncovered) == ["Kh8", "Kxh7"]
    reti = board(san=tactics.RETI_TARTAKOWER)
    last = reti.pop()
    assert reti.piece_at(last.to_square) == chess.Piece(chess.KNIGHT, chess.WHITE)
    reti.push(last)
    reti.push_san("Qd8+")
    assert replies(reti) == ["Kxd8"]
    reti.push_san("Kxd8")
    assert [
        chess.square_name(square)
        for square in chess.SquareSet.between(chess.D1, chess.D8)
        if reti.piece_at(square)
    ] == ["d2"]
    reti.push_san("Bg5+")
    assert len(reti.checkers()) == 2 and replies(reti) == ["Kc7", "Ke8"]
    for finish in ("Kc7 Bd8#", "Ke8 Rd8#"):
        assert board(reti.fen(), finish).is_checkmate()
    finish = board(reti.fen(), "Kc7 Bd8")
    finish.remove_piece_at(chess.C7)
    assert chess.B6 in finish.attacks(chess.D8)

    # Remove the defender: only the knight keeps Qxh7 from being mate.
    guarded = board(tactics.CAPTURED_GUARD)
    guarded.remove_piece_at(chess.F6)
    assert board(guarded.fen(), "Qxh7").is_checkmate()
    captured = board(tactics.CAPTURED_GUARD, "Bxf6")
    assert chess.D8 in captured.attacks(chess.F6)
    for recapture in ("gxf6", "Qxf6"):
        assert board(captured.fen(), recapture + " Qxh7").is_checkmate()
    chased = board(tactics.CHASED_GUARD)
    assert chess.E4 in chess.SquareSet.between(chess.B1, chess.H7)
    chased.push_san("e5")
    for move in [move for move in chased.legal_moves if move.from_square == chess.F6]:
        chased.push(move)
        assert chess.H7 not in chased.attacks(move.to_square)
        chased.pop()
    exposed = board(tactics.CHASED_GUARD, "e5 Rfe8 exf6 gxf6 Qxh7+")
    assert exposed.is_check()
    counted = board(tactics.ONLY_DEFENDER)
    assert guards(counted, chess.WHITE, "e5") == {"e1"}
    assert guards(counted, chess.BLACK, "e5") == {"c6"}
    assert not guards(board(tactics.ONLY_DEFENDER, "Bxc6 bxc6 Rxe5"), chess.BLACK, "e5")

    # Back rank: an unguarded e8, a counted exchange and a forced queen sacrifice.
    assert not guards(board(tactics.OPEN_BACK_RANK), chess.BLACK, "e8")
    assert board(tactics.OPEN_BACK_RANK, "Re8#").is_checkmate()
    exchange = board(tactics.GUARDED_BACK_RANK)
    assert guards(exchange, chess.BLACK, "e8") == {"d7"}
    assert replies(board(tactics.GUARDED_BACK_RANK, "Rxe8+")) == ["Bxe8"]
    assert not guards(board(tactics.GUARDED_BACK_RANK, "Rxe8+ Bxe8"), chess.BLACK, "e8")
    assert board(tactics.GUARDED_BACK_RANK, "Rxe8+ Bxe8 Rxe8#").is_checkmate()
    sacrifice = board(tactics.QUEEN_SACRIFICE)
    assert "d7" in guards(sacrifice, chess.BLACK, "c8")
    sacrifice.push_san("Qxc8+")
    assert replies(sacrifice) == ["Qd8", "Qe8", "Qxc8"]
    assert mated_after_every_reply(sacrifice)
    assert board(tactics.QUEEN_SACRIFICE, "Qxc8+ Qxc8 Rxc8#").is_checkmate()
    assert sacrifice.piece_at(chess.H3) == chess.Piece(chess.PAWN, chess.WHITE)
    assert not sacrifice.piece_at(chess.H2)


def separate_examples():
    first = {"initial_fen": tactics.RANK_SKEWER}
    return {
        "id": "examples",
        "revision": "v1",
        "title": "Two examples",
        "learner_color": "white",
        "attributions": [{"text": "Original test"}],
        "chapters": [
            {
                "id": "chapter",
                "title": "Examples",
                "entry_step": "first",
                "steps": [
                    {
                        "id": "first",
                        "kind": "explanation",
                        "title": "First example",
                        "position": first,
                        "next_step": "check",
                    },
                    {
                        "id": "check",
                        "kind": "decision",
                        "title": "Check",
                        "position": first,
                        "choices": [{"uci": "a1a7", "reply": ["c7d6"], "next_step": "second"}],
                    },
                    {
                        "id": "second",
                        "kind": "explanation",
                        "title": "Second example",
                        "position": {"initial_fen": tactics.FILE_SKEWER},
                    },
                ],
            }
        ],
    }


def test_an_explanation_may_start_a_separate_example():
    course = CourseDefinition.model_validate(separate_examples())
    assert course.chapters[0].step("second").position.board().fen() == tactics.FILE_SKEWER


@pytest.mark.parametrize("problem", ["same_start_other_history", "other_step_kind", "branch_entry"])
def test_a_separate_example_cannot_replace_history_any_other_way(problem):
    record = separate_examples()
    steps = {step["id"]: step for step in record["chapters"][0]["steps"]}
    if problem == "same_start_other_history":
        steps["second"]["position"] = {"initial_fen": tactics.RANK_SKEWER, "moves": ["a1a8"]}
    elif problem == "other_step_kind":
        steps["second"].update(kind="decision", choices=[{"uci": "a1e1", "next_step": None}])
    else:
        steps["first"].update(kind="branch", branch_start="second")
    with pytest.raises(ValidationError, match="incompatible chess history"):
        CourseDefinition.model_validate(record)


def test_published_revision_keeps_its_content_identity():
    # Intentional edits require a new revision and hash together.
    course = installed_course(COURSE_ID)
    assert course.revision == "2026-10-v1"
    assert fingerprint(course) == "8252427312820949598dd5f5fdb62871a92cbc35db768f4353c3ca6639aff79f"
