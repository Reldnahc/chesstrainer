"""Optional side trips branching from the Black Italian lessons."""

from trainer.study_lessons.courses.authoring import decision, demo, step
from trainer.study_lessons.courses.italian_black_positions import (
    ADVANCE,
    EXCHANGED,
    ITALIAN,
    RECAPTURED,
)

CASTLED_FIRST = ITALIAN + " O-O Nf6 d3 d6"
KNIGHT_FIRST = ITALIAN + " Nc3 Nf6 d3 d6"
EARLY_ATTACK = ITALIAN + " Ng5 Qxg5 d4 Qxg2"
EARLY_CENTER = ITALIAN + " d4 Bxd4 Nxd4 Nxd4 c3 Nc6 Qf3 Qf6"
PUSHED = ADVANCE + " exd4 e5 d5 Bb5 Ne4 cxd4 Bb6"
QUEEN_RECAPTURE = EXCHANGED + " Qxd2 Nxe4 Qe3 d5"
QUEEN_CHECK = RECAPTURED + " Qe2+ Be6 O-O O-O"
QUEEN_PRESSURE = RECAPTURED + " Qb3 Nce7 O-O O-O"


def castle_trip():
    return [
        demo(
            "early-castle",
            "White castles first",
            "White puts the king away before choosing a pawn setup. Carry on developing.",
            ITALIAN,
            ITALIAN + " O-O",
            "early-castle-knight",
        ),
        decision(
            "early-castle-knight",
            "Develop with an attack",
            "Develop your kingside knight toward the center, where it attacks e4.",
            ITALIAN + " O-O",
            "Nf6",
            "d3",
            "early-castle-support",
            "Nf6 attacks e4, and White defends it with d3. This is the main line's position, reached in a different order.",
            "Move g8 to f6.",
        ),
        decision(
            "early-castle-support",
            "Keep e5 supported",
            "Support your e-pawn and free the c8-bishop's diagonal, as in the main line.",
            ITALIAN + " O-O Nf6 d3",
            "d6",
            None,
            "early-castle-summary",
            "d6 supports e5, exactly as in the main line.",
            "Move d7 to d6.",
        ),
        step(
            "explanation",
            "early-castle-summary",
            "Back on familiar ground",
            "If White plays c3 next, castle: you are back in the main line. Against Bg5, h3 or Nc3, play h6 first. Against Ng5, either now or instead of d3, castle. Earlier, if White had played Nc3 or Re1 instead of d3, d6 was still the move. Against c3, nothing defended e4: take it with Nxe4, and answer d4 with d5. Against d4, take with the bishop: after Bxd4 Nxd4 Nxd4 you are a pawn ahead.",
            CASTLED_FIRST,
        ),
    ]


def knight_trip():
    return [
        demo(
            "early-knight",
            "White develops the queenside knight",
            "Nc3 develops and defends e4. It also blocks White's c-pawn, so White cannot build a c3 and d4 center.",
            ITALIAN,
            ITALIAN + " Nc3",
            "early-knight-develop",
        ),
        decision(
            "early-knight-develop",
            "Develop the other knight",
            "Develop your kingside knight toward the center.",
            ITALIAN + " Nc3",
            "Nf6",
            "d3",
            "early-knight-support",
            "Nf6 develops and attacks e4. White adds a second defender with d3.",
            "Move g8 to f6.",
        ),
        decision(
            "early-knight-support",
            "Keep e5 supported",
            "Support your e-pawn and free the c8-bishop's diagonal.",
            ITALIAN + " Nc3 Nf6 d3",
            "d6",
            None,
            "early-knight-summary",
            "d6 supports e5. Castling comes next, as in the main line.",
            "Move d7 to d6.",
        ),
        step(
            "explanation",
            "early-knight-summary",
            "Watch for a fork trick",
            "Castle next. If White pins your f6-knight with Bg5, attack the bishop with h6; against Be3, trade bishops with Bxe3. Earlier, if White had castled instead of playing d3, d6 was still the move; against Ng5, castle. If White had grabbed e5 with Nxe5, take the knight: Nxe5. Then d4 forks your bishop and knight, but Nxc4 takes White's bishop first, and after dxc5 you are a piece for a pawn ahead.",
            KNIGHT_FIRST,
        ),
    ]


