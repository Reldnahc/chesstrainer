import juniperScript from "../src/audio/speech/banks/juniper/scripts.json" with {type: "json"};
import {test, expect, type Page} from "@playwright/test";

// A live game against the coach's bot, served by mocked play endpoints so the
// spec needs no engine or human model. Board moves come from the server's frames.
const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const AFTER_E4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
const AFTER_E5 = "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2";

const position = (fen: string, turn: "white" | "black", legal: {from_square: string; to_square: string}[]) => ({
  fen, turn, result: null, termination: null,
  legal_moves: legal.map(move => ({...move, promotion: null, capture: false})),
});
const frame0 = {...position(START, "white", [{from_square: "e2", to_square: "e4"}]), san: "Start", uci: null, number: 1, actor: null, report: null};
const frame1 = {...position(AFTER_E4, "black", []), san: "e4", uci: "e2e4", number: 1, actor: "white", report: null};
const frame2 = {...position(AFTER_E5, "white", [{from_square: "d2", to_square: "d4"}]), san: "e5", uci: "e7e5", number: 1, actor: "black", report: null};

const base = {
  id: "play1", coach_id: "classic", coach_name: "Walter", white: "You", black: "Walter (bot)",
  learner_color: "white", opponent: "human", rating: 1000, learner_rating: 1000,
  white_rating: 1000, black_rating: 1000, status: "active",
  result: null, termination: null, saved_game_id: null, reply: null,
};

const report = (san: string, uci: string, label: string, value: number) => ({
  label, engine_label: label, opening: null, reason: "", coach: "", depth: 12, engine_version: "test",
  best: {uci, san, score: {kind: "cp", value}, pv: [uci], depth: 12},
  actual: {uci, san, score: {kind: "cp", value}, pv: [uci], depth: 12},
  white_score: {kind: "cp", value}, board_cues: null, immediate_reply: null, practical: null, intelligence: null, human: null,
  version: "test", before_analysis_id: "a", played_analysis_id: "a", second_score: null, previous_score: null,
  legal_count: 20, loss_cp: 0, sacrifice: null, opportunity_missed: false,
  actual_line: {frames: [], findings: [], material_delta: null, settled: false},
  best_line: {frames: [], findings: [], material_delta: null, settled: false},
});

async function mockPlay(page: Page) {
  let moves: string[] = [];
  const state = () => ({...base, frames: [frame0, ...(moves.length ? [frame1] : []), ...(moves.length > 1 ? [frame2] : [])]});
  await page.route("**/api/play/profile", route => route.fulfill({json: {
    status: "ready", fitted_rating: 1000, platform_rating: 723, platform: "chesscom", positions: 60, games: 100,
    computed_at: "2026-10-03T00:00:00Z", default_rating: 1000,
  }}));
  await page.route("**/api/play/active", route => route.fulfill({json: {game: null}}));
  await page.route("**/api/play", route => route.request().method() === "POST"
    ? route.fulfill({json: state()}) : route.continue());
  await page.route("**/api/play/play1", route => route.fulfill({json: state()}));
  await page.route("**/api/play/play1/move", async route => {
    const body = route.request().postDataJSON() as {ply: number; uci: string};
    expect(body).toEqual({ply: 0, uci: "e2e4"});
    moves = ["e2e4"];
    await route.fulfill({json: state()});
  });
  await page.route("**/api/play/play1/reply", async route => {
    expect(moves).toEqual(["e2e4"]);
    moves = ["e2e4", "e7e5"];
    await route.fulfill({json: {...state(), reply: {ply: 2, san: "e5", uci: "e7e5", source: "human"}}});
  });
  await page.route("**/api/play/play1/analyze", async route => {
    const {ply} = route.request().postDataJSON() as {ply: number};
    // Grading takes a moment, so the wait for it is visible.
    if (ply === 1) await new Promise(resolve => setTimeout(resolve, 1000));
    const value = ply === 1 ? report("e4", "e2e4", "Best", 30) : report("e5", "e7e5", "Good", 20);
    await route.fulfill({json: {report: value, score: value.white_score, best_move: null}});
  });
}

