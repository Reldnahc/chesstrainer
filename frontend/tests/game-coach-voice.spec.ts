import {expect, test, type Page} from "@playwright/test";
import {humanGames} from "./human-fixtures";
import type {Game} from "../src/gameReview/types";

import {captureSpeech, speechActivity} from "./helpers/speech";
import {selectGameOpener} from "../src/audio/speech/gameSelection";
import walterBank from "../src/audio/speech/bank/manifest.json" with {type: "json"};

const walterOpener = walterBank.recordings.some(recording => recording.id === "game-review-opened");

async function voiceGame(page: Page, game: Game, ply: number, voice = "automatic") {
  await captureSpeech(page);
  await page.route("**/api/preferences/coach", route => route.fulfill({json: {coach_id: "classic", motion: "natural"}}));
  await page.route("**/api/preferences/audio", route => route.fulfill({json: {
    enabled: true, volume: .35, board: false, practice: false, voice,
  }}));
  await page.route(`**/api/games/${game.id}`, route => route.fulfill({json: game}));
  await page.route(`**/api/games/${game.id}/review`, route => route.fulfill({json: {job_id: game.job!.id, status: "completed"}}));
  await page.goto(`/games/${game.id}?ply=${ply}`);
  await expect(page.locator(".move-playback-counter")).toHaveText(`${ply} / 1`);
  await expect(page.locator(".coach-avatar")).toHaveAttribute("data-coach", "classic");
}

test("game voice follows deliberate navigation and stays silent on initial load, flip and reload", async ({page}) => {
  await voiceGame(page, humanGames.unusual_strong, 1);
  await expect(page.getByRole("button", {name: "Listen to coach", exact: true})).toBeVisible();
  // One move offers one spoken line, never a second Listen control beside it.
  await expect(page.locator(".coach-label").getByRole("button", {name: /^Listen to /})).toHaveCount(1);
  expect((await speechActivity(page)).started).toEqual([]);
  await page.getByRole("button", {name: "Previous move", exact: true}).click();
  await page.getByRole("button", {name: "Next move", exact: true}).click();
  await expect.poll(async () => (await speechActivity(page)).started.length).toBe(1);
  // The bubble shows the opening and the Maia reading, so the move speaks their one combined clip.
  expect((await speechActivity(page)).started[0]).toContain("/combo-recognized-opening-unusual-strong-");
  await page.getByRole("button", {name: "Flip board", exact: true}).click();
  await page.waitForTimeout(400);
  expect((await speechActivity(page)).started).toHaveLength(1);
  await page.reload();
  await expect(page.getByRole("button", {name: "Listen to coach", exact: true})).toBeVisible();
  expect((await speechActivity(page)).started).toEqual([]);
});

test("a later background report does not narrate an earlier visit to an unreviewed move", async ({page}) => {
  const game = structuredClone(humanGames.unusual_strong), report = game.frames[1].report!;
  game.frames[1].report = null;
  game.job = {...game.job!, status: "running", completed: 0};
  let release = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route(`**/api/games/${game.id}/review?**`, async route => {
    await gate;
    await route.fulfill({json: {moves: [{ply: 1, report}], accuracy: null,
      job: {...game.job!, status: "completed", completed: 1}}});
  });
  try {
    await voiceGame(page, game, 0);
    await page.getByRole("button", {name: "Next move", exact: true}).click();
    await expect(page.locator(".move-playback-counter")).toHaveText("1 / 1");
    expect((await speechActivity(page)).started).toEqual([]);
    release();
    await expect(page.getByRole("button", {name: "Listen to coach", exact: true})).toBeVisible();
    await page.waitForTimeout(400);
    expect((await speechActivity(page)).started).toEqual([]);
  } finally { release(); }
});

test("human insight narration needs an explicit press and closing its popover stops it", async ({page}) => {
  await voiceGame(page, humanGames.unusual_strong, 1);
  await page.getByRole("button", {name: "Maia: Unusual but strong", exact: true}).click();
  const insight = page.getByRole("dialog", {name: "Maia insight"});
  await expect(insight).toBeVisible();
  await expect(insight.getByRole("button", {name: "Listen to human-move insight", exact: true})).toBeVisible();
  expect((await speechActivity(page)).started).toEqual([]);
  await insight.getByRole("button", {name: "Listen to human-move insight", exact: true}).click();
  await expect.poll(async () => (await speechActivity(page)).started.length).toBe(1);
  expect((await speechActivity(page)).started[0]).toContain("/human-unusual-strong-");
  await page.keyboard.press("Escape");
  await expect(insight).not.toBeVisible();
  await expect.poll(async () => (await speechActivity(page)).stopped.length).toBeGreaterThan(0);
  await page.getByRole("button", {name: "Maia: Unusual but strong", exact: true}).click();
  await page.waitForTimeout(400);
  expect((await speechActivity(page)).started).toHaveLength(1);
});

