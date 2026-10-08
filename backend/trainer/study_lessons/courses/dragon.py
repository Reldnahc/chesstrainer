"""A Sicilian Dragon repertoire for Black, with original instructional prose."""

from trainer.study_lessons.content import CourseDefinition
from trainer.study_lessons.courses.authoring import position
from trainer.study_lessons.courses.dragon_alternatives import second_chapter, third_chapter
from trainer.study_lessons.courses.dragon_bg5 import chapter as bg5_chapter
from trainer.study_lessons.courses.dragon_positions import (
    ALAPIN,
    BG5_C4,
    BG5_CHECK,
    BG5_F4,
    BG5_F6,
    BG5_H4,
    BG5_LINE,
    CHECK_SIX,
    CLASSICAL,
    CLOSED,
    EARLY_E3,
    EARLY_QUEEN,
    MORRA,
    MOSCOW,
    QUEEN_D2,
    QUEEN_RECAPTURE,
    QUIET_C4,
    SECOND,
    THIRD,
    THIRD_C3,
    THIRD_C4_KNIGHT,
    THIRD_JUMP,
    THIRD_KNIGHT,
    YUGOSLAV,
    YUGOSLAV_C4,
    YUGOSLAV_EXCHANGE,
    YUGOSLAV_GAMBIT,
    YUGOSLAV_LATE,
    YUGOSLAV_QUEEN,
)
from trainer.study_lessons.courses.dragon_setup import chapter as setup_chapter
from trainer.study_lessons.courses.dragon_yugoslav import chapter as yugoslav_chapter

LINES = (
    ("dragon-classical", "Sicilian Dragon · quiet Be2 setup", CLASSICAL, "B73"),
    ("dragon-queen-recapture", "Sicilian · 4.Qxd4 Nc6 5.Bb5", QUEEN_RECAPTURE, "B53"),
    ("dragon-quiet-c4", "Sicilian Dragon · 6.Bc4", QUIET_C4, "B70"),
    ("dragon-early-e3", "Sicilian Dragon · 6.Be2 Bg7 7.Be3", EARLY_E3, "B72"),
    ("dragon-queen-d2", "Sicilian Dragon · 9.Qd2 d5", QUEEN_D2, "B73"),
    ("dragon-yugoslav", "Sicilian Dragon · Yugoslav Attack, 9.O-O-O d5", YUGOSLAV, "B76"),
    ("dragon-yugoslav-queen", "Sicilian Dragon · 7.Qd2 Ng4", YUGOSLAV_QUEEN, "B72"),
    ("dragon-yugoslav-c4", "Sicilian Dragon · Yugoslav Attack, 8.Bc4", YUGOSLAV_C4, "B77"),
    (
        "dragon-yugoslav-exchange",
        "Sicilian Dragon · Yugoslav Attack, 9.Nxc6",
        YUGOSLAV_EXCHANGE,
        "B76",
    ),
    (
        "dragon-yugoslav-gambit",
        "Sicilian Dragon · Yugoslav Attack, 10.Nxc6",
        YUGOSLAV_GAMBIT,
        "B76",
    ),
    ("dragon-yugoslav-late", "Sicilian Dragon · Yugoslav Attack, 11.Nxc6", YUGOSLAV_LATE, "B76"),
    ("dragon-bg5", "Sicilian Dragon · 6.Bg5 Bg7 7.Qd2 h6", BG5_LINE, "B70"),
    ("dragon-check-six", "Sicilian Dragon · 6.Bb5+", CHECK_SIX, "B70"),
    ("dragon-bg5-c4", "Sicilian Dragon · 6.Bg5 Bg7 7.Bc4", BG5_C4, "B70"),
    ("dragon-bg5-check", "Sicilian Dragon · 6.Bg5 Bg7 7.Bb5+", BG5_CHECK, "B70"),
    ("dragon-bg5-h4", "Sicilian Dragon · 6.Bg5, 8.Bh4", BG5_H4, "B70"),
    ("dragon-bg5-f6", "Sicilian Dragon · 6.Bg5, 8.Bxf6", BG5_F6, "B70"),
    ("dragon-bg5-f4", "Sicilian Dragon · 6.Bg5, 8.Bf4", BG5_F4, "B70"),
    ("dragon-second-bishop", "Sicilian · 2.Bc4", SECOND, "B20"),
    ("dragon-second-knight", "Sicilian · 2.Nc3, back to the Dragon", CLOSED, "B70"),
    ("dragon-alapin", "Sicilian · Alapin Variation, 2.c3 Nf6", ALAPIN, "B22"),
    ("dragon-early-queen", "Sicilian · 2.d4 cxd4 3.Qxd4", EARLY_QUEEN, "B21"),
    ("dragon-morra", "Sicilian · Smith-Morra Gambit accepted", MORRA, "B21"),
    ("dragon-third-bishop", "Sicilian · 3.Bc4 Nf6 4.d3", THIRD, "B50"),
    ("dragon-moscow", "Sicilian · Moscow Variation, 3.Bb5+", MOSCOW, "B52"),
    ("dragon-third-knight", "Sicilian · 3.Nc3, back to the Dragon", THIRD_KNIGHT, "B70"),
    ("dragon-third-c3", "Sicilian · 3.c3 Nf6 4.d4", THIRD_C3, "B50"),
    ("dragon-third-jump", "Sicilian · 3.Bc4 Nf6 4.Ng5", THIRD_JUMP, "B50"),
    ("dragon-third-c4-knight", "Sicilian · 3.Bc4 Nf6 4.Nc3", THIRD_C4_KNIGHT, "B50"),
)


def course():
    return CourseDefinition.model_validate(
        dict(
            id="sicilian-dragon",
            revision="2026-10-v1",
            title="Sicilian Dragon · A fighting Black repertoire",
            description="Answer e4 with the Sicilian and fianchetto your bishop on g7. Build the setup, meet the Yugoslav Attack with an early d5, punish Bg5 with h6, Ng4 and e5, and handle White's early alternatives. Side trips cover the replies club players choose most often.",
            learner_color="black",
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
            chapters=[
                setup_chapter(),
                yugoslav_chapter(),
                bg5_chapter(),
                second_chapter(),
                third_chapter(),
            ],
        )
    )