test("the setup page explains the measured level and starts a live game", async ({page}) => {
  await mockPlay(page);
  await page.goto("/play");
  await expect(page.getByRole("heading", {name: "Play Walter"})).toBeVisible();
  await expect(page.getByText("Measured from 60 of your own decisions across 100 imported games, where you were rated 723.")).toBeVisible();
  // Switching opponent keeps the form's height and the rows below it in place. Positions
  // are in the page, not the viewport: clicking a choice may scroll it into view on phones.
  // The invitation loads after the page; until it does the coach is a bare portrait of a
  // different height, so measure once it is in place.
  await expect(page.getByLabel("Walter says")).toBeVisible();
  const layout = () => page.evaluate(() => [document.querySelector(".play-setup-form")!.getBoundingClientRect().height,
    document.querySelector('[aria-label="Your color"]')!.getBoundingClientRect().top + window.scrollY]);
  const before = await layout();
  await page.getByRole("button", {name: "Engine"}).click();
  await expect(page.getByRole("slider", {name: "Opponent rating"})).toHaveAttribute("min", "1800");
  await expect(page.getByRole("button", {name: "Match my level"})).toBeDisabled();
  expect(await layout()).toEqual(before);
  await page.getByRole("button", {name: "Human-like"}).click();
  expect(await layout()).toEqual(before);
  await page.getByRole("button", {name: "Match my level"}).click();
  await page.getByRole("button", {name: "White", exact: true}).click();
  const started = page.waitForRequest(request => request.url().endsWith("/api/play") && request.method() === "POST");
  await page.getByRole("button", {name: "Play Walter"}).click();
  const body = (await started).postDataJSON();
  expect(body).toEqual({coach_id: "classic", coach_name: "Walter", color: "white", opponent: "human", rating: 1000});
  await expect(page).toHaveURL(/\/play\/play1$/);
  await expect(page.getByText("Your move")).toBeVisible();
  await expect(page.getByRole("button", {name: "Resign"})).toBeVisible();
  await expect(page.getByRole("button", {name: "Offer draw"})).toHaveCount(0);
  // No accuracy readout is reserved for a game in progress.
  await expect(page.locator(".review-board-meta .game-accuracy")).toHaveCount(0);
});

test("the bot answers once the move is graded while the coach finishes its line", async ({page}) => {
  await mockPlay(page);
  await page.goto("/play/play1");
  await page.locator('[data-square="e2"]').first().click();
  await page.locator('[data-square="e4"]').first().click();
  // The learner's move shows at once; the answer waits only for its grade.
  await expect(page.locator(".game-move-list")).toContainText("e4");
  await expect(page.getByText("Walter is thinking…")).toBeVisible();
  await expect(page.locator(".game-move-list")).not.toContainText("e5");
  await expect(page.locator(".coach-quality-name")).toHaveText("Best");
  await expect(page.locator(".game-move-list")).toContainText("e5", {timeout: 2000});
  // The coach stays on the learner's move for a moment after the reply lands.
  await expect(page.locator(".coach-quality-name")).toHaveText("Best");
  await expect(page.getByText("Your move")).toBeVisible();
  await expect(page.locator(".coach-quality-name")).toHaveText("Good", {timeout: 10000});
  await expect(page.getByText("Your move")).toBeVisible();
  await expect(page.getByRole("group", {name: "Game move playback"})).toContainText("2 / 2");
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator(".coach-quality-name")).toHaveText("Best");
  await expect(page.getByRole("group", {name: "Game move playback"})).toContainText("1 / 2");
});

test("a finished game offers its saved review", async ({page}) => {
  await page.route("**/api/play/play1", route => route.fulfill({json: {
    ...base, status: "finished", result: "0-1", termination: "resignation", saved_game_id: "saved9",
    frames: [frame0, frame1, frame2],
  }}));
  await page.goto("/play/play1");
  await expect(page.getByText("You resigned. Walter takes the game.")).toBeVisible();
  await expect(page.getByRole("link", {name: "Open Walter's review"})).toHaveAttribute("href", "/games/saved9");
  await expect(page.getByRole("button", {name: "Resign"})).toHaveCount(0);
});

test("the setup page's coach asks for a game in its own words", async ({page}, testInfo) => {
  await mockPlay(page);
  await page.route("**/api/preferences/coach", route => route.fulfill({json: {coach_id: "cat-black", motion: "still"}}));
  const line = juniperScript.records.find(record => record.id === "play-invitation")!.text;
  await page.goto("/play");
  await expect(page.getByLabel("Juniper says")).toContainText(line);
  // Phones show it in the same coach layout as review; desktop keeps the large portrait.
  await expect(page.locator(".play-setup-coach .review-coach")).toHaveCount(testInfo.project.name === "mobile" ? 1 : 0);
});

