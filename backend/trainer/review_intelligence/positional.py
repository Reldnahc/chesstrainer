"""Observable position changes, never an evaluation-to-strategy storyteller."""

import chess

from trainer.tactical_geometry import defenders, names

VERSION = "position-facts-1"


def pawn_features(board, color):
    pawns = set(board.pieces(chess.PAWN, color))
    enemy = board.pieces(chess.PAWN, not color)
    passed, isolated = set(), set()
    for square in pawns:
        file, rank = chess.square_file(square), chess.square_rank(square)
        if not any(abs(chess.square_file(p) - file) == 1 for p in pawns):
            isolated.add(square)
        if not any(
            abs(chess.square_file(p) - file) <= 1
            and (chess.square_rank(p) - rank) * (1 if color else -1) > 0
            for p in enemy
        ):
            passed.add(square)
    doubled = {file for file in range(8) if sum(chess.square_file(p) == file for p in pawns) > 1}
    return {"passed_pawns": passed, "isolated_pawns": isolated, "doubled_files": doubled}


def flight_squares(board, color):
    # Compare actual legal king destinations, not raw adjacent empty squares.
    probe = board.copy(stack=False)
    probe.turn, probe.ep_square = color, None
    king = probe.king(color)
    return {
        move.to_square
        for move in probe.generate_legal_moves(from_mask=chess.BB_SQUARES[king])
        if not probe.is_castling(move)
    }


def rook_file(board, square, color):
    mask = chess.BB_FILES[chess.square_file(square)]
    if board.pieces_mask(chess.PAWN, color) & mask:
        return "closed"
    return "semi_open" if board.pieces_mask(chess.PAWN, not color) & mask else "open"


def position_changes(board, move, unmoved_minors=None):
    """Legal immediate transition only. `unmoved_minors` requires complete PGN history."""
    if not board.is_valid() or move not in board.legal_moves:
        return []
    after, mover = board.copy(stack=False), board.turn
    after.push(move)
    changes = []

    def emit(feature, color, before_value, after_value, squares=(), **details):
        changes.append(
            dict(
                feature=feature,
                side="white" if color else "black",
                before=before_value,
                after=after_value,
                squares=names(sorted(squares)),
                **details,
            )
        )

    piece = board.piece_at(move.from_square)
    if unmoved_minors is not None and move.from_square in unmoved_minors:
        emit(
            "first_development",
            mover,
            chess.square_name(move.from_square),
            chess.square_name(move.to_square),
            [move.from_square, move.to_square],
            piece=chess.piece_name(piece.piece_type),
        )
    if board.is_castling(move):
        king = after.king(mover)
        shield = after.pieces(chess.PAWN, mover) & after.attacks(king)
        emit(
            "castling",
            mover,
            chess.square_name(board.king(mover)),
            chess.square_name(king),
            [king, *shield],
            adjacent_pawns=names(sorted(shield)),
        )
    elif (
        piece.piece_type == chess.PAWN
        and chess.square_rank(board.king(mover)) == (0 if mover else 7)
        and chess.square_file(board.king(mover)) in {1, 2, 6, 7}
        and not board.is_check()
        and not after.is_check()
    ):
        before_flights, after_flights = flight_squares(board, mover), flight_squares(after, mover)
        opened = after_flights - before_flights
        if opened:
            emit(
                "king_flights",
                mover,
                names(sorted(before_flights)),
                names(sorted(after_flights)),
                opened,
                opened=names(sorted(opened)),
                king=chess.square_name(after.king(mover)),
            )

    for color in chess.COLORS:
        before_pawns, after_pawns = pawn_features(board, color), pawn_features(after, color)
        for feature in ("passed_pawns", "isolated_pawns"):
            old, new = before_pawns[feature], after_pawns[feature]
            mapped = {
                move.to_square if color == mover and s == move.from_square else s for s in old
            }
            if mapped != new:
                emit(
                    feature,
                    color,
                    names(sorted(old)),
                    names(sorted(new)),
                    old | new,
                    added=names(sorted(new - mapped)),
                    removed=names(sorted(mapped - new)),
                )
        old, new = before_pawns["doubled_files"], after_pawns["doubled_files"]
        if old != new:
            # `added` is what this move doubled; a pair broken up elsewhere
            # leaves an older doubled file in `after` that the move did not make.
            emit(
                "doubled_files",
                color,
                [chess.FILE_NAMES[f] for f in sorted(old)],
                [chess.FILE_NAMES[f] for f in sorted(new)],
                added=[chess.FILE_NAMES[f] for f in sorted(new - old)],
                removed=[chess.FILE_NAMES[f] for f in sorted(old - new)],
            )
        if (
            color == mover
            and move.from_square in before_pawns["passed_pawns"]
            and not move.promotion
        ):
            emit(
                "passed_pawn_advance",
                color,
                chess.square_name(move.from_square),
                chess.square_name(move.to_square),
                [move.from_square, move.to_square],
            )
        for square in sorted(board.pieces(chess.ROOK, color)):
            target = move.to_square if color == mover and square == move.from_square else square
            if board.is_castling(move) and color == mover:
                continue  # King/rook relocation is already represented by castling.
            if after.piece_at(target) != chess.Piece(chess.ROOK, color):
                continue
            old, new = rook_file(board, square, color), rook_file(after, target, color)
            if old != new:
                emit(
                    "rook_file",
                    color,
                    old,
                    new,
                    [target],
                    file=chess.FILE_NAMES[chess.square_file(target)],
                )
        for square, current in sorted(board.piece_map().items()):
            if current.color != color or current.piece_type in {chess.PAWN, chess.KING}:
                continue
            target = move.to_square if color == mover and square == move.from_square else square
            if after.piece_at(target) != current or (board.is_castling(move) and color == mover):
                continue
            old, new = defenders(board, square, color), defenders(after, target, color)
            if bool(old) != bool(new):
                emit(
                    "piece_support",
                    color,
                    names(sorted(old)),
                    names(sorted(new)),
                    [target],
                    piece=chess.piece_name(current.piece_type),
                    target=chess.square_name(target),
                    attacked=bool(defenders(after, target, not color)),
                )
        before_bishops, after_bishops = (
            len(board.pieces(chess.BISHOP, color)),
            len(after.pieces(chess.BISHOP, color)),
        )
        opposite_colors = {
            bool(chess.BB_SQUARES[s] & chess.BB_LIGHT_SQUARES)
            for s in board.pieces(chess.BISHOP, color)
        } == {False, True}
        if before_bishops == 2 and after_bishops == 1 and opposite_colors:
            emit("bishop_pair", color, 2, 1, after.pieces(chess.BISHOP, color))
    return changes


def positional_events(report, board, emit, ref, context=None):
    for line in ("actual", "best"):
        if line == "best" and report["best"]["uci"] == report["actual"]["uci"]:
            continue
        move = chess.Move.from_uci(report[line]["uci"])
        analysis_id = report.get("played_analysis_id" if line == "actual" else "before_analysis_id")
        if not analysis_id:
            continue
        for fact in position_changes(board, move, context.unmoved_minors if context else None):
            history_refs = (
                [ref("pgn", context.pgn_digest, "original_minor_piece_history")]
                if context and fact["feature"] == "first_development"
                else []
            )
            emit(
                "positional",
                "board_fact",
                30,
                fact | {"line": line, "uci": move.uci(), "value_judgment": "not_inferred"},
                [
                    ref("position", board.fen(), "immediate_transition"),
                    ref("rule", VERSION, fact["feature"]),
                    ref("stockfish", analysis_id, f"{line}/candidate"),
                    *history_refs,
                ],
            )
