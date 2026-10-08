"""The countergambit earns its own lesson: its center is not the Bc5 center."""

from trainer.study_lessons.courses.authoring import decision, demo, position, step

START = "e4 e5 f4 d5"
CAPTURE = START + " exd5"
WEDGE = CAPTURE + " e4"
CENTER = WEDGE + " d3 Nf6 dxe4 Nxe4"
DEVELOP = CENTER + " Nf3 Bc5"
LINE = DEVELOP + " Qe2 Bf5 Nc3 Qe7 Be3"
RESOLUTION = LINE + " Nxc3 Bxc5 Qxe2+ Bxe2 Nxe2 Kxe2"
MODERN = CAPTURE + " exf4 Nf3 Nf6 Bb5+"
EARLY_QUEEN = CAPTURE + " Qxd5 Nc3 Qe6 fxe5 Qxe5+ Be2 Bg4 d4"
CHALLENGE = WEDGE + " d3"
SUPPORT = CHALLENGE + " Qxd5 Nc3 Bb4 Bd2 Bxc3 Bxc3"
SWAP = CHALLENGE + " exd3 Bxd3 Qxd5 Nc3"


def recall_lines():
    start = position(START)
    return [
        dict(
            id=identity,
            title=title,
            position=start,
            moves=position(san).moves[len(start.moves) :],
            repertoire=True,
            eco=eco,
        )
        for identity, title, san, eco in (
            (
                "falkbeer-center",
                "Falkbeer Countergambit · remove the wedge and develop",
                LINE,
                "C32",
            ),
            (
                "falkbeer-modern",
                "Falkbeer Countergambit · into the Modern Defense (3...exf4)",
                MODERN,
                "C36",
            ),
            (
                "falkbeer-queen",
                "Falkbeer Countergambit · queen takes back (3...Qxd5)",
                EARLY_QUEEN,
                "C31",
            ),
            (
                "falkbeer-wedge-queen",
                "Falkbeer Countergambit · queen supports e4 (4...Qxd5)",
                SUPPORT,
                "C32",
            ),
            (
                "falkbeer-wedge-take",
                "Falkbeer Countergambit · Black takes on d3 (4...exd3)",
                SWAP,
                "C32",
            ),
            (
                "falkbeer-exchange",
                "Falkbeer Countergambit · knight takes on c3 (9...Nxc3)",
                RESOLUTION,
                "C32",
            ),
        )
    ]


def modern_trip():
    return [
        demo(
            "falkbeer-modern",
            "Black takes f4 instead",
            "Black takes your f-pawn instead of advancing e4. Cover h4 first, as in the accepted chapters.",
            CAPTURE,
            CAPTURE + " exf4",
            "falkbeer-modern-knight",
        ),
        decision(
            "falkbeer-modern-knight",
            "Cover h4",
            "Develop the g1-knight to f3, covering h4.",
            CAPTURE + " exf4",
            "Nf3",
            "Nf6",
            "falkbeer-modern-check",
            "Black develops Nf6, attacking d5. The board now matches the Modern Defense after e4 e5 f4 exf4 Nf3 d5 exd5 Nf6, with the same side to move.",
            "Move the knight from g1 to f3.",
        ),
        decision(
            "falkbeer-modern-check",
            "Reuse the Modern Defense plan",
            "Play the move you learned in this position against the Modern Defense: develop the f1-bishop with check.",
            MODERN.rsplit(" ", 1)[0],
            "Bb5+",
            None,
            "falkbeer-modern-summary",
            "Bb5+ develops with check, exactly as in the Modern Defense chapter. From here, follow that chapter's plan.",
            "Move the bishop from f1 to b5.",
        ),
        step(
            "explanation",
            "falkbeer-modern-summary",
            "Reuse the plan when the board matches",
            "Different move orders can reach the same position, and then the plan you learned still applies. Return to see Black's other replies, including e4, which keeps the e-pawn and pushes it forward.",
            MODERN,
        ),
    ]


