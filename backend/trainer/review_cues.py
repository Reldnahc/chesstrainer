"""Immediate board annotations from saved evidence; never plays an engine line."""

import chess


def review_cues(line, *, mistake=False):
    frames = line["frames"]
    if len(frames) < 2:
        return None
    current = chess.Board(frames[1]["fen"])
    played = chess.Move.from_uci(frames[1]["uci"])
    finding = next((f for f in line["findings"] if 0 <= f["frame_ply"] <= 2), None)
    reply = None
    if len(frames) > 2 and frames[2]["uci"]:
        candidate = chess.Move.from_uci(frames[2]["uci"])
        if candidate in current.legal_moves:
            reply = candidate
    future = finding is not None and finding["frame_ply"] == 2
    if future and reply is None:
        finding = None
    arrows, roles = [], {}

    def arrow(start, end, kind):
        item = {"startSquare": chess.square_name(start), "endSquare": chess.square_name(end)}
        if start != end and not any(all(a[k] == v for k, v in item.items()) for a in arrows):
            arrows.append(item | {"kind": kind})

    show_reply = reply is not None and (mistake or future or finding is None)
    if show_reply:
        arrow(reply.from_square, reply.to_square, "reply")
        roles["reply"] = [chess.square_name(reply.to_square)]
        caption = f"{'White' if current.turn else 'Black'} can play {frames[2]['san']}."
    else:
        arrow(played.from_square, played.to_square, "move")
        caption = frames[1]["annotation"]

    checking = current.copy()
    if show_reply:
        checking.push(reply)
    if checking.is_check():
        king = checking.king(checking.turn)
        roles["king"] = [chess.square_name(king)]
        roles["attackers"] = [chess.square_name(s) for s in checking.checkers()]
        for checker in checking.checkers():
            arrow(checker, king, "threat")

    if finding:
        witness = chess.Board(frames[finding["frame_ply"]]["fen"])
        for role, squares in finding["roles"].items():
            visible = []
            for name in squares:
                square = chess.parse_square(name)
                # A before-move witness can mention the vacated origin or a
                # captured piece. Project only the mover, never the victim.
                if finding["frame_ply"] == 0:
                    if square == played.from_square:
                        square = played.to_square
                    elif witness.piece_at(square) != current.piece_at(square):
                        continue
                visible.append(chess.square_name(square))
            if visible:
                roles[role] = visible

        # Only draw attack relationships verified in the witness position.
        # Future threats belong to the immediate reply, never later PV moves.
        attackers = [
            s for role, squares in finding["roles"].items() if "attacker" in role for s in squares
        ]
        targets = [
            s
            for role, squares in finding["roles"].items()
            if "target" in role or role == "king"
            for s in squares
        ]
        for start in attackers:
            source = chess.parse_square(start)
            for end in targets:
                target = chess.parse_square(end)
                if target not in witness.attacks(source):
                    continue
                if finding["frame_ply"] == 0:
                    # The old attack may have disappeared after the move.
                    if witness.piece_at(source) != current.piece_at(source):
                        continue
                    if witness.piece_at(target) != current.piece_at(target):
                        continue
                    if target not in current.attacks(source):
                        continue
                arrow(source, target, "threat")
        caption = (caption + " " if show_reply else "") + finding["explanation"]
    return {"fen": current.fen(), "arrows": arrows, "roles": roles, "caption": caption}
