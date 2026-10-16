"""Immediate board annotations from saved evidence; never plays an engine line."""

import chess

from trainer.chess_core import VALUES
from trainer.tactical_geometry import absolute_pinner, relative_pinners


def pins(board):
    """Pins worth an arrow, as (pinning piece, pinned piece, piece behind): a
    piece (never a pawn) pinned to its king, or to something worth more than
    the pinning piece. On real games pawn and lesser pins put an arrow on about
    one move in six; this keeps it near one in twenty (owner decision,
    2026-10-12)."""
    found = set()
    for square, piece in board.piece_map().items():
        if piece.piece_type in {chess.KING, chess.PAWN}:
            continue
        # The arrow starts at the piece actually pinning, the nearest one beyond
        # the pinned piece, not any slider elsewhere on the line.
        source = absolute_pinner(board, square)
        if source is not None:
            found.add((source, square, board.king(piece.color)))
        # A relative pin the pinned piece can answer by taking the pinner (5.Bxf6
        # "pinning" Be7 to Qd8) is not drawn as a pin.
        found.update(
            (slider, square, rear)
            for slider, rear in relative_pinners(board, square)
            if VALUES[board.piece_type_at(rear)] > VALUES[board.piece_type_at(slider)]
            and slider not in board.attacks(square)
        )
    return found


def new_pins(before, after):
    """Pins the move just made, never ones carried over from earlier moves.

    A pin is the same pin while the piece behind stays put on the same line
    (chess.ray is the whole line), so the pinning or pinned piece sliding along
    that line does not redraw it."""
    held = {(rear, chess.ray(source, rear)) for source, _, rear in pins(before)}
    return [
        {
            "startSquare": chess.square_name(source),
            "endSquare": chess.square_name(rear),
            "kind": "pin",
            "pinned": chess.square_name(pinned),
        }
        for source, pinned, rear in sorted(pins(after))
        if (rear, chess.ray(source, rear)) not in held
    ]


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
                # A before-move witness can mention the vacated origin, the empty
                # square the move goes to (a skewering check names it before the
                # piece stands there) or a captured piece. Project only the mover,
                # never the victim.
                if finding["frame_ply"] == 0:
                    if square == played.from_square:
                        square = played.to_square
                    elif square == played.to_square and witness.piece_at(square) is None:
                        pass
                    elif witness.piece_at(square) != current.piece_at(square):
                        continue
                # The cue draws the current position: a square a piece has yet to
                # reach (a skewering piece's destination) is marked only as the
                # shown reply's landing square, never as an empty square.
                elif current.piece_at(square) is None and not (
                    show_reply and square == reply.to_square
                ):
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
    # Only this complete caption has a reusable generic recording. A caption
    # that also explains a finding must retain that finding's specific meaning.
    reply_only = show_reply and finding is None
    return {
        "fen": current.fen(),
        "arrows": arrows,
        "pins": new_pins(chess.Board(frames[0]["fen"]), current),
        "roles": roles,
        "caption": caption,
        "caption_kind": "legal_reply" if reply_only else None,
        "caption_reply_uci": reply.uci() if reply_only else None,
    }
