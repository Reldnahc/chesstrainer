import {expect, test, type Page} from "@playwright/test";
import {humanGames} from "./human-fixtures";
import type {Game} from "../src/gameReview/types";

import {captureSpeech, speechActivity} from "./helpers/speech";
import {selectGameOpener} from "../src/audio/speech/gameSelection";
import walterBank from "../src/audio/speech/bank/manifest.json" with {type: "json"};
import pilotAdditions from "../src/audio/speech/banks/pilot-additions.json" with {type: "json"};

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

test("the human insight popover is silent and has no voice control", async ({page}) => {
  await voiceGame(page, humanGames.unusual_strong, 1);
  await page.getByRole("button", {name: "Maia: Unusual but strong", exact: true}).click();
  const insight = page.getByRole("dialog", {name: "Maia insight"});
  await expect(insight).toBeVisible();
  await expect(insight.getByRole("button", {name: /listen|stop/i})).toHaveCount(0);
  await page.waitForTimeout(400);
  expect((await speechActivity(page)).started).toEqual([]);
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

test("only the mainline start selects the fact-free opener", () => {
  const game = humanGames.unusual_strong, frame = game.frames[0], report = game.frames[1].report;
  expect(selectGameOpener({ply: 0, frame})).toBe("game-review-opened");
  for (const context of [
    {ply: 1, frame}, {ply: 0, frame, variation: true}, {ply: 0, frame, report}, {ply: 0, frame, error: true},
    {ply: 0, frame: null}, {ply: 0, frame: {...frame, termination: "checkmate"}},
  ]) expect(selectGameOpener(context)).toBeNull();
});

test("a fresh review greets, the first move replaces it and returning to the start greets again", async ({page}) => {
  test.skip(!walterOpener, "Walter's game-review opener is written but not yet recorded.");
  const game = humanGames.unusual_strong;
  await captureSpeech(page);
  await page.route("**/api/preferences/coach", route => route.fulfill({json: {coach_id: "classic", motion: "natural"}}));
  await page.route("**/api/preferences/audio", route => route.fulfill({json: {
    enabled: true, volume: .35, board: false, practice: false, voice: "automatic",
  }}));
  await page.route(`**/api/games/${game.id}`, route => route.fulfill({json: game}));
  // Opening a finished review restarts its session, as a real server accepts.
  await page.route(`**/api/games/${game.id}/review`, async route => {
    await new Promise(resolve => setTimeout(resolve, 100));
    await route.fulfill({json: {job_id: game.job!.id, status: "completed"}});
  });
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
  await page.waitForTimeout(400);
  expect((await speechActivity(page)).stopped).toHaveLength(0);
  // The bubble shows the spoken greeting, then the move's own text replaces it.
  const greeting = pilotAdditions.recordings.find(row => row.id === "game-review-opened")!.walterText;
  const bubble = page.locator(".coach-message > [data-utterance]");
  await expect(bubble).toHaveText(greeting);
  await page.getByRole("button", {name: "Next move", exact: true}).click();
  await expect(bubble).not.toHaveText(greeting);
  await expect.poll(async () => (await speechActivity(page)).started.length).toBe(2);
  expect((await speechActivity(page)).started[1]).toContain("/combo-recognized-opening-unusual-strong-");
  // The start keeps one line: returning there shows and speaks the greeting again.
  await page.getByRole("button", {name: "Previous move", exact: true}).click();
  await expect(bubble).toHaveText(greeting);
  await expect.poll(async () => (await speechActivity(page)).started.length).toBe(3);
  expect((await speechActivity(page)).started[2]).toContain("/game-review-opened-");
});

test("without a recorded greeting the start keeps its own bubble text", async ({page}) => {
  test.skip(walterOpener, "Walter's greeting is recorded; the greeting test covers the bubble.");
  await voiceGame(page, humanGames.unusual_strong, 0);
  await expect(page.locator(".coach-message > [data-utterance]"))
    .toHaveText("Select a move or move a piece to explore an alternative.");
});
