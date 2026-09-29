"""Catalogue and authored repertoire lines share one explicit, pinned authority."""

import chess
import pytest
from fastapi import HTTPException
from study_lesson_fixtures import BrowserLessonProvider, connected_course
from trainer.contracts.opening_studies import OpeningEnrollment
from trainer.opening_book import VERSION
from trainer.opening_studies import catalogue, sources
from trainer.study_lessons.content import CourseDefinition, Position
from trainer.study_lessons.providers import CourseProviders


def test_bundled_catalogue_keeps_named_records_and_legal_complete_lines():
    records = catalogue.lines()
    assert len(records) > 3000
    assert len({line.source_key for line in records}) == len(records)
    for line in records:
        assert line.source == "lichess_catalogue" and line.source_version == VERSION
        assert line.moves and line.name and line.eco
        Position(initial_fen=line.initial_fen, moves=tuple(line.moves))
    french = [line for line in records if line.name == "French Defense"]
    assert len(french) >= 2  # Named catalogue records must not collapse into one endpoint.
    assert len({tuple(line.moves) for line in french}) == len(french)


def test_catalogue_resolution_rejects_other_revisions_and_returns_independent_data():
    original = catalogue.lines()[0]
    first = catalogue.get(original.source_key, VERSION)
    first.moves.append("0000")
    assert catalogue.get(original.source_key).moves == original.moves
    with pytest.raises(HTTPException) as error:
        catalogue.get(original.source_key, "future-catalogue")
    assert error.value.status_code == 404


def test_catalogue_search_pagination_and_detail_count_actual_decisions():
    result = catalogue.search(None, "italian", "c5", 0, 3)
    assert result.total > 3 and len(result.items) == 3
    next_page = catalogue.search(None, "Italian", "C5", 3, 3)
    assert next_page.total == result.total
    assert {row.source_key for row in result.items}.isdisjoint(
        row.source_key for row in next_page.items
    )
    for row in result.items:
        assert "italian" in row.name.casefold() and row.eco.startswith("C5")
        detail = catalogue.detail(None, row.source_key)
        assert row.white_positions + row.black_positions == row.plies
        assert len(detail.frames) == row.plies
        assert detail.white_positions == row.white_positions
        assert detail.black_positions == row.black_positions
    assert catalogue.search(None, "not-an-opening-fixture").total == 0


def test_preview_counts_respect_black_to_move_setup():
    line = catalogue.get(catalogue.lines()[0].source_key)
    board = chess.Board()
    board.push_uci("e2e4")
    line.initial_fen, line.moves = board.fen(), ["e7e5", "g1f3", "b8c6"]
    detail = sources.line_view(line)
    assert detail.white_positions == 1 and detail.black_positions == 2
    assert detail.frames[0].before_fen == board.fen()


def request_for(line, **changes):
    return OpeningEnrollment(
        **(
            {
                "source": line.source,
                "source_key": line.source_key,
                "source_version": line.source_version,
                "course_id": line.course_id,
                "line_id": line.line_id,
                "color": "white",
            }
            | changes
        )
    )


def test_course_line_can_be_independent_of_catalogue_and_keeps_full_setup_history(sessions):
    provider = BrowserLessonProvider()
    record = connected_course().model_dump(mode="json")
    # Rehearsal's line remains unchanged; this additional designated line has its
    # own known prelude and a deliberately non-catalogue display name.
    record["lines"].append(
        {
            "id": "custom-line",
            "title": "Independent course material",
            "position": {"initial_fen": chess.STARTING_FEN, "moves": ["e2e4", "e7e5"]},
            "moves": ["g1f3", "b8c6"],
            "repertoire": True,
        }
    )
    provider._accounts["local"] = {"connected": CourseDefinition.model_validate(record)}
    providers = CourseProviders((provider,))
    with sessions() as db:
        line = sources.course_line(db, providers, "connected", "fixture-v1", "custom-line")
        assert line.moves == ["e2e4", "e7e5", "g1f3", "b8c6"]
        assert line.initial_fen == chess.STARTING_FEN and line.eco is None
        assert line.source_version == "fixture-v1" and line.source == "course_line"
        assert sources.resolve_line(db, providers, request_for(line)) == line
        with pytest.raises(HTTPException) as error:
            sources.resolve_line(db, providers, request_for(line, source_key="wrong-line"))
        assert error.value.status_code == 422


@pytest.mark.parametrize("line_id", ["example-only", "fixture-game", "quiet-reply"])
def test_illustrative_games_and_undesignated_lines_cannot_become_repertoire(sessions, line_id):
    provider = BrowserLessonProvider()
    provider.install("local", "connected")
    with sessions() as db, pytest.raises(HTTPException) as error:
        sources.course_line(db, CourseProviders((provider,)), "connected", "fixture-v1", line_id)
    assert error.value.status_code in {404, 422}


def test_catalogue_enrollment_cannot_smuggle_course_identity():
    line = catalogue.lines()[0]
    with pytest.raises(HTTPException) as error:
        sources.resolve_line(None, None, request_for(line, course_id="connected"))
    assert error.value.status_code == 422
