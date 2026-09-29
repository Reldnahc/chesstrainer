"""Historical Italian scores transcribed from the public-domain 1896 tournament book."""

import chess

from trainer.contracts.study_lessons import LessonAttribution
from trainer.study_lessons.content import SourceGame

BOOK_URL = "https://archive.org/details/cu31924029919820"
PUBLIC_DOMAIN_URL = (
    "https://commons.wikimedia.org/wiki/"
    "File:The_Hastings_chess_tournament_1895._Containing_the_authorised_account_of_"
    "the_230_games_played_Aug.-Sept._1895_(IA_cu31924029919820).pdf"
)
BOOK_ATTRIBUTION = LessonAttribution(
    text="Historical game scores: H. F. Cheshire (ed.), The Hastings Chess Tournament 1895 (1896).",
    url=BOOK_URL,
    license="Public domain",
)
PUBLIC_DOMAIN_ATTRIBUTION = LessonAttribution(
    text="The original tournament book is public domain; lesson explanations are original Fieldwork writing.",
    url=PUBLIC_DOMAIN_URL,
    license="Public Domain Mark 1.0",
)

# SAN preserves the human-reviewable transcription. python-chess supplies the UCI
# moves and the lesson content model independently validates the complete history.
_SCORES = (
    (
        "mason-lasker",
        "Mason–Lasker · Hastings 1895 · ½–½",
        "264–265",
        320,
        "e4 e5 Nf3 Nc6 Bc4 Bc5 d3 Nf6 Nc3 d6 Be3 Bxe3 fxe3 Na5 Bb3 c6 "
        "O-O Nxb3 axb3 O-O Qe1 Ne8 Qg3 f6 Nh4 Be6 Rf2 Qb6 Raf1 Rd8 Kh1 Rd7 "
        "Nf5 Kh8 Na4 Qc7 Qh4 b6 Nc3 Qd8 Qg3 Nc7 Nh4 Re8 Qf3 Bf7 Nf5 Be6 "
        "Qg3 Bxf5 Rxf5 Ne6 Qf2 Ng5 Qe1 d5 Qh4 d4 exd4 Rxd4 Ne2 Rd7 Qf2 Ne6 "
        "Qe3 Qe7 R5f2 Qb4 Ng3 a5 Ra1 Nc5 Qc1 Red8 Nf5 Qb5 g4 Ne6 Qe3 Nf4 "
        "Rd2 c5 Qf2 c4 dxc4 Rxd2 Qxd2 Rxd2 cxb5 Rxc2 Rb1 Nh3 Ne3 Rc5 Kg2 Nf4+ "
        "Kf3 h5 b4 Rxb5 bxa5 hxg4+ Kxg4 bxa5 Nc4 Ne6 h4 Nd4 Ra1 Nc6 Kf5 Rb4 "
        "Nxa5 Nxa5 Rxa5 Rxb2 Kg6 Rg2+ Kh5 Kh7 Ra7 Re2 Rb7 Kg8 Kg6 Rg2+ Kh5 g6+ "
        "Kh6 Rg4 Rg7+ Kf8 Ra7 f5 exf5 gxf5 Kh5 Rg7 Ra8+ Kf7 Ra7+ Kg8 Ra5 f4 "
        "Rxe5 f3 Rf5 Rf7 Rg5+ Kf8 Rg1 Rg7 Rf1 Rg3 Kh6 Kf7 h5 Kf6 Kh7 Kf5 "
        "h6 Kf4 Kh8",
    ),
    (
        "steinitz-bardeleben",
        "Steinitz–von Bardeleben · Hastings 1895 · 1–0",
        "157–158",
        201,
        "e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d4 exd4 cxd4 Bb4+ Nc3 d5 exd5 Nxd5 "
        "O-O Be6 Bg5 Be7 Bxd5 Bxd5 Nxd5 Qxd5 Bxe7 Nxe7 Re1 f6 Qe2 Qd7 Rac1 c6 "
        "d5 cxd5 Nd4 Kf7 Ne6 Rhc8 Qg4 g6 Ng5+ Ke8 Rxe7+ Kf8 Rf7+ Kg8 Rg7+ "
        "Kh8 Rxh7+",
    ),
    (
        "pollock-schiffers",
        "Pollock–Schiffers · Hastings 1895 · 0–1",
        "330",
        392,
        "e4 e5 Nf3 Nc6 Bc4 Nf6 d4 exd4 Ng5 d5 exd5 Na5 Qxd4 Nxc4 Qxc4 Qxd5 "
        "Qe2+ Be6 O-O O-O-O Nxe6 Qxe6 Qxe6+ fxe6 Nc3 Bb4 Bg5 Bxc3 bxc3 Rd5 "
        "Be3 Rhd8 c4 Ra5 a4 Rd6 Rfb1 Ng4 Rb5 Rxa4 Rab1 Nxe3 fxe3 Rb6 Rf1 Rxc4 "
        "Rg5 g6 Rf8+ Kd7 Rf7+ Kd6 Rxh7 Rb1+ Kf2 Rxc2+ Kg3 b5 Rxg6 Rb3 "
        "Kf4 Rc4+ Kg5 Rxe3 Rgg7 Re5+ Kh6 Rh4+ Kg6 Rxh7 Rxh7 b4 g4 b3 Rh3 Rb5 "
        "Rd3+ Ke7 Rd1 b2 Rb1 a5 h4 a4 h5 a3 h6 a2",
    ),
)


def source_games() -> tuple[SourceGame, ...]:
    games = []
    for game_id, title, pages, scan_page, san in _SCORES:
        board = chess.Board()
        moves = []
        for token in san.split():
            move = board.parse_san(token)
            moves.append(move.uci())
            board.push(move)
        games.append(
            SourceGame(
                id=game_id,
                title=title,
                moves=tuple(moves),
                attributions=(
                    LessonAttribution(
                        text=f"Cheshire (ed.), The Hastings Chess Tournament 1895 (1896), pp. {pages}.",
                        url=f"{BOOK_URL}/page/n{scan_page - 1}/mode/1up",
                        license="Public domain",
                    ),
                    PUBLIC_DOMAIN_ATTRIBUTION,
                ),
            )
        )
    return tuple(games)
