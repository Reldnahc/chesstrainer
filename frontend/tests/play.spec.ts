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
  fallback_plies: [] as number[], fallback_elo: 1320 as number | null,
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
    status: "ready", human_model: true, fitted_rating: 1000, platform_rating: 723, platform: "chesscom", positions: 60, games: 100,
    computed_at: "2026-10-03T00:00:00Z", default_rating: 1000,
  }}));
  await page.route("**/api/play/active", route => route.fulfill({json: {game: null}}));
  await page.route("**/api/play", route => route.request().method() === "POST"
    ? route.fulfill({json: state()}) : route.continue());
  await page.route("**/api/play/play1", route => route.fulfill({json: state()}));
  await page.route("**/api/play/play1/move", async route => {
    const body = route.request().postDataJSON() as {ply: number; uci: string};
    expect(body).toEqual({ply: 0, uci: "e2e4", rewind: false});
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
    document.querySelector('[aria-labelledby="play-color"]')!.getBoundingClientRect().top + window.scrollY]);
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

test("the setup waits for the game in progress so the callout does not push it down", async ({page}) => {
  await mockPlay(page);
  let answer: () => void = () => undefined;
  const answered = new Promise<void>(resolve => { answer = resolve; });
  await page.route("**/api/play/active", async route => {
    await answered;
    await route.fulfill({json: {game: {...base, frames: [frame0]}}});
  });
  await page.goto("/play");
  await expect(page.getByRole("heading", {name: "Play Walter"})).toBeVisible();
  await expect(page.getByRole("region", {name: "Game setup"})).toHaveCount(0);
  answer();
  await expect(page.getByRole("region", {name: "Game in progress"})).toBeVisible();
  await expect(page.getByRole("region", {name: "Game setup"})).toBeVisible();
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

test("a failed bot reply can be asked for again, and the game carries on", async ({page}) => {
  await mockPlay(page);
  let replies = 0;
  await page.route("**/api/play/play1/reply", async route => {
    if (++replies === 1) return route.fulfill({status: 503, json: {detail: "The bot is unavailable."}});
    await route.fallback();
  });
  await page.goto("/play/play1");
  await page.locator('[data-square="e2"]').first().click();
  await page.locator('[data-square="e4"]').first().click();
  const banners = page.getByRole("region", {name: "Notifications"});
  await expect(banners).toContainText("The bot is unavailable.");
  await banners.getByRole("button", {name: "Try again"}).click();
  await expect(page.locator(".game-move-list")).toContainText("e5", {timeout: 5000});
  await expect(page.getByText("The bot is unavailable.")).toHaveCount(0);
  expect(replies).toBe(2);
});

test("Try again waits for a running command, and a resigned game stays finished", async ({page}) => {
  await mockPlay(page);
  let replies = 0;
  await page.route("**/api/play/play1/reply", async route => {
    replies += 1;
    await route.fulfill({status: 503, json: {detail: "The bot is unavailable."}});
  });
  let release = () => {};
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/play/play1/resign", async route => {
    await held;
    await route.fulfill({json: {...base, status: "finished", result: "0-1", termination: "resignation", frames: [frame0, frame1]}});
  });
  await page.goto("/play/play1");
  await page.locator('[data-square="e2"]').first().click();
  await page.locator('[data-square="e4"]').first().click();
  const banners = page.getByRole("region", {name: "Notifications"});
  await expect(banners).toContainText("The bot is unavailable.");
  await page.getByRole("button", {name: "Resign"}).click();
  // While the resign is in flight, a retried reply could land on the finished game.
  await expect(banners.getByRole("button", {name: "Try again"})).toBeDisabled();
  release();
  await expect(banners).toContainText("You resigned. Walter takes the game.");
  await expect(page.getByText("The bot is unavailable.")).toHaveCount(0);
  await expect(page.getByRole("button", {name: "Resign"})).toHaveCount(0);
  expect(replies).toBe(1);
});