test("opening practice asks in the coach's bubble when the learner leaves the line", async ({page}) => {
  const book = {course_id: "italian", title: "Italian Game", status: "book", ended: null, deviation: null,
    book_moves: ["d2d4"]};
  const deviation = (verdict: string | null) => ({
    ply: 1, san: "e4", uci: "e2e4", book: ["d4"], verdict, loss_cp: verdict ? 120 : null,
    compared_with: verdict ? "d4" : null,
  });
  let practice: Record<string, unknown> = book;
  let moves: string[] = [];
  const requests: string[] = [];
  const state = (reply: unknown = null) => ({...base, reply, practice,
    frames: [frame0, ...(moves.length ? [frame1] : []), ...(moves.length > 1 ? [frame2] : [])]});
  await page.route("**/api/play/profile", route => route.fulfill({json: {
    status: "ready", fitted_rating: 1000, platform_rating: null, platform: null, positions: 60, games: 100,
    computed_at: "2026-10-03T00:00:00Z", default_rating: 1000,
  }}));
  await page.route("**/api/play/active", route => route.fulfill({json: {game: null}}));
  await page.route("**/api/play/openings", route => route.fulfill({json: {courses: [
    {id: "dragon", title: "Sicilian Dragon", learner_color: "black", lines: 29},
    {id: "italian", title: "Italian Game", learner_color: "white", lines: 13},
  ]}}));
  await page.route("**/api/play", route => route.request().method() === "POST"
    ? route.fulfill({json: state()}) : route.continue());
  await page.route("**/api/play/play1", route => route.fulfill({json: state()}));
  await page.route("**/api/play/play1/move", async route => {
    moves = ["e2e4"];
    practice = {...book, status: "deviation", deviation: deviation(null)};
    await route.fulfill({json: state()});
  });
  await page.route("**/api/play/play1/reply", async route => {
    requests.push("reply");
    if (practice.status === "deviation") {
      practice = {...practice, deviation: deviation("worse")};
      return route.fulfill({json: state()});
    }
    moves = ["e2e4", "e7e5"];
    await route.fulfill({json: state({ply: 2, san: "e5", uci: "e7e5", source: "human"})});
  });
  await page.route("**/api/play/play1/takeback", async route => {
    moves = [];
    practice = book;
    await route.fulfill({json: state()});
  });
  await page.route("**/api/play/play1/carry-on", async route => {
    practice = {...book, status: "ended", ended: "carried_on", book_moves: []};
    await route.fulfill({json: state()});
  });
  await page.route("**/api/play/play1/analyze", route => {
    const value = report("e4", "e2e4", "Good", 20);
    return route.fulfill({json: {report: value, score: value.white_score, best_move: null}});
  });

  await page.goto("/play");
  await page.getByRole("button", {name: "Practice an opening"}).click();
  // The course decides the side: the Dragon is Black's, so White cannot be chosen.
  await expect(page.getByRole("button", {name: "Black", exact: true})).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", {name: "White", exact: true})).toBeDisabled();
  await page.getByLabel("Course to practice").selectOption("italian");
  await expect(page.getByText("You play White.")).toBeVisible();
  const started = page.waitForRequest(request => request.url().endsWith("/api/play") && request.method() === "POST");
  await page.getByRole("button", {name: "Play Walter"}).click();
  expect((await started).postDataJSON()).toEqual({coach_id: "classic", coach_name: "Walter", color: "white",
    opponent: "human", rating: 1000, course_id: "italian"});
  await expect(page).toHaveURL(/\/play\/play1$/);
  await expect(page.getByText("Your move")).toBeVisible();
  // Nothing about the practice sits above the board; the book move is there on request.
  await expect(page.getByText(/Practicing/)).toHaveCount(0);
  // "Show book" sits with the coach's own actions.
  const showBook = page.locator(".coach-actions").getByRole("button", {name: "Show book"});
  await showBook.click();
  await expect(page.locator(".coach-actions").getByRole("button", {name: "Hide book"})).toHaveAttribute("aria-pressed", "true");

  const playE4 = async () => {
    await page.locator('[data-square="e2"]').first().click();
    await page.locator('[data-square="e4"]').first().click();
  };
  await playE4();
  // The move stays on the board and the coach's bubble asks; the bot waits.
  const bubble = page.locator(".play-practice-prompt");
  await expect(bubble).toContainText("That's not the line, and it costs you something.");
  await expect(bubble).toContainText("e4 gives up about 1.2 pawns against the book move.");
  await expect(page.locator(".game-move-list")).toContainText("e4");
  await expect(page.getByText("Walter is thinking…")).toHaveCount(0);
  await expect(page.getByText("Your move")).toHaveCount(0);
  await expect(page.locator(".coach-actions").getByRole("button", {name: "Show book"})).toBeVisible();
  await page.getByRole("button", {name: "Take back"}).click();
  await expect(page.getByText("Your move")).toBeVisible();
  await expect(page.locator(".game-move-list")).not.toContainText("e4");
  await expect(bubble).toHaveCount(0);

  await playE4();
  await page.getByRole("button", {name: "Play on"}).click();
  await expect(page.locator(".game-move-list")).toContainText("e5", {timeout: 10000});
  await expect(page.getByRole("button", {name: "Show book"})).toHaveCount(0);
  // Two comparisons, one per off-book move, then the usual reply.
  expect(requests.length).toBe(3);
});

