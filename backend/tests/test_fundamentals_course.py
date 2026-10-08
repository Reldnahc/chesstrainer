"""The fundamentals course: exact board claims for every skill and a pinned revision."""

import chess
from fastapi.testclient import TestClient
from test_italian_course import installed_course, walk_chapter
from test_opening_journey import response_json
from test_tactics_course import board, guards, material, replies
from trainer.api import create_app
from trainer.study_lessons.courses import fundamentals
from trainer.study_lessons.queries import fingerprint

COURSE_ID = "chess-fundamentals"
CENTER = chess.SquareSet([chess.D4, chess.D5, chess.E4, chess.E5])


def balance(position):
    return material(position, chess.WHITE) - material(position, chess.BLACK)


def mates(position):
    found = []
    for move in position.legal_moves:
        san = position.san(move)
        position.push(move)
        if position.is_checkmate():
            found.append(san)
        position.pop()
    return found


def moves_that_force_mate_next(position):
    """White moves after which Black has a legal reply and every reply allows mate."""
    found = []
    for move in position.legal_moves:
        san = position.san(move)
        position.push(move)
        answers = list(position.legal_moves)
        if answers and all(mates(board(position.fen(), position.san(reply))) for reply in answers):
            found.append(san)
        position.pop()
    return found


def area(files, ranks):
    return chess.SquareSet(
        chess.square(chess.FILE_NAMES.index(file), int(rank) - 1)
        for file in files
        for rank in ranks
    )


def king_moves_into(position, squares):
    return [
        position.san(move)
        for move in position.legal_moves
        if move.from_square == position.king(position.turn) and move.to_square in squares
    ]


def test_every_chapter_plays_through_its_examples(settings):
    course = installed_course(COURSE_ID)
    assert [chapter.id for chapter in course.chapters] == [
        "piece-values",
        "count-attackers",
        "before-you-move",
        "opening-principles",
        "lone-king-mates",
        "king-and-pawn",
    ]
    with TestClient(create_app(settings, workers=False, start_engine=False)) as client:
        for chapter in course.chapters:
            state, seen, _ = walk_chapter(client, course, chapter)
            assert state["status"] == "completed"
            assert seen == {step.id for step in chapter.steps}
        library = response_json(client.get("/api/study/courses"))
        summary = next(item for item in library["courses"] if item["id"] == COURSE_ID)
        assert summary["completed_chapters"] == len(course.chapters)


def test_material_and_counting_claims_match_the_boards():
    # Piece values: take with the cheaper piece; win the exchange.
    knight = board(san=fundamentals.KNIGHT_ON_D4)
    assert guards(knight, chess.WHITE, "d4") == {"c3", "f3"}
    assert guards(knight, chess.BLACK, "d4") == {"e5", "c5"}
    assert balance(board(san=fundamentals.KNIGHT_ON_D4 + " cxd4 exd4")) == 2
    assert balance(board(san=fundamentals.KNIGHT_ON_D4 + " Nxd4 exd4")) == 0
    exchange = board(fundamentals.OPEN_DIAGONAL)
    assert not any(
        exchange.piece_at(square) for square in chess.SquareSet.between(chess.A3, chess.F8)
    )
    assert guards(exchange, chess.BLACK, "f8") == {"d8", "g8"}
    assert balance(board(fundamentals.OPEN_DIAGONAL, "Bxf8 Qxf8")) - balance(exchange) == 2

    # Counting: the cheaper attacker first; a pinned defender cannot take back.
    count = board(fundamentals.TWO_ATTACKERS)
    assert guards(count, chess.WHITE, "e5") == {"f3", "e1"}
    assert guards(count, chess.BLACK, "e5") == {"c6"}
    assert not guards(board(fundamentals.TWO_ATTACKERS, "Nxe5 Nxe5"), chess.BLACK, "e5")
    assert balance(board(fundamentals.TWO_ATTACKERS, "Nxe5 Nxe5 Rxe5")) - balance(count) == 1
    assert balance(board(fundamentals.TWO_ATTACKERS, "Rxe5 Nxe5 Nxe5")) - balance(count) == -1
    pinned = board(fundamentals.PINNED_DEFENDER)
    assert guards(pinned, chess.WHITE, "e5") == {"f3"}
    assert guards(pinned, chess.BLACK, "e5") == {"d7"}
    assert pinned.is_pinned(chess.BLACK, chess.D7)
    taken = board(fundamentals.PINNED_DEFENDER, "Nxe5")
    assert not [move for move in taken.legal_moves if move.to_square == chess.E5]

    # Checks, captures and threats: a loose attacker and Scholar's mate.
    loose = board(fundamentals.LOOSE_BISHOP)
    assert chess.D1 in loose.attacks(chess.G4)
    assert not guards(loose, chess.BLACK, "g4")
    assert balance(board(fundamentals.LOOSE_BISHOP, "Qxg4 Nxd4")) - balance(loose) == 2
    scholar = board(san=fundamentals.SCHOLARS_MATE)
    assert guards(scholar, chess.BLACK, "h5") == {"f6"}
    assert guards(scholar, chess.BLACK, "f7") == {"e8"}
    assert mates(scholar) == ["Qxf7#"]
    for defence in ("g6", "Qe7"):
        assert not mates(board(san="e4 e5 Bc4 Nc6 Qh5 " + defence))
    assert mates(board(san="e4 e5 Bc4 Nc6 Qh5 g6 Qf3 Bg7")) == ["Qxf7#"]
    assert not mates(board(san="e4 e5 Bc4 Nc6 Qh5 g6 Qf3 Nf6"))
    early = board(san="e4 e5 Qh5 g6 Qxe5+")
    assert early.is_check() and chess.H8 in early.attacks(chess.E5)