def early_queen_trip():
    return [
        demo(
            "falkbeer-early-queen",
            "The queen takes back",
            "Black recaptures with the queen. Material is equal, but the queen stands in the center where your pieces can attack it, and your f4-pawn still attacks e5.",
            CAPTURE,
            CAPTURE + " Qxd5",
            "falkbeer-early-chase",
        ),
        decision(
            "falkbeer-early-chase",
            "Develop with an attack",
            "Develop the b1-knight to c3, attacking the queen.",
            CAPTURE + " Qxd5",
            "Nc3",
            "Qe6",
            "falkbeer-early-pawn",
            "The queen moves to e6. This is not check: Black's own e5-pawn blocks the e-file. That pawn is still attacked by your f4-pawn.",
            "Move the knight from b1 to c3.",
        ),
        decision(
            "falkbeer-early-pawn",
            "Take the e5-pawn",
            "Capture on e5 with the f-pawn. Black's queen will take back with check, and you will block it with a developing move.",
            CAPTURE + " Qxd5 Nc3 Qe6",
            "fxe5",
            "Qxe5+",
            "falkbeer-early-block",
            "The queen takes back with check along the e-file.",
            "Capture on e5 with the pawn from f4.",
        ),
        decision(
            "falkbeer-early-block",
            "Block with development",
            "Block the check with the f1-bishop on e2.",
            CAPTURE + " Qxd5 Nc3 Qe6 fxe5 Qxe5+",
            "Be2",
            "Bg4",
            "falkbeer-early-center",
            "Black develops Bg4, attacking your e2-bishop. That bishop is pinned: if it left the e-file, Black's queen would check your king.",
            "Move the bishop from f1 to e2.",
        ),
        decision(
            "falkbeer-early-center",
            "Attack the queen with a pawn",
            "Push d4. The pawn attacks Black's queen and opens the c1-bishop's path.",
            EARLY_QUEEN.rsplit(" ", 1)[0],
            "d4",
            None,
            "falkbeer-early-summary",
            "Black's queen is attacked again, and your c1-bishop can come out.",
            "Move d2 to d4.",
        ),
        step(
            "explanation",
            "falkbeer-early-summary",
            "Watch the pin",
            "You are ahead in development. Until Black's queen leaves the e-file, your e2-bishop stays pinned. That is why Nf3 instead of d4 would be a mistake: Black takes the knight with the bishop, the pinned bishop cannot recapture, and gxf3 breaks up your kingside pawns. Keep developing with moves that do not rely on the pinned bishop.",
            EARLY_QUEEN,
        ),
    ]


def support_trip():
    return [
        demo(
            "falkbeer-wedge-queen",
            "The queen supports e4",
            "Black's queen takes your d5-pawn and now defends the e4-pawn. Material is equal.",
            CHALLENGE,
            CHALLENGE + " Qxd5",
            "falkbeer-wedge-queen-knight",
        ),
        decision(
            "falkbeer-wedge-queen-knight",
            "Develop with an attack",
            "Develop the b1-knight to c3, attacking the queen.",
            CHALLENGE + " Qxd5",
            "Nc3",
            "Bb4",
            "falkbeer-wedge-queen-pin",
            "Black answers with Bb4, pinning your knight: it cannot move, or your king would be in check, so it cannot take the queen. Break the pin.",
            "Move the knight from b1 to c3.",
        ),
        decision(
            "falkbeer-wedge-queen-pin",
            "Break the pin",
            "Develop the c1-bishop to d2, between Black's bishop and your king.",
            CHALLENGE + " Qxd5 Nc3 Bb4",
            "Bd2",
            "Bxc3",
            "falkbeer-wedge-queen-recapture",
            "With the pin broken, your knight threatens the queen again, so Black takes it. Recapture with the bishop.",
            "Move the bishop from c1 to d2.",
        ),
        decision(
            "falkbeer-wedge-queen-recapture",
            "Recapture with the bishop",
            "Take back on c3 with the bishop. From c3 it looks along the long diagonal toward Black's g7-pawn.",
            CHALLENGE + " Qxd5 Nc3 Bb4 Bd2 Bxc3",
            "Bxc3",
            None,
            "falkbeer-wedge-queen-summary",
            "Material is equal. Next, take on e4 with the d-pawn to remove the wedge.",
            "Capture on c3 with the bishop.",
        ),
        step(
            "explanation",
            "falkbeer-wedge-queen-summary",
            "Remove the wedge next",
            "Black has traded the bishop for your knight. Your plan is the main line's: take on e4 with the d-pawn, then develop and castle. If Black's queen takes back on e4 with check, block with your queen.",
            SUPPORT,
        ),
    ]


