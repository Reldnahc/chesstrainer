"""Black's other common replies share one plan: develop, take the center, regain f4."""

from trainer.study_lessons.courses.authoring import decision, demo, position, step

GAMBIT = "e4 e5 f4"
ACCEPTED = GAMBIT + " exf4 Nf3"
KNIGHT = ACCEPTED + " Nc6"
CENTER = KNIGHT + " d4"
CALM = CENTER + " d6"
LINE = CALM + " Bxf4 Bg4 Be2"
STRIKE = CENTER + " d5 exd5 Qxd5 Nc3 Qe6+ Be2"
HOLD = GAMBIT + " Nc6 Nf3 d6 Bc4"
FISCHER = ACCEPTED + " d6 Bc4 h6 d4 g5 h4"
SCHALLOPP = ACCEPTED + " Nf6 Nc3 Bb4 e5 Bxc3 dxc3"
CUNNINGHAM = ACCEPTED + " Be7 Bc4 Bh4+ Kf1 d6 d4"


def lines():
    return [
        dict(id=identity, title=title, moves=position(san).moves, repertoire=True, eco=eco)
        for identity, title, san, eco in (
            ("others-center", "King's Gambit · meet 3...Nc6 with d4", LINE, "C34"),
            ("others-hold", "King's Gambit Declined · 2...Nc6 keeps the e-pawn", HOLD, "C30"),
            ("others-fischer", "King's Gambit · Fischer Defense (3...d6)", FISCHER, "C34"),
            ("others-schallopp", "King's Gambit · Schallopp Defense (3...Nf6)", SCHALLOPP, "C34"),
            (
                "others-cunningham",
                "King's Gambit · Cunningham Defense (3...Be7)",
                CUNNINGHAM,
                "C35",
            ),
            ("others-strike", "King's Gambit · 3...Nc6 4.d4 d5", STRIKE, "C34"),
        )
    ]


def hold_trip():
    return [
        demo(
            "others-hold",
            "A knight defends e5",
            "Black develops the b8-knight to c6, where it defends the e5-pawn. Your f4-pawn is still on offer: Black can take it now or later.",
            GAMBIT,
            GAMBIT + " Nc6",
            "others-hold-knight",
        ),
        decision(
            "others-hold-knight",
            "Develop and cover h4",
            "Develop the g1-knight to f3. It attacks e5 and covers h4, where Black's queen could otherwise give check.",
            GAMBIT + " Nc6",
            "Nf3",
            "d6",
            "others-hold-bishop",
            "Black adds a second defender with d6. There is no need to exchange on e5 yet; develop your bishop.",
            "Move the knight from g1 to f3.",
        ),
        decision(
            "others-hold-bishop",
            "Aim at f7",
            "Develop the f1-bishop to c4. It points at f7, which only Black's king defends, and clears the way to castle.",
            GAMBIT + " Nc6 Nf3 d6",
            "Bc4",
            None,
            "others-hold-summary",
            "Your knight and bishop are out and you are ready to castle. Black still has to decide what to do about your f4-pawn.",
            "Move the bishop from f1 to c4.",
        ),
        step(
            "explanation",
            "others-hold-summary",
            "Finish developing",
            "Next, play d3 to open the c1-bishop's path, then castle. If Black takes on f4 after d3, take back with that bishop; if Black takes before you play d3, push d4 instead. Against Bg4, which pins your knight to the queen, play h3, and if the bishop takes on f3, recapture with the queen. Black can also start with d6 and then Nc6, reaching this same position.",
            HOLD,
        ),
    ]


