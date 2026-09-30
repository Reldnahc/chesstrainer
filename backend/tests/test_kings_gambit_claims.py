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


def test_modern_defense_explains_counterdevelopment_and_actual_pawn_balance():
    chapter = course().chapter("accepted-development")
    developed = after_choice(chapter, "develop-knight")
    assert chess.H4 in developed.attacks(chess.F3)
    assert chess.E4 in developed.attacks(chess.D5)
    # After exd5/Nf6, neither player has an extra pawn; the d5-pawn is attacked.
    central = after_choice(chapter, "answer-central-break")
    assert len(central.pieces(chess.PAWN, chess.WHITE)) == 7
    assert len(central.pieces(chess.PAWN, chess.BLACK)) == 7
    assert chess.D5 in central.attacks(chess.F6)
    counterattack = after_choice(chapter, "develop-bishop")
    assert_piece(counterattack, "b5", "B")
    assert chess.B5 in counterattack.attacks(chess.C6)
    resolved = after_choice(chapter, "answer-counterattack")
    assert_piece(resolved, "c6", "n")
    assert_piece(resolved, "b5", "B")
    assert resolved.is_pinned(chess.BLACK, chess.C6)
    final = after_choice(chapter, "finish-development")
    assert_piece(final, "g1", "K")
    assert_piece(final, "g8", "k")
    assert_piece(final, "f1", "R")
    assert_piece(final, "f4", "p")
    assert_piece(final, "d2", "N")
    assert_piece(final, "d4", "P")
    assert len(final.pieces(chess.PAWN, chess.WHITE)) == 6
    assert len(final.pieces(chess.PAWN, chess.BLACK)) == 6
    # The rook has a file to work on, not immediate contact with f7 through f4.
    assert chess.F7 not in final.attacks(chess.F1)


def test_pawn_chain_meets_black_counterplay_before_castling():
    chapter = course().chapter("pawn-chain")
    pushed = after_choice(chapter, "challenge-chain")
    assert chess.F3 in pushed.attacks(chess.G4)
    counterattack = after_choice(chapter, "chain-bishop")
    assert {chess.C4, chess.E4} <= set(counterattack.attacks(chess.D5))
    before_defense = after_choice(chapter, "chain-center")
    assert chess.E5 in before_defense.attacks(chess.D6)
    assert not before_defense.attackers(chess.WHITE, chess.E5)
    defended = after_choice(chapter, "support-knight")
    assert chess.E5 in defended.attacks(chess.D4)
    assert chess.F4 in defended.attacks(chess.H5)
    assert chess.H4 in defended.attacks(chess.D8)
    # After d4, the same bishop capture can now be answered with a recapture.
    defense = before_defense.copy()
    for san in ("d4", "Bxe5", "dxe5"):
        defense.push_san(san)
    assert len(defense.pieces(chess.BISHOP, chess.BLACK)) == 1
    completed = after_choice(chapter, "chain-castle")
    assert_piece(completed, "g1", "K")
    assert_piece(completed, "f1", "R")
    assert len(completed.pieces(chess.PAWN, chess.WHITE)) == 7
    assert len(completed.pieces(chess.PAWN, chess.BLACK)) == 7
    danger = completed.copy()
    danger.push_san("Ng3")
    assert chess.F1 in danger.attacks(chess.G3)


def test_early_castling_counterexample_shows_the_loss_without_teaching_it_as_an_answer():
    bundled = course()
    chapter = bundled.chapter("pawn-chain")
    branch = chapter.step("chain-castling-choice")
    demonstration = chapter.step(branch.branch_start)
    assert branch.position == demonstration.position
    assert chapter.step(branch.next_step).id == "support-knight"
    final = demonstration.position.after(demonstration.moves).board()
    assert final.is_check()
    assert_piece(final, "d4", "b")
    assert_piece(final, "e7", "q")
    assert len(final.pieces(chess.KNIGHT, chess.WHITE)) == 1
    assert len(final.pieces(chess.KNIGHT, chess.BLACK)) == 2
    assert len(final.pieces(chess.PAWN, chess.BLACK)) == 7
    assert len(final.pieces(chess.PAWN, chess.WHITE)) == 6
    # The counterexample is separate from both graded decisions and recall.
    assert chapter.step(branch.next_step).choices[0].uci == "d2d4"
    line = bundled.line("challenge-pawn-chain")
    offset = len(branch.position.moves) - len(line.position.moves)
    assert line.moves[offset] == "d2d4"
    assert demonstration.moves[0] == "e1g1"


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


