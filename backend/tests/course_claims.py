"""Board helpers shared by the opening-course claims tests."""

import chess
from trainer.study_lessons.courses.authoring import position

VALUES = {
    chess.PAWN: 1,
    chess.KNIGHT: 3,
    chess.BISHOP: 3,
    chess.ROOK: 5,
    chess.QUEEN: 9,
    chess.KING: 100,
}


def key(board):
    return (board.board_fen(), board.turn, board.castling_rights, board.ep_square)


def reached(course):
    """Every position a learner can see in the course's lessons and recall lines."""
    seen = set()

    def walk(start, moves):
        board = start.board()
        seen.add(key(board))
        for uci in moves:
            board.push_uci(uci)
            seen.add(key(board))

    for line in course.lines:
        walk(line.position, line.moves)
    for chapter in course.chapters:
        for step in chapter.steps:
            walk(step.position, getattr(step, "moves", ()))
            for choice in getattr(step, "choices", ()):
                walk(step.position, (choice.uci, *choice.reply))
    return seen


class Boards:
    """Build boards from SAN, insisting that taught positions really occur in the course."""

    def __init__(self, course):
        self.positions = reached(course)

    def __call__(self, san, beyond=False):
        board = position(san).board()
        if not beyond:
            assert key(board) in self.positions, f"not a course position: {san}"
        return board


def sq(name):
    return chess.parse_square(name)


def piece(board, name):
    found = board.piece_at(sq(name))
    return found.symbol() if found else None


def attacks(board, origin, target):
    return sq(target) in board.attacks(sq(origin))


def attackers(board, color, target):
    return {chess.square_name(s) for s in board.attackers(color, sq(target))}


def count(board, kind, color):
    return len(board.pieces(kind, color))


def minor(board, color):
    return count(board, chess.KNIGHT, color) + count(board, chess.BISHOP, color)


def pawn_balance(board):
    return count(board, chess.PAWN, chess.WHITE) - count(board, chess.PAWN, chess.BLACK)


def pins_to(board, attacker, pinned, behind):
    """A bishop, rook or queen pins an enemy piece to a more valuable enemy piece behind it."""
    hunter = board.piece_at(sq(attacker))
    front = board.piece_at(sq(pinned))
    back = board.piece_at(sq(behind))
    if not hunter or not front or not back:
        return False
    if hunter.piece_type not in (chess.BISHOP, chess.ROOK, chess.QUEEN):
        return False
    if front.color == hunter.color or back.color == hunter.color:
        return False
    if VALUES[back.piece_type] <= VALUES[front.piece_type]:
        return False
    line = chess.ray(sq(attacker), sq(pinned))
    return (
        attacks(board, attacker, pinned)
        and bool(line & chess.BB_SQUARES[sq(behind)])
        and not chess.between(sq(pinned), sq(behind)) & board.occupied
        and chess.square_distance(sq(attacker), sq(behind))
        > chess.square_distance(sq(attacker), sq(pinned))
    )
