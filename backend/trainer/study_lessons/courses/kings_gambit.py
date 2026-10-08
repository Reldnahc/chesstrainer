"""A bounded White repertoire: activity is a goal, not guaranteed compensation."""

from trainer.study_lessons.content import CourseDefinition, GameAnnotation
from trainer.study_lessons.courses.authoring import decision, demo, position, step
from trainer.study_lessons.courses.kings_gambit_falkbeer import chapter as falkbeer_chapter
from trainer.study_lessons.courses.kings_gambit_falkbeer import recall_lines as falkbeer_lines
from trainer.study_lessons.courses.kings_gambit_games import source_games
from trainer.study_lessons.courses.kings_gambit_others import chapter as others_chapter
from trainer.study_lessons.courses.kings_gambit_others import lines as others_lines

GAMBIT = "e4 e5 f4"
ACCEPTED = GAMBIT + " exf4 Nf3"
QUEEN = ACCEPTED + " d5 exd5 Qxd5"
QUEEN_LINE = QUEEN + " Nc3 Qe6+ Be2 Nf6 O-O"
MODERN_CENTER = ACCEPTED + " d5 exd5 Nf6 Bb5+ c6 dxc6 Nxc6 d4 Bd6"
MODERN_DEVELOPMENT = MODERN_CENTER + " O-O O-O Nbd2"
MODERN = MODERN_DEVELOPMENT + " Bg4 c3"
CHAIN_CENTER = ACCEPTED + " g5 h4 g4 Ne5 Nf6 Bc4 d5 exd5 Bd6"
CHAIN = CHAIN_CENTER + " d4 Nh5 O-O"
DECLINED_SETUP = GAMBIT + " Bc5 Nf3 d6 c3 Nf6"
DECLINED = DECLINED_SETUP + " d4 exd4 cxd4 Bb6 Nc3"