test("at the end of the line the coach offers to keep playing or go again", async ({page}) => {
  const practice = {course_id: "italian", title: "Italian Game", status: "book_end", ended: null,
    deviation: null, book_moves: []};
  await page.route("**/api/play/play1", route => route.fulfill({json: {...base, practice,
    frames: [frame0, frame1, frame2]}}));
  await page.route("**/api/play/play1/analyze", route => {
    const value = report("e5", "e7e5", "Good", 20);
    return route.fulfill({json: {report: value, score: value.white_score, best_move: null}});
  });
  await page.route("**/api/play/play2", route => route.fulfill({json: {...base, id: "play2",
    practice: {...practice, status: "book", book_moves: ["e2e4"]}, frames: [frame0]}}));
  await page.route("**/api/play", route => route.fulfill({json: {...base, id: "play2", frames: [frame0]}}));
  await page.goto("/play/play1");
  await expect(page.locator(".play-practice-prompt")).toContainText("That's the end of the line. Keep playing, or go again?");
  await expect(page.getByRole("button", {name: "Keep playing"})).toBeVisible();
  await expect(page.getByText("Your move")).toHaveCount(0);
  const again = page.waitForRequest(request => request.url().endsWith("/api/play") && request.method() === "POST");
  await page.getByRole("button", {name: "Go again"}).click();
  expect((await again).postDataJSON()).toEqual({coach_id: "classic", coach_name: "Walter", color: "white",
    opponent: "human", rating: 1000, course_id: "italian"});
  await expect(page).toHaveURL(/\/play\/play2$/);
  await expect(page.getByText("Your move")).toBeVisible();
});

test("a new game after a finished one starts from that game's settings", async ({page}) => {
  await mockPlay(page);
  await page.route("**/api/play/openings", route => route.fulfill({json: {courses: [
    {id: "dragon", title: "Sicilian Dragon", learner_color: "black", lines: 29},
    {id: "italian", title: "Italian Game", learner_color: "white", lines: 13},
  ]}}));
  const finished = {...base, status: "finished", result: "1-0", termination: "resignation", saved_game_id: null,
    opponent: "engine", rating: 2000, learner_color: "black", frames: [frame0, frame1, frame2]};
  await page.route("**/api/play/play1", route => route.fulfill({json: finished}));
  await page.route("**/api/play/play2", route => route.fulfill({json: {...finished, id: "play2",
    opponent: "human", rating: 1000, learner_color: "white",
    practice: {course_id: "italian", title: "Italian Game", status: "ended", ended: "book_end", deviation: null, book_moves: []}}}));
  await page.goto("/play/play1");
  await page.getByRole("link", {name: "New game"}).first().click();
  await expect(page).toHaveURL(/\/play\?from=play1$/);
  await expect(page.getByRole("button", {name: "Engine"})).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("slider", {name: "Opponent rating"})).toHaveValue("2000");
  await expect(page.getByRole("button", {name: "Black", exact: true})).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", {name: "Any opening"})).toHaveAttribute("aria-pressed", "true");
  // A practice game brings back its course and the matched level.
  await page.goto("/play?from=play2");
  await expect(page.getByRole("button", {name: "Practice an opening"})).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Course to practice")).toHaveValue("italian");
  await expect(page.getByRole("button", {name: "Match my level"})).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", {name: "White", exact: true})).toHaveAttribute("aria-pressed", "true");
});
