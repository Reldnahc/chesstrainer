"""White Italian foundations: connected plans, concrete breaks, and contrasting games."""

from trainer.study_lessons.content import CourseDefinition, GameAnnotation
from trainer.study_lessons.courses.authoring import decision as _decision
from trainer.study_lessons.courses.authoring import demo as _demo
from trainer.study_lessons.courses.authoring import position
from trainer.study_lessons.courses.authoring import step as _step
from trainer.study_lessons.courses.italian_center import ACTIVE_BREAK
from trainer.study_lessons.courses.italian_center import chapter as center_chapter
from trainer.study_lessons.courses.italian_development import chapter as development_chapter
from trainer.study_lessons.courses.italian_games import source_games
from trainer.study_lessons.courses.italian_positions import (
    CENTRAL,
    DEVELOPED,
    ITALIAN,
    KNIGHT_ROUTE,
    QUIET,
)
from trainer.study_lessons.courses.italian_two_knights import chapter as two_knights_chapter
from trainer.study_lessons.courses.italian_two_knights import lines as two_knights_lines
from trainer.study_lessons.courses.italian_variations import (
    BISHOP_THREAT,
    EARLY_H6,
    KNIGHT_JUMP,
    PIN,
    PREMATURE_BREAK,
    early_h6_trip,
    knight_jump_trip,
)


