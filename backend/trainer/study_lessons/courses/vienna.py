"""A Vienna Gambit repertoire for White, with original instructional prose."""

from trainer.study_lessons.content import CourseDefinition
from trainer.study_lessons.courses.authoring import position
from trainer.study_lessons.courses.vienna_accepted import chapter as accepted_chapter
from trainer.study_lessons.courses.vienna_others import (
    second_chapter,
    solid_chapter,
    strike_chapter,
)
from trainer.study_lessons.courses.vienna_positions import (
    BISHOP_FIRST,
    BLOCK,
    DEFENDED,
    FORK,
    KING_BACK,
    KING_TAKES,
    KNIGHT,
    KNIGHTS_EARLY,
    KNIGHTS_LINE,
    KNIGHTS_PIN,
    PIN,
    QUEEN,
    SOLID_LINE,
    SOLID_PIN,
    SOLID_TAKE,
    STRIKE_BISHOP,
    STRIKE_KNIGHT,
    STRIKE_LINE,
    STRIKE_PIN,
)

LINES = (
    ("vienna-accepted", "Vienna Gambit · 3...exf4 4.e5, attack on f7", FORK, "C29"),
    ("vienna-king-takes", "Vienna Gambit · 3...exf4, 10...Kxf7", KING_TAKES, "C29"),
    ("vienna-king-back", "Vienna Gambit · 3...exf4, 12...Ke8", KING_BACK, "C29"),
    ("vienna-block", "Vienna Gambit · 3...exf4, 7...Bd7", BLOCK, "C29"),
    ("vienna-queen", "Vienna Gambit · 3...exf4 4.e5 Qe7", QUEEN, "C29"),
    ("vienna-accepted-knight", "Vienna Gambit · 3...exf4, 5...Nc6", KNIGHT, "C29"),
    ("vienna-pin", "Vienna Gambit · 3...exf4, 6...Bg4", PIN, "C29"),
    ("vienna-strike", "Vienna Gambit · 3...d5 main line", STRIKE_LINE, "C29"),
    ("vienna-strike-pin", "Vienna Gambit · 3...d5, 5...Bg4", STRIKE_PIN, "C29"),
    ("vienna-strike-bishop", "Vienna Gambit · 3...d5, 5...Bc5", STRIKE_BISHOP, "C29"),
    ("vienna-strike-knight", "Vienna Gambit · 3...d5, 6...Nc6", STRIKE_KNIGHT, "C29"),
    ("vienna-solid", "Vienna Gambit · 3...d6 main line", SOLID_LINE, "C29"),
    ("vienna-solid-pin", "Vienna Gambit · 3...d6 4.Nf3 Bg4", SOLID_PIN, "C29"),
    ("vienna-solid-take", "Vienna Gambit · 3...d6 4.Nf3 exf4", SOLID_TAKE, "C29"),
    ("vienna-defended", "Vienna Gambit · 3...Nc6", DEFENDED, "C29"),
    ("vienna-second-knights", "Vienna Game · 2...Nc6 main line", KNIGHTS_LINE, "C28"),
    ("vienna-second-knights-early", "Vienna Game · 2...Nc6 3.Bc4 Bc5", KNIGHTS_EARLY, "C25"),
    ("vienna-second-knights-pin", "Vienna Game · 2...Nc6 3.Bc4 Nf6 4.d3 Bb4", KNIGHTS_PIN, "C28"),
    ("vienna-bishop-first", "Vienna Game · Anderssen Defense, 2...Bc5", BISHOP_FIRST, "C25"),
)


def course():
    return CourseDefinition.model_validate(
        dict(
            id="vienna-gambit",
            revision="2026-10-v1",
            title="Vienna Gambit · An attacking White repertoire",
            description="Offer the f-pawn after 1.e4 e5 2.Nc3 Nf6 and punish the most common replies: a chain of checks against exf4, a strong center against d5, and calm development against d6, Nc6 and Black's other second moves. Side trips cover the replies club players choose most often.",
            learner_color="white",
            attributions=[
                dict(
                    text="Original Fieldwork instruction. Opponent replies were chosen with the Maia-3 human move model and every taught move was checked with Stockfish.",
                    license="Repository license",
                )
            ],
            lines=[
                dict(id=identity, title=title, moves=position(san).moves, repertoire=True, eco=eco)
                for identity, title, san, eco in LINES
            ],
            chapters=[accepted_chapter(), strike_chapter(), solid_chapter(), second_chapter()],
        )
    )