def test_declined_capture_warning_distinguishes_mate_from_the_other_legal_defense():
    bundled = course()
    chapter = bundled.chapter("declined-center")
    branch = chapter.step("declined-trap-choice")
    demonstration = chapter.step(branch.branch_start)
    # Both queen diagonals are already open after f4/Bc5; fxe5 ignores the threat.
    before = branch.position.board()
    assert not chess.between(chess.D8, chess.H4) & before.occupied
    assert not chess.between(chess.H4, chess.E1) & before.occupied
    mate = demonstration.position.after(demonstration.moves).board()
    assert mate.is_checkmate()
    assert_piece(mate, "e2", "K")
    assert_piece(mate, "e4", "q")
    assert chess.F2 in mate.attacks(chess.C5)
    # The first queen check has a non-mating defense, but that defense loses material.
    checked = demonstration.position.after(demonstration.moves[:2]).board()
    assert checked.is_check()
    assert checked.parse_san("g3") in checked.legal_moves
    assert chess.Move(chess.E1, chess.F1) not in checked.legal_moves
    checked.push_san("g3")
    checked.push_san("Qxe4+")
    assert checked.is_check() and not checked.is_checkmate()
    assert chess.H1 in checked.attacks(chess.E4)
    safe = after_choice(chapter, "declined-knight")
    assert chess.H4 in safe.attacks(chess.F3)
    # The mistake illustration must never become the required recall answer.
    line = bundled.line("declined-center")
    assert line.moves[len(branch.position.moves)] == "g1f3"
    assert demonstration.moves[0] == "f4e5"


def test_declined_endpoint_explains_what_currently_blocks_the_bishop_diagonal():
    board = course().chapter("declined-center").step("declined-summary").position.board()
    assert_piece(board, "d4", "P")
    assert chess.D4 in board.attacks(chess.B6)
    assert chess.G1 not in board.attacks(chess.B6)
    # After Black's bishop leaves that diagonal, White can develop Bd3 and support e4.
    board.push_san("Ba5")
    board.push_san("Bd3")
    assert chess.E4 in board.attacks(chess.D3)


def test_source_annotations_preserve_real_pawns_blockers_and_published_endpoints():
    bundled = course()
    anderssen = bundled.game("rosanes-anderssen")
    line = bundled.line("challenge-pawn-chain")
    assert anderssen.moves[:16] == line.moves[:16]
    # The historical game deliberately contrasts the taught ninth move.
    assert anderssen.moves[16] != line.moves[16]
    material_chase = anderssen.position.after(anderssen.moves[:26]).board()
    assert_piece(material_chase, "a8", "B")
    assert_piece(material_chase, "e1", "K")
    assert_piece(material_chase, "b1", "N")
    assert_piece(material_chase, "c1", "B")
    assert_piece(material_chase, "d1", "Q")
    assert chess.H1 in material_chase.attacks(chess.G3)
    assert len(anderssen.moves) == 46
    before_end = anderssen.position.after(anderssen.moves[:-1]).board()
    assert before_end.san(chess.Move.from_uci(anderssen.moves[-1])) == "Re1#"
    final = anderssen.position.after(anderssen.moves).board()
    assert final.is_checkmate()
    # This is a discovered bishop mate, not a rook directly checking through Qf1.
    assert set(final.checkers()) == {chess.D4}
    assert final.is_pinned(chess.WHITE, chess.F1)
    assert chess.H1 in final.attacks(chess.G3)
    assert chess.E1 not in final.attacks(chess.G3)
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
