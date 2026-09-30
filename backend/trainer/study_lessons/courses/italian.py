"""Original White-side pilot. Historical games illustrate, never prescribe, moves."""

from trainer.study_lessons.content import CourseDefinition, GameAnnotation
from trainer.study_lessons.courses.authoring import decision as _decision
from trainer.study_lessons.courses.authoring import demo as _demo
from trainer.study_lessons.courses.authoring import position
from trainer.study_lessons.courses.authoring import step as _step
from trainer.study_lessons.courses.italian_games import source_games

ITALIAN = "e4 e5 Nf3 Nc6 Bc4"
QUIET = ITALIAN + " Bc5 d3 Nf6 O-O d6"
PREPARED = QUIET + " c3 O-O Re1 a6"
TWO_KNIGHTS = ITALIAN + " Nf6 d3 Bc5 O-O d6"


def course():
    games = {game.id: game for game in source_games()}
    notes = {
        "mason-lasker": (
            (8, "Both bishops are developed; d3 supports e4 without opening the center yet."),
            (
                10,
                "Mason chooses Nc3. Our repertoire castles here instead: a game example can differ from your study.",
            ),
            (
                14,
                "After Be3 Bxe3 fxe3, White has doubled e-pawns and a semi-open f-file. Development choices can change the structure.",
            ),
        ),
        "steinitz-bardeleben": (
            (7, "Here c3 prepares d4 immediately, earlier than in our quiet setup."),
            (12, "White has pawns on d4 and e4. Black has developed the bishop with check on b4."),
            (
                18,
                "White has castled after the center opened. This is a contrasting plan, not an extra line to memorize.",
            ),
            (
                49,
                "The recorded game ends after Rxh7+ with a White win. The famous mating analysis is not part of the played score.",
            ),
        ),
        "pollock-schiffers": (
            (6, "The Two Knights: Nf6 attacks e4 before Black develops the f8-bishop."),
            (
                10,
                "Pollock chooses d4 and then Ng5. Our d3 setup avoids entering this particular forcing line.",
            ),
            (
                16,
                "Black has exchanged White's c4-bishop and the central pawns. This is already a very different position.",
            ),
            (
                20,
                "The players castle on opposite sides. Follow the full game if you want to explore what came next; it is not assigned recall material.",
            ),
        ),
    }
    games = {
        key: game.model_copy(
            update={
                "annotations": tuple(GameAnnotation(ply=ply, text=text) for ply, text in notes[key])
            }
        )
        for key, game in games.items()
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

    quiet_steps = [
        _step(
            "explanation",
            "welcome",
            "The Italian, with White",
            "Develop toward the center, support e4 and castle. You will learn a quiet setup, compare Black's replies, then play it yourself. These are chosen study moves, not the only good moves.",
            next_step="center",
        ),
        _demo(
            "center",
            "Begin with the center",
            "The e-pawns claim central squares and open paths for both bishops.",
            "",
            "e4 e5",
            "knight",
        ),
        _decision(
            "knight",
            "Develop and attack",
            "Bring the kingside knight toward the center and attack e5.",
            "e4 e5",
            "Nf3",
            "Nc6",
            "bishop",
            "Nf3 attacks e5; Black develops Nc6 to defend it.",
            "The knight on g1 can reach f3.",
        ),
        _decision(
            "bishop",
            "Aim at f7",
            "Develop the king's bishop to c4. Its diagonal points at f7; that alone does not mean a sacrifice there works.",
            "e4 e5 Nf3 Nc6",
            "Bc4",
            None,
            "black-choice",
            "Bc4 establishes the Italian position and clears f1 for castling.",
            "Move the bishop from f1 to c4.",
        ),
        _step(
            "branch",
            "black-choice",
            "Black has more than one setup",
            "Our main line uses Bc5. Explore Nf6 to see the Two Knights, then return here; the third chapter teaches that reply in more detail.",
            ITALIAN,
            branch_start="alternate",
            next_step="quiet-setup",
        ),
        _demo(
            "alternate",
            "Support e4 against Nf6",
            "Nf6 attacks e4. We answer with d3; Black develops the bishop to c5.",
            ITALIAN,
            ITALIAN + " Nf6 d3 Bc5",
            "branch-summary",
        ),
        _step(
            "explanation",
            "branch-summary",
            "A different order, a familiar plan",
            "The d3-pawn now protects e4. Return to the main line to see the bishop-first move order.",
            ITALIAN + " Nf6 d3 Bc5",
        ),
        _demo(
            "quiet-setup",
            "Keep the center supported",
            "Black develops Bc5. White supports e4 with d3 before Black's Nf6 attacks it.",
            ITALIAN,
            ITALIAN + " Bc5 d3 Nf6",
            "castle",
        ),
        _decision(
            "castle",
            "Put the king away",
            "The kingside path is clear. Castle before choosing your next central plan.",
            ITALIAN + " Bc5 d3 Nf6",
            "O-O",
            "d6",
            "quiet-game",
            "Your king is on g1 and rook on f1. Black supports e5 with d6.",
            "Move the king from e1 to g1.",
        ),
        excerpt(
            "quiet-game",
            "A quiet setup in a real game",
            "Mason–Lasker, Hastings 1895. Mason chooses Nc3 and Be3 rather than our immediate castle. Watch how the bishop exchange changes his pawns; this is an illustration, not a repertoire addition.",
            "mason-lasker",
            6,
            14,
            "quiet-recall",
        ),
        _step(
            "rehearsal",
            "quiet-recall",
            "Play your quiet Italian",
            "Play the line you just learned.",
            line_id="quiet-italian",
        ),
    ]
    central_steps = [
        _step(
            "explanation",
            "central-welcome",
            "Prepare the next central move",
            "In this continuation we prepare d4 with c3 and support e4 with a rook. Timing still depends on Black's moves: do not push d4 automatically.",
            next_step="reach-setup",
        ),
        _demo(
            "reach-setup",
            "Return to your setup",
            "Follow the quiet Italian to the position after both sides support their e-pawns.",
            "",
            QUIET,
            "prepare-center",
        ),
        _decision(
            "prepare-center",
            "Prepare d4",
            "Use the c-pawn to support a future d4 advance.",
            QUIET,
            "c3",
            "O-O",
            "support-e4",
            "c3 supports d4; Black castles. Your d-pawn stays on d3 for now.",
            "Move c2 to c3.",
        ),
        _decision(
            "support-e4",
            "Bring a rook into the plan",
            "Put the f1-rook behind the e-pawn before deciding when to open the center.",
            QUIET + " c3 O-O",
            "Re1",
            "a6",
            "central-game",
            "Re1 adds a defender to e4. Black's a6 prepares queenside options; it does not force you to push d4.",
            "Move the rook from f1 to e1.",
        ),
        excerpt(
            "central-game",
            "What opening the center changes",
            "Steinitz–von Bardeleben, Hastings 1895. White plays c3 and d4 much earlier here. Compare the open center and Black's checking development with the quieter setup you learned.",
            "steinitz-bardeleben",
            6,
            18,
            "central-takeaway",
        ),
        _step(
            "explanation",
            "central-takeaway",
            "Support first, then judge the break",
            "In this game d4 led to exchanges and Bb4+. Remember the question, not a fixed move number: are your pieces ready for the center to open? Our rehearsal keeps the quiet preparation.",
            # The excerpt deliberately retains its own full game history.
            next_step="central-recall",
        )
        | {
            "position": games["steinitz-bardeleben"].position.after(
                games["steinitz-bardeleben"].moves[:18]
            )
        },
        _step(
            "rehearsal",
            "central-recall",
            "Rehearse the preparation",
            "Play the studied continuation.",
            line_id="central-preparation",
        ),
    ]
    two_steps = [
        _step(
            "explanation",
            "two-welcome",
            "When Black develops the knight first",
            "After Bc4, Black can attack e4 with Nf6. You will learn the quiet d3 reply and compare it with a much sharper historical choice.",
            next_step="two-arrival",
        ),
        _demo(
            "two-arrival",
            "Reach the Two Knights",
            "Nf6 develops a second knight and attacks White's e4-pawn.",
            "",
            ITALIAN + " Nf6",
            "two-support",
        ),
        _decision(
            "two-support",
            "Keep your center defended",
            "Support e4 with the d-pawn, using the quiet reply taught here.",
            ITALIAN + " Nf6",
            "d3",
            "Bc5",
            "two-castle",
            "d3 protects e4. Black develops Bc5, reaching the same piece setup through a different move order.",
            "Move d2 to d3.",
        ),
        _decision(
            "two-castle",
            "Finish the familiar setup",
            "Castle on the kingside, as in the bishop-first line.",
            ITALIAN + " Nf6 d3 Bc5",
            "O-O",
            "d6",
            "two-knights-game",
            "Your quiet setup is ready. Black's d6 supports e5.",
            "Move the king from e1 to g1.",
        ),
        excerpt(
            "two-knights-game",
            "A sharper choice is a different lesson",
            "Pollock–Schiffers, Hastings 1895. Pollock chooses d4 and Ng5 instead of d3. Watch the exchanges and opposite-side castling; this example explains the contrast without adding that line to your recall.",
            "pollock-schiffers",
            5,
            20,
            "two-takeaway",
        ),
        _step(
            "explanation",
            "two-takeaway",
            "Recognize the reply, keep the plan",
            "Nf6 requires you to account for the attack on e4. Our d3 answer does that while keeping a familiar setup. The historical game shows why a different fourth move deserves its own study.",
            next_step="two-recall",
        )
        | {
            "position": games["pollock-schiffers"].position.after(
                games["pollock-schiffers"].moves[:20]
            )
        },
        _step(
            "rehearsal",
            "two-recall",
            "Play against the Two Knights",
            "Play the line you studied.",
            line_id="quiet-two-knights",
        ),
    ]
    return CourseDefinition.model_validate(
        dict(
            id="italian-foundations",
            revision="2026-09-v1",
            title="Italian Game · A quiet White repertoire",
            description="Three short chapters: develop and castle, prepare the center, and meet the Two Knights. Historical game passages show contrasting plans. Add a line to Due only if you want scheduled recall.",
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
                    ("quiet-italian", "Quiet Italian · develop and castle", QUIET, "C50"),
                    ("central-preparation", "Quiet Italian · prepare the center", PREPARED, "C50"),
                    ("quiet-two-knights", "Two Knights · the d3 setup", TWO_KNIGHTS, "C55"),
                )
            ],
            chapters=[
                dict(id=identity, title=title, entry_step=steps[0]["id"], steps=steps)
                for identity, title, steps in (
                    ("quiet-development", "Develop and castle", quiet_steps),
                    ("central-break", "Prepare the center", central_steps),
                    ("two-knights", "Meet the Two Knights", two_steps),
                )
            ],
        )
    )
