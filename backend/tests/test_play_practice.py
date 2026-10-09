"""Opening practice: a play game whose bot answers from a course's repertoire lines."""

import random

import chess
import pytest
from fastapi.testclient import TestClient
from human_fixtures import PolicyProvider
from study_lesson_fixtures import connected_course
from trainer.api import create_app
from trainer.human_models.types import HumanMove, HumanPolicy
from trainer.play.book import MINIMUM_SHARE, book_for, book_move, book_weights, practice_courses
from trainer.study_lessons.content import CourseDefinition

# Added to the fixture's own repertoire line, 1.e4 e5 2.Nf3 Nc6 3.Bc4.
LINES = (
    ("philidor", ("e2e4", "e7e5", "g1f3", "d7d6", "d2d4")),
    # Reaches the main line's position after 2...Nc6 by another order.
    ("transposed", ("g1f3", "b8c6", "e2e4", "e7e5", "f1b5")),
)


def practice_course(key="practice", color="white"):
    record = connected_course(key).model_dump()
    if color != record["learner_color"]:
        # The fixture's decisions are White's; a Black course needs only a reading step.
        step = {"kind": "explanation", "id": "read", "title": "Read"}
        record["chapters"] = [
            {"id": "only", "title": "Only", "entry_step": "read", "steps": [step]}
        ]
    record["learner_color"] = color
    record["lines"] = [*record["lines"]] + [
        {"id": identity, "title": identity, "moves": moves, "repertoire": True}
        for identity, moves in LINES
    ]
    return CourseDefinition.model_validate(record)


class Courses:
    def __init__(self, *courses):
        self.items = courses

    def courses(self, db):
        return self.items


def board_after(*moves):
    board = chess.Board()
    for uci in moves:
        board.push_uci(uci)
    return board


def test_lines_merge_by_position_so_transpositions_join():
    book = book_for(practice_course())
    assert book.book_moves(chess.Board()) == ("e2e4", "g1f3")
    assert set(book.book_moves(board_after("e2e4", "e7e5", "g1f3"))) == {"b8c6", "d7d6"}
    # Both orders reach one node, so either line's continuation is book from both.
    main = book.book_moves(board_after("e2e4", "e7e5", "g1f3", "b8c6"))
    transposed = book.book_moves(board_after("g1f3", "b8c6", "e2e4", "e7e5"))
    assert set(main) == set(transposed) == {"f1c4", "f1b5"}
    # The fixture's non-repertoire game line is a lesson example, not book.
    assert not book.book_moves(board_after("e2e4", "e7e5", "g1f3", "b8c6", "f1c4", "f8c5"))
    listed = practice_courses([practice_course(), connected_course("no-lines")])
    assert [row["id"] for row in listed] == ["practice", "no-lines"]
    assert listed[0]["lines"] == 3 and listed[0]["learner_color"] == "white"


def test_book_choice_follows_the_policy_with_a_floor_for_rare_lines():
    def policy(shares):
        return HumanPolicy.model_construct(
            moves=[
                HumanMove(uci=uci, rank=i + 1, probability=p) for i, (uci, p) in enumerate(shares)
            ]
        )

    weights = book_weights(
        ("b8c6", "d7d6"), policy([("b8c6", 0.6), ("d7d6", 0.001), ("a7a6", 0.3)])
    )
    assert weights["b8c6"] > 0.99 and weights["d7d6"] == MINIMUM_SHARE
    assert book_weights(("b8c6", "d7d6"), None) == {"b8c6": 1.0, "d7d6": 1.0}

    class Models:
        def policy(self, sessions, request):
            return policy([("b8c6", 0.9), ("d7d6", 0.1)]), None

    class Play:
        opponent_rating, learner_rating = 1400, 1200

    board = board_after("e2e4", "e7e5", "g1f3")
    picks = [
        book_move(Models(), None, Play(), board, ("b8c6", "d7d6"), random.Random(seed)).uci
        for seed in range(200)
    ]
    assert set(picks) == {"b8c6", "d7d6"} and picks.count("b8c6") > picks.count("d7d6")
    choice = book_move(None, None, Play(), board, ("b8c6",), random.Random(0))
    assert choice.source == "book" and choice.san == "Nc6"


