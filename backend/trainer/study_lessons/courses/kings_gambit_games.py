"""Historical game scores; original Fieldwork notes live in the course."""

from trainer.contracts.study_lessons import LessonAttribution
from trainer.study_lessons.content import SourceGame
from trainer.study_lessons.courses.authoring import position

BOOK_URL = "https://www.gutenberg.org/files/16377/16377-h/16377-h.htm"
GIDDINS_URL = "https://www.newinchess.com/media/wysiwyg/product_pdf/9024.pdf#page=17"

_SCORES = (
    (
        "rosanes-anderssen",
        "Rosanes–Anderssen · Breslau 1863 · 0–1",
        "Historical move score: Steve Giddins, The Most Exciting Chess Games Ever (2022), pp. 172–174. Fieldwork's annotations are original; the book's annotations are not reproduced.",
        GIDDINS_URL,
        "Historical game score",
        "e4 e5 f4 exf4 Nf3 g5 h4 g4 Ne5 Nf6 Bc4 d5 exd5 Bd6 d4 Nh5 "
        "Bb5+ c6 dxc6 bxc6 Nxc6 Nxc6 Bxc6+ Kf8 Bxa8 Ng3 Rh2 Bf5 Bd5 Kg7 "
        "Nc3 Re8+ Kf2 Qb6 Na4 Qa6 Nc3 Be5 a4 Qf1+ Qxf1 Bxd4+ Be3 Rxe3 Kg1 Re1#",
    ),
    (
        "morphy-bornemann",
        "Morphy–Bornemann · Blindfold game · 1–0",
        "The Blue Book of Chess (1910), p. 183; historical score, with original Fieldwork annotations.",
        f"{BOOK_URL}#Pg_183",
        "Public domain",
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
                    text=citation,
                    url=url,
                    license=license_name,
                ),
            ),
        )
        for identity, title, citation, url, license_name, san in _SCORES
    )
