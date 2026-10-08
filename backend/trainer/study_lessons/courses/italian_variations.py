"""Optional side trips branching from the White Italian lessons."""

from trainer.study_lessons.courses.authoring import decision, demo, step
from trainer.study_lessons.courses.italian_positions import ITALIAN, PREPARED, QUIET

KNIGHT_JUMP = ITALIAN + " Nd4 Nxd4 exd4 O-O Bc5 Bxf7+ Kxf7 Qh5+ Kf8 Qxc5+"
EARLY_H6 = ITALIAN + " h6 O-O Nf6 d3 Bc5 c3"
PIN = QUIET + " c3 Bg4 h3 Bh5 Nbd2"
PREMATURE_BREAK = QUIET + " c3 O-O Re1 d5 exd5 Nxd5 Nxe5 Nxe5 Rxe5"
BISHOP_THREAT = PREPARED + " Bb3 Ba7 Nbd2 h6 Nf1 Na5 Bc2"


def knight_jump_trip():
    return [
        demo(
            "knight-jump",
            "The knight jumps to d4",
            "...Nd4 attacks your f3-knight and leaves the e5-pawn undefended. It is a trap: Nxe5 looks like it wins a pawn, but Black answers ...Qg5, attacking the e5-knight and your g2-pawn at once.",
            ITALIAN,
            ITALIAN + " Nd4",
            "knight-jump-trade",
        ),
        decision(
            "knight-jump-trade",
            "Trade the active knight",
            "Take the d4-knight with your f3-knight instead of grabbing e5.",
            ITALIAN + " Nd4",
            "Nxd4",
            "exd4",
            "knight-jump-castle",
            "Nxd4 removes Black's most active piece. Black recaptures with the e-pawn, which now stands on d4.",
            "Capture on d4 with the knight from f3.",
        ),
        decision(
            "knight-jump-castle",
            "Put the king away",
            "Castle. Your king gets safe and your rook comes closer to the center.",
            ITALIAN + " Nd4 Nxd4 exd4",
            "O-O",
            "Bc5",
            "knight-jump-sacrifice",
            "Black develops the bishop to c5, where it defends the d4-pawn. Look at f7: your bishop attacks it, and only Black's king defends it.",
            "Move your king from e1 to g1 to castle.",
        ),
        decision(
            "knight-jump-sacrifice",
            "Count before you sacrifice",
            "Take on f7 with check. The king can take your bishop; before you play it, find the queen move that follows.",
            ITALIAN + " Nd4 Nxd4 exd4 O-O Bc5",
            "Bxf7+",
            "Kxf7",
            "knight-jump-fork",
            "Black takes the bishop. Now one queen move can attack both the king on f7 and the bishop on c5.",
            "Capture the f7-pawn with your bishop.",
        ),
        decision(
            "knight-jump-fork",
            "Check and attack",
            "Give check with your queen from a square that also attacks the c5-bishop.",
            ITALIAN + " Nd4 Nxd4 exd4 O-O Bc5 Bxf7+ Kxf7",
            "Qh5+",
            "Kf8",
            "knight-jump-recover",
            "Black must answer the check, so the c5-bishop cannot be saved. The king steps to f8.",
            "Move the queen from d1 to h5.",
        ),
        decision(
            "knight-jump-recover",
            "Take back the piece",
            "Collect the bishop your check attacked.",
            ITALIAN + " Nd4 Nxd4 exd4 O-O Bc5 Bxf7+ Kxf7 Qh5+ Kf8",
            "Qxc5+",
            None,
            "knight-jump-summary",
            "Qxc5+ wins back your bishop with check. You have won the f7-pawn, and Black's king can no longer castle.",
            "Capture the c5-bishop with your queen.",
        ),
        step(
            "explanation",
            "knight-jump-summary",
            "A pawn up",
            "If Black blocks this check with ...d6, your queen can also take the d4-pawn. Earlier, if Black had blocked Qh5+ with ...g6, you would still take the bishop. If Black declines your bishop with ...Kf8 instead of taking on f7, retreat it to b3: you are still a pawn up. And if Black answers your castling with ...Nf6 instead of ...Bc5, defend e4 with Re1; against ...d6, play c3 to attack the d4-pawn.",
            KNIGHT_JUMP,
        ),
    ]


def early_h6_trip():
    return [
        demo(
            "early-h6",
            "A quiet pawn move",
            "...h6 stops your knight and bishop from using g5, but it does not develop a piece. Carry on with your setup.",
            ITALIAN,
            ITALIAN + " h6",
            "early-h6-castle",
        ),
        decision(
            "early-h6-castle",
            "Castle first",
            "Black spent a move on a pawn. Use the time to put your king away.",
            ITALIAN + " h6",
            "O-O",
            "Nf6",
            "early-h6-support",
            "Black develops the knight and attacks your e4-pawn.",
            "Move your king from e1 to g1 to castle.",
        ),
        decision(
            "early-h6-support",
            "Secure your e-pawn",
            "Defend the attacked pawn and open your c1-bishop's diagonal.",
            ITALIAN + " h6 O-O Nf6",
            "d3",
            "Bc5",
            "early-h6-prepare",
            "d3 supports e4. Black develops the bishop to c5.",
            "Move the d-pawn from d2 to d3.",
        ),
        decision(
            "early-h6-prepare",
            "Prepare the center",
            "Make room for a later d4, as in your quiet setup.",
            ITALIAN + " h6 O-O Nf6 d3 Bc5",
            "c3",
            None,
            "early-h6-summary",
            "c3 supports a future d4. This is your quiet setup, with Black's pawn on h6.",
            "Move c2 to c3.",
        ),
        step(
            "explanation",
            "early-h6-summary",
            "The same setup",
            "This exact position also arises from the main line if Black plays ...h6 instead of ...d6, and from the Two Knights. Continue with Re1, Bb3 and Nbd2, as in the development chapter. If Black answers castling with ...Bc5 instead of ...Nf6, play c3 and then d4: Black has spent a move on ...h6, so a quick center is strong.",
            EARLY_H6,
        ),
    ]


def pin_trip():
    return [
        demo(
            "pin",
            "Black pins your knight",
            "...Bg4 pins your f3-knight to the queen: if the knight moved, Black's bishop could take your queen.",
            QUIET + " c3",
            QUIET + " c3 Bg4",
            "pin-question",
        ),
        decision(
            "pin-question",
            "Ask the bishop",
            "Attack the bishop with a pawn, so Black must decide whether to take your knight or step back.",
            QUIET + " c3 Bg4",
            "h3",
            "Bh5",
            "pin-support",
            "h3 asks the bishop to decide. Black keeps the pin with ...Bh5.",
            "Move h2 to h3.",
        ),
        decision(
            "pin-support",
            "Support the pinned knight",
            "Develop your b1-knight so it defends the f3-knight.",
            QUIET + " c3 Bg4 h3 Bh5",
            "Nbd2",
            None,
            "pin-summary",
            "Nbd2 develops and protects the f3-knight. If Black takes on f3, recapture with this knight and keep your pawns in front of the king.",
            "Move the knight from b1 to d2.",
        ),
        step(
            "explanation",
            "pin-summary",
            "The pin is only a nuisance",
            "Continue with Re1 and the knight route through f1, as in the main line. If Black takes on f3 right after h3, recapture with the queen: gxf3 would break up the pawns in front of your king. Black can also pin after castling and Re1; answer with h3 there too.",
            PIN,
        ),
    ]


def development_variations():
    return pin_trip() + [
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
