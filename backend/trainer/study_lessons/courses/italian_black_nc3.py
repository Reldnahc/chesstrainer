"""Against 7.Nc3, take the e4-pawn and meet White's gambit play."""

from trainer.study_lessons.courses.authoring import decision, demo, position, step
from trainer.study_lessons.courses.italian_black_positions import CHECK

BLOCK = CHECK + " Nc3"
TAKEN = BLOCK + " Nxe4"
GAMBIT = TAKEN + " O-O Bxc3"
LINE = GAMBIT + " bxc3 d5 Bb5 O-O"
QUEEN = TAKEN + " Qe2 d5 Bb5 O-O"
MOLLER = GAMBIT + " d5 Bf6 dxc6 bxc6"


def lines():
    anchor = position(CHECK)
    return [
        dict(
            id=identity,
            title=title,
            position=anchor,
            moves=position(san).moves[len(anchor.moves) :],
            repertoire=True,
            eco="C54",
        )
        for identity, title, san in (
            ("black-knight-block", "Black Italian · take the pawn against 7.Nc3", LINE),
            ("black-knight-block-queen", "Black Italian · meet 8.Qe2 after 7.Nc3 Nxe4", QUEEN),
            ("black-moller-attack", "Black Italian · meet the Møller Attack", MOLLER),
        )
    ]


def queen_trip():
    return [
        demo(
            "block-queen",
            "White pins your knight",
            "Qe2 attacks your e4-knight and pins it to your king.",
            TAKEN,
            TAKEN + " Qe2",
            "block-queen-defend",
        ),
        decision(
            "block-queen-defend",
            "Support the knight",
            "Defend the e4-knight with a pawn that also attacks the c4-bishop.",
            TAKEN + " Qe2",
            "d5",
            "Bb5",
            "block-queen-castle",
            "d5 defends the knight and attacks the bishop. White moves it to b5, where it pins your c6-knight too.",
            "Move d7 to d5.",
        ),
        decision(
            "block-queen-castle",
            "Castle out of both pins",
            "Castle: your king leaves the e-file and the b5-bishop's diagonal.",
            TAKEN + " Qe2 d5 Bb5",
            "O-O",
            None,
            "block-queen-summary",
            "Neither of your knights is pinned any more, and you are a pawn ahead.",
            "Move e8 to g8.",
        ),
        step(
            "explanation",
            "block-queen-summary",
            "White's king is still in the center",
            "Your king is safe, while White's c3-knight is still pinned and attacked twice. Against Bb3 instead of Bb5, castle too. If White takes on d5 with the bishop, recapture with your queen. If White castles instead, first take the c3-knight with your bishop.",
            QUEEN,
        ),
    ]


def moller_trip():
    return [
        demo(
            "block-moller",
            "The Møller Attack",
            "White leaves your bishop on c3 and pushes d5, attacking your c6-knight.",
            GAMBIT,
            GAMBIT + " d5",
            "block-moller-bishop",
        ),
        decision(
            "block-moller-bishop",
            "Bring the bishop back",
            "White can still take your c3-bishop. Retreat it to f6, near your king.",
            GAMBIT + " d5",
            "Bf6",
            "dxc6",
            "block-moller-recapture",
            "Bf6 saves the bishop. White takes your c6-knight with the pawn.",
            "Move the bishop from c3 to f6.",
        ),
        decision(
            "block-moller-recapture",
            "Take back",
            "Recapture the pawn on c6.",
            GAMBIT + " d5 Bf6 dxc6",
            "bxc6",
            None,
            "block-moller-summary",
            "bxc6 leaves you two pawns ahead.",
            "Capture on c6 with the b7-pawn.",
        ),
        step(
            "explanation",
            "block-moller-summary",
            "Two pawns ahead",
            "White has quick development for the pawns, so castle soon. Earlier, if White had played Re1 instead of dxc6, move your c6-knight to e7; after Rxe4, castle.",
            MOLLER,
        ),
    ]