def attack_trip():
    return [
        demo(
            "early-attack",
            "White attacks f7 at once",
            "Ng5 joins the c4-bishop against f7 and threatens Nxf7, forking your queen and h8-rook. Before you defend, check what protects the knight.",
            ITALIAN,
            ITALIAN + " Ng5",
            "early-attack-take",
        ),
        decision(
            "early-attack-take",
            "Take the undefended knight",
            "Nothing defends the g5-knight. Capture it.",
            ITALIAN + " Ng5",
            "Qxg5",
            "d4",
            "early-attack-punish",
            "Your queen wins a whole knight. White's d4 attacks your c5-bishop and opens the c1-bishop's path to your queen.",
            "Move the queen from d8 to g5.",
        ),
        decision(
            "early-attack-punish",
            "Move the queen with a gain",
            "Your queen is attacked. Move it to a square where it takes a pawn and attacks a rook.",
            ITALIAN + " Ng5 Qxg5 d4",
            "Qxg2",
            None,
            "early-attack-summary",
            "Qxg2 wins a pawn and attacks the h1-rook.",
            "Capture on g2 with the queen.",
        ),
        step(
            "explanation",
            "early-attack-summary",
            "A piece ahead",
            "If White takes your bishop with dxc5, take the rook with check: Qxh1+. If the rook steps to f1 instead, Qxe4+ takes another pawn with check. Earlier, if White had played d3 instead of d4, take on g2 just the same. If White had castled, simply keep your queen safe: you are a knight ahead.",
            EARLY_ATTACK,
        ),
    ]


def center_trip():
    return [
        demo(
            "early-center",
            "White strikes in the center",
            "d4 attacks your c5-bishop. Count the d4-pawn's attackers and defenders: your e5-pawn, bishop and knight against White's knight and queen.",
            ITALIAN,
            ITALIAN + " d4",
            "early-center-take",
        ),
        decision(
            "early-center-take",
            "Take with the bishop",
            "Capture the d4-pawn with the attacked bishop.",
            ITALIAN + " d4",
            "Bxd4",
            "Nxd4",
            "early-center-recapture",
            "Bxd4 takes the pawn. White trades knight for bishop with Nxd4.",
            "Capture on d4 with the bishop from c5.",
        ),
        decision(
            "early-center-recapture",
            "Take back",
            "Recapture the knight on d4.",
            ITALIAN + " d4 Bxd4 Nxd4",
            "Nxd4",
            "c3",
            "early-center-retreat",
            "You are a pawn ahead: the minor pieces are even, and White's d-pawn is gone. White's c3 attacks your knight.",
            "Capture on d4 with the knight from c6.",
        ),
        decision(
            "early-center-retreat",
            "Bring the knight back",
            "Retreat the attacked knight to c6, where it guards e5 again.",
            ITALIAN + " d4 Bxd4 Nxd4 Nxd4 c3",
            "Nc6",
            "Qf3",
            "early-center-guard",
            "Nc6 is safe and defends e5. But White's Qf3 lines up with the c4-bishop against f7 and threatens Qxf7, checkmate.",
            "Move the knight from d4 to c6.",
        ),
        decision(
            "early-center-guard",
            "Stop the mate",
            "Defend f7 with your queen. A queen trade would suit you, since you are a pawn ahead.",
            ITALIAN + " d4 Bxd4 Nxd4 Nxd4 c3 Nc6 Qf3",
            "Qf6",
            None,
            "early-center-summary",
            "Qf6 defends f7. If White trades queens, recapture with the g8-knight, which develops it.",
            "Move the queen from d8 to f6.",
        ),
        step(
            "explanation",
            "early-center-summary",
            "A pawn ahead",
            "Next, develop your g8-knight and castle. If White's queen had gone to d5 instead of f3, it threatens the same mate, and Qf6 defends again. Earlier, if White had attacked f7 with Ng5 instead of taking your bishop, defend with Nh6, and against c3, retreat the bishop to b6. If White had brought the queen to h5 instead of playing c3, Qe7 guards both f7 and e5; against Be3, which attacks your knight, bring it back to c6.",
            EARLY_CENTER,
        ),
    ]


def push_trip():
    return [
        demo(
            "central-push",
            "White pushes e5 instead",
            "Instead of taking back on d4, White pushes e5 and attacks your f6-knight.",
            ADVANCE + " exd4",
            ADVANCE + " exd4 e5",
            "central-push-strike",
        ),
        decision(
            "central-push-strike",
            "Counterattack the bishop",
            "Don't retreat the knight. Push your d-pawn two squares to attack the c4-bishop.",
            ADVANCE + " exd4 e5",
            "d5",
            "Bb5",
            "central-push-knight",
            "d5 attacks the bishop, so if White takes your knight, you can take the bishop. White moves it to b5 instead, where it pins your c6-knight.",
            "Move d7 to d5.",
        ),
        decision(
            "central-push-knight",
            "Jump forward",
            "Your knight is still attacked. Move it forward to a central square your d5-pawn protects.",
            ADVANCE + " exd4 e5 d5 Bb5",
            "Ne4",
            "cxd4",
            "central-push-bishop",
            "On e4 the knight is safe and active. White takes back on d4, attacking your c5-bishop again.",
            "Move the knight from f6 to e4.",
        ),
        decision(
            "central-push-bishop",
            "Keep the bishop",
            "Retreat the bishop one square along its diagonal, where it still eyes d4.",
            ADVANCE + " exd4 e5 d5 Bb5 Ne4 cxd4",
            "Bb6",
            None,
            "central-push-summary",
            "Bb6 keeps the bishop safe and pressing on d4.",
            "Move the bishop from c5 to b6.",
        ),
        step(
            "explanation",
            "central-push-summary",
            "Active pieces",
            "Castle next. If White takes your c6-knight with check first, recapture with the b-pawn. Earlier, if White had taken your knight with exf6 or recaptured with cxd4, take the c4-bishop with dxc4; after exf6 dxc4, answer fxg7 with Rg8. Against exd6, recapture with your queen. If the bishop had gone to b3 or e2 instead of b5, Ne4 was still the move.",
            PUSHED,
        ),
    ]