def swap_trip():
    return [
        demo(
            "falkbeer-wedge-take",
            "Black takes on d3",
            "Black captures your d3-pawn instead of keeping the wedge. Recapture with a piece that needs to develop.",
            CHALLENGE,
            CHALLENGE + " exd3",
            "falkbeer-wedge-take-bishop",
        ),
        decision(
            "falkbeer-wedge-take-bishop",
            "Recapture and develop",
            "Take back on d3 with the f1-bishop.",
            CHALLENGE + " exd3",
            "Bxd3",
            "Qxd5",
            "falkbeer-wedge-take-knight",
            "Black's queen wins back the d5-pawn, so material is equal. Attack the queen with a developing move.",
            "Capture on d3 with the bishop.",
        ),
        decision(
            "falkbeer-wedge-take-knight",
            "Develop with an attack",
            "Develop the b1-knight to c3, attacking the queen.",
            CHALLENGE + " exd3 Bxd3 Qxd5",
            "Nc3",
            None,
            "falkbeer-wedge-take-summary",
            "Black's queen is attacked. Black can move it, or pin your knight with Bb4.",
            "Move the knight from b1 to c3.",
        ),
        step(
            "explanation",
            "falkbeer-wedge-take-summary",
            "A trap on g2",
            "Taking your g2-pawn looks free, but Be4 then attacks the queen and covers every square it could escape to: the queen is trapped. If the queen checks on e6 instead, block with the g1-knight on e2. Against Bb4, keep developing with Nf3 or Bd2. If Black developed Nf6 instead of taking on d5, play Nc3 too.",
            SWAP,
        ),
    ]


def resolution_trip():
    return [
        demo(
            "falkbeer-resolution",
            "Black takes on c3",
            "Nxc3 takes your knight and attacks your queen on e2. Taking back with the b-pawn would let Black's queen take your e3-bishop, which the c5-bishop also attacks. Look for a counterattack instead.",
            LINE,
            LINE + " Nxc3",
            "falkbeer-resolution-counter",
        ),
        decision(
            "falkbeer-resolution-counter",
            "Counterattack the queen",
            "Capture the c5-bishop with your e3-bishop. Now Black's queen is attacked too.",
            LINE + " Nxc3",
            "Bxc5",
            "Qxe2+",
            "falkbeer-resolution-recapture",
            "Black exchanges queens with check. Take back.",
            "Capture on c5 with the bishop from e3.",
        ),
        decision(
            "falkbeer-resolution-recapture",
            "Recapture the queen",
            "Take back on e2 with the f1-bishop.",
            LINE + " Nxc3 Bxc5 Qxe2+",
            "Bxe2",
            "Nxe2",
            "falkbeer-resolution-king",
            "Black's knight takes your bishop on e2. Only your king can recapture.",
            "Capture on e2 with the bishop from f1.",
        ),
        decision(
            "falkbeer-resolution-king",
            "Recapture with the king",
            "Take the knight with your king.",
            LINE + " Nxc3 Bxc5 Qxe2+ Bxe2 Nxe2",
            "Kxe2",
            None,
            "falkbeer-resolution-summary",
            "Both queens and two minor pieces from each side are gone, and you are still a pawn up. Your king can no longer castle.",
            "Capture on e2 with the king.",
        ),
        step(
            "explanation",
            "falkbeer-resolution-summary",
            "A different ending to development",
            "With the queens gone, your king is safe enough on e2 and can help in the center. Finish developing and bring the rooks to the open files, rather than forcing the original castling plan. Return to the position before these exchanges.",
            RESOLUTION,
        ),
    ]