def course():
    games = {game.id: game for game in source_games()}
    notes = {
        "mason-lasker": (
            (
                8,
                "Each side has developed one bishop; d3 supports e4 without opening the center yet.",
            ),
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
            (
                12,
                "White has pawns on d4 and e4. Black has moved the bishop out of attack with check on b4.",
            ),
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
            "A setup you can explain",
            "Start with central development and king safety. Later chapters cover the Two Knights Defense, finishing development, threats to your bishop and when to open the center. These are selected study moves, not the only good moves in every position.",
            next_step="center",
        ),
        _demo(
            "center",
            "Begin with the center",
            "The e-pawns take central space and open paths for the bishops.",
            "",
            "e4 e5",
            "knight",
        ),
        _decision(
            "knight",
            "Develop with a purpose",
            "Bring out a knight while attacking Black's central pawn.",
            "e4 e5",
            "Nf3",
            "Nc6",
            "bishop",
            "Nf3 develops a piece and attacks e5. Black's Nc6 develops while defending that pawn.",
            "Move the kingside knight from g1 to f3.",
        ),
        _decision(
            "bishop",
            "Choose an active diagonal",
            "Develop the king's bishop toward f7 and clear another square between your king and rook.",
            "e4 e5 Nf3 Nc6",
            "Bc4",
            None,
            "knight-jump-choice",
            "Bc4 establishes the Italian. The bishop points at f7, but one attacker alone does not justify sacrificing it there.",
            "The bishop on f1 can reach c4.",
        ),
        _step(
            "branch",
            "knight-jump-choice",
            "If Black plays ...Nd4",
            "Black has several common third moves. This chapter's main line is ...Bc5; side trips show ...Nd4 and ...h6 first, and the next chapter covers ...Nf6, the Two Knights Defense. Explore ...Nd4, or continue to the next reply.",
            ITALIAN,
            branch_start="knight-jump",
            next_step="early-h6-choice",
        ),
        *knight_jump_trip(),
        _step(
            "branch",
            "early-h6-choice",
            "If Black plays ...h6",
            "Explore ...h6, which keeps your pieces off g5, or continue to the main line.",
            ITALIAN,
            branch_start="early-h6",
            next_step="quiet-setup",
        ),
        *early_h6_trip(),
        _demo(
            "quiet-setup",
            "Black develops the bishop first",
            "The c5-bishop points toward f2. Your next move can support the center and free your remaining bishop.",
            ITALIAN,
            ITALIAN + " Bc5",
            "support-center",
        ),
        _decision(
            "support-center",
            "Secure your e-pawn",
            "Build a pawn support for e4 before Black's knight attacks it, while opening your c1-bishop's diagonal.",
            ITALIAN + " Bc5",
            "d3",
            "Nf6",
            "castle",
            "d3 supports e4. Black's ...Nf6 now attacks a defended pawn, so you can attend to king safety. If Black plays ...d6 or ...h6 instead, castle all the same.",
            "Move the d-pawn from d2 to d3.",
        ),
        _decision(
            "castle",
            "Put the king away",
            "Your central pawn is supported and the kingside path is clear. Secure the king and bring its rook closer to the center.",
            ITALIAN + " Bc5 d3 Nf6",
            "O-O",
            "d6",
            "quiet-takeaway",
            "Castling puts the king on g1 and rook on f1. Black's ...d6 supports e5. Both players still have work to do on the queenside. If Black castles or plays ...h6 instead of ...d6, continue with c3, as in the development chapter.",
            "Move your king from e1 to g1 to castle.",
        ),
        _step(
            "explanation",
            "quiet-takeaway",
            "A starting point, not a finished plan",
            "Your b1-knight and c1-bishop have not moved. A later chapter gives them useful jobs and prepares a central break. First rehearse this short setup; optional scheduled recall is your choice after the lesson.",
            QUIET,
            next_step="quiet-recall",
        ),
        _step(
            "rehearsal",
            "quiet-recall",
            "Play your quiet Italian",
            "Play the setup you learned.",
            line_id="quiet-italian",
        ),
    ]

    def line(identity, title, before, after):
        anchor, finish = position(before), position(after)
        return dict(
            id=identity,
            title=title,
            position=anchor,
            moves=finish.moves[len(anchor.moves) :],
            repertoire=True,
            eco="C50",
        )

    chapters = (
        ("quiet-development", "Build the quiet setup", quiet_steps),
        ("two-knights", "Meet the Two Knights Defense", two_knights_chapter(excerpt, games)),
        ("finish-development", "Give every piece a job", development_chapter(excerpt, games)),
        ("central-break", "Choose when to open the center", center_chapter(excerpt, games)),
    )
    return CourseDefinition.model_validate(
        dict(
            id="italian-foundations",
            revision="2026-10-v4",
            title="Italian Game · A quiet White repertoire",
            description="Learn the setup, meet the Two Knights Defense and Black's other common third moves, finish development and play the central break. Compare bishop exchanges, punish a premature ...d5, and meet Black's better-prepared counterplay. Historical examples illustrate different choices; this is a starter repertoire, not coverage of every Italian line.",
            learner_color="white",
            attributions=[
                dict(
                    text="Original Fieldwork instruction and annotations. Historical game scores are credited separately.",
                    license="Repository license",
                )
            ],
            games=list(games.values()),
            lines=[
                line("quiet-italian", "Quiet Italian · develop and castle", "", QUIET),
                line("knight-jump", "Italian Game · punish 3...Nd4", "", KNIGHT_JUMP),
                line("early-h6", "Italian Game · meet 3...h6", "", EARLY_H6),
            ]
            + two_knights_lines()
            + [
                line(
                    "central-preparation", "Quiet Italian · complete development", QUIET, DEVELOPED
                ),
                line("central-pin", "Quiet Italian · answer the ...Bg4 pin", QUIET, PIN),
                line(
                    "premature-break",
                    "Quiet Italian · punish an early ...d5",
                    QUIET,
                    PREMATURE_BREAK,
                ),
                line(
                    "bishop-threat",
                    "Quiet Italian · save the bishop from ...Na5",
                    QUIET,
                    BISHOP_THREAT,
                ),
                line(
                    "central-break",
                    "Quiet Italian · play d4 and rebuild the center",
                    KNIGHT_ROUTE,
                    CENTRAL,
                ),
                line(
                    "active-break",
                    "Quiet Italian · meet Black's active ...d5",
                    KNIGHT_ROUTE,
                    ACTIVE_BREAK,
                ),
            ],
            chapters=[
                dict(id=identity, title=title, entry_step=steps[0]["id"], steps=steps)
                for identity, title, steps in chapters
            ],
        )
    )
