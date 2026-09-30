"""Public-domain game scores; original Fieldwork notes live in the course."""

from trainer.contracts.study_lessons import LessonAttribution
from trainer.study_lessons.content import SourceGame
from trainer.study_lessons.courses.authoring import position

BOOK_URL = "https://www.gutenberg.org/files/16377/16377-h/16377-h.htm"

_SCORES = (
    (
        "anderssen-kipping",
        "Anderssen–Kipping · Manchester 1857 · 1–0",
        "165",
        "e4 e5 f4 exf4 Nf3 g5 h4 g4 Ne5 h5 Bc4 Rh7 Bxf7+ Rxf7 Nxf7 Kxf7 "
        "d4 d6 Bxf4 Be7 O-O Kg7 g3 Be6 Qd3 Nd7 Nc3 c5 Ne2 Bf7 Rf2 Bg6 "
        "Raf1 Ndf6 dxc5 Bxe4 Qe3 dxc5 Be5 Qd5 Qg5+ Kh7 Nc3 Qc6 Bxf6 Bxf6 Rxf6",
    ),
    (
        "morphy-bornemann",
        "Morphy–Bornemann · Blindfold game · 1–0",
        "183",
        "e4 e5 f4 Bc5 Nf3 d6 c3 Bg4 Bc4 Nf6 fxe5 Bxf3 Qxf3 dxe5 d3 Nc6 "
        "Bg5 a6 Nd2 Be7 O-O-O Qd7 Nf1 O-O-O Ne3 h6 Bh4 g5 Bg3 Rdf8 Nd5 Ne8 "
        "d4 exd4 cxd4 Nd6 Bb3 Bd8 Rhf1 Nb5 Qe3 f5 exf5 Rxf5 Nb6+ cxb6 Be6 Rd5 "
        "Rf7 Ne7 Kb1 Re8 Rc1+ Nc7 Bxd7+ Rxd7 d5 Nc6 dxc6 Rxe3 cxd7+",
    ),
)


def source_games() -> tuple[SourceGame, ...]:
    return tuple(
        SourceGame(
            id=identity,
            title=title,
            moves=position(san).moves,
            attributions=(
                LessonAttribution(
                    text=f"The Blue Book of Chess (1910), p. {page}; historical score, with original Fieldwork annotations.",
                    url=f"{BOOK_URL}#Pg_{page}",
                    license="Public domain",
                ),
            ),
        )
        for identity, title, page, san in _SCORES
    )