@pytest.mark.stockfish
def test_practice_follows_the_book_and_stops_the_learner_off_it(settings, stockfish_path):
    settings.stockfish_path = stockfish_path
    provider = PolicyProvider(settings)
    app = create_app(
        settings,
        workers=False,
        human_provider=provider,
        lesson_providers=(Courses(practice_course(), connected_course("other")),),
    )
    with TestClient(app) as client:
        listed = client.get("/api/play/openings").json()["courses"]
        assert [row["id"] for row in listed] == ["practice", "other"]
        assert (
            client.post(
                "/api/play",
                json={
                    "coach_id": "classic",
                    "coach_name": "Walter",
                    "rating": 1400,
                    "course_id": "nope",
                },
            ).status_code
            == 404
        )
        # The course decides the learner's side, whatever color was asked for.
        game = client.post(
            "/api/play",
            json={
                "coach_id": "classic",
                "coach_name": "Walter",
                "color": "black",
                "rating": 1400,
                "course_id": "practice",
            },
        ).json()
        play_id = game["id"]
        assert game["learner_color"] == "white"
        assert game["practice"] == {
            "course_id": "practice",
            "title": "Connected lesson fixture",
            "status": "book",
            "ended": None,
            "deviation": None,
            "hint": [],
        }

        def move(ply, uci):
            response = client.post(f"/api/play/{play_id}/move", json={"ply": ply, "uci": uci})
            assert response.status_code == 200, response.text
            return response.json()

        def reply():
            return client.post(f"/api/play/{play_id}/reply").json()

        move(0, "e2e4")
        answered = reply()
        assert answered["reply"]["source"] == "book" and answered["reply"]["uci"] == "e7e5"
        move(2, "g1f3")
        answered = reply()
        assert answered["reply"]["uci"] in {"b8c6", "d7d6"}
        # After 2...Nc6 the transposed line adds 3.Bb5 to the book.
        book = {"b8c6": {"f1c4", "f1b5"}, "d7d6": {"d2d4"}}[answered["reply"]["uci"]]

        # Off book: the bot waits, and the reply request reports how the move compares.
        off = move(4, "a2a3")
        assert off["practice"]["status"] == "deviation"
        assert off["practice"]["deviation"]["verdict"] is None
        assert off["practice"]["deviation"]["san"] == "a3"
        assert not off["practice"]["deviation"]["repeated"]
        judged = reply()
        assert judged["reply"] is None and len(judged["frames"]) == 6
        deviation = judged["practice"]["deviation"]
        assert deviation["verdict"] in {"fine", "worse"} and deviation["compared_with"]
        assert (
            client.post(f"/api/play/{play_id}/move", json={"ply": 5, "uci": "h7h6"}).status_code
            == 409
        )

        back = client.post(f"/api/play/{play_id}/takeback").json()
        assert len(back["frames"]) == 5 and back["practice"]["status"] == "book"
        assert back["practice"]["hint"] == []
        assert client.post(f"/api/play/{play_id}/takeback").status_code == 409

        # A second miss at the same spot shows the book move once the learner goes back.
        assert move(4, "h2h3")["practice"]["deviation"]["repeated"]
        hinted = client.post(f"/api/play/{play_id}/takeback").json()
        assert set(hinted["practice"]["hint"]) == book

        # Carrying on turns it into an ordinary game against the usual bot.
        move(4, "a2a3")
        carried = client.post(f"/api/play/{play_id}/carry-on").json()
        assert carried["practice"]["status"] == "ended"
        assert carried["practice"]["ended"] == "carried_on"
        assert reply()["reply"]["source"] == "human"


@pytest.mark.stockfish
def test_the_book_ending_hands_over_to_the_usual_bot(settings, stockfish_path):
    settings.stockfish_path = stockfish_path
    app = create_app(
        settings,
        workers=False,
        human_provider=PolicyProvider(settings),
        lesson_providers=(Courses(practice_course(color="black")),),
    )
    with TestClient(app) as client:
        game = client.post(
            "/api/play",
            json={
                "coach_id": "classic",
                "coach_name": "Walter",
                "rating": 1400,
                "course_id": "practice",
            },
        ).json()
        play_id = game["id"]
        assert game["learner_color"] == "black"
        opened = client.post(f"/api/play/{play_id}/reply").json()
        assert opened["reply"]["source"] == "book"
        if opened["reply"]["uci"] == "g1f3":
            learner = ["b8c6", "e7e5"]
        else:
            learner = ["e7e5", "b8c6"]
        state = opened
        for uci in learner:
            ply = len(state["frames"]) - 1
            client.post(f"/api/play/{play_id}/move", json={"ply": ply, "uci": uci})
            state = client.post(f"/api/play/{play_id}/reply").json()
            assert state["reply"]["source"] == "book"
        # The bot's last book move ends the book; the game plays on from there.
        assert state["practice"]["status"] == "ended"
        assert state["practice"]["ended"] == "book_end"
        ply = len(state["frames"]) - 1
        legal = sorted(m.uci() for m in chess.Board(state["frames"][-1]["fen"]).legal_moves)
        client.post(f"/api/play/{play_id}/move", json={"ply": ply, "uci": legal[0]})
        assert client.post(f"/api/play/{play_id}/reply").json()["reply"]["source"] == "human"