def fischer_trip():
    return [
        demo(
            "others-fischer",
            "The Fischer Defense",
            "d6 covers e5, so your knight will not be able to jump there. Black plans to hold the f4-pawn with g5, as in the pawn-chain chapter, without allowing Ne5.",
            ACCEPTED,
            ACCEPTED + " d6",
            "others-fischer-bishop",
        ),
        decision(
            "others-fischer-bishop",
            "Develop toward f7",
            "Develop the f1-bishop to c4, aiming at f7 and clearing the way to castle.",
            ACCEPTED + " d6",
            "Bc4",
            "h6",
            "others-fischer-center",
            "Black plays h6 to prepare g5: then the h6-pawn will protect the g5-pawn. Use the time to take the center.",
            "Move the bishop from f1 to c4.",
        ),
        decision(
            "others-fischer-center",
            "Take the center",
            "Play d4. Your pawns hold d4 and e4, and the c1-bishop's path toward f4 opens.",
            ACCEPTED + " d6 Bc4 h6",
            "d4",
            "g5",
            "others-fischer-chain",
            "Black protects f4 with g5. As in the pawn-chain chapter, the g5-pawn is the support, so challenge it.",
            "Move d2 to d4.",
        ),
        decision(
            "others-fischer-chain",
            "Challenge the support",
            "Attack the g5-pawn with h4, the pawn-chain chapter's idea.",
            ACCEPTED + " d6 Bc4 h6 d4 g5",
            "h4",
            None,
            "others-fischer-summary",
            "h4 attacks g5, the pawn that protects f4. If Black ignores it, hxg5 hxg5 opens the h-file, and your h1-rook can take the unprotected rook on h8.",
            "Move h2 to h4.",
        ),
        step(
            "explanation",
            "others-fischer-summary",
            "Keep pressing the chain",
            "Black usually answers with Bg7, which protects the h8-rook; then develop with Nc3. If Black attacks your knight with g4 instead, retreat it to g1: it can come back into play through e2. Against f6, develop Nc3. Earlier, if Black answered d4 with Nf6 instead of g5, defend e4 with Qe2 or Nc3; if Black pinned your knight with Bg4 on move 4, take the center with d4 there too.",
            FISCHER,
        ),
    ]


def schallopp_trip():
    return [
        demo(
            "others-schallopp",
            "The knight attacks e4",
            "Nf6 develops and attacks your e4-pawn, which nothing defends yet.",
            ACCEPTED,
            ACCEPTED + " Nf6",
            "others-schallopp-defend",
        ),
        decision(
            "others-schallopp-defend",
            "Defend e4 with development",
            "Develop the b1-knight to c3, where it defends e4.",
            ACCEPTED + " Nf6",
            "Nc3",
            "Bb4",
            "others-schallopp-advance",
            "Black's bishop attacks your c3-knight. If Black takes it, nothing will defend e4, so move the pawn first.",
            "Move the knight from b1 to c3.",
        ),
        decision(
            "others-schallopp-advance",
            "Push with an attack",
            "Advance the e-pawn to e5. Nothing attacks it there, and now it attacks the f6-knight.",
            ACCEPTED + " Nf6 Nc3 Bb4",
            "e5",
            "Bxc3",
            "others-schallopp-recapture",
            "Black takes your knight before moving the attacked one. Choose the recapture that opens a path for your c1-bishop.",
            "Move the pawn from e4 to e5.",
        ),
        decision(
            "others-schallopp-recapture",
            "Open the bishop's path",
            "Recapture with the d-pawn. The c1-bishop's diagonal toward f4 opens, and your queen can use the d-file.",
            ACCEPTED + " Nf6 Nc3 Bb4 e5 Bxc3",
            "dxc3",
            None,
            "others-schallopp-summary",
            "Black is still a pawn up, but your e5-pawn attacks the knight and the c1-bishop can win back f4.",
            "Capture on c3 with the d2-pawn.",
        ),
        step(
            "explanation",
            "others-schallopp-summary",
            "Win back the pawn",
            "Black's best reply is Qe7. It pins your e5-pawn: if that pawn took the knight, Black's queen would check your king along the e-file. Develop with Be2, then take f4 with the bishop. If Black moves the attacked knight instead of taking on c3, play d4 against Ng4 and Be2 against Nh5; against Qe7 there, play Qe2. On move 4, answer Bc5 with e5 too, and d6 with d4.",
            SCHALLOPP,
        ),
    ]


