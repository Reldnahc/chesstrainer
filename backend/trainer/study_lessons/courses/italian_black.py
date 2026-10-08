"""A bishop-first Italian repertoire for Black, with original instructional prose."""

from trainer.study_lessons.content import CourseDefinition, GameAnnotation, SourceGame
from trainer.study_lessons.courses.authoring import decision, demo, position, step
from trainer.study_lessons.courses.italian_black_nc3 import chapter as knight_block_chapter
from trainer.study_lessons.courses.italian_black_nc3 import lines as knight_block_lines
from trainer.study_lessons.courses.italian_black_plan import quiet_plan
from trainer.study_lessons.courses.italian_black_positions import (
    ADVANCE,
    CENTER,
    CENTRAL,
    CHECK,
    EVANS,
    EVANS_QUIET,
    EXCHANGED,
    ITALIAN,
    KNIGHT_THREAT,
    QUIET,
    RECAPTURED,
)
from trainer.study_lessons.courses.italian_black_variations import (
    CASTLED_FIRST,
    EARLY_ATTACK,
    EARLY_CENTER,
    KNIGHT_FIRST,
    PUSHED,
    QUEEN_CHECK,
    QUEEN_PRESSURE,
    QUEEN_RECAPTURE,
    attack_trip,
    castle_trip,
    center_trip,
    check_trip,
    knight_trip,
    pressure_trip,
    push_trip,
    queen_trip,
)
from trainer.study_lessons.courses.italian_games import (
    BOOK_URL,
    PUBLIC_DOMAIN_ATTRIBUTION,
    source_games,
)

KNIGHT_ATTACK = KNIGHT_THREAT + " Ng5 O-O"
EVANS_FLANK = EVANS + " b5 axb5 Bxb5 Nf6 a6 Nxe4"

# Factual score from the original 1896 book, p. 115. The lesson does not reuse
# Tarrasch's annotations or treat the whole historical game as a repertoire.
_POLLOCK_LASKER = (
    "e4 e5 Nf3 Nc6 Bc4 Bc5 b4 Bb6 c3 d6 a4 a6 a5 Ba7 b5 axb5 Bxb5 Nf6 "
    "a6 O-O d3 Ne7 axb7 Bxb7 Na3 d5 O-O Ng6 exd5 Nxd5 Qe1 Qf6 Bg5 Qf5 "
    "Nc2 Nxc3 Rxa7 Bxf3 Ne3 Qxg5 Rxa8 Rxa8 Qxc3 Nf4 Ra1 Ne2+"
)


def _games():
    notes = {
        "mason-lasker": (
            (8, "White supports e4 with d3. Black's Nf6 develops a knight and attacks that pawn."),
            (10, "White chooses Nc3; Black's d6 supports e5 and opens the c8-bishop's diagonal."),
            (
                13,
                "After Bxe3 fxe3, White has doubled e-pawns and a semi-open f-file. Both changes matter.",
            ),
            (
                20,
                "Black has castled. The bishop trades in this example were choices, not requirements of the Italian.",
            ),
        ),
        "steinitz-bardeleben": (
            (9, "White pushes d4 before castling. Black must account for the attack on e5 and c5."),
            (
                12,
                "Bb4+ saves the attacked bishop with check; White must answer before carrying on with the center.",
            ),
            (14, "With White's knight on c3, d5 attacks both the e4-pawn and c4-bishop."),
            (
                18,
                "This game used Nc3 rather than our Bd2 reply and bishop exchange. Black developed Be6 here; treat the later play as an example to inspect, not a continuation of your recall line.",
            ),
            (
                49,
                "The recorded game ends at Rxh7+. Von Bardeleben left the room instead of resigning and lost on time. This is check, not the final position of a played checkmate.",
            ),
        ),
    }
    games = [
        game.model_copy(
            update={
                "annotations": tuple(
                    GameAnnotation(ply=ply, text=text) for ply, text in notes[game.id]
                )
            }
        )
        for game in source_games()
        if game.id in notes
    ]
    games.append(
        SourceGame(
            id="pollock-lasker",
            title="Pollock–Lasker · Hastings 1895 · 0–1",
            moves=position(_POLLOCK_LASKER).moves,
            annotations=(
                GameAnnotation(
                    ply=8,
                    text="Black declines b4 with Bb6. Material is still equal; White has gained queenside space.",
                ),
                GameAnnotation(
                    ply=14,
                    text="a6 made a7 available for the bishop after a5. A retreat can preserve a useful piece without accepting a gambit.",
                ),
                GameAnnotation(
                    ply=20,
                    text="White has pushed the a-pawn again. Black has developed Nf6 and castled; this is a contrast with our quieter d3 continuation.",
                ),
                GameAnnotation(
                    ply=26,
                    text="Black now advances d5. The pawn attacks e4 while the bishops and rooks have room to join the game.",
                ),
                GameAnnotation(
                    ply=46,
                    text="Ne2+ checks the king and attacks the queen on c3. White resigned here; no later moves are part of this score.",
                ),
            ),
            attributions=(
                dict(
                    text="Cheshire (ed.), The Hastings Chess Tournament 1895 (1896), p. 115.",
                    url=f"{BOOK_URL}/page/n152/mode/1up",
                    license="Public domain",
                ),
                PUBLIC_DOMAIN_ATTRIBUTION,
            ),
        )
    )
    return {game.id: game for game in games}


