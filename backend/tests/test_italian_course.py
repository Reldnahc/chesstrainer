"""The shipped curriculum exercises the production framework, not a parallel player."""

from copy import deepcopy

import chess
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from test_focused_practice import seed_classified
from test_lesson_journey import command, learning
from test_opening_journey import response_json
from trainer.api import create_app
from trainer.contracts.study_lessons import LessonCommand
from trainer.models import OpeningStudy, StudyLessonProgress
from trainer.opening_studies.sources import course_key
from trainer.study_lessons.bundled import BundledCourses
from trainer.study_lessons.content import Position
from trainer.study_lessons.player import enter_step, initial_state, transition
from trainer.study_lessons.queries import fingerprint

BASE = "/api/study/lesson-sessions"
COURSE_IDS = (
    "italian-foundations",
    "italian-black-foundations",
    "kings-gambit-foundations",
)


def installed_course(course_id):
    return next(course for course in BundledCourses().courses(None) if course.id == course_id)


def pilot():
    return installed_course("italian-foundations")


def start(client, course, chapter):
    return response_json(
        client.post(
            BASE,
            json={
                "request_id": f"{course.id}-{chapter.id}",
                "course_id": course.id,
                "course_revision": course.revision,
                "chapter_id": chapter.id,
            },
        )
    )


def logical(state):
    return {
        key: state[key]
        for key in ("fen", "history", "step", "branch", "game", "feedback", "status")
    }


def inspect_source_game(client, state, source):
    anchor = logical(state)
    state = command(client, state, "open_game")
    assert state["game"]["total_plies"] == len(source.position.moves) + len(source.moves)
    assert state["game"]["attributions"]
    for ply in (0, len(source.position.moves) + len(source.moves)):
        state = command(client, state, "game_seek", ply=ply)
        expected = Position(
            initial_fen=source.position.initial_fen,
            moves=(*source.position.moves, *source.moves)[:ply],
        )
        assert state["fen"] == expected.board().fen()
        reloaded = response_json(client.get(f"{BASE}/{state['id']}"))
        assert logical(reloaded) == logical(state)
        assert reloaded["playback"] == []
    state = command(client, state, "close_game")
    assert logical(state) == anchor
    return state


def walk_chapter(client, course, chapter):
    state = start(client, course, chapter)
    assert state["orientation"] == course.learner_color
    seen, explored, source_games = set(), set(), set()
    branch_anchor = None
    for _ in range(300):
        if state["status"] == "completed":
            return state, seen, source_games
        step = chapter.step(state["step"]["id"])
        seen.add(step.id)
        if step.kind == "branch" and state["branch"] is None and step.id not in explored:
            explored.add(step.id)
            branch_anchor = logical(state)
            state = command(client, state, "enter_branch")
            continue
        if (
            state["branch"]
            and "continue" not in state["actions"]
            and "move" not in state["actions"]
        ):
            state = command(client, state, "return_branch")
            assert logical(state) == branch_anchor
            branch_anchor = None
            continue
        if step.kind == "game_excerpt" and step.id not in source_games:
            source_games.add(step.id)
            state = inspect_source_game(client, state, course.game(step.game_id))
        if "move" in state["actions"]:
            assert chess.Board(state["fen"]).turn == (course.learner_color == "white")
            if step.kind == "decision":
                expected = step.choices[0].uci
                wrong = next(
                    (
                        move.uci()
                        for move in chess.Board(state["fen"]).legal_moves
                        if move.uci() not in {choice.uci for choice in step.choices}
                    ),
                    None,
                )
                if wrong:
                    original_fen = state["fen"]
                    state = command(client, state, "move", uci=wrong)
                    assert state["fen"] == original_fen
                    assert state["feedback"]["kind"] == "incorrect"
            else:
                line = course.line(step.line_id)
                cursor = len(state["history"]) - len(line.position.moves)
                expected = line.moves[cursor]
                assert state["step"]["text"] == "Play this line from memory."
                assert not state["step"]["annotations"]["arrows"]
                assert not state["step"]["annotations"]["squares"]
                assert "hint" not in state["actions"]
                assert not any(key in state for key in ("choices", "solution", "line"))
            state = command(client, state, "move", uci=expected)
            continue
        assert "continue" in state["actions"], state
        before = logical(state)
        after = command(client, state, "continue")
        if step.kind in {"demonstration", "game_excerpt"} and state["step"]["phase"] == "ready":
            playback = deepcopy(after["playback"])
            assert playback and playback[-1]["after_fen"] == after["fen"]
            reloaded = response_json(client.get(f"{BASE}/{after['id']}"))
            assert logical(reloaded) == logical(after) and reloaded["playback"] == []
            rewound = command(client, after, "back")
            assert logical(rewound) == before
            after = command(client, rewound, "continue")
            assert after["playback"] == playback
        state = after
    raise AssertionError(f"{course.id}/{chapter.id} failed to terminate")