def cunningham_trip():
    return [
        demo(
            "others-cunningham",
            "The bishop heads for h4",
            "Be7 looks quiet, but next the bishop can check from h4, along the diagonal your f-pawn used to block.",
            ACCEPTED,
            ACCEPTED + " Be7",
            "others-cunningham-bishop",
        ),
        decision(
            "others-cunningham-bishop",
            "Develop and make room",
            "Develop the f1-bishop to c4. It aims at f7 and empties f1, a square your king may need.",
            ACCEPTED + " Be7",
            "Bc4",
            "Bh4+",
            "others-cunningham-king",
            "Bh4+ checks your king. Blocking with g3 lets the f4-pawn capture on g3 and open lines toward your king, so step aside instead.",
            "Move the bishop from f1 to c4.",
        ),
        decision(
            "others-cunningham-king",
            "Step the king aside",
            "Move the king to f1. You give up castling, but the king is safe there. Your f3-knight attacks the h4-bishop, and only Black's queen defends it.",
            ACCEPTED + " Be7 Bc4 Bh4+",
            "Kf1",
            "d6",
            "others-cunningham-center",
            "Black plays d6, opening the c8-bishop's path. Now take the center.",
            "Move the king from e1 to f1.",
        ),
        decision(
            "others-cunningham-center",
            "Take the center",
            "Play d4. Your pawns hold the center and the c1-bishop's path to f4 opens.",
            ACCEPTED + " Be7 Bc4 Bh4+ Kf1 d6",
            "d4",
            None,
            "others-cunningham-summary",
            "Your king is safe on f1, and the c1-bishop can win back the f4-pawn next.",
            "Move d2 to d4.",
        ),
        step(
            "explanation",
            "others-cunningham-summary",
            "Bring the king to safety by hand",
            "Without castling, you move the king and rook to safety yourself: develop Nc3, take f4 with the bishop, then play Kf2 and bring the h1-rook to e1. Watch for one trap a move earlier. If Black answers Kf1 with Nf6 instead of d6, take the h4-bishop with your knight: the f6-knight blocks the queen's defense of h4, so Black loses the bishop.",
            CUNNINGHAM,
        ),
    ]


def strike_trip():
    return [
        demo(
            "others-strike",
            "A strike at e4",
            "d5 attacks your e4-pawn, the same kind of central counterattack as the Modern Defense.",
            CENTER,
            CENTER + " d5",
            "others-strike-take",
        ),
        decision(
            "others-strike-take",
            "Take the pawn",
            "Capture on d5 with the e-pawn.",
            CENTER + " d5",
            "exd5",
            "Qxd5",
            "others-strike-knight",
            "Black's queen recaptures on d5. A queen that comes out early can be chased by your developing pieces.",
            "Move the pawn from e4 to d5.",
        ),
        decision(
            "others-strike-knight",
            "Develop with an attack",
            "Develop the b1-knight to c3, attacking the queen.",
            CENTER + " d5 exd5 Qxd5",
            "Nc3",
            "Qe6+",
            "others-strike-block",
            "The queen moves again, this time with check along the e-file. Block it with a piece that needs to develop anyway.",
            "Move the knight from b1 to c3.",
        ),
        decision(
            "others-strike-block",
            "Block with development",
            "Block the check with the f1-bishop on e2.",
            CENTER + " d5 exd5 Qxd5 Nc3 Qe6+",
            "Be2",
            None,
            "others-strike-summary",
            "Be2 blocks the check and gets you ready to castle. Black's queen has moved twice while your pieces developed.",
            "Move the bishop from f1 to e2.",
        ),
        step(
            "explanation",
            "others-strike-summary",
            "Use your lead in development",
            "Castle next, then look to win back the f4-pawn with the c1-bishop. Black's best answer to Nc3 was Bb4, pinning the knight to your king; then develop with Bd3. If the queen goes back to d8 or a5 instead, push d5 to attack the c6-knight.",
            STRIKE,
        ),
    ]


