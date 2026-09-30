"""Pin the board facts behind the authored King's Gambit explanations."""

import chess
from trainer.study_lessons.courses.kings_gambit import course


def after_choice(chapter, identity):
    decision = chapter.step(identity)
    choice = decision.choices[0]
    return decision.position.after((choice.uci, *choice.reply)).board()


def assert_piece(board, square, symbol):
    piece = board.piece_at(chess.parse_square(square))
    assert piece is not None and piece.symbol() == symbol


def test_modern_defense_answers_an_attack_before_castling_and_remains_a_gambit():
    chapter = course().chapter("accepted-development")
    developed = after_choice(chapter, "develop-knight")
    assert chess.H4 in developed.attacks(chess.F3)
    assert chess.E4 in developed.attacks(chess.D5)
    attacked = after_choice(chapter, "develop-bishop")
    assert_piece(attacked, "c4", "B")
    assert chess.C4 in attacked.attacks(chess.B6)
    retained = after_choice(chapter, "save-bishop")
    assert_piece(retained, "b3", "B")
    assert chess.Move.from_uci("e1g1") in retained.legal_moves
    final = after_choice(chapter, "accepted-castle")
    assert_piece(final, "g1", "K")
    assert_piece(final, "f1", "R")
    assert_piece(final, "f4", "p")
    assert len(final.pieces(chess.PAWN, chess.WHITE)) == 6
    assert len(final.pieces(chess.PAWN, chess.BLACK)) == 7
    # The rook has a file to work on, not immediate contact with f7 through f4.
    assert chess.F7 not in final.attacks(chess.F1)


def test_pawn_chain_explanations_follow_actual_attacks_and_material():
    chapter = course().chapter("pawn-chain")
    pushed = after_choice(chapter, "challenge-chain")
    assert chess.F3 in pushed.attacks(chess.G4)
    centered = after_choice(chapter, "chain-center")
    assert chess.E5 in centered.attacks(chess.D4)
    assert chess.E5 in centered.attacks(chess.D6)
    recaptured = after_choice(chapter, "remove-wedge")
    assert_piece(recaptured, "f4", "B")
    assert_piece(recaptured, "e4", "n")
    assert len(recaptured.pieces(chess.PAWN, chess.WHITE)) == 6
    assert len(recaptured.pieces(chess.PAWN, chess.BLACK)) == 7
    completed = after_choice(chapter, "chain-develop")
    assert chess.H4 in completed.attacks(chess.G3)
    assert chess.G2 in completed.attacks(chess.F1)
    assert_piece(completed, "f1", "B")
    # Without this pawn move, Bxh4+ wins time against the uncastled king.
    premature = recaptured.copy()
    premature.push_san("Nc3")
    premature.push_san("Bxh4+")
    assert premature.is_check()


def test_declined_and_countergambit_keep_distinct_centers():
    chapter = course().chapter("declined-center")
    setup = chapter.step("declined-break").position.board()
    assert chess.D4 in setup.attacks(chess.C3)
    attack = setup.copy()
    attack.push_san("d4")
    assert {chess.C5, chess.E5} <= set(attack.attacks(chess.D4))
    restored = after_choice(chapter, "restore-center")
    assert_piece(restored, "d4", "P")
    assert_piece(restored, "e4", "P")
    assert_piece(restored, "f4", "P")
    assert_piece(restored, "b6", "b")
    falkbeer = chapter.step("falkbeer-summary").position.board()
    assert_piece(falkbeer, "d5", "P")
    assert_piece(falkbeer, "f4", "P")
    assert_piece(falkbeer, "e4", "n")
    assert falkbeer.piece_at(chess.D3) is None


def test_source_annotations_preserve_real_pawns_blockers_and_published_endpoints():
    bundled = course()
    anderssen = bundled.game("anderssen-kipping")
    castled = anderssen.position.after(anderssen.moves[:21]).board()
    assert_piece(castled, "f1", "R")
    assert_piece(castled, "f4", "B")
    assert_piece(castled, "f7", "k")
    assert chess.F7 not in castled.attacks(chess.F1)
    assert len(anderssen.moves) == 47
    before_end = anderssen.position.after(anderssen.moves[:-1]).board()
    # The source's prose table misprints KxB; the PGN and legal history give Rxf6.
    assert before_end.san(chess.Move.from_uci(anderssen.moves[-1])) == "Rxf6"
    assert not anderssen.position.after(anderssen.moves).board().is_checkmate()
    morphy = bundled.game("morphy-bornemann")
    exchanged = morphy.position.after(morphy.moves[:14]).board()
    assert_piece(exchanged, "e4", "P")
    assert_piece(exchanged, "e5", "p")
    assert_piece(exchanged, "f3", "Q")
    assert exchanged.piece_at(chess.F4) is None
    assert_piece(morphy.position.after(morphy.moves[:35]).board(), "d4", "P")
    assert len(morphy.moves) == 61
    before_end = morphy.position.after(morphy.moves[:-1]).board()
    assert before_end.san(chess.Move.from_uci(morphy.moves[-1])) == "cxd7+"
    assert not morphy.position.after(morphy.moves).board().is_checkmate()
