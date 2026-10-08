"""Against the Two Knights, defend e4 first, then meet each common fourth move."""

from trainer.study_lessons.courses.authoring import decision, demo, position, step
from trainer.study_lessons.courses.italian_positions import ITALIAN

TWO_KNIGHTS = ITALIAN + " Nf6"
DEFENDED = TWO_KNIGHTS + " d3"
STRIKE = DEFENDED + " d5"
TRADE = STRIKE + " exd5 Nxd5"
LINE = TRADE + " O-O Be6 Re1"
SETTLED = LINE + " Bd6"
WAIT = DEFENDED + " h6 O-O Bc5 c3"
PRESS = DEFENDED + " d6 Ng5 Be6 Nxe6 fxe6 Bxe6"
CHECK = DEFENDED + " Bb4+ c3 Ba5 O-O"


def lines():
    anchor = position(TWO_KNIGHTS)
    return [
        dict(
            id=identity,
            title=title,
            position=anchor,
            moves=position(san).moves[len(anchor.moves) :],
            repertoire=True,
            eco="C55",
        )
        for identity, title, san in (
            ("two-knights-center", "Two Knights · meet 4...d5", LINE),
            ("two-knights-h6", "Two Knights · 4...h6", WAIT),
            ("two-knights-d6", "Two Knights · 4...d6 5.Ng5", PRESS),
            ("two-knights-check", "Two Knights · 4...Bb4+", CHECK),
        )
    ]


def h6_trip():
    return [
        demo(
            "two-knights-h6",
            "A quiet pawn move",
            "...h6 keeps your knight and bishop off g5. It does not develop a piece, so continue with your setup.",
            DEFENDED,
            DEFENDED + " h6",
            "two-knights-h6-castle",
        ),
        decision(
            "two-knights-h6-castle",
            "Put the king away",
            "Your e4-pawn is defended, so castle.",
            DEFENDED + " h6",
            "O-O",
            "Bc5",
            "two-knights-h6-prepare",
            "Black develops the bishop to c5.",
            "Move your king from e1 to g1 to castle.",
        ),
        decision(
            "two-knights-h6-prepare",
            "Prepare the center",
            "Make room for a later d4, as in your quiet setup.",
            DEFENDED + " h6 O-O Bc5",
            "c3",
            None,
            "two-knights-h6-summary",
            "c3 supports a future d4. This is your quiet setup, with Black's pawn on h6.",
            "Move c2 to c3.",
        ),
        step(
            "explanation",
            "two-knights-h6-summary",
            "The same setup",
            "The first chapter's h6 side trip reaches this exact position. Continue with Re1, Bb3 and Nbd2, as in the development chapter. If Black plays ...d6 instead of ...Bc5, play c3 all the same.",
            WAIT,
        ),
    ]


def d6_trip():
    return [
        demo(
            "two-knights-d6",
            "Black supports e5 with ...d6",
            "...d6 defends e5, but it also shuts in the f8-bishop: it can only reach e7, so Black cannot castle next move. For now, only Black's king defends f7.",
            DEFENDED,
            DEFENDED + " d6",
            "two-knights-d6-attack",
        ),
        decision(
            "two-knights-d6-attack",
            "Attack f7 twice",
            "Your bishop already aims at f7. Add a second attacker.",
            DEFENDED + " d6",
            "Ng5",
            "Be6",
            "two-knights-d6-take",
            "Ng5 threatens Nxf7, which would attack Black's queen and h8-rook. Black blocks your bishop's path to f7 with ...Be6.",
            "Move the knight from f3 to g5.",
        ),
        decision(
            "two-knights-d6-take",
            "Remove the blocker",
            "Take the bishop that blocks your c4-bishop.",
            DEFENDED + " d6 Ng5 Be6",
            "Nxe6",
            "fxe6",
            "two-knights-d6-pawn",
            "Black recaptures with the f-pawn. Check what defends the new pawn on e6.",
            "Capture on e6 with your knight.",
        ),
        decision(
            "two-knights-d6-pawn",
            "Win the pawn",
            "Nothing defends the e6-pawn. Take it.",
            DEFENDED + " d6 Ng5 Be6 Nxe6 fxe6",
            "Bxe6",
            None,
            "two-knights-d6-summary",
            "Bxe6 wins a pawn, and Black's light-squared bishop is gone.",
            "Capture on e6 with the bishop from c4.",
        ),
        step(
            "explanation",
            "two-knights-d6-summary",
            "A pawn ahead",
            "If Black attacks your bishop with ...Qe7 or ...Nd4, retreat it to h3. Black's best answer to Ng5 was ...d5, which blocks your bishop: take the pawn with exd5. Then, if the c6-knight goes to a5 to attack your bishop, check with Bb5+; if the f6-knight takes on d5, castle.",
            PRESS,
        ),
    ]


