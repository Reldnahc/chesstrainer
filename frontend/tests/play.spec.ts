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
    const value = ply === 1 ? report("e4", "e2e4", "Best", 30) : report("e5", "e7e5", "Good", 20);
    await route.fulfill({json: {report: value, score: value.white_score, best_move: null}});
  });
}

test("the setup page explains the measured level and starts a live game", async ({page}) => {
  await mockPlay(page);
  await page.goto("/play");
  await expect(page.getByRole("heading", {name: "Play Walter"})).toBeVisible();
  await expect(page.getByText("Measured from 60 of your own decisions across 100 imported games, where you were rated 723.")).toBeVisible();
  // Switching opponent keeps the form's height and the rows below it in place.
  const layout = () => page.evaluate(() => [document.querySelector(".play-setup-form")!.getBoundingClientRect().height,
    document.querySelector('[aria-label="Your color"]')!.getBoundingClientRect().top]);
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

test("the coach comments on the move before the bot answers it", async ({page}) => {
  await mockPlay(page);
  await page.goto("/play/play1");
  await page.locator('[data-square="e2"]').first().click();
  await page.locator('[data-square="e4"]').first().click();
  // The learner's move shows at once with its grade; the answer waits for the coach.
  await expect(page.locator(".game-move-list")).toContainText("e4");
  await expect(page.locator(".coach-quality-name")).toHaveText("Best");
  await expect(page.getByText("Walter is thinking…")).toBeVisible();
  await expect(page.locator(".game-move-list")).not.toContainText("e5");
  await expect(page.locator(".game-move-list")).toContainText("e5", {timeout: 10000});
  await expect(page.locator(".coach-quality-name")).toHaveText("Good");
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