test("an analysis failure belongs to its own move, and saved reports are not asked for again", async ({page}) => {
  await mockPlay(page);
  const asked: number[] = [];
  let failing = true;
  await page.route("**/api/play/play1/analyze", async route => {
    const {ply} = route.request().postDataJSON() as {ply: number};
    asked.push(ply);
    if (ply === 1 && failing) return route.fulfill({status: 503, json: {detail: "Engine unavailable for e4."}});
    await route.fallback();
  });
  await page.goto("/play/play1");
  await page.locator('[data-square="e2"]').first().click();
  await page.locator('[data-square="e4"]').first().click();
  // The failed grade still lets the reply through; the next move's grade is its own.
  await expect(page.locator(".game-move-list")).toContainText("e5", {timeout: 5000});
  await expect(page.locator(".coach-quality-name")).toHaveText("Good", {timeout: 10000});
  await expect(page.getByRole("button", {name: "Retry analysis"})).toHaveCount(0);
  await page.keyboard.press("ArrowLeft");
  failing = false;
  await page.getByRole("button", {name: "Retry analysis"}).click();
  await expect(page.locator(".coach-quality-name")).toHaveText("Best");
  expect(asked.filter(ply => ply === 2)).toEqual([2]);
  // Reloading reads the reports the game saved instead of grading the moves again.
  asked.length = 0;
  await page.route("**/api/play/play1", route => route.fulfill({json: {...base,
    frames: [frame0, {...frame1, report: report("e4", "e2e4", "Best", 30)}, {...frame2, report: report("e5", "e7e5", "Good", 20)}]}}));
  await page.reload();
  await expect(page.locator(".coach-quality-name")).toHaveText("Good");
  expect(asked).toEqual([]);
});

test("playing a move from an earlier position replaces the rest of the game", async ({page}) => {
  const AFTER_D4 = "rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1";
  const start = {...frame0, ...position(START, "white", [{from_square: "e2", to_square: "e4"}, {from_square: "d2", to_square: "d4"}])};
  const d4 = {...position(AFTER_D4, "black", []), san: "d4", uci: "d2d4", number: 1, actor: "white", report: null};
  let frames = [start, frame1, frame2];
  await mockPlay(page);
  const bodies: unknown[] = [];
  await page.route("**/api/play/play1", route => route.fulfill({json: {...base, frames}}));
  await page.route("**/api/play/play1/move", async route => {
    bodies.push(route.request().postDataJSON());
    frames = [start, d4];
    await route.fulfill({json: {...base, frames}});
  });
  // The bot is slow to answer, so the rewound game is seen before its reply.
  await page.route("**/api/play/play1/reply", () => undefined);
  await page.route("**/api/play/play1/analyze", async route => {
    const {ply} = route.request().postDataJSON() as {ply: number};
    const value = ply === 1 ? report(frames[1].san, frames[1].uci!, "Best", 30) : report("e5", "e7e5", "Good", 20);
    await route.fulfill({json: {report: value, score: value.white_score, best_move: null}});
  });
  await page.goto("/play/play1");
  await expect(page.getByRole("group", {name: "Game move playback"})).toContainText("2 / 2");
  // Back on a position where it was the learner's move, the board takes a move.
  await page.getByRole("button", {name: "Start of game"}).click();
  await expect(page.getByText("Moving replaces the rest")).toBeVisible();
  // One move back is the bot's turn: nothing to play there.
  await page.getByRole("button", {name: "Next move"}).click();
  await expect(page.getByText("Moving replaces the rest")).toHaveCount(0);
  await page.getByRole("button", {name: "Previous move"}).click();
  await page.locator('[data-square="d2"]').first().click();
  await page.locator('[data-square="d4"]').first().click();
  await expect(page.locator(".game-move-list")).toContainText("d4");
  await expect(page.locator(".game-move-list")).not.toContainText("e5");
  expect(bodies).toEqual([{ply: 0, uci: "d2d4", rewind: true}]);
  await expect(page.getByRole("group", {name: "Game move playback"})).toContainText("1 / 1");
  await expect(page.getByText("Walter is thinking…")).toBeVisible();
});