test("a variation waits for its own analysis and leaving it cancels the pending narration", async ({page}) => {
  const game = humanGames.unusual_strong;
  let release = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route(`**/api/games/${game.id}/position`, route => route.fulfill({json: game.frames[1]}));
  await page.route(`**/api/games/${game.id}/analyze`, async route => {
    await gate;
    await route.fulfill({json: {report: game.frames[1].report, score: game.frames[1].report!.white_score,
      best_move: game.frames[1].report!.best.san}});
  });
  try {
    await voiceGame(page, game, 0);
    const requested = page.waitForRequest(request => request.url().endsWith("/analyze"));
    await page.locator('.board-shell [data-square="e2"]').click();
    await page.locator('.board-shell [data-square="e4"]').click();
    await requested;
    await expect(page.getByText("Exploring a variation", {exact: true})).toBeVisible();
    expect((await speechActivity(page)).started).toEqual([]);
    await page.getByRole("button", {name: "Return to game", exact: true}).click();
    await expect(page.getByText("Original game", {exact: true})).toBeVisible();
    release();
    await page.waitForTimeout(400);
    expect((await speechActivity(page)).started).toEqual([]);
    await page.locator(".game-variation-row button").last().click();
    await expect.poll(async () => (await speechActivity(page)).started.length).toBe(1);
    // The variation's own report carries the Maia reading, so it speaks the combined line.
    expect((await speechActivity(page)).started[0]).toContain("/combo-book-opening-entry-3-unusual-strong-");
  } finally { release(); }
});

test("only an untouched review at the start selects the fact-free opener", () => {
  const game = humanGames.unusual_strong, frame = game.frames[0], report = game.frames[1].report;
  expect(selectGameOpener({opening: true, ply: 0, frame})).toBe("game-review-opened");
  for (const context of [
    {opening: false, ply: 0, frame}, {opening: true, ply: 1, frame}, {opening: true, ply: 0, frame, variation: true},
    {opening: true, ply: 0, frame, report}, {opening: true, ply: 0, frame, error: true}, {opening: true, ply: 0, frame: null},
    {opening: true, ply: 0, frame: {...frame, termination: "checkmate"}},
  ]) expect(selectGameOpener(context)).toBeNull();
});

test("a fresh review greets once and the first move replaces the greeting", async ({page}) => {
  test.skip(!walterOpener, "Walter's game-review opener is written but not yet recorded.");
  const game = humanGames.unusual_strong;
  await captureSpeech(page);
  await page.route("**/api/preferences/coach", route => route.fulfill({json: {coach_id: "classic", motion: "natural"}}));
  await page.route("**/api/preferences/audio", route => route.fulfill({json: {
    enabled: true, volume: .35, board: false, practice: false, voice: "automatic",
  }}));
  await page.route(`**/api/games/${game.id}`, route => route.fulfill({json: game}));
  // A fresh document cannot autoplay. Open the review in-app after a real gesture,
  // as from the game library.
  await page.goto("/");
  await page.getByRole("heading", {level: 1}).first().click();
  await page.evaluate(href => {
    history.pushState(null, "", href);
    dispatchEvent(new PopStateEvent("popstate"));
  }, `/games/${game.id}?ply=0`);
  await expect(page.locator(".move-playback-counter")).toHaveText("0 / 1");
  await expect.poll(async () => (await speechActivity(page)).started.length).toBe(1);
  expect((await speechActivity(page)).started[0]).toContain("/game-review-opened-");
  await page.getByRole("button", {name: "Next move", exact: true}).click();
  await expect.poll(async () => (await speechActivity(page)).started.length).toBe(2);
  expect((await speechActivity(page)).started[1]).toContain("/combo-recognized-opening-unusual-strong-");
  await page.getByRole("button", {name: "Previous move", exact: true}).click();
  await page.waitForTimeout(400);
  expect((await speechActivity(page)).started).toHaveLength(2);
});