def chapter():
    return [
        step(
            "explanation",
            "block-welcome",
            "White blocks the check with a knight",
            "We return to the bishop check from the previous chapter. Instead of Bd2, White can block with Nc3 and offer the e4-pawn. Taking it is the only good answer, and it leads to sharp, well-known lines.",
            CHECK,
            next_step="block-arrival",
        ),
        demo(
            "block-arrival",
            "The knight blocks the check",
            "Nc3 blocks the check and develops, but your b4-bishop pins the knight to White's king.",
            CHECK,
            BLOCK,
            "block-take",
        ),
        decision(
            "block-take",
            "Take the e4-pawn",
            "The pinned c3-knight cannot recapture on e4. Take the pawn with your knight.",
            BLOCK,
            "Nxe4",
            None,
            "block-queen-choice",
            "Nxe4 wins a pawn and attacks the pinned c3-knight a second time. Castling or Bxc3+ instead gives White the better game.",
            "Capture on e4 with the knight from f6.",
        ),
        step(
            "branch",
            "block-queen-choice",
            "If White pins your knight with Qe2",
            "In this chapter's main line, White castles and gives up more material. A side trip shows Qe2 first. Explore Qe2, or continue to the main line.",
            TAKEN,
            branch_start="block-queen",
            next_step="block-castle",
        ),
        *queen_trip(),
        demo(
            "block-castle",
            "White castles and offers more",
            "White castles, so the c3-knight is no longer pinned. This is a gambit: White gives up material to open lines while your king is still in the center.",
            TAKEN,
            TAKEN + " O-O",
            "block-trade",
        ),
        decision(
            "block-trade",
            "Take the knight",
            "Capture the c3-knight with your bishop. Castling first would let it jump to d5 and attack your bishop.",
            TAKEN + " O-O",
            "Bxc3",
            None,
            "block-moller-choice",
            "Bxc3 removes the knight before it can join the attack.",
            "Capture on c3 with the bishop from b4.",
        ),
        step(
            "branch",
            "block-moller-choice",
            "If White pushes d5",
            "The main line recaptures with bxc3. A side trip shows d5, the Møller Attack. Explore d5, or continue to the main line.",
            GAMBIT,
            branch_start="block-moller",
            next_step="block-recapture",
        ),
        *moller_trip(),
        demo(
            "block-recapture",
            "White recaptures",
            "White takes back with the b-pawn. Next White wants Re1, pinning your e4-knight to your king.",
            GAMBIT,
            GAMBIT + " bxc3",
            "block-center",
        ),
        decision(
            "block-center",
            "Support the knight",
            "Push your d-pawn two squares: it defends the e4-knight and attacks the c4-bishop.",
            GAMBIT + " bxc3",
            "d5",
            "Bb5",
            "block-king",
            "d5 defends e4 and attacks the bishop. White moves it to b5, pinning your c6-knight.",
            "Move d7 to d5.",
        ),
        decision(
            "block-king",
            "Castle",
            "Get your king out of the pin and off the e-file before White's rook arrives.",
            GAMBIT + " bxc3 d5 Bb5",
            "O-O",
            None,
            "block-summary",
            "Your king is safe and neither knight is pinned. You are a pawn ahead.",
            "Move e8 to g8.",
        ),
        step(
            "explanation",
            "block-summary",
            "A pawn ahead",
            "White has two bishops and open lines for the pawn, so keep your pieces active: develop the c8-bishop next. Against Bb3, Bd3 or Re1 instead of Bb5, castling is also good. Against Ba3, which stops you castling, take the c4-bishop with dxc4.",
            LINE,
            next_step="block-recall",
        ),
        step(
            "rehearsal",
            "block-recall",
            "Meet Nc3",
            "Play the line against Nc3 from the bishop check.",
            CHECK,
            line_id="black-knight-block",
        ),
    ]
