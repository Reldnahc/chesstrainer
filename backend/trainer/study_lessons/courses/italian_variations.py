"""Optional concrete comparisons branching from the White development lesson."""

from trainer.study_lessons.courses.authoring import decision, demo, step
from trainer.study_lessons.courses.italian_positions import PREPARED, QUIET


def development_variations():
    return [
        demo(
            "premature-break",
            "Black opens the center too soon",
            "Here ...d5 attacks your e4-pawn and bishop. Watch the concrete exchanges rather than continuing your quiet setup automatically.",
            QUIET + " c3 O-O Re1",
            QUIET + " c3 O-O Re1 d5",
            "capture-break",
        ),
        decision(
            "capture-break",
            "Challenge the advancing pawn",
            "Capture the pawn that just challenged your center. Then inspect what Black's recapturing knight leaves behind.",
            QUIET + " c3 O-O Re1 d5",
            "exd5",
            "Nxd5",
            "win-center-pawn",
            "exd5 draws the f6-knight to d5. Black's e5-pawn is now defended only by the c6-knight, while your rook supports the e-file.",
            "Move the e4-pawn diagonally to d5.",
        ),
        decision(
            "win-center-pawn",
            "Use your rook's support",
            "Your knight can capture e5 even though Black has a defender there. Calculate your reply to ...Nxe5 before playing it.",
            QUIET + " c3 O-O Re1 d5 exd5 Nxd5",
            "Nxe5",
            "Nxe5",
            "recover-knight",
            "Nxe5 wins the e-pawn. Black takes your knight, but the rook behind it can complete the exchange.",
            "Move the f3-knight to e5; then your e1-rook can recapture.",
        ),
        decision(
            "recover-knight",
            "Finish the exchange",
            "Recover the knight and count what remains, rather than stopping the calculation after the first capture.",
            QUIET + " c3 O-O Re1 d5 exd5 Nxd5 Nxe5 Nxe5",
            "Rxe5",
            "c6",
            "premature-takeaway",
            "Rxe5 restores the piece balance. White has seven pawns to Black's six; Black uses ...c6 to support the d5-knight.",
            "Move the rook on e1 to e5.",
        ),
        step(
            "explanation",
            "premature-takeaway",
            "A pawn, not an automatic win",
            "You won a pawn because the rook could join the exchanges. The rook is now exposed on e5, so finish development and be ready to retreat it if attacked. Later, with more pieces supporting the center, Black's ...d5 can be perfectly sound.",
            QUIET + " c3 O-O Re1 d5 exd5 Nxd5 Nxe5 Nxe5 Rxe5 c6",
        ),
        demo(
            "bishop-threat-arrives",
            "A knight comes after the bishop",
            "In this illustrative continuation White improves the knight and Black attacks the bishop. The threat needs an answer before continuing your plan.",
            PREPARED + " Bb3 Ba7 Nbd2 h6",
            PREPARED + " Bb3 Ba7 Nbd2 h6 Nf1 Na5",
            "save-bishop",
        ),
        decision(
            "save-bishop",
            "Keep a useful bishop",
            "Move the attacked bishop to a safe square behind your central pawns.",
            PREPARED + " Bb3 Ba7 Nbd2 h6 Nf1 Na5",
            "Bc2",
            None,
            "bishop-safe",
            "Bc2 escapes the a5-knight. The d3-pawn still blocks its diagonal; if that pawn advances, the bishop will help defend e4 along c2–d3–e4.",
            "Move the bishop from b3 to c2.",
        ),
        step(
            "explanation",
            "bishop-safe",
            "A retreat can have a purpose",
            "The knight no longer attacks your bishop. The bishop has a future role behind the center, but d3 still blocks its ray to e4. Do not count that bishop as an e4-defender until the pawn moves.",
            PREPARED + " Bb3 Ba7 Nbd2 h6 Nf1 Na5 Bc2",
        ),
    ]
