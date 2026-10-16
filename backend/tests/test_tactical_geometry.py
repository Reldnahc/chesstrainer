import chess
from trainer.tactical_geometry import attacker_collection, new_targets


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
    # The knight on d2 is pinned to its king; its geometric reach was no threat.
    before = chess.Board("4k3/8/8/8/1b6/8/3N4/4K3 w - - 0 1")
    assert new_targets(before, chess.D2, {chess.C4, chess.E4})
    unpinned = chess.Board("4k3/8/8/8/8/8/3N4/4K3 w - - 0 1")
    assert not new_targets(unpinned, chess.D2, {chess.C4, chess.E4})
