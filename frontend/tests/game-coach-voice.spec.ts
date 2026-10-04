import {expect, test, type Page} from "@playwright/test";
import {humanGames} from "./human-fixtures";
import type {Game, Report} from "../src/gameReview/types";
import {gameIntent} from "../src/dialogue/gameIntent";
import {renderDialogue} from "../src/dialogue/neutral";
import {storyteller} from "../src/dialogue/characters/storyteller";

import {captureSpeech, speechActivity} from "./helpers/speech";
import {selectGameOpener, selectGameRecording} from "../src/audio/speech/gameSelection";
import walterBank from "../src/audio/speech/bank/manifest.json" with {type: "json"};
import pilotAdditions from "../src/audio/speech/banks/pilot-additions.json" with {type: "json"};

const walterOpener = walterBank.recordings.some(recording => recording.id === "game-review-opened");
// Coaches never speak a Maia (human-move model) reading, alone or combined.
const MAIA_AUDIO = /\/(?:human-|combo-|combined-)/;

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
  // The bubble and badge show the Maia reading, but the move speaks only its opening line.
  await expect(page.getByRole("button", {name: "Maia: Unusual but strong", exact: true})).toBeVisible();
  expect((await speechActivity(page)).started[0]).toContain("/recognized-opening-");
  expect((await speechActivity(page)).started[0]).not.toMatch(MAIA_AUDIO);
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
    // The variation's own report carries the Maia reading, which is shown but never spoken.
    expect((await speechActivity(page)).started[0]).toContain("/book-opening-entry-3-");
    expect((await speechActivity(page)).started[0]).not.toMatch(MAIA_AUDIO);
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

test("a game against the coach greets with its own line only before the first move", () => {
  const frame = humanGames.unusual_strong.frames[0];
  expect(selectGameOpener({ply: 0, frame, live: "new"})).toBe("game-start");
  expect(selectGameOpener({ply: 0, frame, live: "underway"})).toBeNull();
  expect(selectGameOpener({ply: 0, frame, live: "new", error: true})).toBeNull();
});

// The review line of a double check that a queen fork follows three moves
// later (backend output for 30...Nc2+ in the position below,
// the same shape as the reviewed 30...Nf5+ that was voiced as a fork).
function doubleCheckThenFork(forkPlies: number[]) {
  const fen = "rnbk1b2/pp4pp/1q1p4/3p4/3n4/2P1K1PP/PP6/3R4 b - - 0 30";
  const sans = ["Nc2+", "Kf3", "Qe3+", "Kg2", "Qe2+", "Kh1", "Qxd1+"];
  const score = {kind: "mate" as const, value: -7, mate_given: false};
  const actual = {uci: "d4c2", san: "Nc2+", score, depth: 20, pv: ["d4c2"]};
  const tactic = (id: string, index: number, motif: string, plies: number[]) => ({
    id, kind: "tactic" as const, actor: "black" as const, confidence: "line_witness" as const, importance: 65,
    facts: {role: "played", motif, plies, frame_ply: plies[0], verification: "verified_line",
      witness: plies.map(ply => ({ply, san: sans[ply - 1], capture: null, gives_check: true})),
      roles: {}, pieces: {}, squares: []},
    evidence: [{source: "stockfish" as const, id: "played", field: `actual_line/findings/${index}`},
      {source: "rule" as const, id: `rule-${motif}`, field: "verified_witness"}],
  });
  const report: Report = {label: "Best", engine_label: "Best", actual, best: actual, reason: "", coach: "",
    white_score: score, depth: 20, engine_version: "fixture", opening: null, board_cues: null,
    intelligence: {version: "move-events-4", input_digest: "double-check", ply: 1, clock: null, limitations: [],
      events: [tactic("double-check", 0, "double_attack", [1]), tactic("later-fork", 1, "fork", forkPlies)]}};
  const start = {fen, turn: "black" as const, uci: null, san: "Start", actor: null, number: 30,
    legal_moves: [], result: null, termination: null, report: null};
  const frame = {fen: "after-Nc2+", turn: "white" as const, uci: "d4c2", san: "Nc2+", actor: "black" as const,
    number: 30, legal_moves: [], result: null, termination: null, report};
  const game = {...humanGames.unusual_strong, id: "double-check-fork", orientation: "black" as const,
    frames: [start, frame], context: null} as unknown as Game;
  const intent = gameIntent({game, ply: 1, frame, report, key: "double-check", expression: "best"});
  const select = (code: string) => {
    const claim = intent.claims.find(item => item.code === "tactic_played" && item.sourceIds[0] === code)!;
    expect(claim).toBeTruthy();
    // Speak each witness as the move's whole line; the selector re-derives the full intent.
    const single = {...intent, claims: [claim]};
    const utterance = renderDialogue(single, {id: "classic", personality: storyteller});
    return selectGameRecording({game, ply: 1, frame, report, intent: single, utterance, anyCoach: true});
  };
  return {doubleCheck: select("double-check"), fork: select("later-fork")};
}

test("a fork later in the line is not voiced as the move's own fork", () => {
  // The double check itself is the move's tactic; the queen fork three moves on is not.
  expect(doubleCheckThenFork([5, 7])).toEqual({doubleCheck: "tactic-double-attack-played", fork: null});
  // A fork the move itself makes, collected later, still is.
  expect(doubleCheckThenFork([1, 3]).fork).toBe("tactic-fork-played");
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
  expect((await speechActivity(page)).started[1]).toContain("/recognized-opening-");
  expect((await speechActivity(page)).started[1]).not.toMatch(MAIA_AUDIO);
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