def test_default_library_ships_reviewed_courses_and_explicit_empty_override_works(settings):
    course = pilot()
    assert "Italian" in course.title
    assert len(course.games) >= 3
    assert {step.kind for chapter in course.chapters for step in chapter.steps} == {
        "explanation",
        "demonstration",
        "decision",
        "branch",
        "game_excerpt",
        "rehearsal",
    }
    # Cached source must not become shared mutable state across accounts/requests.
    for course_id in COURSE_IDS:
        original = installed_course(course_id)
        copy = installed_course(course_id)
        copy.title = "Changed by a consumer"
        copy.chapters[0].title = "Changed nested chapter"
        assert installed_course(course_id).title == original.title
        assert installed_course(course_id).chapters[0].title == original.chapters[0].title
    with TestClient(create_app(settings, workers=False, start_engine=False)) as client:
        library = response_json(client.get("/api/study/courses"))
        assert {item["id"] for item in library["courses"]} == set(COURSE_IDS)
        assert all(item["completed_chapters"] == 0 for item in library["courses"])
    with TestClient(
        create_app(settings, workers=False, start_engine=False, lesson_providers=())
    ) as client:
        assert response_json(client.get("/api/study/courses")) == {"courses": [], "resume": []}


@pytest.mark.parametrize("course_id", COURSE_IDS)
def test_all_chapters_branches_games_rehearsal_and_progress_preserve_learning(settings, course_id):
    course = installed_course(course_id)
    app = create_app(settings, workers=False, start_engine=False)
    with TestClient(app) as client:
        # Protect existing positive review/skill evidence, not only an empty database.
        with app.state.sessions() as db:
            previous = seed_classified(db, settings, key="before-italian")
        cold = response_json(client.post(f"/api/review/{previous['exercise_id']}/start"))
        response_json(client.post(f"/api/review/sessions/{cold['session_id']}/reveal"))
        before = learning(app)
        completed_ids = []
        taught_games = set()
        for chapter in course.chapters:
            state, seen, excerpts = walk_chapter(client, course, chapter)
            completed_ids.append(state["id"])
            assert {step.id for step in chapter.steps if step.kind == "branch"} <= seen
            assert {step.id for step in chapter.steps if step.kind == "game_excerpt"} <= excerpts
            taught_games.update(chapter.step(step_id).game_id for step_id in excerpts)
        assert taught_games == {game.id for game in course.games}
        assert learning(app) == before
        assert response_json(client.get("/api/opening-studies"))["items"] == []
        library = response_json(client.get("/api/study/courses"))
        summaries = {item["id"]: item for item in library["courses"]}
        assert summaries[course.id]["completed_chapters"] == len(course.chapters)
        assert all(
            item["completed_chapters"] == 0 for key, item in summaries.items() if key != course.id
        )
        with app.state.sessions() as db:
            assert len(list(db.scalars(select(StudyLessonProgress)))) == len(course.chapters)
            assert not list(db.scalars(select(OpeningStudy)))
    # Installed source can be absent later; completed session snapshots still reopen.
    restarted = create_app(settings, workers=False, start_engine=False, lesson_providers=())
    with TestClient(restarted) as client:
        for session_id in completed_ids:
            saved = response_json(client.get(f"{BASE}/{session_id}"))
            assert saved["status"] == "completed" and saved["course_revision"] == course.revision


@pytest.mark.parametrize("course_id", COURSE_IDS)
def test_every_authored_accepted_choice_preserves_its_own_continuation(course_id):
    course = installed_course(course_id)
    for chapter in course.chapters:
        for step in chapter.steps:
            if step.kind != "decision":
                continue
            for choice in step.choices:
                before = initial_state(course, chapter)
                enter_step(course, chapter, before, step.id)
                played, frames = transition(
                    course,
                    chapter,
                    before,
                    LessonCommand(request_id="choice", revision=0, action="move", uci=choice.uci),
                )
                expected = step.position.after((choice.uci, *choice.reply))
                assert played["position"] == expected.model_dump(mode="json")
                assert frames[-1]["after_fen"] == expected.board().fen()
                advanced, _ = transition(
                    course,
                    chapter,
                    played,
                    LessonCommand(request_id="next", revision=1, action="continue"),
                )
                if choice.next_step is None:
                    assert advanced["status"] == "completed"
                else:
                    assert advanced["step_id"] == choice.next_step


