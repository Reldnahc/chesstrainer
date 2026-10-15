import {expect, test, type Page} from "@playwright/test";
import {humanGames} from "./human-fixtures";
import type {Game, Report} from "../src/gameReview/types";
import {gameIntent} from "../src/dialogue/gameIntent";
import {renderDialogue} from "../src/dialogue/neutral";
import {storyteller} from "../src/dialogue/characters/storyteller";
import {expert} from "../src/dialogue/characters/expert";
import {newCastPersonalities} from "../src/dialogue/characters/newCast";
import type {DialogueCharacter} from "../src/dialogue/personality";

import {captureSpeech, speechActivity} from "./helpers/speech";
import {selectGameOpener, selectGameRecording, selectGameSpeech} from "../src/audio/speech/gameSelection";
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
type Witness = {id: string; motif: string; plies: number[]; roles?: Record<string, string[]>};
function reviewedTactics(witnesses: Witness[], coach: DialogueCharacter = {id: "classic", personality: storyteller}) {
  const fen = "rnbk1b2/pp4pp/1q1p4/3p4/3n4/2P1K1PP/PP6/3R4 b - - 0 30";
  const sans = ["Nc2+", "Kf3", "Qe3+", "Kg2", "Qe2+", "Kh1", "Qxd1+"];
  const score = {kind: "mate" as const, value: -7, mate_given: false};
  const actual = {uci: "d4c2", san: "Nc2+", score, depth: 20, pv: ["d4c2"]};
  const tactic = ({id, motif, plies, roles = {}}: Witness, index: number) => ({
    id, kind: "tactic" as const, actor: "black" as const, confidence: "line_witness" as const, importance: 65,
    facts: {role: "played", motif, plies, frame_ply: plies[0], verification: "verified_line",
      witness: plies.map(ply => ({ply, san: sans[ply - 1], capture: null, gives_check: true})),
      roles, pieces: {}, squares: []},
    evidence: [{source: "stockfish" as const, id: "played", field: `actual_line/findings/${index}`},
      {source: "rule" as const, id: `rule-${motif}`, field: "verified_witness"}],
  });
  const report: Report = {label: "Best", engine_label: "Best", actual, best: actual, reason: "", coach: "",
    white_score: score, depth: 20, engine_version: "fixture", opening: null, board_cues: null,
    intelligence: {version: "move-events-4", input_digest: "double-check", ply: 1, clock: null, limitations: [],
      events: witnesses.map(tactic)}};
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
    const utterance = renderDialogue(single, coach);
    return selectGameRecording({game, ply: 1, frame, report, intent: single, utterance, anyCoach: true});
  };
  return select;
}

