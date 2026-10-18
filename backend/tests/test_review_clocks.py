"""No guessed elapsed time across missing clocks, unsupported controls or branches."""

import io

import chess
import chess.pgn
import pytest
from trainer.review_intelligence.clocks import clock_facts
from trainer.review_intelligence.context import move_contexts


def game(moves, control="600+5", extra=""):
    headers = f'[TimeControl "{control}"]\n{extra}'.strip()
    return chess.pgn.read_game(io.StringIO(headers + "\n\n" + moves))


def test_increment_uses_previous_clock_of_same_player_and_explicit_sources():
    parsed = game(
        "1. e4 {[%clk 0:10:03]} e5 {[%clk 0:10:02]} 2. Nf3 {[%clk 0:08:20]} Nc6 {[%clk 0:09:59]} *"
    )
    clocks = clock_facts(parsed)
    assert [clocks[i].elapsed_seconds for i in range(1, 5)] == [2, 3, 108, 8]
    assert clocks[1].tempo == "fast_with_time"
    assert clocks[3].tempo == "long_think"
    assert clocks[3].before_seconds == 603 and clocks[4].before_seconds == 602
    assert clocks[1].before_source == "initial_control"
    assert clocks[3].before_source == "previous_clock"
    assert clocks[1].elapsed_source == "clock_delta"
    assert clocks[1].limitations == ["assumes_post_increment_clocks"]


@pytest.mark.parametrize("tag", ["[%clk 0:00:60]", "[%clk 0:00:01] [%clk 0:00:02]"])
def test_invalid_or_ambiguous_annotations_are_not_clock_facts(tag):
    result = clock_facts(game(f"1. e4 {{{tag}}} *"))[1]
    assert result.status == "invalid"
    assert result.after_seconds is result.before_seconds is result.elapsed_seconds is None
    assert result.before_band == "unknown"


def test_missing_turn_breaks_elapsed_chain_without_erasing_literal_remaining_clock():
    result = clock_facts(game("1. e4 {[%clk 0:00:08]} e5 2. Nf3 Nc6 3. Bc4 {[%clk 0:00:05]} *"))
    assert result[3].before_seconds == 8  # Supported even when this move's annotation is absent.
    assert result[3].elapsed_seconds is None and result[3].before_band == "critical"
    assert result[5].after_seconds == 5
    assert result[5].before_seconds is result[5].elapsed_seconds is None
    assert result[2].status == "absent"


@pytest.mark.parametrize("control", ["?", "600+NaN"])
def test_unsupported_elapsed_derivation_retains_annotations(control):
    result = clock_facts(game("1. e4 {[%clk 0:08:00]} e5 2. Nf3 {[%clk 0:07:20]} *", control))
    assert result[3].before_seconds == 480 and result[3].after_seconds == 440
    assert result[3].elapsed_seconds is None
    assert "elapsed_not_derivable_from_this_time_control" in result[3].limitations


def test_opening_departure_is_once_and_never_invented_for_a_setup_position():
    # The king walk leaves the Breyer and transposes back into it, which is not a
    # departure; the game leaves the catalogue for good only with 12. a3.
    contexts = move_contexts(
        game(
            "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3 Nb8 10. Kh2 Kh8 11. Kg1 Kg8 12. a3 *"
        )
    )
    departures = [context for context in contexts.values() if context.opening_departure]
    assert len(departures) == 1
    assert departures[0].ply == 23
    assert departures[0].opening_departure.previous_book_ply == 22
    parsed = game(
        "1. e4 *", extra=f'[SetUp "1"]\n[FEN "{chess.STARTING_FEN.replace("0 1", "0 5")}"]'
    )
    assert move_contexts(parsed)[1].opening_departure is None


@pytest.mark.stockfish
def test_imported_annotations_reach_review_and_survive_restart_without_leaking_into_branches(
    settings, stockfish_path
):
    from fastapi.testclient import TestClient
    from test_game_review import seed
    from trainer.api import create_app

    settings.stockfish_path = stockfish_path
    app = create_app(settings, workers=False)
    with TestClient(app) as client:
        game_id = seed(
            app,
            '[White "Learner"]\n[Black "Opponent"]\n[TimeControl "600"]\n\n1. f3 {[%clk 0:00:08]} e5 {[%clk 0:09:59]} 2. g4 {[%clk 0:00:05]} Qh4# 0-1',
        )
        job = client.post(f"/api/games/{game_id}/review", json={}).json()["job_id"]
        app.state.runner.run_job(job)
        detail = client.get(f"/api/games/{game_id}").json()
        intelligence = detail["frames"][3]["report"]["intelligence"]
        assert intelligence["clock"]["before_seconds"] == 8
        assert intelligence["clock"]["elapsed_seconds"] == 3
        assert any(
            e["kind"] == "clock_observation" and e["facts"]["accompanied_error"]
            for e in intelligence["events"]
        )
        branch = client.post(
            f"/api/games/{game_id}/analyze", json={"ply": 2, "moves": ["g2g4"]}
        ).json()
        assert branch["report"]["intelligence"]["clock"] is None
    settings.stockfish_path = "must-not-rerun-for-context"
    with TestClient(create_app(settings, workers=False, start_engine=False)) as client:
        restored = client.get(f"/api/games/{game_id}").json()
        assert restored["frames"][3]["report"]["intelligence"] == intelligence