def check_trip():
    return [
        demo(
            "two-knights-check",
            "A bishop check",
            "...Bb4+ develops the bishop with check.",
            DEFENDED,
            DEFENDED + " Bb4+",
            "two-knights-check-block",
        ),
        decision(
            "two-knights-check-block",
            "Block with a useful pawn",
            "Block the check with a pawn move that also prepares a later d4.",
            DEFENDED + " Bb4+",
            "c3",
            "Ba5",
            "two-knights-check-castle",
            "c3 blocks the check and supports a later d4. Black keeps the bishop on the same diagonal with ...Ba5.",
            "Move c2 to c3.",
        ),
        decision(
            "two-knights-check-castle",
            "Castle",
            "Put your king away, as in your usual setup.",
            DEFENDED + " Bb4+ c3 Ba5",
            "O-O",
            None,
            "two-knights-check-summary",
            "Your king is safe, and your pawns stand on c3, d3 and e4 as usual.",
            "Move your king from e1 to g1 to castle.",
        ),
        step(
            "explanation",
            "two-knights-check-summary",
            "The usual setup",
            "Later, a4 and b4 gain space against the a5-bishop. If Black's bishop had gone back to c5 or e7 instead of a5, you would castle all the same.",
            CHECK,
        ),
    ]


def chapter(excerpt, games):
    pollock = games["pollock-schiffers"]
    return [
        step(
            "explanation",
            "two-knights-welcome",
            "The Two Knights Defense",
            "We return to move 3. Instead of ...Bc5, Black develops the other knight to f6, where it attacks your e4-pawn. This is the Two Knights Defense. Defend the pawn first, then answer Black's fourth move.",
            TWO_KNIGHTS,
            next_step="two-knights-defend",
        ),
        decision(
            "two-knights-defend",
            "Defend e4",
            "Support the attacked e-pawn while opening a path for your c1-bishop.",
            TWO_KNIGHTS,
            "d3",
            None,
            "two-knights-h6-choice",
            "d3 defends e4. If Black now plays ...Bc5, castle: you are back in the first chapter's quiet setup. Against ...Be7, castle too.",
            "Move the d-pawn one square, from d2 to d3.",
        ),
        step(
            "branch",
            "two-knights-h6-choice",
            "If Black plays ...h6",
            "This chapter's main line is ...d5; side trips show ...h6, ...d6 and ...Bb4+ first. Explore ...h6, or continue to the next reply.",
            DEFENDED,
            branch_start="two-knights-h6",
            next_step="two-knights-d6-choice",
        ),
        *h6_trip(),
        step(
            "branch",
            "two-knights-d6-choice",
            "If Black plays ...d6",
            "Explore ...d6, which leaves f7 weak for a moment, or continue to the next reply.",
            DEFENDED,
            branch_start="two-knights-d6",
            next_step="two-knights-check-choice",
        ),
        *d6_trip(),
        step(
            "branch",
            "two-knights-check-choice",
            "If Black gives check",
            "Explore ...Bb4+, or continue to the main line.",
            DEFENDED,
            branch_start="two-knights-check",
            next_step="two-knights-strike",
        ),
        *check_trip(),
        demo(
            "two-knights-strike",
            "Black strikes in the center",
            "...d5 attacks your bishop on c4 and your e4-pawn at the same time.",
            DEFENDED,
            STRIKE,
            "two-knights-take",
        ),
        decision(
            "two-knights-take",
            "Remove the attacker",
            "Deal with the d5-pawn. If you only move the bishop away, Black takes your e4-pawn.",
            STRIKE,
            "exd5",
            "Nxd5",
            "two-knights-castle",
            "exd5 removes the pawn that attacked both. Black recaptures with the f6-knight, which now stands in the center.",
            "Capture on d5 with your e4-pawn.",
        ),
        decision(
            "two-knights-castle",
            "Castle before the center opens",
            "The center is opening. Put your king away before Black's pieces can use the open lines.",
            TRADE,
            "O-O",
            "Be6",
            "two-knights-rook",
            "Black develops the bishop to e6, where it defends the d5-knight.",
            "Move your king from e1 to g1 to castle.",
        ),
        decision(
            "two-knights-rook",
            "Bring a rook to the e-file",
            "Bring your f1-rook to the e-file. With your e-pawn gone, it can attack e5 directly.",
            TRADE + " O-O Be6",
            "Re1",
            "Bd6",
            "two-knights-summary",
            "Re1 attacks e5 together with your f3-knight, and only the c6-knight defends it. Black adds a second defender with ...Bd6.",
            "Move the rook from f1 to e1.",
        ),
        step(
            "explanation",
            "two-knights-summary",
            "Open the center",
            "Black's king is still on e8. Next, d4 opens the center while it stands there; it is also strong if Black defended e5 with ...f6 instead of ...Bd6. If Black developed with ...Bg4 or ...Bc5 instead of ...Be6, Re1 was still the move.",
            SETTLED,
            next_step="two-knights-game",
        ),
        excerpt(
            "two-knights-game",
            "A sharper choice changes the game",
            "Pollock–Schiffers, Hastings 1895. Pollock chooses d4 and Ng5 instead of our d3. The exchanges that follow show why this is a separate choice, not a continuation of our setup to memorize.",
            "pollock-schiffers",
            5,
            20,
            "two-knights-takeaway",
        ),
        dict(
            kind="explanation",
            id="two-knights-takeaway",
            title="A move order is not a whole repertoire",
            text="The historical game has opposite-side castling and very different pawn and piece placement. Return to your plan: against ...Nf6, defend e4 with d3 first, then answer Black's fourth move as this chapter showed.",
            position=pollock.position.after(pollock.moves[:20]),
            next_step="two-knights-recall",
        ),
        step(
            "rehearsal",
            "two-knights-recall",
            "Play against the Two Knights",
            "Rehearse the main line: defend e4, take on d5, castle and bring the rook to e1.",
            TWO_KNIGHTS,
            line_id="two-knights-center",
        ),
    ]
