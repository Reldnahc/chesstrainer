"""Conservative sacrifice admission from legal moves and saved engine evidence."""

import chess

from trainer.chess_core import Score, material, valid_board


def is_sacrifice_offer(board, move, capture):
    """Exclude promotions and immediate material-restoring trades, without searching.

    A legal recapture is only a reason to abstain from a sacrifice claim. It does
    not establish that the recapture is tactically sound or replace engine scores.
    """
    if not board.is_valid() or move not in board.legal_moves or board.legal_moves.count() <= 1:
        return False
    after = board.copy(stack=False)
    after.push(move)
    if capture not in after.legal_moves or not after.is_capture(capture):
        return False
    victim = after.piece_at(capture.to_square)
    original_square = move.from_square if capture.to_square == move.to_square else capture.to_square
    original = board.piece_at(original_square)
    if (
        victim is None
        or original is None
        or original.color != board.turn
        or original.piece_type in {chess.PAWN, chess.KING}
        or original != victim
    ):
        return False

    def balance(position):
        return material(position, board.turn) - material(position, not board.turn)

    baseline = balance(board)
    accepted = after.copy(stack=False)
    accepted.push(capture)
    if balance(accepted) >= baseline:
        return False
    for recapture in accepted.legal_moves:
        if recapture.to_square != capture.to_square or not accepted.is_capture(recapture):
            continue
        restored = accepted.copy(stack=False)
        restored.push(recapture)
        if balance(restored) >= baseline:
            return False
    return True


def has_sacrifice_support(board, score, line):
    """Require a winning mate or a tactical witness involving the current move."""
    if score.kind == "mate" and score.outcome() == 1:
        return True
    actor = "white" if board.turn else "black"
    findings = line.get("findings", [])
    if not isinstance(findings, list):
        return False
    return any(
        isinstance(finding, dict)
        and finding.get("actor") == actor
        and isinstance(finding.get("plies"), list)
        and any(type(ply) is int and ply == 1 for ply in finding["plies"])
        for finding in findings
    )


def supported_sacrifice(report):
    """Revalidate a stored offer without changing its acceptance score or report."""
    if not isinstance(report, dict):
        return False
    sacrifice = report.get("sacrifice")
    actual = report.get("actual")
    line = report.get("actual_line")
    if not all(isinstance(value, dict) for value in (sacrifice, actual, line)):
        return False
    identifier = sacrifice.get("analysis_id")
    if not isinstance(identifier, str) or not identifier.strip():
        return False
    frames = line.get("frames")
    if not isinstance(frames, list) or not frames or not isinstance(frames[0], dict):
        return False
    fen, uci, capture_uci = frames[0].get("fen"), actual.get("uci"), sacrifice.get("capture")
    if not all(isinstance(value, str) for value in (fen, uci, capture_uci)):
        return False
    try:
        board = valid_board(fen)
        move = chess.Move.from_uci(uci)
        capture = chess.Move.from_uci(capture_uci)
        score = Score.model_validate(actual.get("score"), strict=True)
        acceptance = Score.model_validate(sacrifice.get("score"), strict=True)
    except ValueError:
        return False

    def sound(value):
        return value.value >= -50 if value.kind == "cp" else value.outcome() == 1

    return (
        sound(score)
        and sound(acceptance)
        and has_sacrifice_support(board, score, line)
        and is_sacrifice_offer(board, move, capture)
    )
