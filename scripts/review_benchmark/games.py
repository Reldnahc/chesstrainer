"""Original synthetic game sequences for end-to-end inspection, not player data.

Coverage labels describe what to inspect, not an assertion that a motif or grade
must be detected. Ratings and clocks are deliberate probes, not observed skill.
"""

import chess
import chess.pgn


def case(
    key,
    moves,
    *,
    ratings=None,
    platform="unknown",
    speed=None,
    control=None,
    result="*",
    root=None,
    clocks=None,
    coverage=(),
):
    game = chess.pgn.Game()
    if root:
        game.setup(chess.Board(root))
    game.headers.update(White=f"Probe {key}", Black="Synthetic opponent", Result=result)
    game.headers["Event"] = f"Synthetic {speed or 'unspecified'} review"
    game.headers["Site"] = {"lichess": "https://lichess.org", "chesscom": "https://chess.com"}.get(
        platform, "?"
    )
    if ratings:
        game.headers.update(WhiteElo=str(ratings[0]), BlackElo=str(ratings[1]))
    if control:
        game.headers["TimeControl"] = control
    node, board = game, game.board()
    for index, san in enumerate(moves.split()):
        if board.is_game_over():
            raise ValueError(f"{key}: move after automatic game end")
        move = board.parse_san(san)
        board.push(move)
        node = node.add_variation(move)
        if clocks and index < len(clocks):
            node.set_clock(clocks[index])
    if board.result() != "*" and board.result() != result:
        raise ValueError(f"{key}: declared result contradicts board")
    return {
        "id": key,
        "pgn": str(game),
        "coverage": list(coverage),
        "plies": board.ply() - game.board().ply(),
    }


def game_corpus():
    return [
        case(
            "mate-low-clock",
            "f3 e5 g4 Qh4#",
            ratings=(600, 800),
            platform="chesscom",
            speed="rapid",
            control="600",
            result="0-1",
            clocks=[8, 580, 4, 577],
            coverage=("mate", "time_trouble", "large_swing", "opening_departure"),
        ),
        case(
            "quiet-ruy",
            "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O h3 Nb8",
            ratings=(2400, 2600),
            platform="lichess",
            speed="blitz",
            control="180+2",
            coverage=("quiet", "development", "rook_file", "opening"),
        ),
        case(
            "queen-offer",
            "e4 e5 Nf3 Nc6 Bc4 d6 Nc3 Bg4 h3 Bh5 Nxe5 Bxd1 Bxf7+ Ke7 Nd5#",
            ratings=(1200, 1400),
            platform="chesscom",
            speed="blitz",
            control="180",
            result="1-0",
            coverage=("sacrifice", "human_disagreement", "only_move", "punishment"),
        ),
        case(
            "missed-finishes",
            "f3 e5 g4 Nc6 a3 d5 b3 Qh4#",
            ratings=(1800, 2000),
            platform="lichess",
            speed="blitz",
            control="300",
            result="0-1",
            coverage=("missed_punishment", "recovery", "repeated_issue", "large_swing"),
        ),
        case(
            "repetition-draw",
            "Nf3 Nf6 Ng1 Ng8 " * 4,
            result="1/2-1/2",
            coverage=("draw", "full_history", "unknown_domain", "rating_fallback"),
        ),
        case(
            "conversion",
            "Qb7 Kg8 Qe7 Kh8 Ka2 Kg8 Ka3 Kh8 Kb4 Kg8 Kc5 Kh8 Kd5 Kg8 Ke6 Kh8 Kf6 Kg8 Qg7#",
            root="7k/8/8/8/8/8/8/KQ6 w - - 0 1",
            ratings=(1800, 1800),
            result="1-0",
            coverage=("winning_conversion", "quiet", "setup_history", "no_major_errors"),
        ),
        case(
            "failed-conversion",
            "Qb7 Kg8 Qe7 Kh8 Ka2 Kg8 Qh7+ Kxh7",
            root="7k/8/8/8/8/8/8/KQ6 w - - 0 1",
            ratings=(800, 800),
            result="1/2-1/2",
            coverage=("failed_conversion", "insufficient_material", "lost_win"),
        ),
        case(
            "book-is-not-quality",
            "e4 e5 Ke2",
            ratings=(600, 600),
            coverage=("book", "bad_recognized_move"),
        ),
        case(
            "returned-queen",
            "e4 e5 Qh5 Nc6 Qxe5+ Nxe5 d4 Nc6 Nf3 Qf6 e5 Qxe5+ dxe5",
            ratings=(800, 1000),
            platform="chesscom",
            speed="rapid",
            control="600",
            coverage=("recovery", "opponent_error", "punishment"),
        ),
        case(
            "repeated-knights",
            "Nf3 e5 Ng5 d5 Nxf7 Kxf7 Nc3 Ke8 Nxd5 Qxd5",
            ratings=(1200, 1200),
            coverage=("repeated_issue", "hanging_piece"),
        ),
    ]