def course():
    games = _games()
    plan_chapter, plan_line = quiet_plan(QUIET)

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

    quiet = [
        step(
            "explanation",
            "welcome",
            "The Italian, with Black",
            "Meet e4 with a share of the center, develop your pieces and make your king safe. We use Bc5 against the Italian, then adjust to White's plan. These are selected study moves, not the only good replies.",
            next_step="arrival",
        ),
        demo(
            "arrival",
            "White opens the center",
            "White begins with e4. You play Black throughout this course.",
            "",
            "e4",
            "center",
        ),
        decision(
            "center",
            "Claim your share",
            "Put your e-pawn in the center and open the f8-bishop's diagonal.",
            "e4",
            "e5",
            "Nf3",
            "knight",
            "e5 contests d4 and f4. White develops Nf3 and attacks your pawn.",
            "Move e7 to e5.",
        ),
        decision(
            "knight",
            "Defend while developing",
            "Develop your queenside knight to defend e5.",
            "e4 e5 Nf3",
            "Nc6",
            "Bc4",
            "bishop",
            "Nc6 protects e5. White's Bc4 now points toward f7: this is the Italian.",
            "Move b8 to c6.",
        ),
        decision(
            "bishop",
            "Choose the bishop-first setup",
            "Place your kingside bishop on the diagonal toward f2 and clear part of the castling route.",
            "e4 e5 Nf3 Nc6 Bc4",
            "Bc5",
            None,
            "early-castle-choice",
            "Bc5 clears f8 for castling. Now White chooses a plan.",
            "Move f8 to c5.",
        ),
        step(
            "branch",
            "early-castle-choice",
            "If White castles",
            "White has several common fourth moves. This chapter's main line is d3; side trips show castling, Nc3, Ng5 and d4 first, and later chapters cover c3 and the Evans Gambit, b4. Explore castling, or continue to the next reply.",
            ITALIAN,
            branch_start="early-castle",
            next_step="early-knight-choice",
        ),
        *castle_trip(),
        step(
            "branch",
            "early-knight-choice",
            "If White plays Nc3",
            "Explore Nc3, or continue to the next reply.",
            ITALIAN,
            branch_start="early-knight",
            next_step="early-attack-choice",
        ),
        *knight_trip(),
        step(
            "branch",
            "early-attack-choice",
            "If White plays Ng5",
            "Explore Ng5, an early attack on f7, or continue to the next reply.",
            ITALIAN,
            branch_start="early-attack",
            next_step="early-center-choice",
        ),
        *attack_trip(),
        step(
            "branch",
            "early-center-choice",
            "If White plays d4",
            "Explore d4, which strikes at the center at once, or continue to the main line.",
            ITALIAN,
            branch_start="early-center",
            next_step="white-supports",
        ),
        *center_trip(),
        demo(
            "white-supports",
            "White supports the center",
            "White supports e4 with d3; no central pawns have been exchanged yet.",
            ITALIAN,
            ITALIAN + " d3",
            "develop",
        ),
        decision(
            "develop",
            "Bring out the other knight",
            "Develop your kingside knight toward the center.",
            ITALIAN + " d3",
            "Nf6",
            None,
            "quiet-threat-choice",
            "Nf6 attacks e4, but d3 protects it. This is development, not a free pawn. Your bishop and knight have now cleared the route for castling.",
            "Move g8 to f6.",
        ),
        step(
            "branch",
            "quiet-threat-choice",
            "What if White attacks f7?",
            "White need not castle next. You can inspect Ng5 and a useful defensive purpose of castling, or continue with White's quiet plan.",
            KNIGHT_THREAT,
            branch_start="quiet-knight-threat",
            next_step="quiet-white-castles",
        ),
        demo(
            "quiet-knight-threat",
            "White attacks f7",
            "Ng5 joins the c4-bishop in attacking f7 and threatens Nxf7, forking your queen and h8-rook.",
            KNIGHT_THREAT,
            KNIGHT_THREAT + " Ng5",
            "quiet-threat-castle",
        ),
        decision(
            "quiet-threat-castle",
            "Castle to reinforce f7",
            "Castle: the rook comes from h8 to f8, adding a defender while making the king safer.",
            KNIGHT_THREAT + " Ng5",
            "O-O",
            None,
            "quiet-threat-summary",
            "Your king and the f8-rook now both defend f7.",
            "Castle kingside by moving e8 to g8.",
        ),
        step(
            "explanation",
            "quiet-threat-summary",
            "Check the defenders, not just the threat",
            "The rook on f8 and king on g8 now defend f7. If White captures there with the knight, Rxf7 is available. This is why the bishop-first move order matters: you can castle after developing Nf6. Return to the quiet line when ready.",
            KNIGHT_ATTACK,
            annotations={"squares": ["f7", "f8", "g8"]},
        ),
        demo(
            "quiet-white-castles",
            "White chooses the quiet plan",
            "White castles instead of attacking f7. Now support your center and complete your own king safety.",
            KNIGHT_THREAT,
            KNIGHT_THREAT + " O-O",
            "support",
        ),
        decision(
            "support",
            "Keep e5 supported",
            "Support your e-pawn and free the c8-bishop's diagonal.",
            ITALIAN + " d3 Nf6 O-O",
            "d6",
            "c3",
            "castle",
            "d6 supports e5. White's c3 prepares d4, so watch for the center opening next.",
            "Move d7 to d6.",
        ),
        decision(
            "castle",
            "Make the king safe",
            "Your kingside pieces are out of the way. Castle before choosing a longer plan.",
            ITALIAN + " d3 Nf6 O-O d6 c3",
            "O-O",
            None,
            "quiet-game",
            "The king reaches g8 and the rook f8. Castling is a checkpoint, not the end of your opening plan: the c8-bishop still needs a job.",
            "Move e8 to g8.",
        ),
        excerpt(
            "quiet-game",
            "Lasker develops against a quiet Italian",
            "Mason–Lasker, Hastings 1895. White chooses Nc3 and Be3 instead of our quick castle. Follow Black's development and notice what exchanging on e3 changes. This example is not extra recall material.",
            "mason-lasker",
            6,
            20,
            "quiet-recall",
        ),
        step(
            "rehearsal",
            "quiet-recall",
            "Build your Black setup",
            "Play the line you just learned.",
            line_id="black-quiet-italian",
        ),
    ]
    central = [
        step(
            "explanation",
            "central-welcome",
            "When White opens the center early",
            "c3 alone does not promise an immediate attack: White can still play d3 and reach a quiet setup. This chapter examines d4 before castling instead. Meet the pawn contact, save your attacked bishop with check and look for your own d5 break.",
            next_step="central-arrival",
        ),
        demo(
            "central-arrival",
            "Recognize c3",
            "Return to the bishop-first Italian. White prepares d4 with c3.",
            "",
            ITALIAN + " c3",
            "central-knight",
        ),
        decision(
            "central-knight",
            "Develop against the center",
            "Develop the kingside knight and attack e4.",
            ITALIAN + " c3",
            "Nf6",
            "d4",
            "central-capture",
            "White plays d4, attacking your e5-pawn and c5-bishop. The center now needs a concrete response. If White plays d3 instead, play d6 and castle: that leads back to your quiet setup.",
            "Move g8 to f6.",
        ),
        decision(
            "central-capture",
            "Resolve the pawn contact",
            "Capture the pawn that has advanced to d4.",
            ADVANCE,
            "exd4",
            None,
            "central-push-choice",
            "exd4 removes the pawn that attacked your bishop and e5-pawn.",
            "The e5-pawn can capture on d4.",
        ),
        step(
            "branch",
            "central-push-choice",
            "If White pushes e5",
            "White usually takes back with cxd4. A side trip shows e5 first, which attacks your knight. Explore e5, or continue to the main line.",
            ADVANCE + " exd4",
            branch_start="central-push",
            next_step="central-recaptures",
        ),
        *push_trip(),
        demo(
            "central-recaptures",
            "White takes back",
            "After cxd4, White has pawns on d4 and e4, and your bishop is attacked again by the new pawn on d4.",
            ADVANCE + " exd4",
            CENTER,
            "central-check",
        ),
        decision(
            "central-check",
            "Move the bishop with check",
            "Save the c5-bishop while making White answer a check.",
            CENTER,
            "Bb4+",
            "Bd2",
            "central-trade",
            "Bb4+ moves the bishop out of attack. White blocks the check with Bd2; we will exchange that bishop before breaking in the center. The next chapter covers blocking with Nc3 instead.",
            "Move c5 to b4.",
        ),
        decision(
            "central-trade",
            "Exchange the blocking bishop",
            "Capture the bishop on d2 with check. White can develop a knight while recapturing.",
            CHECK + " Bd2",
            "Bxd2+",
            None,
            "central-queen-choice",
            "Bxd2+ trades your bishop for White's and gives check.",
            "Move the bishop from b4 to d2.",
        ),
        step(
            "branch",
            "central-queen-choice",
            "If White recaptures with the queen",
            "The main line recaptures with the knight. Explore Qxd2, which leaves e4 without a defender, or continue to the main line.",
            EXCHANGED,
            branch_start="central-queen",
            next_step="central-knight-recaptures",
        ),
        *queen_trip(),
        demo(
            "central-knight-recaptures",
            "White recaptures with the knight",
            "After Nbxd2, each side has traded a bishop. Your d-pawn can now challenge White's center.",
            EXCHANGED,
            EXCHANGED + " Nbxd2",
            "central-break",
        ),
        decision(
            "central-break",
            "Challenge both central targets",
            "Advance your d-pawn two squares, attacking e4 and the bishop on c4.",
            EXCHANGED + " Nbxd2",
            "d5",
            "exd5",
            "central-recapture",
            "d5 challenges White's center immediately. White captures; our next move restores the material balance.",
            "Move d7 to d5.",
        )
        | {
            "annotations": {
                "squares": ["e4", "c4"],
                "arrows": [{"from_square": "d7", "to_square": "d5"}],
            }
        },
        decision(
            "central-recapture",
            "Recapture with a piece",
            "Restore the material balance with a knight and occupy the square in front of White's d-pawn.",
            EXCHANGED + " Nbxd2 d5 exd5",
            "Nxd5",
            None,
            "central-queen-check-choice",
            "Nxd5 restores equal material and places a knight in the center.",
            "Move f6 to d5.",
        ),
        step(
            "branch",
            "central-queen-check-choice",
            "If White checks with the queen",
            "White's main line here is castling. Side trips show Qe2+ and Qb3 first. Explore Qe2+, or continue to the next reply.",
            RECAPTURED,
            branch_start="central-queen-check",
            next_step="central-queen-b3-choice",
        ),
        *check_trip(),
        step(
            "branch",
            "central-queen-b3-choice",
            "If White plays Qb3",
            "Explore Qb3, which lines the queen up behind the bishop against d5, or continue to the main line.",
            RECAPTURED,
            branch_start="central-queen-b3",
            next_step="central-white-castles",
        ),
        *pressure_trip(),
        demo(
            "central-white-castles",
            "White castles",
            "White castles. Now attend to your own king.",
            RECAPTURED,
            RECAPTURED + " O-O",
            "central-castle",
        ),
        decision(
            "central-castle",
            "Castle after the exchanges",
            "The kingside route is clear. Castle before deciding where your remaining bishop belongs.",
            RECAPTURED + " O-O",
            "O-O",
            None,
            "central-plan",
            "Both kings are castled and material is level. The exchanges have left a useful structural target to understand before you continue.",
            "Move e8 to g8.",
        ),
        step(
            "explanation",
            "central-plan",
            "Play against the isolated d-pawn",
            "White's d4-pawn has no friendly pawn on the c- or e-file to protect it. Your knight on d5 blocks its advance. Keep control of d5, finish developing and look for pressure on d4. Safe piece exchanges can reduce White's activity, but the pawn also gives White space and control of e5: it is a target, not a pawn you have already won.",
            CENTRAL,
            next_step="central-game",
            annotations={"squares": ["d4", "d5", "e5"]},
        ),
        excerpt(
            "central-game",
            "A different reply to the bishop check",
            "Steinitz–von Bardeleben, Hastings 1895. White blocks Bb4+ with Nc3 instead of Bd2, and Black answers d5. Stockfish prefers Nxe4 there, which the next chapter teaches. The later Black loss is not part of your taught line.",
            "steinitz-bardeleben",
            6,
            18,
            "central-recall",
        ),
        step(
            "rehearsal",
            "central-recall",
            "Meet c3 and d4",
            "Play the studied response to the central advance.",
            line_id="black-central-counterplay",
        ),
    ]
    evans = [
        step(
            "explanation",
            "evans-welcome",
            "You do not have to accept the gambit",
            "The Evans Gambit offers b4 to draw your bishop away and gain time for a central expansion. Here we decline with Bb6. White keeps extra queenside space, so the bishop still needs a safe retreat.",
            next_step="evans-arrival",
        ),
        demo(
            "evans-arrival",
            "White offers the b-pawn",
            "The pawn on b4 attacks your bishop on c5. We will move the bishop instead of capturing it.",
            "",
            ITALIAN + " b4",
            "evans-decline",
        ),
        decision(
            "evans-decline",
            "Decline without abandoning the diagonal",
            "Retreat the bishop one square along the a7–g1 diagonal.",
            ITALIAN + " b4",
            "Bb6",
            "c3",
            "evans-support",
            "Bb6 preserves the bishop without taking a pawn. White's c3 prepares d4; declining has not stopped White from building a center.",
            "Move c5 to b6.",
        ),
        decision(
            "evans-support",
            "Support your center",
            "Support e5 with the d-pawn before White expands further.",
            ITALIAN + " b4 Bb6 c3",
            "d6",
            "a4",
            "evans-room",
            "d6 supports e5. White advances a4 and can push a5 to attack your bishop.",
            "Move d7 to d6.",
        ),
        decision(
            "evans-room",
            "Make a retreat square",
            "White threatens to gain time with a5. Use your a-pawn to make a safe retreat square for the bishop.",
            ITALIAN + " b4 Bb6 c3 d6 a4",
            "a6",
            "a5",
            "evans-retreat",
            "a6 vacates a7. White pushes a5 and attacks the bishop on b6.",
            "Move a7 to a6.",
        ),
        decision(
            "evans-retreat",
            "Use the space you prepared",
            "Retreat the attacked bishop to a7.",
            ITALIAN + " b4 Bb6 c3 d6 a4 a6 a5",
            "Ba7",
            None,
            "evans-choice",
            "The bishop is safe on a7. White has more queenside space; you can return to development as the next moves allow.",
            "Move b6 to a7.",
        ),
        step(
            "branch",
            "evans-choice",
            "White can keep pushing or develop",
            "The main line continues with d3 and castling. Explore White's b5 advance, which Pollock played against Lasker, or continue to the main line.",
            EVANS,
            branch_start="evans-flank",
            next_step="evans-quiet-reply",
        ),
        demo(
            "evans-flank",
            "White pushes the b-pawn again",
            "Pollock played b5 against Lasker. The pawn attacks your c6-knight, but your a6-pawn can take it.",
            EVANS,
            EVANS + " b5",
            "evans-flank-take",
        ),
        decision(
            "evans-flank-take",
            "Take the pawn",
            "Capture the b5-pawn with your a-pawn.",
            EVANS + " b5",
            "axb5",
            "Bxb5",
            "evans-flank-develop",
            "axb5 removes the attacker. White's bishop takes back on b5 and pins your c6-knight to your king.",
            "Capture on b5 with the a6-pawn.",
        ),
        decision(
            "evans-flank-develop",
            "Develop with an attack",
            "Develop your kingside knight, attacking e4.",
            EVANS + " b5 axb5 Bxb5",
            "Nf6",
            "a6",
            "evans-flank-pawn",
            "Nf6 develops and attacks e4. White pushes a6 instead of defending it.",
            "Move g8 to f6.",
        ),
        decision(
            "evans-flank-pawn",
            "Take the loose pawn",
            "Nothing defends e4. Take it.",
            EVANS + " b5 axb5 Bxb5 Nf6 a6",
            "Nxe4",
            None,
            "evans-branch-summary",
            "Nxe4 wins a pawn. In Pollock–Lasker, Black castled here instead, which is also good.",
            "Capture on e4 with the knight from f6.",
        ),
        step(
            "explanation",
            "evans-branch-summary",
            "A pawn ahead",
            "Castle next, but if White's queen attacks your knight from e2, retreat it to f6 first. If White takes on b7 with the a-pawn, recapture with the c8-bishop. Return to the branch point to practice the quieter continuation.",
            EVANS_FLANK,
        ),
        demo(
            "evans-quiet-reply",
            "White returns to development",
            "White supports e4 with d3 instead of pushing another queenside pawn. Return to your own development now that the bishop is safe.",
            EVANS,
            EVANS + " d3",
            "evans-develop",
        ),
        decision(
            "evans-develop",
            "Finish clearing the castling route",
            "Develop the remaining kingside knight toward the center. White's d3-pawn protects e4, so the attack on e4 is pressure rather than a free pawn.",
            EVANS + " d3",
            "Nf6",
            "O-O",
            "evans-castle",
            "Nf6 clears g8. White castles; you have no piece left between your king and h8-rook either.",
            "Develop the knight from g8 to f6.",
        ),
        decision(
            "evans-castle",
            "Secure the king before a central break",
            "Use the route you have prepared to bring your king to safety.",
            EVANS + " d3 Nf6 O-O",
            "O-O",
            None,
            "evans-game",
            "Both kings are castled. White has queenside space, but you have finished kingside development without losing material. Look next for chances to challenge the center, as the historical example illustrates.",
            "Castle kingside by moving e8 to g8.",
        ),
        excerpt(
            "evans-game",
            "Answer flank space with central activity",
            "Pollock–Lasker, Hastings 1895. White pushes the queenside pawns. Black preserves the bishop, castles and develops; then d5 challenges e4 while White's king is still in the center. Watch how the prepared break gives Black active play instead of endlessly defending the queenside.",
            "pollock-lasker",
            6,
            26,
            "evans-recall",
        ),
        step(
            "rehearsal",
            "evans-recall",
            "Decline and finish developing",
            "Play the quieter continuation you studied.",
            line_id="black-evans-declined",
        ),
    ]
    return CourseDefinition.model_validate(
        dict(
            id="italian-black-foundations",
            revision="2026-10-v5",
            title="Italian Game · A practical Black repertoire",
            description="Develop with Bc5 and meet White's common fourth moves, choose a plan after castling, meet the early d4 break and the Nc3 gambit, and decline the Evans Gambit. Guided decisions connect the moves to their resulting positions.",
            learner_color="black",
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
                    ("black-quiet-italian", "Black Italian · develop and castle", QUIET, "C50"),
                    ("black-castled-first", "Black Italian · meet 4.O-O", CASTLED_FIRST, "C50"),
                    ("black-knight-first", "Black Italian · meet 4.Nc3", KNIGHT_FIRST, "C50"),
                    ("black-early-attack", "Black Italian · punish 4.Ng5", EARLY_ATTACK, "C50"),
                    ("black-early-center", "Black Italian · meet 4.d4", EARLY_CENTER, "C50"),
                    (
                        "black-knight-attack",
                        "Black Italian · castle against 5.Ng5",
                        KNIGHT_ATTACK,
                        "C50",
                    ),
                )
            ]
            + [plan_line]
            + [
                dict(id=identity, title=title, moves=position(san).moves, repertoire=True, eco=eco)
                for identity, title, san, eco in (
                    ("black-central-counterplay", "Black Italian · meet c3 and d4", CENTRAL, "C54"),
                    ("black-central-push", "Black Italian · meet 6.e5", PUSHED, "C54"),
                    ("black-central-queen", "Black Italian · meet 8.Qxd2", QUEEN_RECAPTURE, "C54"),
                    ("black-central-check", "Black Italian · meet 10.Qe2+", QUEEN_CHECK, "C54"),
                    (
                        "black-central-pressure",
                        "Black Italian · meet 10.Qb3",
                        QUEEN_PRESSURE,
                        "C54",
                    ),
                )
            ]
            + knight_block_lines()
            + [
                dict(id=identity, title=title, moves=position(san).moves, repertoire=True, eco=eco)
                for identity, title, san, eco in (
                    (
                        "black-evans-declined",
                        "Evans Declined · preserve the bishop and develop",
                        EVANS_QUIET,
                        "C51",
                    ),
                    ("black-evans-flank", "Evans Declined · meet the b5 push", EVANS_FLANK, "C51"),
                )
            ],
            chapters=[
                dict(
                    id="quiet-development",
                    title="Develop and castle",
                    entry_step=quiet[0]["id"],
                    steps=quiet,
                ),
                plan_chapter,
            ]
            + [
                dict(id=identity, title=title, entry_step=steps[0]["id"], steps=steps)
                for identity, title, steps in (
                    ("central-break", "Meet the central advance", central),
                    ("knight-block", "Meet the Nc3 gambit", knight_block_chapter()),
                    ("evans-declined", "Decline the Evans Gambit", evans),
                )
            ],
        )
    )