@pytest.mark.parametrize("course_id", COURSE_IDS)
def test_enrollment_is_explicit_and_only_designated_lines_enter_due(settings, course_id):
    course = installed_course(course_id)
    app = create_app(settings, workers=False, start_engine=False)
    with TestClient(app) as client:
        assert response_json(client.get("/api/review/count"))["due"] == 0
        for line in course.lines:
            path = f"/api/openings/course-lines/{course.id}/{line.id}?revision={course.revision}"
            response = client.get(path)
            if not line.repertoire:
                assert response.status_code == 422
                continue
            preview = response_json(response)
            study = response_json(
                client.post(
                    "/api/opening-studies",
                    json={
                        "source": "course_line",
                        "source_key": course_key(course.id, line.id),
                        "source_version": course.revision,
                        "course_id": course.id,
                        "line_id": line.id,
                        "color": course.learner_color,
                    },
                )
            )
            assert study["line"] == preview["line"]
            assert study["line"]["moves"] == list((*line.position.moves, *line.moves))
            assert study["positions"] > 0
            assert study["color"] == course.learner_color
        assert response_json(client.get("/api/review/count"))["due"] > 0
        assert all(
            item["completed_chapters"] == 0
            for item in response_json(client.get("/api/study/courses"))["courses"]
        )


def test_illustrative_passages_support_their_specific_board_claims():
    course = pilot()
    assert {game.id: len(game.moves) for game in course.games} == {
        "mason-lasker": 163,
        "steinitz-bardeleben": 49,
        "pollock-schiffers": 88,
    }

    def board(game_id, ply):
        game = course.game(game_id)
        return game.position.after(game.moves[:ply]).board()

    quiet = board("mason-lasker", 14)
    assert quiet.piece_at(chess.E3) == chess.Piece(chess.PAWN, chess.WHITE)
    assert quiet.piece_at(chess.E4) == chess.Piece(chess.PAWN, chess.WHITE)
    assert not quiet.pieces(chess.PAWN, chess.WHITE) & chess.BB_FILES[chess.FILE_NAMES.index("f")]
    central = board("steinitz-bardeleben", 12)
    assert central.piece_at(chess.D4) == chess.Piece(chess.PAWN, chess.WHITE)
    assert central.piece_at(chess.E4) == chess.Piece(chess.PAWN, chess.WHITE)
    assert board("steinitz-bardeleben", 18).king(chess.WHITE) == chess.G1
    finish = board("steinitz-bardeleben", 49)
    assert finish.piece_at(chess.H7) == chess.Piece(chess.ROOK, chess.WHITE)
    assert finish.is_check() and not finish.is_checkmate()
    sharp = board("pollock-schiffers", 6)
    assert sharp.piece_at(chess.F6) == chess.Piece(chess.KNIGHT, chess.BLACK)
    assert chess.F6 in sharp.attackers(chess.BLACK, chess.E4)
    castled = board("pollock-schiffers", 20)
    assert castled.king(chess.WHITE) == chess.G1 and castled.king(chess.BLACK) == chess.C8


@pytest.mark.parametrize(
    "course_id, revision, content_hash",
    (
        (
            "italian-foundations",
            "2026-10-v3",
            "37297b889f502b07663ee9556b3a31d9b4d806c846fba97d3e02897b7312b9c1",
        ),
        (
            "italian-black-foundations",
            "2026-10-v4",
            "649aefe41f847410274f4c3788f5ee6d46974232cb152135ffa778e631ef35dc",
        ),
        (
            "kings-gambit-foundations",
            "2026-10-v5",
            "1b46ad40f6ff90e0692a10e077bd24b7020372537a60384fded9b9acba89eb77",
        ),
    ),
)
def test_published_curriculum_revisions_keep_their_content_identity(
    course_id, revision, content_hash
):
    # Intentional edits require a new revision and hash together. A refactor must
    # not silently change content already saved under a published revision.
    course = installed_course(course_id)
    assert course.revision == revision
    assert fingerprint(course) == content_hash
