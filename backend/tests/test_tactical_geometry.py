import chess
from trainer.tactical_geometry import attacker_collection, new_targets, valuable_targets


def boards_after(fen, moves):
    board = chess.Board(fen)
    boards = [board.copy()]
    for san in moves:
        board.push_san(san)
        boards.append(board.copy())
    return boards


FORK = "r2qk3/8/8/1N1N4/8/8/8/4K3 w - - 0 1"


def test_the_forking_piece_collects_with_its_own_next_move():
    boards = boards_after(FORK, ["Ndc7+", "Ke7", "Nxa8"])
    knight = boards[1].piece_at(chess.C7)
    assert attacker_collection(boards, chess.C7, knight, [3], {chess.A8, chess.E8}) == 3


def test_a_recapture_by_a_like_piece_is_not_the_fork_collecting():
    # The forking knight is taken; the other knight retakes on c7 and then wins the rook.
    boards = boards_after(FORK, ["Ndc7+", "Qxc7", "Nxc7+", "Ke7", "Nxa8"])
    knight = boards[1].piece_at(chess.C7)
    assert attacker_collection(boards, chess.C7, knight, [3, 5], {chess.A8, chess.E8}) is None


def test_a_piece_that_was_pinned_threatens_anew_what_lay_off_its_pin():
    # The queen on d2 is pinned to its king by the rook on d8. Its diagonals already
    # reached a5 and g5, but it could not take on them; taking the pinner forks both.
    before = chess.Board("3r4/7k/8/n5n1/8/8/3Q4/3K4 w - - 0 1")
    after = before.copy()
    after.push_san("Qxd8")
    assert {chess.A5, chess.G5} <= valuable_targets(after, chess.D8)
    assert {chess.A5, chess.G5} <= set(before.attacks(chess.D2))
    assert new_targets(before, chess.D2, {chess.A5, chess.G5})
    # Unpinned, the same queen already threatened both knights.
    unpinned = chess.Board("3r4/7k/8/n5n1/8/8/3Q4/2K5 w - - 0 1")
    assert not new_targets(unpinned, chess.D2, {chess.A5, chess.G5})