def test_opening_claims_match_the_boards():
    early = board(san=fundamentals.EARLY_QUEEN)
    assert [
        early.san(move)
        for move in early.legal_moves
        if early.piece_type_at(move.from_square) == chess.KNIGHT
        and chess.D5 in chess.SquareSet(chess.BB_KNIGHT_ATTACKS[move.to_square])
    ] == ["Nc3"]
    center = board(san=fundamentals.EARLY_QUEEN + " Nc3 Qa5")
    assert [
        center.san(move)
        for move in center.legal_moves
        if center.piece_type_at(move.from_square) == chess.PAWN and move.to_square in CENTER
    ] == ["d4"]
    assert chess.SquareSet(chess.BB_PAWN_ATTACKS[chess.WHITE][chess.D4]) == chess.SquareSet(
        [chess.C5, chess.E5]
    )
    develop = board(san=fundamentals.EARLY_QUEEN + " Nc3 Qa5 d4 Nf6")
    knight_moves = sorted(
        develop.san(move) for move in develop.legal_moves if move.from_square == chess.G1
    )
    assert knight_moves == ["Ne2", "Nf3", "Nh3"]
    assert CENTER & chess.SquareSet(chess.BB_KNIGHT_ATTACKS[chess.F3]) == chess.SquareSet(
        [chess.D4, chess.E5]
    )
    assert not CENTER & chess.SquareSet(chess.BB_KNIGHT_ATTACKS[chess.H3])
    assert chess.E2 in chess.SquareSet.between(chess.F1, chess.A6)

    italian = board(san="e4 e5 Nf3 Nc6 Bc4 Bc5 d3 Nf6 Nc3 Ng4")
    assert italian.fen() == fundamentals.KNIGHT_ON_G4
    assert guards(italian, chess.WHITE, "f2") == {"e1"}
    assert guards(italian, chess.BLACK, "f2") == {"g4", "c5"}
    italian.turn = chess.BLACK
    italian.push_san("Nxf2")
    assert {chess.D1, chess.H1}.issubset(italian.attacks(chess.F2))
    traded = board(fundamentals.KNIGHT_ON_G4, "O-O Nxf2 Rxf2 Bxf2+ Kxf2")
    assert balance(traded) == balance(board(fundamentals.KNIGHT_ON_G4))
    castled = board(fundamentals.KNIGHT_ON_G4, "O-O O-O")
    assert guards(castled, chess.WHITE, "f2") == {"f1", "g1"}


