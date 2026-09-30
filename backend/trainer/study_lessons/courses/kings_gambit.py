"""A bounded White repertoire: activity is a goal, not guaranteed compensation."""

from trainer.study_lessons.content import CourseDefinition, GameAnnotation
from trainer.study_lessons.courses.authoring import decision, demo, position, step
from trainer.study_lessons.courses.kings_gambit_games import source_games

GAMBIT = "e4 e5 f4"
ACCEPTED = GAMBIT + " exf4 Nf3"
MODERN_CENTER = ACCEPTED + " d5 exd5 Nf6 d4 Nxd5"
MODERN = MODERN_CENTER + " Bc4 Nb6 Bb3 Nc6 O-O"
CHAIN = ACCEPTED + " g5 h4 g4 Ne5 Nf6 d4 d6 Nd3 Nxe4 Bxf4 Be7 g3"
DECLINED_SETUP = GAMBIT + " Bc5 Nf3 d6 c3 Nf6"
DECLINED = DECLINED_SETUP + " d4 exd4 cxd4 Bb6 Nc3"
FALKBEER = GAMBIT + " d5 exd5 e4"


def course():
    notes = {
        "anderssen-kipping": (
            (
                9,
                "Ne5 escapes the g4-pawn's attack. This is the same knight move as in our studied line.",
            ),
            (
                12,
                "Here Black chooses h5 and Rh7, unlike the Nf6 defense in our rehearsal. The rook has left h8.",
            ),
            (
                16,
                "White has exchanged a bishop and knight for a rook and pawn on f7. Black's king has moved to f7; these trades are specific to this position.",
            ),
            (
                21,
                "White has removed the pawn from f4 and castled. The rook reaches f1; the bishop on f4 stands between it and Black's king on f7.",
            ),
            (
                47,
                "The published score ends with Rxf6 and a White win. This is resignation, not a played checkmate.",
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
            "The King's Gambit begins with e4, e5 and f4. White offers a pawn to challenge Black's center, but also opens the king's diagonal. Learn concrete replies; activity is not a promise that the pawn sacrifice is fully compensated.",
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
            "Take the pawn on d5 with your e-pawn. This is the continuation taught here, not the only legal response.",
            ACCEPTED + " d5",
            "exd5",
            "Nf6",
            "claim-center",
            "Your pawn reaches d5. Black develops Nf6 and attacks it rather than trying to keep both extra central pawns.",
            "Move the pawn from e4 to d5.",
        ),
        decision(
            "claim-center",
            "Use the center",
            "Advance d4 to open your c1-bishop's diagonal and claim central space.",
            ACCEPTED + " d5 exd5 Nf6",
            "d4",
            "Nxd5",
            "develop-bishop",
            "d4 opens the c1-bishop. Black recovers the d5-pawn; your next moves should bring pieces into play.",
            "Move d2 to d4.",
        ),
        decision(
            "develop-bishop",
            "Develop with a target",
            "Put the f1-bishop on c4, pointing at f7 and clearing f1 for castling.",
            MODERN_CENTER,
            "Bc4",
            "Nb6",
            "save-bishop",
            "Bc4 develops the bishop. Black's knight moves to b6 and attacks it, so respond before castling.",
            "Move the bishop from f1 to c4.",
        ),
        decision(
            "save-bishop",
            "Keep the bishop",
            "Retreat the attacked bishop to b3, keeping its diagonal toward f7.",
            MODERN_CENTER + " Bc4 Nb6",
            "Bb3",
            "Nc6",
            "accepted-castle",
            "The bishop is safe on b3. Black develops Nc6; your kingside path is clear.",
            "Move the bishop from c4 to b3.",
        ),
        decision(
            "accepted-castle",
            "Finish the setup",
            "Castle now. Your rook reaches the f-file, but the black pawn on f4 still blocks it.",
            MODERN_CENTER + " Bc4 Nb6 Bb3 Nc6",
            "O-O",
            None,
            "accepted-summary",
            "Your king is on g1 and rook on f1. Development and king safety came before chasing the extra pawn.",
            "Move the king from e1 to g1.",
        ),
        step(
            "explanation",
            "accepted-summary",
            "Keep counting the cost",
            "You are still a pawn down. The d4-pawn and developed pieces give you things to work with; Black has resources too. Continue development and calculate before launching an attack.",
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
            "Black can defend the extra f4-pawn with g5. Our response challenges that pawn chain with h4. Be ready for g4 to attack the knight; development alone does not make that threat disappear.",
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
            "Move the knight to e5. This course uses the Kieseritzky setup; we are not sacrificing it on g5.",
            ACCEPTED + " g5 h4 g4",
            "Ne5",
            "Nf6",
            "chain-center",
            "Ne5 escapes the pawn. Black develops Nf6 and attacks e4, so the center needs attention too.",
            "Move the knight from f3 to e5.",
        ),
        decision(
            "chain-center",
            "Open the bishop",
            "Play d4 to support the e5-knight and open the c1-bishop toward f4.",
            ACCEPTED + " g5 h4 g4 Ne5 Nf6",
            "d4",
            "d6",
            "retreat-knight",
            "d4 supports Ne5 and opens your bishop. Black plays d6, attacking the knight again.",
            "Move d2 to d4.",
        ),
        decision(
            "retreat-knight",
            "Keep the knight in the game",
            "Bring the attacked knight back to d3, the retreat studied here.",
            ACCEPTED + " g5 h4 g4 Ne5 Nf6 d4 d6",
            "Nd3",
            "Nxe4",
            "remove-wedge",
            "Nd3 preserves the knight. Black takes e4; count that pawn before claiming your gambit has paid off.",
            "Move the knight from e5 to d3.",
        ),
        decision(
            "remove-wedge",
            "Remove the advanced pawn",
            "Use the bishop from c1 to take the pawn on f4.",
            ACCEPTED + " g5 h4 g4 Ne5 Nf6 d4 d6 Nd3 Nxe4",
            "Bxf4",
            "Be7",
            "chain-develop",
            "Bxf4 develops the bishop and removes Black's advanced pawn. You are still a pawn down because Black also captured e4.",
            "Move the c1-bishop along d2 and e3 to f4.",
        ),
        decision(
            "chain-develop",
            "Support h4 and prepare the bishop",
            "Play g3 to defend h4 and open a path for your bishop to g2. Black's e7-bishop is already looking toward h4.",
            CHAIN.rsplit(" ", 1)[0],
            "g3",
            None,
            "chain-game",
            "g3 supports h4 and prepares Bg2. Your f1-bishop still needs development before kingside castling can be possible.",
            "Move the pawn from g2 to g3.",
        ),
        excerpt(
            "chain-game",
            "A historical fork in the road",
            "Anderssen–Kipping, Manchester 1857. After Ne5, Black played h5 instead of Nf6, then moved the rook to h7. Watch the trades on f7 and White's later castle. This different defense permits a different story; its sacrifice is not part of your repertoire.",
            "anderssen-kipping",
            9,
            21,
            "chain-rehearsal",
        ),
        step(
            "rehearsal",
            "chain-rehearsal",
            "Rehearse the pawn-chain response",
            "Play the h4 and Ne5 line against Nf6, keeping track of which pawn attacks which knight.",
            line_id="challenge-pawn-chain",
        ),
    ]
    declined_steps = [
        step(
            "explanation",
            "declined-welcome",
            "Black can refuse the offer",
            "You cannot force Black to accept a gambit. Against Bc5, develop and prepare a central break. The optional branch shows a different refusal: d5 challenges the center immediately.",
            next_step="declined-arrival",
        ),
        demo(
            "declined-arrival",
            "Reach Black's choice",
            "After f4, Black can capture, develop a bishop, or strike at the center.",
            "",
            GAMBIT,
            "declined-choice",
        ),
        step(
            "branch",
            "declined-choice",
            "Development or counterattack",
            "Continue for Bc5. Explore the Falkbeer d5 response if you want to compare the immediate central counterattack, then return to this position.",
            GAMBIT,
            branch_start="falkbeer-arrival",
            next_step="declined-bishop",
        ),
        demo(
            "falkbeer-arrival",
            "Meet the Falkbeer",
            "Black plays d5. White takes on d5, but Black pushes e4 instead of immediately recovering the pawn.",
            GAMBIT,
            FALKBEER,
            "falkbeer-challenge",
        ),
        decision(
            "falkbeer-challenge",
            "Challenge the advanced center",
            "Use d3 to challenge the black pawn on e4.",
            FALKBEER,
            "d3",
            "Nf6",
            "falkbeer-exchange",
            "d3 attacks e4. Black develops Nf6, which can recapture there.",
            "Move d2 to d3.",
        ),
        decision(
            "falkbeer-exchange",
            "Trade the central pawn",
            "Capture e4 with the d-pawn in this demonstration line.",
            FALKBEER + " d3 Nf6",
            "dxe4",
            "Nxe4",
            "falkbeer-summary",
            "The advanced e-pawn is gone, but Black has a knight on e4. This countergambit is about central activity, not defending a pawn on f4.",
            "Move the pawn from d3 to e4.",
        ),
        step(
            "explanation",
            "falkbeer-summary",
            "A different center needs a different plan",
            "Your f-pawn is still on f4, while the e-pawn has reached d5. Black has developed a knight to e4. Return to the branch point for Bc5; this comparison is not added to scheduled recall.",
            FALKBEER + " d3 Nf6 dxe4 Nxe4",
        ),
        demo(
            "declined-bishop",
            "The bishop-first refusal",
            "Bc5 develops while pointing at the g1 square. There is no black pawn on f4 to win back.",
            GAMBIT,
            GAMBIT + " Bc5",
            "declined-knight",
        ),
        decision(
            "declined-knight",
            "Develop before taking",
            "Develop Nf3 rather than automatically capturing e5.",
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
            "Bring the b1-knight to c3, adding another defender to e4.",
            DECLINED.rsplit(" ", 1)[0],
            "Nc3",
            None,
            "declined-game",
            "Nc3 supports e4. Keep developing and check king safety; a large pawn center is something to maintain, not a win by itself.",
            "Move the knight from b1 to c3.",
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
            revision="2026-09-v1",
            title="King's Gambit · Active play with White",
            description="Offer the f-pawn with a plan: meet the central defense, challenge the g5 pawn chain, and build a center when Black declines. Three short lines, guided practice and two historical games.",
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
                        "challenge-pawn-chain",
                        "King's Gambit · challenge the g5 pawn chain",
                        CHAIN,
                        "C39",
                    ),
                    ("declined-center", "King's Gambit Declined · prepare d4", DECLINED, "C30"),
                )
            ],
            chapters=[
                dict(id=identity, title=title, entry_step=steps[0]["id"], steps=steps)
                for identity, title, steps in (
                    ("accepted-development", "A pawn for active play", accepted_steps),
                    ("pawn-chain", "Challenge the pawn chain", chain_steps),
                    ("declined-center", "When Black declines", declined_steps),
                )
            ],
        )
    )
