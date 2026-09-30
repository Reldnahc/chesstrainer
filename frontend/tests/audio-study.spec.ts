import { expect, test, type Page } from "@playwright/test";
import type { Feedback, Schema } from "../src/api";
import type { AudioPreferences, SoundCue } from "../src/audio/model";
import { captureAudio, audioCues } from "./helpers/audio";

const preferences = new WeakMap<Page, { audio: AudioPreferences; motion: Schema["MotionPreferences"] }>();
const studies = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  preferences.set(page, {
    audio: await (await page.request.get("/api/preferences/audio")).json(),
    motion: await (await page.request.get("/api/preferences/motion")).json(),
  });
  expect((await page.request.put("/api/preferences/audio", { data: {
    enabled: true, volume: .4, board: true, practice: true, review: true,
  } })).ok()).toBe(true);
  expect((await page.request.put("/api/preferences/motion", { data: { motion: "still" } })).ok()).toBe(true);
  await captureAudio(page);
});

test.afterEach(async ({ page }) => {
  for (const id of studies.get(page) ?? []) {
    expect((await page.request.delete(`/api/opening-studies/${id}`)).ok()).toBe(true);
  }
  const original = preferences.get(page)!;
  expect((await page.request.put("/api/preferences/audio", { data: original.audio })).ok()).toBe(true);
  expect((await page.request.put("/api/preferences/motion", { data: original.motion })).ok()).toBe(true);
});

async function fixture(page: Page, kind: "puzzle" | "lesson", key: string) {
  const response = await page.request.post(`/__test/${kind}-fixture/audio-${key}`);
  expect(response.ok()).toBe(true);
  const { session_id }: { session_id: string } = await response.json();
  return { id: session_id, path: `/study/${kind === "puzzle" ? "puzzles" : "openings"}/sessions/${session_id}` };
}

async function opening(page: Page, key: string) {
  const response = await page.request.post(`/__test/opening-recall-fixture/audio-${key}`);
  expect(response.ok()).toBe(true);
  const result: { session_id: string; study_ids: string[]; wrong: string; accepted_moves: string[] } = await response.json();
  studies.set(page, [...studies.get(page) ?? [], ...result.study_ids]);
  return result;
}

async function move(page: Page, uci: string) {
  const response = page.waitForResponse(value => value.request().method() === "POST"
    && /\/(?:move|command)$/.test(new URL(value.url()).pathname));
  await page.locator(`.board-shell [data-square="${uci.slice(0, 2)}"]`).click();
  await page.locator(`.board-shell [data-square="${uci.slice(2, 4)}"]`).click();
  const result = await response;
  expect(result.ok()).toBe(true);
  return result;
}

async function command(page: Page, label: string) {
  const response = page.waitForResponse(value => value.request().method() === "POST" && value.url().endsWith("/command"));
  await page.getByRole("button", { name: label, exact: true }).click();
  const result = await response;
  expect(result.ok()).toBe(true);
  return result.json() as Promise<Schema["LessonSessionView"]>;
}

async function expectCues(page: Page, expected: SoundCue[]) {
  await expect.poll(() => audioCues(page)).toEqual(expected);
}

async function expectSilent(page: Page, expected: SoundCue[] = []) {
  // Cross the 160 ms practice cue and 400 ms counter-reply deadlines.
  await page.waitForTimeout(550);
  expect(await audioCues(page)).toEqual(expected);
}

const piece = (page: Page, square: string, symbol: string) =>
  page.locator(`.board-shell [data-square="${square}"] [data-piece="${symbol}"]`);

test("Still puzzle feedback sounds once, survives retries, and replaces correct with complete", async ({ page }, info) => {
  const puzzle = await fixture(page, "puzzle", `still-${info.project.name}`);
  await page.goto(puzzle.path);
  await expect(page.getByRole("heading", { name: "Find the continuation.", exact: true })).toBeVisible();
  await expectSilent(page);
  await move(page, "d2d4");
  await expect(page.getByRole("heading", { name: "Try a different move.", exact: true })).toBeVisible();
  await expectCues(page, ["move", "retry"]);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Try a different move.", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expectSilent(page);
  const response: Schema["PuzzleSessionView"] = await (await move(page, "e2e4")).json();
  expect(response.playback.map(frame => frame.uci)).toEqual(["e2e4", "e7e5"]);
  await expect(piece(page, "e5", "bP")).toBeVisible();
  await expectCues(page, ["move", "correct"]);
  await expectSilent(page, ["move", "correct"]);
  await move(page, "g1f3");
  await expect(page.getByRole("heading", { name: "Puzzle solved.", exact: true })).toBeVisible();
  await expectCues(page, ["move", "correct", "move", "complete"]);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Puzzle solved.", exact: true })).toBeVisible();
  await expectSilent(page);
});