def test_endgame_claims_match_the_boards():
    # Queen mate: the king is confined to the h-file, Kf6 is the only mating plan
    # in two, and Qg6 is stalemate.
    confined = board(fundamentals.QUEEN_MATE)
    confined.turn = chess.BLACK
    assert {chess.square_file(move.to_square) for move in confined.legal_moves} == {7}
    assert moves_that_force_mate_next(board(fundamentals.QUEEN_MATE)) == ["Kf6"]
    assert replies(board(fundamentals.QUEEN_MATE, "Kf6")) == ["Kh7"]
    assert mates(board(fundamentals.QUEEN_MATE, "Kf6 Kh7")) == ["Qg7#"]
    assert board(fundamentals.QUEEN_MATE, "Qg6").is_stalemate()

    # Rook mate: checking at once lets the king out; Rh1 forces the mating picture.
    assert replies(board(fundamentals.ROOK_MATE, "Re8+")) == ["Kh7"]
    assert moves_that_force_mate_next(board(fundamentals.ROOK_MATE)) == ["Rh1"]
    assert replies(board(fundamentals.ROOK_MATE, "Rh1")) == ["Kf8"]
    assert mates(board(fundamentals.ROOK_MATE, "Rh1 Kf8")) == ["Rh8#"]
    assert chess.SquareSet([chess.E7, chess.F7, chess.G7]).issubset(chess.BB_KING_ATTACKS[chess.F6])

    # The square of the pawn: one king move enters it each time.
    race = board(fundamentals.PAWN_RACE)
    assert king_moves_into(race, area("bcde", "1234")) == ["Ke4"]
    shrunk = board(fundamentals.PAWN_RACE, "Ke4 b3")
    assert shrunk.king(chess.WHITE) not in area("bcd", "123")
    assert king_moves_into(shrunk, area("bcd", "123")) == ["Kd3"]
    near_b1 = chess.SquareSet(chess.BB_KING_ATTACKS[chess.B1])
    assert king_moves_into(board(fundamentals.PAWN_RACE, "Ke4 b3 Kd3 b2"), near_b1) == ["Kc2"]
    promoted = board(fundamentals.PAWN_RACE, "Ke4 b3 Kd3 b2 Kc2 b1=Q+")
    assert promoted.is_check() and "Kxb1" in replies(promoted)
    caught = board(fundamentals.PAWN_RACE, "Ke4 b3 Kd3 b2 Kc2 b1=Q+ Kxb1")
    assert not king_moves_into(caught, area("defgh", "45678"))
    assert not caught.pieces(chess.PAWN, chess.BLACK)

    # The opposition: six legal moves, a face-off on the e-file, one way forward.
    assert replies(board(fundamentals.OPPOSITION)) == ["Kc4", "Kc5", "Kc6", "Kd4", "Ke5", "e5"]
    faced = board(fundamentals.OPPOSITION, "Ke5")
    assert chess.square_distance(faced.king(chess.WHITE), faced.king(chess.BLACK)) == 2
    assert chess.square_file(faced.king(chess.WHITE)) == chess.square_file(faced.king(chess.BLACK))
    aside = board(fundamentals.OPPOSITION, "Ke5 Kd7")
    assert [
        aside.san(move)
        for move in aside.legal_moves
        if move.from_square == chess.E5 and chess.square_rank(move.to_square) == 5
    ] == ["Kf6"]
    finish = board(fundamentals.OPPOSITION, fundamentals.PAWN_FINISH)
    assert finish.is_check() and guards(finish, chess.WHITE, "e8") == {"f7"}
    assert chess.SquareSet([chess.E6, chess.E7, chess.E8]).issubset(chess.BB_KING_ATTACKS[chess.F7])


def test_published_revision_keeps_its_content_identity():
    # Intentional edits require a new revision and hash together.
    course = installed_course(COURSE_ID)
    assert course.revision == "2026-10-v1"
    assert fingerprint(course) == "0dd65745c65159bd659f1cfd87998aa4c7ae81e29ef36ae908f62b02121c0722"