def course():
    notes = {
        "rosanes-anderssen": (
            (
                15,
                "d4 supports Ne5 against the bishop on d6. White has developed Bc4 before supporting the knight: the same move order as our lesson.",
            ),
            (
                18,
                "Rosanes checks with Bb5+ and Black blocks with c6. The check has let Black attack the bishop while opening lines. Our repertoire follows a different ninth move.",
            ),
            (
                26,
                "White has taken the a8-rook, but Ng3 attacks the h1-rook next. White's king is still on e1 and the queen, c1-bishop and b1-knight have not developed. Counting the extra rook does not count the threats.",
            ),
            (
                34,
                "Black's rook occupies the open e-file and the queen has joined on b6. White's king has been driven to f2: Black's active pieces are attacking the king, not trying to recover the a8-rook.",
            ),
            (
                46,
                "Re1 uncovers the d4-bishop's check and pins White's queen on f1, so the queen cannot block it. The g3-knight covers h1. This is checkmate: White's extra material never gave the king a safe home.",
            ),
        ),
        "morphy-bornemann": (
            (
                7,
                "Morphy prepares d4 with c3, as we do. Black next chooses Bg4 rather than our studied Nf6.",
            ),
            (
                14,
                "Black has traded the c8-bishop for the f3-knight. White's queen is on f3. White's f-pawn and Black's original e-pawn have been exchanged; Black's d-pawn now occupies e5.",
            ),
            (
                21,
                "Morphy castles queenside. This game has its own plan; it is not a continuation to memorize with our line.",
            ),
            (
                35,
                "Only now does the prepared c-pawn recapture on d4. Preparing a central break does not require playing it immediately.",
            ),
            (
                61,
                "The score ends after cxd7+ with Black resigning. The checking pawn is on d7; no extra continuation has been added.",
            ),
        ),
    }
    games = {
        game.id: game.model_copy(
            update={
                "annotations": tuple(
                    GameAnnotation(ply=ply, text=text) for ply, text in notes[game.id]
                )
            }
        )
        for game in source_games()
    }

    def excerpt(identity, title, text, game_id, start, end, next_step):
        game = games[game_id]
        return dict(
            kind="game_excerpt",
            id=identity,
            title=title,
            text=text,
            position=game.position.after(game.moves[:start]),
            game_id=game_id,
            from_ply=start,
            to_ply=end,
            next_step=next_step,
        )

    accepted_steps = [
        step(
            "explanation",
            "accepted-welcome",
            "Offer a pawn, keep a plan",
            "The King's Gambit offers the f-pawn to draw Black's e-pawn away from the center. White wants development and central space; Black can counterattack before White castles. We will study the Modern Defense, the g5 pawn chain, Black's other common replies, and two refusals: Bc5 and the Falkbeer countergambit. These are the common responses, not every possible defense.",
            next_step="offer-pawn",
        ),
        demo(
            "offer-pawn",
            "Reach the gambit",
            "Both sides occupy the center. Now make the pawn offer that defines this opening.",
            "",
            "e4 e5",
            "play-gambit",
        ),
        decision(
            "play-gambit",
            "Offer the f-pawn",
            "Play the King's Gambit pawn offer, f4.",
            "e4 e5",
            "f4",
            "exf4",
            "develop-knight",
            "Black accepts. Your f-pawn is gone, and Black has an extra pawn on f4. Develop while watching your king.",
            "Move f2 to f4.",
        ),
        decision(
            "develop-knight",
            "Cover h4 and develop",
            "Develop the g1-knight to f3. It controls h4, where Black's queen could otherwise arrive with check.",
            GAMBIT + " exf4",
            "Nf3",
            "d5",
            "answer-central-break",
            "Nf3 covers h4. Black answers in the center with d5, attacking your e4-pawn: the Modern Defense.",
            "Move the knight from g1 to f3.",
        ),
        decision(
            "answer-central-break",
            "Answer the central break",
            "Capture on d5. Black's pawn is attacking e4, and taking it keeps a white pawn in the center while opening the e-file.",
            ACCEPTED + " d5",
            "exd5",
            None,
            "central-queen-choice",
            "Material is equal again. Black can take back with the queen or develop the g8-knight with an attack on d5.",
            "Move the pawn from e4 to d5.",
        ),
        step(
            "branch",
            "central-queen-choice",
            "If the queen takes back",
            "Black's queen usually takes back on d5. Explore that side trip, or continue for Nf6, this chapter's main line.",
            ACCEPTED + " d5 exd5",
            branch_start="modern-queen",
            next_step="modern-knight",
        ),
        demo(
            "modern-queen",
            "The queen takes back",
            "Black's queen recaptures on d5, so Black is a pawn up again. But a queen in the middle of the board can be attacked by your developing pieces.",
            ACCEPTED + " d5 exd5",
            QUEEN,
            "modern-queen-knight",
        ),
        decision(
            "modern-queen-knight",
            "Develop with an attack",
            "Develop the b1-knight to c3, attacking Black's queen.",
            QUEEN,
            "Nc3",
            "Qe6+",
            "modern-queen-block",
            "The queen moves again and checks along the e-file. Block the check with a piece that needs to develop anyway.",
            "Move the knight from b1 to c3.",
        ),
        decision(
            "modern-queen-block",
            "Block with development",
            "Block the check with the f1-bishop on e2.",
            QUEEN + " Nc3 Qe6+",
            "Be2",
            "Nf6",
            "modern-queen-castle",
            "Black develops Nf6. Your bishop has cleared f1, so the king can leave the center.",
            "Move the bishop from f1 to e2.",
        ),
        decision(
            "modern-queen-castle",
            "Castle",
            "Castle before the center opens further.",
            QUEEN + " Nc3 Qe6+ Be2 Nf6",
            "O-O",
            None,
            "modern-queen-summary",
            "Your king is safe and three of your pieces are developed, while Black's queen has moved twice.",
            "Move the king from e1 to g1.",
        ),
        step(
            "explanation",
            "modern-queen-summary",
            "Development for a pawn",
            "Black is a pawn up, but you are ahead in development: that is what you get in return for the pawn. Next, d4 opens the c1-bishop's path toward the f4-pawn. If the queen had retreated to d8 or a5 instead of checking, you would play d4 at once.",
            QUEEN_LINE,
        ),
        demo(
            "modern-knight",
            "Black develops instead",
            "In this chapter's main line Black develops Nf6, attacking d5. Instead of defending the pawn passively, we can develop with check.",
            ACCEPTED + " d5 exd5",
            ACCEPTED + " d5 exd5 Nf6",
            "develop-bishop",
        ),
        decision(
            "develop-bishop",
            "Develop with check",
            "Bring the f1-bishop to b5. The check makes Black answer a threat while clearing the way to castle.",
            ACCEPTED + " d5 exd5 Nf6",
            "Bb5+",
            "c6",
            "answer-counterattack",
            "Black blocks the check with c6 and attacks the bishop. Your d5-pawn can remove that attacker.",
            "Move the bishop from f1 to b5.",
        ),
        decision(
            "answer-counterattack",
            "Remove the attacking pawn",
            "Capture c6 with the d5-pawn. This answers the attack on your bishop and makes Black spend a move recapturing.",
            ACCEPTED + " d5 exd5 Nf6 Bb5+ c6",
            "dxc6",
            "Nxc6",
            "claim-center",
            "Black recaptures with the b8-knight. Both sides have six pawns; Black has developed both knights while your bishop has developed with tempo.",
            "Move the pawn from d5 to c6.",
        ),
        decision(
            "claim-center",
            "Give the pieces a center",
            "Play d4 to control e5 and c5 and open your c1-bishop's diagonal. The pawn on d4 will need support as Black develops.",
            ACCEPTED + " d5 exd5 Nf6 Bb5+ c6 dxc6 Nxc6",
            "d4",
            "Bd6",
            "accepted-castle",
            "Black develops Bd6, defending the f4-pawn. Castle before beginning an attack of your own.",
            "Move d2 to d4.",
        ),
        decision(
            "accepted-castle",
            "Put the king away",
            "Castle before opening more lines in the center. Your bishop has cleared f1, and moving the king also brings a rook into the game.",
            MODERN_CENTER,
            "O-O",
            "O-O",
            "finish-development",
            "Both kings have castled. Your remaining knight can develop without occupying c3, leaving that square available to the c-pawn.",
            "Move the king from e1 to g1.",
        ),
        decision(
            "finish-development",
            "Leave room to support d4",
            "Develop the b1-knight to d2. It reinforces f3 and leaves c3 free for a pawn that can support d4.",
            MODERN_CENTER + " O-O O-O",
            "Nbd2",
            "Bg4",
            "support-d4",
            "Nbd2 completes the knights' development. Black develops Bg4, pinning Nf3 against your queen. Carry out the support plan while keeping that pin in mind.",
            "Move the knight from b1 to d2.",
        ),
        decision(
            "support-d4",
            "Use the square you kept free",
            "Use the c-pawn to support d4. You deliberately left c3 free when developing Nb1; now put that plan into practice.",
            MODERN_DEVELOPMENT + " Bg4",
            "c3",
            None,
            "accepted-summary",
            "c3 supports d4. Bg4 still pins Nf3 against your queen, and Nd2 still blocks Bc1: supporting the center does not finish development or remove Black's threats.",
            "Move c2 to c3.",
        ),
        step(
            "explanation",
            "accepted-summary",
            "Use the center without rushing",
            "Material is equal and c3 now supports d4. Your queen and c1-bishop still need useful squares. Nd2 blocks that bishop; moving the knight to c4 could clear the diagonal and challenge Bd6, which defends f4. Black's Bg4 pin is already on the board, so moving Nf3 without checking the queen behind it would be careless.",
            MODERN,
            next_step="accepted-rehearsal",
        ),
        step(
            "rehearsal",
            "accepted-rehearsal",
            "Play against the central defense",
            "Play the chosen Modern Defense line without the step-by-step prompts.",
            line_id="modern-development",
        ),
    ]
    chain_steps = [
        step(
            "explanation",
            "chain-welcome",
            "When Black holds the pawn",
            "Black can hold f4 with g5. We challenge that support with h4 and move the attacked knight to e5 after g4. Then the lesson changes: Black strikes in the center, and White must defend that knight before castling.",
            next_step="chain-arrival",
        ),
        demo(
            "chain-arrival",
            "Reach the pawn chain",
            "Black's g5-pawn supports f4 and can advance to attack Nf3.",
            "",
            ACCEPTED + " g5",
            "challenge-chain",
        ),
        decision(
            "challenge-chain",
            "Challenge the support",
            "Play h4 to attack the pawn supporting f4.",
            ACCEPTED + " g5",
            "h4",
            "g4",
            "escape-knight",
            "h4 attacks g5, but Black pushes g4 instead. That pawn now attacks your knight on f3.",
            "Move h2 to h4.",
        ),
        decision(
            "escape-knight",
            "Move the attacked knight",
            "Move the knight to e5. This course uses the Kieseritzky setup; we are not playing Ng5, the Allgaier Gambit, where the knight is given up on f7.",
            ACCEPTED + " g5 h4 g4",
            "Ne5",
            "Nf6",
            "chain-bishop",
            "Ne5 escapes the pawn. Nf6 attacks e4; our reply develops the bishop before deciding how to handle the center.",
            "Move the knight from f3 to e5.",
        ),
        decision(
            "chain-bishop",
            "Develop before the center opens",
            "Develop Bc4, aiming at f7 and clearing f1. Your e5-knight is advanced, so keep checking whether Black can attack it.",
            ACCEPTED + " g5 h4 g4 Ne5 Nf6",
            "Bc4",
            "d5",
            "chain-center",
            "Black strikes with d5, attacking your bishop and the e4-pawn. Capturing with the e-pawn will answer both attacks.",
            "Move the bishop from f1 to c4.",
        ),
        decision(
            "chain-center",
            "Answer the central attack",
            "Capture d5 with your e-pawn. You remove the pawn attacking Bc4 and keep the bishop developed.",
            ACCEPTED + " g5 h4 g4 Ne5 Nf6 Bc4 d5",
            "exd5",
            "Bd6",
            "chain-castling-choice",
            "Bd6 attacks your knight on e5. The kingside is clear, but castling does not answer that attack.",
            "Move the pawn from e4 to d5.",
        ),
        step(
            "branch",
            "chain-castling-choice",
            "A clear path is not enough",
            "Before castling, deal with the bishop attacking Ne5. Continue to defend it; explore the short comparison to see what goes wrong when White castles immediately.",
            CHAIN_CENTER,
            branch_start="premature-castle",
            next_step="support-knight",
        ),
        demo(
            "premature-castle",
            "Castling leaves the knight behind",
            "In this comparison, White castles and Black takes the undefended knight. Re1 pins the bishop to Black's king, but Qe7 defends the bishop and shields the king. Watch how the late d4 is then met by Bxd4+.",
            CHAIN_CENTER,
            CHAIN_CENTER + " O-O Bxe5 Re1 Qe7 d4 Bxd4+",
            "premature-summary",
        ),
        step(
            "explanation",
            "premature-summary",
            "Defend first, castle next",
            "Black has won a knight and a pawn in this illustrative continuation. Re1 pinned the bishop, but Qe7 defended it, and Bxd4+ escaped with check. This castling line is called the Rice Gambit. After Re1 Qe7, White usually plays c3 rather than d4, and Black is still better. Return to the decision: d4 immediately protects Ne5 and avoids giving it away.",
            CHAIN_CENTER + " O-O Bxe5 Re1 Qe7 d4 Bxd4+",
        ),
        decision(
            "support-knight",
            "Give Ne5 a defender",
            "Play d4. The pawn supports Ne5, so a bishop capture there could be answered by dxe5. It also opens your c1-bishop's diagonal.",
            CHAIN_CENTER,
            "d4",
            "Nh5",
            "chain-castle",
            "Now Ne5 has support. Black's knight moves to h5, adding protection to f4 and opening the queen's diagonal toward h4.",
            "Move the pawn from d2 to d4.",
        ),
        decision(
            "chain-castle",
            "Castle after meeting the threat",
            "Castle now that Ne5 is defended. The order matters: the same king move a turn earlier would have left the knight hanging.",
            CHAIN.rsplit(" ", 1)[0],
            "O-O",
            None,
            "chain-summary",
            "Your king has left the center and the rook has reached f1. Black still has counterplay: f4 is protected by Nh5, and the h4-pawn is under attack from the queen.",
            "Move the king from e1 to g1.",
        ),
        step(
            "explanation",
            "chain-summary",
            "Activity requires calculation",
            "Material is equal, but your kingside pawns have moved and Black can castle too. Finish developing Nb1 and Bc1 while watching the knight's jump to g3, which attacks Rf1. Taking f4 is not a free pawn. After Bxf4, Black can ignore the bishop and attack your king with Qxh4. After Rxf4, the h5-knight can take your rook.",
            CHAIN,
            next_step="chain-game",
        ),
        excerpt(
            "chain-game",
            "What if White chases material instead?",
            "Rosanes–Anderssen, Breslau 1863. The game reaches our position after Nh5, but White checks with Bb5+ instead of castling. Follow the captures to a8, then look at White's undeveloped pieces and the attack on the other rook. Extra material cannot make the next threat disappear.",
            "rosanes-anderssen",
            16,
            26,
            "chain-rehearsal",
        ),
        step(
            "rehearsal",
            "chain-rehearsal",
            "Rehearse the pawn-chain response",
            "Challenge g5, develop Bc4 and meet the central break. Remember why d4 must come before castling in this line.",
            line_id="challenge-pawn-chain",
        ),
    ]
    declined_steps = [
        step(
            "explanation",
            "declined-welcome",
            "Black can refuse the offer",
            "You cannot force Black to accept a gambit. Against Bc5, cover the queen-check square and prepare a central break. This chapter follows the bishop-first refusal; the Falkbeer countergambit has its own chapter because it creates a different center.",
            next_step="declined-arrival",
        ),
        demo(
            "declined-arrival",
            "The bishop-first refusal",
            "Bc5 develops along the diagonal toward f2 and g1. Since your f-pawn has left f2, the bishop affects your king's safety. First cover h4, where the queen could give check.",
            "",
            GAMBIT + " Bc5",
            "declined-trap-choice",
        ),
        step(
            "branch",
            "declined-trap-choice",
            "Why not take e5?",
            "The e5-pawn looks free, but fxe5 leaves the queen check on h4 unanswered. Continue to develop Nf3, or explore a short example of the queen and bishop attacking together.",
            GAMBIT + " Bc5",
            branch_start="declined-greed",
            next_step="declined-knight",
        ),
        demo(
            "declined-greed",
            "The missing f-pawn exposes the king",
            "White grabs e5 and Black checks on h4. In this example White answers Ke2, allowing Qxe4 mate. Ke2 is one losing reply, not White's only legal move.",
            GAMBIT + " Bc5",
            GAMBIT + " Bc5 fxe5 Qh4+ Ke2 Qxe4#",
            "declined-greed-summary",
        ),
        step(
            "explanation",
            "declined-greed-summary",
            "Develop with the threat in mind",
            "The queen checks along the e-file while the c5-bishop cuts off f2. Blocking the earlier check with g3 avoids this immediate mate, but Qxe4+ would fork king and h1-rook. Return and play Nf3: covering h4 is a concrete reason to develop before taking e5.",
            GAMBIT + " Bc5 fxe5 Qh4+ Ke2 Qxe4#",
        ),
        decision(
            "declined-knight",
            "Develop before taking",
            "Develop Nf3 to control h4 before capturing anything. This blocks the queen-check idea and adds another attack on e5.",
            GAMBIT + " Bc5",
            "Nf3",
            "d6",
            "prepare-d4",
            "Nf3 develops and controls h4. Black supports e5 with d6.",
            "Move the knight from g1 to f3.",
        ),
        decision(
            "prepare-d4",
            "Prepare the central break",
            "Play c3 to support a future pawn on d4.",
            GAMBIT + " Bc5 Nf3 d6",
            "c3",
            "Nf6",
            "declined-break",
            "c3 prepares d4. Black develops a knight, so now use your preparation in this line.",
            "Move c2 to c3.",
        ),
        decision(
            "declined-break",
            "Challenge bishop and center",
            "Advance d4: the pawn attacks the c5-bishop and the e5-pawn.",
            DECLINED_SETUP,
            "d4",
            "exd4",
            "restore-center",
            "Black exchanges on d4. Your c3-pawn is ready to recapture and keep a central pawn there.",
            "Move d2 to d4.",
        ),
        decision(
            "restore-center",
            "Use the prepared recapture",
            "Recapture on d4 with the c-pawn.",
            DECLINED_SETUP + " d4 exd4",
            "cxd4",
            "Bb6",
            "declined-develop",
            "The c-pawn reaches d4 and attacks Bc5; the bishop retreats to b6. Your e4-pawn remains in the center too.",
            "Move the pawn from c3 to d4.",
        ),
        decision(
            "declined-develop",
            "Develop behind your center",
            "Bring the b1-knight to c3. Black's f6-knight attacks e4, and nothing else defends it.",
            DECLINED.rsplit(" ", 1)[0],
            "Nc3",
            None,
            "declined-summary",
            "Nc3 supports e4. Your center has survived the exchange, but the f1-bishop and king still need attention.",
            "Move the knight from b1 to c3.",
        ),
        step(
            "explanation",
            "declined-summary",
            "Develop behind the pawn center",
            "Bd3 is a natural way to develop the last kingside piece and reinforce e4. Before castling, check the b6-bishop's diagonal: your pawn on d4 currently blocks its route to g1. If that pawn moves or is exchanged, reassess king safety instead of castling automatically.",
            DECLINED,
            next_step="declined-game",
        ),
        excerpt(
            "declined-game",
            "The same preparation, different timing",
            "Morphy–Bornemann. Morphy also prepared d4 with c3, but Black chose Bg4. He developed, exchanged in the center and castled queenside before the later d4 break. Explore the full game to follow how that plan unfolded.",
            "morphy-bornemann",
            6,
            21,
            "declined-rehearsal",
        ),
        step(
            "rehearsal",
            "declined-rehearsal",
            "Play against Bc5",
            "Rehearse the chosen c3 and d4 setup against the bishop-first refusal.",
            line_id="declined-center",
        ),
    ]
    return CourseDefinition.model_validate(
        dict(
            id="kings-gambit-foundations",
            revision="2026-10-v5",
            title="King's Gambit · Active play with White",
            description="Meet the Modern Defense, challenge the g5 pawn chain, handle Black's other common replies, build a center against Bc5, and untangle the Falkbeer countergambit. Separate chapters follow the different decisions each defense demands, with side trips for common replies and two contrasting historical games.",
            learner_color="white",
            attributions=[
                dict(
                    text="Original Fieldwork instruction and annotations. Historical game scores are credited separately.",
                    license="Repository license",
                )
            ],
            games=list(games.values()),
            lines=[
                dict(id=identity, title=title, moves=position(san).moves, repertoire=True, eco=eco)
                for identity, title, san, eco in (
                    (
                        "modern-development",
                        "King's Gambit · meet the central defense",
                        MODERN,
                        "C36",
                    ),
                    (
                        "modern-queen",
                        "King's Gambit · Modern Defense, queen takes back (4...Qxd5)",
                        QUEEN_LINE,
                        "C36",
                    ),
                    (
                        "challenge-pawn-chain",
                        "King's Gambit · challenge the g5 pawn chain",
                        CHAIN,
                        "C39",
                    ),
                )
            ]
            + others_lines()
            + [
                dict(
                    id="declined-center",
                    title="King's Gambit Declined · prepare d4",
                    moves=position(DECLINED).moves,
                    repertoire=True,
                    eco="C30",
                )
            ]
            + falkbeer_lines(),
            chapters=[
                dict(id=identity, title=title, entry_step=steps[0]["id"], steps=steps)
                for identity, title, steps in (
                    ("accepted-development", "A pawn for active play", accepted_steps),
                    ("pawn-chain", "Challenge the pawn chain", chain_steps),
                )
            ]
            + [others_chapter()]
            + [
                dict(
                    id="declined-center",
                    title="Build a center against Bc5",
                    entry_step=declined_steps[0]["id"],
                    steps=declined_steps,
                )
            ]
            + [falkbeer_chapter()],
        )
    )