def queen_trip():
    return [
        demo(
            "central-queen",
            "White recaptures with the queen",
            "Qxd2 takes back the bishop, but unlike Nbxd2 it leaves the e4-pawn without a defender.",
            EXCHANGED,
            EXCHANGED + " Qxd2",
            "central-queen-take",
        ),
        decision(
            "central-queen-take",
            "Take the loose pawn",
            "Capture the undefended e4-pawn with your knight.",
            EXCHANGED + " Qxd2",
            "Nxe4",
            "Qe3",
            "central-queen-unpin",
            "Nxe4 wins a pawn. White's Qe3 attacks the knight and pins it to your king on e8.",
            "Capture on e4 with the knight from f6.",
        ),
        decision(
            "central-queen-unpin",
            "Defend the pinned knight",
            "Your e4-knight cannot move while it shields your king. Support it with a pawn.",
            EXCHANGED + " Qxd2 Nxe4 Qe3",
            "d5",
            None,
            "central-queen-summary",
            "d5 defends the knight and attacks the c4-bishop. You are a pawn ahead.",
            "Move d7 to d5.",
        ),
        step(
            "explanation",
            "central-queen-summary",
            "A pawn ahead",
            "Castle next, which ends the pin. If White first pins your c6-knight with Bb5, break that pin with Bd7, then castle; if White's bishop takes on d5, recapture with the queen. Earlier, if White's queen had gone to f4 or e2 instead of e3, d5 was still the move.",
            QUEEN_RECAPTURE,
        ),
    ]


def check_trip():
    return [
        demo(
            "central-queen-check",
            "White checks on the e-file",
            "Qe2+ uses the open e-file to check your king.",
            RECAPTURED,
            RECAPTURED + " Qe2+",
            "central-queen-check-block",
        ),
        decision(
            "central-queen-check-block",
            "Block with the bishop",
            "Block the check with a piece that develops and also guards your d5-knight.",
            RECAPTURED + " Qe2+",
            "Be6",
            "O-O",
            "central-queen-check-castle",
            "Be6 blocks the check and defends d5. Avoid Qe7: your queen would stop guarding d5, and Bxd5 would win the knight. White castles.",
            "Move the bishop from c8 to e6.",
        ),
        decision(
            "central-queen-check-castle",
            "Castle",
            "Your king is still on the e-file. Castle.",
            RECAPTURED + " Qe2+ Be6 O-O",
            "O-O",
            None,
            "central-queen-check-summary",
            "Both kings are castled and material is level.",
            "Move e8 to g8.",
        ),
        step(
            "explanation",
            "central-queen-check-summary",
            "The same plan",
            "White's d4-pawn is isolated, as in the main line: keep your knight on d5 and aim at d4. Earlier, if White had taken on d5 instead of castling, recapture with the queen, because your e6-bishop is pinned. If White had attacked that bishop with Ng5, take the knight with your queen: nothing defends it. Against Ne5, take the d4-pawn with your c6-knight, which also attacks the queen.",
            QUEEN_CHECK,
        ),
    ]


def pressure_trip():
    return [
        demo(
            "central-queen-b3",
            "White doubles up on d5",
            "Qb3 lines up behind the c4-bishop against your d5-knight and also attacks b7.",
            RECAPTURED,
            RECAPTURED + " Qb3",
            "central-queen-b3-defend",
        ),
        decision(
            "central-queen-b3-defend",
            "Add a defender",
            "Move your c6-knight to a square where it also defends d5.",
            RECAPTURED + " Qb3",
            "Nce7",
            "O-O",
            "central-queen-b3-castle",
            "Nce7 defends d5 a second time, and your c8-bishop still guards b7. White castles.",
            "Move the knight from c6 to e7.",
        ),
        decision(
            "central-queen-b3-castle",
            "Castle",
            "d5 and b7 are covered. Castle.",
            RECAPTURED + " Qb3 Nce7 O-O",
            "O-O",
            None,
            "central-queen-b3-summary",
            "Both kings are castled and material is level.",
            "Move e8 to g8.",
        ),
        step(
            "explanation",
            "central-queen-b3-summary",
            "Hold d5",
            "Keep the knight on d5 and aim at White's isolated d4-pawn, as in the main line. Na5 was the other good answer to Qb3, attacking the queen and bishop: if White checks with Qa4+, Nc6 returns, and the same moves can repeat.",
            QUEEN_PRESSURE,
        ),
    ]