def chapter():
    steps = [
        step(
            "explanation",
            "falkbeer-welcome",
            "Black offers a central pawn",
            "The Falkbeer starts with d5 before Black takes f4. Unlike the bishop-first refusal, this can put a black pawn on e4. We will challenge that wedge, then develop while watching the open e-file. Side trips cover Black's common alternatives along the way.",
            next_step="falkbeer-arrival",
        ),
        demo(
            "falkbeer-arrival",
            "Recognize the countergambit",
            "White offers f4, and Black answers with a pawn offer in the center. The d5-pawn attacks e4.",
            "",
            START,
            "falkbeer-take",
        ),
        decision(
            "falkbeer-take",
            "Meet the central counterattack",
            "Take the pawn that is challenging e4, then see which reply Black chooses.",
            START,
            "exd5",
            None,
            "falkbeer-choice",
            "Your e-pawn reaches d5. Black can take your f-pawn, take back with the queen, or push e4.",
            "Use the e4-pawn to capture d5.",
        ),
        step(
            "branch",
            "falkbeer-choice",
            "One move order, two centers",
            "If Black takes your f-pawn, the game can reach the Modern Defense by a different move order. Explore that side trip, or continue to Black's next reply.",
            CAPTURE,
            branch_start="falkbeer-modern",
            next_step="falkbeer-queen-choice",
        ),
        *modern_trip(),
        step(
            "branch",
            "falkbeer-queen-choice",
            "If the queen takes back",
            "Black's queen often recaptures on d5 at once. Explore that side trip, or continue for e4, the Falkbeer wedge.",
            CAPTURE,
            branch_start="falkbeer-early-queen",
            next_step="falkbeer-wedge",
        ),
        *early_queen_trip(),
        demo(
            "falkbeer-wedge",
            "The pawn advances instead",
            "Black leaves your f-pawn alone and advances e4. That pawn controls d3 and f3, so developing Nf3 now would put the knight where the pawn can take it.",
            CAPTURE,
            WEDGE,
            "falkbeer-challenge",
        ),
        decision(
            "falkbeer-challenge",
            "Challenge the wedge first",
            "Use the d-pawn to attack e4. Remove this obstacle before putting the g1-knight on f3.",
            WEDGE,
            "d3",
            None,
            "falkbeer-wedge-queen-choice",
            "d3 attacks e4. Black can support the pawn with the queen, take on d3, or develop Nf6.",
            "Move d2 to d3.",
        ),
        step(
            "branch",
            "falkbeer-wedge-queen-choice",
            "If the queen supports e4",
            "Explore Black's queen taking d5 to support the wedge, or continue to Black's next reply.",
            CHALLENGE,
            branch_start="falkbeer-wedge-queen",
            next_step="falkbeer-wedge-take-choice",
        ),
        *support_trip(),
        step(
            "branch",
            "falkbeer-wedge-take-choice",
            "If Black takes on d3",
            "Explore Black exchanging the wedge for your d3-pawn, or continue for Nf6, this chapter's main line.",
            CHALLENGE,
            branch_start="falkbeer-wedge-take",
            next_step="falkbeer-develop-reply",
        ),
        *swap_trip(),
        demo(
            "falkbeer-develop-reply",
            "Black develops the knight",
            "In the main line Black develops Nf6, ready to recapture if you exchange pawns on e4.",
            CHALLENGE,
            CHALLENGE + " Nf6",
            "falkbeer-exchange",
        ),
        decision(
            "falkbeer-exchange",
            "Remove the advanced pawn",
            "Carry out the exchange you prepared. Black can recapture, but a knight on e4 creates different threats from a pawn controlling f3.",
            WEDGE + " d3 Nf6",
            "dxe4",
            "Nxe4",
            "falkbeer-knight",
            "The pawn wedge is gone. Black has an active knight on e4; your f-pawn is still on f4, and you are a pawn ahead. Development matters more than trying to hold every pawn.",
            "Capture e4 with the pawn on d3.",
        ),
        decision(
            "falkbeer-knight",
            "Cover the queen's entry square",
            "Develop the g1-knight to cover h4. The black pawn that previously attacked f3 has disappeared.",
            CENTER,
            "Nf3",
            "Bc5",
            "falkbeer-queen",
            "Nf3 covers h4. Bc5 aims at f2, while Ne4 controls d2 and f2. Your king remains in the center, so coordinate your pieces before castling.",
            "Move the knight from g1 to f3.",
        ),
        decision(
            "falkbeer-queen",
            "Tie the knight to its king",
            "Place the queen on e2. The open e-file lets it pin Ne4 against Black's king while you prepare to develop Nb1.",
            DEVELOP,
            "Qe2",
            "Bf5",
            "falkbeer-queenside-knight",
            "Qe2 pins Ne4. Black develops Bf5 to defend that knight, but the pin means it still cannot move and expose its king.",
            "Move the queen from d1 to e2.",
        ),
        decision(
            "falkbeer-queenside-knight",
            "Develop with pressure",
            "Develop Nb1 to c3 and attack the pinned e4-knight. This brings another piece into play while Black must consider the pressure on e4.",
            DEVELOP + " Qe2 Bf5",
            "Nc3",
            "Qe7",
            "falkbeer-bishop",
            "Nc3 adds pressure. Qe7 interposes between Ne4 and the king: the knight is no longer absolutely pinned, although moving it would expose Black's queen to your queen.",
            "Move the knight from b1 to c3.",
        ),
        decision(
            "falkbeer-bishop",
            "Develop while covering the file",
            "Bring Bc1 to e3, blocking the e-file between the queens and attacking Bc5. Then reassess: your own bishop will also remove your queen's pressure on Ne4.",
            DEVELOP + " Qe2 Bf5 Nc3 Qe7",
            "Be3",
            None,
            "falkbeer-resolution-choice",
            "Be3 develops and clears c1 for possible queenside castling. It also breaks the queen's line to e4, freeing Black's knight to capture on c3. Do not assume the old pin still exists.",
            "Move the bishop from c1 to e3.",
        ),
        step(
            "branch",
            "falkbeer-resolution-choice",
            "What if Black exchanges on c3?",
            "The knight on e4 is no longer pinned, so it can take on c3 and attack your queen. Explore how to answer that, or continue.",
            LINE,
            branch_start="falkbeer-resolution",
            next_step="falkbeer-summary",
        ),
        *resolution_trip(),
        step(
            "explanation",
            "falkbeer-summary",
            "Reassess before choosing a king's home",
            "Your queen and queenside pieces have developed, and you are a pawn ahead. You have cleared the way for queenside castling, but Black moves first and can change the center by exchanging on c3 or e3. Check those threats before castling. If the center stays intact, developing the f1-bishop and connecting the rooks are next jobs; the extra pawn is not a finished attack.",
            LINE,
            next_step="falkbeer-rehearsal",
        ),
        step(
            "rehearsal",
            "falkbeer-rehearsal",
            "Meet the countergambit from Black's d5",
            "Rehearse removing the pawn wedge and coordinating the pieces. Each side trip has its own line under Keep these lines in memory on the course page.",
            START,
            line_id="falkbeer-center",
        ),
    ]
    return dict(
        id="falkbeer-countergambit",
        title="Meet the Falkbeer countergambit",
        entry_step=steps[0]["id"],
        steps=steps,
    )