function doubleCheckThenFork(forkPlies: number[]) {
  const select = reviewedTactics([{id: "double-check", motif: "double_attack", plies: [1]},
    {id: "later-fork", motif: "fork", plies: forkPlies}]);
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
  // Wait for the page and its audio preferences, as a user clicking in it would.
  const preferences = page.waitForResponse(response => response.url().endsWith("/api/preferences/audio"));
  await page.goto("/");
  await preferences;
  await expect(page.getByRole("heading", {level: 1})).toBeAttached();
  await page.locator("main").click({position: {x: 1, y: 1}});
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

test("a double check plays no double-attack take", () => {
  // A double check's witness names the king it checks: one target, and every legal
  // reply meets both checks, so neither "two targets" nor "one reply rarely meets both" holds.
  const doubleCheck = {id: "double-check", motif: "double_attack", plies: [1], roles: {attackers: ["c2", "d8"], king: ["e3"]}};
  const jun = {id: "man-expert", personality: expert};
  expect(reviewedTactics([doubleCheck])("double-check")).toBeNull();
  expect(reviewedTactics([doubleCheck], jun)("double-check")).toBeNull();
  // A double attack on two targets keeps the takes.
  const twoTargets = {...doubleCheck, roles: {attackers: ["c2", "d1"], targets: ["e3", "a1"]}};
  expect(reviewedTactics([twoTargets])("double-check")).toBe("tactic-double-attack-played");
  expect(reviewedTactics([twoTargets], jun)("double-check")).toBe("tactic-double-attack-played");
});

test("back-rank takes play for every coach", () => {
  const backRank = {id: "back-rank", motif: "back_rank", plies: [1], roles: {attacker: ["d1"], king: ["h1"], escape_blockers: ["g2", "h2"]}};
  // Walter's take says the king is boxed in by its own pieces, which holds.
  expect(reviewedTactics([backRank])("back-rank")).toBe("tactic-back-rank-played");
  // Jun's re-recorded take says the king is confined behind its own pieces.
  expect(reviewedTactics([backRank], {id: "man-expert", personality: expert})("back-rank")).toBe("tactic-back-rank-played");
});

// The learner's 3.Qxd8 takes the queen Black's 2nd move left; a punishment relation links them.
function punishedError(label: string, coach: DialogueCharacter,
  relationship: {kind: string; plies: number[]; facts: Record<string, unknown>; code: string} =
  {kind: "punishment", plies: [2, 3], facts: {outcome: "capitalized"}, code: "punishment"}) {
  const score = {kind: "cp" as const, value: 900, mate_given: false};
  const actual = {uci: "d1d8", san: "Qxd8", score, depth: 20, pv: ["d1d8"]};
  const evidence = [{source: "stockfish" as const, id: "punish-search", field: "candidate_search", ply: 3}];
  const report = {label: "Best", engine_label: "Best", actual, best: actual, reason: "", coach: "",
    white_score: score, depth: 20, engine_version: "fixture", opening: null, board_cues: null,
    intelligence: {version: "move-events-4", input_digest: "punish", ply: 3, clock: null, limitations: [], events: []}} as Report;
  const frame = (ply: number, san: string, actor: "white" | "black", frameReport: unknown) => ({fen: `after-${ply}`,
    turn: actor === "white" ? "black" : "white", uci: "a1a2", san, actor, number: Math.ceil(ply / 2),
    legal_moves: [], result: null, termination: null, report: frameReport});
  const frames = [{...frame(0, "Start", "black", null), actor: null, uci: null, turn: "white"},
    frame(1, "d4", "white", null), frame(2, "Qd8", "black", {label}), frame(3, "Qxd8", "white", report)];
  const game = {...humanGames.unusual_strong, id: "punished", orientation: "white", frames, context: {
    version: "game-context-1", input_digest: "context", complete: true, total_plies: 3, missing_plies: [],
    turning_points: [], biggest_swing_ply: null, limitations: [],
    nodes: [{ply: 3, actor: "white", input_digest: "punish", event_ids: [], before: score, after: score, evidence}],
    relationships: [{id: "punish-1", kind: relationship.kind, actor: "white", plies: relationship.plies, event_ids: [],
      facts: relationship.facts, evidence}]}} as unknown as Game;
  const intent = gameIntent({game, ply: 3, frame: game.frames[3], report, key: "punished", expression: "best"});
  const claim = intent.claims.find(item => item.code === relationship.code)!;
  expect(claim).toBeTruthy();
  const single = {...intent, claims: [claim]};
  const {primaryId, variants} = selectGameSpeech({game, ply: 3, frame: game.frames[3], report, intent: single,
    utterance: renderDialogue(single, coach), anyCoach: true});
  return {primaryId, takes: variants.primaryId?.split("|") ?? []};
}

test("a chance-taken take calling the error small sits out after a blunder", () => {
  // Celeste's base take says the opponent's move "held a small gift".
  const celeste = {id: "unicorn", personality: newCastPersonalities.unicorn};
  const afterMistake = punishedError("Mistake", celeste);
  expect(afterMistake.primaryId).toBe("chance-taken");
  expect(afterMistake.takes).toContain("chance-taken");
  const afterBlunder = punishedError("Blunder", celeste);
  expect(afterBlunder.primaryId).toBe("chance-taken");
  expect(afterBlunder.takes).not.toContain("chance-taken");
  expect(afterBlunder.takes).toEqual(expect.arrayContaining(["chance-taken-2", "chance-taken-3", "chance-taken-4"]));
  // Walter's takes say nothing of size, so all of them stay.
  expect(punishedError("Blunder", {id: "classic", personality: storyteller}).takes).toContain("chance-taken");
});

test("a recovery plays the assisted take after the other side's Mistakes", () => {
  // The learner's earlier Qd8 is reused as the setback; Qxd8 is the move after which it is playable again.
  const recovery = (help: boolean) => ({kind: "recovery", plies: [1, 3], code: "recovery",
    facts: {outcome: "playable_position", opponent_errors: help ? [2] : []}});
  const fergus = {id: "frog", personality: newCastPersonalities.frog};
  expect(punishedError("Mistake", fergus, recovery(false)).primaryId).toBe("recovery");
  expect(punishedError("Mistake", fergus, recovery(true)).primaryId).toBe("recovery-assisted");
  expect(punishedError("Mistake", {id: "classic", personality: storyteller}, recovery(true)).primaryId).toBe("recovery-assisted");
});
