"""The countergambit earns its own lesson: its center is not the Bc5 center."""

from trainer.study_lessons.courses.authoring import decision, demo, position, step

START = "e4 e5 f4 d5"
CAPTURE = START + " exd5"
WEDGE = CAPTURE + " e4"
CENTER = WEDGE + " d3 Nf6 dxe4 Nxe4"
DEVELOP = CENTER + " Nf3 Bc5"
LINE = DEVELOP + " Qe2 Bf5 Nc3 Qe7 Be3"
RESOLUTION = LINE + " Nxc3 Bxc5 Qxe2+ Bxe2 Nxe2 Kxe2"


def recall_line():
    start, end = position(START), position(LINE)
    return dict(
        id="falkbeer-center",
        title="Falkbeer Countergambit · remove the wedge and develop",
        position=start,
        moves=end.moves[len(start.moves) :],
        repertoire=True,
        eco="C32",
    )


def chapter():
    steps = [
        step(
            "explanation",
            "falkbeer-welcome",
            "Black offers a central pawn",
            "The Falkbeer starts with d5 before Black takes f4. Unlike the bishop-first refusal, this can put a black pawn on e4. We will challenge that wedge, then develop while watching the open e-file. This is one selected response; Black need not choose the same continuation.",
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
            "Take the pawn that is challenging e4. Then check whether Black captures your f-pawn or advances the remaining central pawn.",
            START,
            "exd5",
            None,
            "falkbeer-choice",
            "Your e-pawn reaches d5. Black's choice now determines whether this becomes a familiar Modern Defense or a different center.",
            "Use the e4-pawn to capture d5.",
        ),
        step(
            "branch",
            "falkbeer-choice",
            "One move order, two centers",
            "Continue for e4, the Falkbeer wedge. The comparison shows exf4 instead: after Nf3 and Nf6 we reach the Modern Defense already studied, by a different move order.",
            CAPTURE,
            branch_start="falkbeer-modern",
            next_step="falkbeer-wedge",
        ),
        demo(
            "falkbeer-modern",
            "Recognize a familiar position",
            "Black takes f4 instead of advancing e4. Nf3 covers h4 and Black develops Nf6, attacking d5. The board now matches the Modern Defense before our bishop check.",
            CAPTURE,
            CAPTURE + " exf4 Nf3 Nf6",
            "falkbeer-modern-summary",
        ),
        step(
            "explanation",
            "falkbeer-modern-summary",
            "Reuse the plan when the board matches",
            "This is the same board and side to move as e4 e5 f4 exf4 Nf3 d5 exd5 Nf6. Our studied reply is Bb5+. Return to see what changes when Black keeps the e-pawn and pushes it to e4 instead.",
            CAPTURE + " exf4 Nf3 Nf6",
        ),
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
            "Nf6",
            "falkbeer-exchange",
            "d3 attacks e4. Black develops Nf6, ready to recapture if you exchange pawns.",
            "Move d2 to d3.",
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
            "The knight on e4 is no longer pinned. Explore one sound exchange sequence to see why captures and checks can matter more than immediately recapturing a piece. This is a comparison, not the only continuation.",
            LINE,
            branch_start="falkbeer-resolution",
            next_step="falkbeer-summary",
        ),
        demo(
            "falkbeer-resolution",
            "Answer the threat between the captures",
            "Nxc3 attacks White's queen. White answers Bxc5, attacking Black's queen in turn. Black exchanges queens with check before trading the knight. Follow the checks and captures to the resulting position.",
            LINE,
            RESOLUTION,
            "falkbeer-resolution-summary",
        ),
        step(
            "explanation",
            "falkbeer-resolution-summary",
            "A different ending to development",
            "Both queens and two minor pieces from each side are gone; White still has one extra pawn. White's king has moved to e2 and can no longer castle. With queens off, the task becomes finishing development and coordinating the rooks, rather than forcing the original castling plan. Return to the position before these exchanges.",
            RESOLUTION,
        ),
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
            "Rehearse removing the pawn wedge and coordinating the pieces. The comparison branches are not part of this recall line.",
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