test("a game that fails to load offers Try again", async ({page}) => {
  await mockPlay(page);
  let loads = 0;
  await page.route("**/api/play/play1", async route => {
    if (++loads === 1) return route.fulfill({status: 503, json: {detail: "The server is busy."}});
    await route.fallback();
  });
  await page.goto("/play/play1");
  await expect(page.getByText("Couldn’t load the game.")).toBeVisible();
  await page.getByRole("button", {name: "Try again", exact: true}).click();
  await expect(page.getByText("Your move")).toBeVisible();
  expect(loads).toBe(2);
});

test("a finished game offers its saved review", async ({page}) => {
  await page.route("**/api/play/play1", route => route.fulfill({json: {
    ...base, status: "finished", result: "0-1", termination: "resignation", saved_game_id: "saved9",
    frames: [frame0, frame1, frame2],
  }}));
  await page.goto("/play/play1");
  // The result is the page banner; it stays while the game is shown, with no close button.
  const banner = page.getByRole("region", {name: "Notifications"}).getByRole("status");
  await expect(banner).toContainText("You resigned. Walter takes the game.");
  await expect(banner.getByRole("link", {name: "Open Walter's review"})).toHaveAttribute("href", "/games/saved9");
  await expect(banner.getByRole("button", {name: "Dismiss"})).toHaveCount(0);
  await expect(page.getByRole("button", {name: "Resign"})).toHaveCount(0);
});

test("without the human move model the setup offers only the engine", async ({page}) => {
  await mockPlay(page);
  await page.route("**/api/play/profile", route => route.fulfill({json: {
    status: "unavailable", human_model: false, fitted_rating: null, platform_rating: null, platform: null, positions: 0,
    games: 100, computed_at: null, default_rating: 1200,
  }}));
  await page.goto("/play");
  await expect(page.getByRole("button", {name: "Human-like"})).toBeDisabled();
  await expect(page.getByRole("button", {name: "Engine"})).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Human-like play needs the human move model, which is not available.")).toBeVisible();
  await expect(page.getByRole("slider", {name: "Opponent rating"})).toHaveAttribute("min", "1800");
  const started = page.waitForRequest(request => request.url().endsWith("/api/play") && request.method() === "POST");
  await page.getByRole("button", {name: "Play Walter"}).click();
  expect((await started).postDataJSON()).toMatchObject({opponent: "engine", rating: 1800});
});

test("a reply the engine played for the human model says so", async ({page}) => {
  await page.route("**/api/play/play1", route => route.fulfill({json: {
    ...base, fallback_plies: [2], frames: [frame0, frame1, frame2],
  }}));
  await page.goto("/play/play1");
  await expect(page.getByRole("region", {name: "Notifications"}).getByRole("status"))
    .toContainText("1 of Walter's moves came from Stockfish at Elo 1320, because the human move model was unavailable.");
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
    status: "ready", human_model: true, fitted_rating: 1000, platform_rating: null, platform: null, positions: 60, games: 100,
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
  // Choosing practice enables the course picker in place: the rows below it do not move.
  await expect(page.getByLabel("Walter says")).toBeVisible();
  await expect(page.getByLabel("Course to practice")).toBeDisabled();
  const layout = () => page.evaluate(() => [document.querySelector(".play-setup-form")!.getBoundingClientRect().height,
    document.querySelector('[aria-labelledby="play-opponent"]')!.getBoundingClientRect().top + window.scrollY]);
  const before = await layout();
  await page.getByRole("button", {name: "Practice an opening"}).click();
  await expect(page.getByLabel("Course to practice")).toBeEnabled();
  expect(await layout()).toEqual(before);
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