def chapter():
    steps = [
        step(
            "explanation",
            "others-welcome",
            "Black has other replies",
            "The course's other chapters cover four defenses, but club players often choose something else. Black may keep the e5-pawn with Nc6, or take on f4 and then play Nc6, d6, Nf6 or Be7. One plan handles most of them: develop the g1-knight to f3, take the center with d4 when Black allows it, and win the f4-pawn back with the c1-bishop when it is safe.",
            next_step="others-arrival",
        ),
        demo(
            "others-arrival",
            "Start from the gambit",
            "Both sides open with their e-pawns. Offer the f-pawn again; this time, watch for Black's other replies.",
            "",
            "e4 e5",
            "others-gambit",
        ),
        decision(
            "others-gambit",
            "Offer the f-pawn",
            "Play f4, the King's Gambit pawn offer.",
            "e4 e5",
            "f4",
            None,
            "others-hold-choice",
            "The pawn is offered. Black does not have to take it.",
            "Move f2 to f4.",
        ),
        step(
            "branch",
            "others-hold-choice",
            "If Black keeps the e-pawn",
            "Continue to see Black take the pawn. The side trip shows Nc6, a common way to defend e5 instead of capturing.",
            GAMBIT,
            branch_start="others-hold",
            next_step="others-take",
        ),
        *hold_trip(),
        demo(
            "others-take",
            "Black takes the pawn",
            "Black accepts the gambit. Before anything else, cover h4 as in the earlier chapters.",
            GAMBIT,
            GAMBIT + " exf4",
            "others-knight",
        ),
        decision(
            "others-knight",
            "Cover h4 again",
            "Develop the g1-knight to f3, so Black's queen cannot check from h4.",
            GAMBIT + " exf4",
            "Nf3",
            None,
            "others-fischer-choice",
            "Earlier chapters met d5 and g5 here. If Black's bishop comes out to c5 or d6 instead, take the center with d4: the pawn attacks a bishop on c5, and a bishop on d6 blocks Black's own d-pawn.",
            "Move the knight from g1 to f3.",
        ),
        step(
            "branch",
            "others-fischer-choice",
            "If Black plays d6",
            "Black has four other common replies here. This chapter's main line is Nc6; side trips show d6, Nf6 and Be7 first. Explore d6, the Fischer Defense, or continue to the next reply.",
            ACCEPTED,
            branch_start="others-fischer",
            next_step="others-schallopp-choice",
        ),
        *fischer_trip(),
        step(
            "branch",
            "others-schallopp-choice",
            "If Black plays Nf6",
            "Explore Nf6, the Schallopp Defense, which attacks your e4-pawn at once, or continue to the next reply.",
            ACCEPTED,
            branch_start="others-schallopp",
            next_step="others-cunningham-choice",
        ),
        *schallopp_trip(),
        step(
            "branch",
            "others-cunningham-choice",
            "If Black plays Be7",
            "Explore Be7, the Cunningham Defense, which prepares a bishop check on h4, or continue to the main line.",
            ACCEPTED,
            branch_start="others-cunningham",
            next_step="others-main-knight",
        ),
        *cunningham_trip(),
        demo(
            "others-main-knight",
            "Black develops a knight",
            "Nc6 develops toward the center. Unlike d5 or g5, it does not attack e4 or defend the f4-pawn yet.",
            ACCEPTED,
            KNIGHT,
            "others-center",
        ),
        decision(
            "others-center",
            "Take the center",
            "Play d4. Black's e-pawn has left e5, so your pawns can stand side by side on d4 and e4, and the c1-bishop's path to f4 opens.",
            KNIGHT,
            "d4",
            None,
            "others-strike-choice",
            "Black can strike at the center with d5 or defend calmly with d6. Against other moves, answer Nf6 with e5, g5 with d5, and the check Bb4+ by blocking with c3.",
            "Move d2 to d4.",
        ),
        step(
            "branch",
            "others-strike-choice",
            "If Black strikes with d5",
            "Black's most common reply is d5, attacking your e4-pawn. Explore it in a side trip, or continue for the calmer d6.",
            CENTER,
            branch_start="others-strike",
            next_step="others-calm",
        ),
        *strike_trip(),
        demo(
            "others-calm",
            "A calmer reply",
            "d6 opens the c8-bishop's path. Nothing defends the f4-pawn now, so win it back.",
            CENTER,
            CALM,
            "others-recapture",
        ),
        decision(
            "others-recapture",
            "Win back the pawn",
            "Take the f4-pawn with the c1-bishop. Material is level again, and the bishop is developed.",
            CALM,
            "Bxf4",
            "Bg4",
            "others-bishop",
            "Black pins your knight with Bg4: if the knight moved, Black's bishop could take your queen. Against Nf6 instead, continue with Nc3.",
            "Capture on f4 with the c1-bishop.",
        ),
        decision(
            "others-bishop",
            "Unpin and prepare to castle",
            "Develop the f1-bishop to e2. It stands between Black's bishop and your queen, and clears the way to castle.",
            CALM + " Bxf4 Bg4",
            "Be2",
            None,
            "others-summary",
            "Your knight is no longer pinned to the queen, and you can castle next move.",
            "Move the bishop from f1 to e2.",
        ),
        step(
            "explanation",
            "others-summary",
            "A familiar plan",
            "Material is level and your pawns hold the center. Next, castle, develop the b1-knight to d2 and support d4 with c3: the same plan as in the Modern Defense chapter.",
            LINE,
            next_step="others-rehearsal",
        ),
        step(
            "rehearsal",
            "others-rehearsal",
            "Play against Nc6",
            "Rehearse the main line without prompts: cover h4, take the center, win back f4 and unpin with Be2.",
            line_id="others-center",
        ),
    ]
    return dict(
        id="other-replies",
        title="Meet Black's other replies",
        entry_step=steps[0]["id"],
        steps=steps,
    )