test("natural puzzle playback sounds each visible frame once and reveal has no success cue", async ({ page }, info) => {
  const puzzle = await fixture(page, "puzzle", `natural-${info.project.name}`);
  await page.request.put("/api/preferences/motion", { data: { motion: "natural" } });
  await page.goto(puzzle.path);
  await expect(page.getByRole("heading", { name: "Find the continuation.", exact: true })).toBeVisible();
  await move(page, "e2e4");
  await expect(page.getByRole("heading", { name: "Keep going.", exact: true })).toBeVisible();
  await expectCues(page, ["move", "correct", "move"]);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Keep going.", exact: true })).toBeVisible();
  await expectSilent(page);
  await page.getByRole("button", { name: "Reveal solution", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Solution revealed.", exact: true })).toBeVisible();
  await expectCues(page, ["move"]);
  await expectSilent(page, ["move"]);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Solution revealed.", exact: true })).toBeVisible();
  await expectSilent(page);
});

test("lesson demonstrations and accepted decisions sound only their live transitions", async ({ page }, info) => {
  const lesson = await fixture(page, "lesson", `lesson-${info.project.name}`);
  await page.request.put("/api/preferences/motion", { data: { motion: "natural" } });
  await page.goto(lesson.path);
  await command(page, "Continue");
  await command(page, "Play continuation");
  await expect(page.getByRole("heading", { name: "Both sides enter the center", exact: true })).toBeVisible();
  await expectCues(page, ["move", "move"]);
  await command(page, "Continue");
  await expect(page.getByRole("heading", { name: "Develop a knight", exact: true })).toBeVisible();
  await page.request.put("/api/preferences/motion", { data: { motion: "still" } });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Develop a knight", exact: true })).toBeVisible();
  await expectSilent(page);
  await move(page, "d2d4");
  await expectCues(page, ["move", "retry"]);
  await move(page, "b1c3");
  await expectCues(page, ["move", "retry", "move", "correct"]);
  await page.reload();
  await expect(piece(page, "c3", "wN")).toBeVisible();
  await expectSilent(page);
  await command(page, "Continue");
  await expect(page.getByRole("heading", { name: "A separate continuation", exact: true })).toBeVisible();
  await expectSilent(page);
  await command(page, "Continue");
  await expect(page.getByRole("heading", { name: "Chapter completed.", exact: true })).toBeVisible();
  await expectCues(page, ["complete"]);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Chapter completed.", exact: true })).toBeVisible();
  await expectSilent(page);
});

test("lesson game rewind is neutral even when its destination is a castle", async ({ page }, info) => {
  const lesson = await fixture(page, "lesson", `game-${info.project.name}`);
  const url = `/api/study/lesson-sessions/${lesson.id}`;
  let state: Schema["LessonSessionView"] = await (await page.request.get(url)).json();
  let revision = 0;
  const seed = async (action: Schema["LessonCommand"]["action"], extra: { uci?: string; ply?: number } = {}) => {
    const response = await page.request.post(`${url}/command`, { data: {
      action, ...extra, revision: state.revision, request_id: `audio-game-${++revision}`,
    } });
    expect(response.ok()).toBe(true);
    state = await response.json();
  };
  await seed("continue");
  await seed("continue");
  await seed("continue");
  await seed("move", { uci: "g1f3" });
  await seed("continue");
  await seed("continue");
  await seed("continue");
  await seed("continue");
  await seed("continue");
  await seed("open_game");
  await seed("game_seek", { ply: 12 });
  await page.goto(lesson.path);
  await expect(page.getByRole("button", { name: "Previous game move", exact: true })).toBeVisible();
  await expectSilent(page);
  await command(page, "Previous game move");
  await expectCues(page, ["move"]);
  await command(page, "Next game move");
  await expectCues(page, ["move", "castle"]);
});

test("opening recall retries and acceptance stay distinct from reveal and hydrated feedback", async ({ page }, info) => {
  const recall = await opening(page, `recall-${info.project.name}`);
  await page.goto(`/study/due?session=${recall.session_id}`);
  await expect(page.getByRole("heading", { name: "Play your studied move.", exact: true })).toBeVisible();
  await expectSilent(page);
  await move(page, recall.wrong);
  await expectCues(page, ["move", "retry"]);
  await move(page, recall.accepted_moves[0]);
  await expect(page.getByRole("heading", { name: "Opening recalled.", exact: true })).toBeVisible();
  await expectCues(page, ["move", "retry", "move", "correct"]);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Opening recalled.", exact: true })).toBeVisible();
  await expectSilent(page);
  const revealed = await opening(page, `reveal-${info.project.name}`);
  await page.goto(`/study/due?session=${revealed.session_id}`);
  await page.getByRole("button", { name: "Reveal move", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Studied move revealed.", exact: true })).toBeVisible();
  await expectCues(page, ["move"]);
  await expectSilent(page, ["move"]);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Studied move revealed.", exact: true })).toBeVisible();
  await expectSilent(page);
});

test("SRS sounds the visible counter reply and retry cancels a pending reply", async ({ page }, info) => {
  const response = await page.request.post(`/__test/review-explanation-fixture/audio-counter-${info.project.name}`);
  expect(response.ok()).toBe(true);
  const recall: { exercise_id: string; wrong: string; best: string } = await response.json();
  await page.goto(`/study/due?exercise=${recall.exercise_id}`);
  await expect(page.getByRole("button", { name: "Reveal move", exact: true })).toBeVisible();
  await move(page, recall.wrong);
  await expect(piece(page, "a1", "bQ")).toBeVisible();
  await expectCues(page, ["move", "retry", "check"]);
  await page.getByRole("button", { name: "Try again", exact: true }).click();

  // Freeze the presentation timer while the real server grades the retry.
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await move(page, recall.wrong);
  await page.clock.runFor(200);
  await expectCues(page, ["move", "retry", "check", "move", "retry"]);
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await page.clock.runFor(700);
  await expect(piece(page, "a1", "wR")).toBeVisible();
  expect(await audioCues(page)).toEqual(["move", "retry", "check", "move", "retry"]);
  await page.clock.resume();
  await move(page, recall.best);
  await expect(page.getByRole("heading", { name: "Good decision.", exact: true })).toBeVisible();
  await expectCues(page, ["move", "retry", "check", "move", "retry", "capture", "correct"]);
});

test("leaving a lesson discards sound from its late committed demonstration", async ({ page }, info) => {
  const lesson = await fixture(page, "lesson", `late-${info.project.name}`);
  await page.goto(lesson.path);
  await command(page, "Continue");
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let handled: Promise<void> | undefined;
  const pattern = `**/api/study/lesson-sessions/${lesson.id}/command`;
  await page.route(pattern, route => {
    handled = (async () => {
      const response = await route.fetch();
      await gate;
      await route.fulfill({ response });
    })();
    return handled;
  });
  try {
    const submitted = page.waitForRequest(request => request.url().endsWith("/command") && request.method() === "POST");
    await page.getByRole("button", { name: "Play continuation", exact: true }).click();
    await submitted;
    await page.getByRole("navigation").getByRole("link", { name: "Study", exact: true }).click();
    await expect(page).toHaveURL("/study");
    release();
    await handled;
    await expectSilent(page);
  } finally {
    release();
    await handled;
    await page.unroute(pattern);
  }
});

test("leaving SRS discards sounds from a late accepted response", async ({ page }, info) => {
  const recall = await opening(page, `late-${info.project.name}`);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let handled: Promise<void> | undefined;
  const pattern = `**/api/review/sessions/${recall.session_id}/move`;
  await page.route(pattern, route => {
    handled = (async () => {
      const response = await route.fetch();
      const feedback: Feedback = await response.json();
      expect(feedback.completed).toBe(true);
      await gate;
      await route.fulfill({ response });
    })();
    return handled;
  });
  try {
    await page.goto(`/study/due?session=${recall.session_id}`);
    await expect(page.getByRole("heading", { name: "Play your studied move.", exact: true })).toBeVisible();
    const uci = recall.accepted_moves[0];
    await page.locator(`.board-shell [data-square="${uci.slice(0, 2)}"]`).click();
    const submitted = page.waitForRequest(request => request.url().endsWith("/move") && request.method() === "POST");
    await page.locator(`.board-shell [data-square="${uci.slice(2, 4)}"]`).click();
    await submitted;
    await page.getByRole("navigation").getByRole("link", { name: "Settings", exact: true }).click();
    await expect(page).toHaveURL("/settings");
    release();
    await handled;
    await expectSilent(page);
  } finally {
    release();
    await handled;
    await page.unroute(pattern);
  }
});
