import { test, expect, type Page } from "@playwright/test";
import type { Schema } from "../src/api";

const preferences = new WeakMap<Page, { coach: Schema["CoachPreferences"]; motion: Schema["MotionPreferences"] }>();
test.beforeEach(async ({ page }) => {
  preferences.set(page, {
    coach: await (await page.request.get("/api/preferences/coach")).json(),
    motion: await (await page.request.get("/api/preferences/motion")).json(),
  });
});
test.afterEach(async ({ page }) => {
  const original = preferences.get(page)!;
  expect((await page.request.put("/api/preferences/coach", { data: original.coach })).ok()).toBe(true);
  expect((await page.request.put("/api/preferences/motion", { data: original.motion })).ok()).toBe(true);
});

async function fixture(page: Page, key: string) {
  const response = await page.request.post(`/__test/puzzle-fixture/${key}`);
  expect(response.ok()).toBe(true);
  const { session_id }: { session_id: string } = await response.json();
  return { id: session_id, path: `/study/puzzles/sessions/${session_id}` };
}
async function move(page: Page, uci: string) {
  await page.locator(`.board-shell [data-square="${uci.slice(0, 2)}"]`).click();
  await page.locator(`.board-shell [data-square="${uci.slice(2, 4)}"]`).click();
}
async function saved(page: Page, id: string): Promise<Schema["PuzzleSessionView"]> {
  const result = await page.request.get(`/api/puzzle-sessions/${id}`);
  expect(result.ok()).toBe(true);
  return result.json();
}
const piece = (page: Page, square: string, symbol: string) =>
  page.locator(`.board-shell [data-square="${square}"] [data-piece="${symbol}"]`);

test("Study home keeps modes distinct and preserves old recall bookmarks without extra history", async ({ page }) => {
  await page.route("**/api/puzzles", route => route.fulfill({ json: {
    available: 0, sources: [], themes: [], retry_available: 0, solved_puzzles: 0, resume: [], stats: { solved: 0, clean: 0, failed_then_solved: 0, revealed: 0 },
  } }));
  await page.goto("/study");
  await expect(page).toHaveURL("/study");
  await expect(page.getByRole("heading", { name: "Study", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Study", exact: true })).toHaveAttribute("aria-current", "page");
  await page.getByRole("link", { name: "Open puzzles", exact: true }).click();
  await expect(page.getByRole("heading", { name: "No puzzles available yet." })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL("/study");
  const original = await page.request.post("/api/exercises/manual", { data: {
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", moves: ["e2e4"],
  } });
  const { id } = await original.json();
  for (const path of [`/review?exercise=${id}`, `/?exercise=${id}`]) {
    await page.goto(path);
    await expect(page).toHaveURL(`/study/due?exercise=${id}`);
    await expect(page.getByRole("button", { name: "Reveal move", exact: true })).toBeVisible();
    const length = await page.evaluate(() => history.length);
    await page.getByRole("link", { name: "Study", exact: true }).click();
    await page.goBack();
    await expect(page).toHaveURL(`/study/due?exercise=${id}`);
    expect(await page.evaluate(() => history.length)).toBe(length + 1);
  }
  const started = await page.request.post(`/api/review/${id}/start`);
  expect(started.ok()).toBe(true);
  const session: Schema["ColdPosition"] = await started.json();
  expect(session.exercise_id).toBe(id);
  for (const bookmark of [
    { path: "/review?focus=fork", destination: "/study/due?focus=fork", focused: true },
    { path: "/?focus=fork", destination: "/study/due?focus=fork", focused: true },
    { path: `/?session=${session.session_id}`, destination: `/study/due?session=${session.session_id}`, focused: false },
  ]) {
    await page.goto("/study");
    const resumed = bookmark.focused ? null : page.waitForResponse(response =>
      new URL(response.url()).pathname === `/api/review/sessions/${session.session_id}` && response.request().method() === "GET");
    await page.goto(bookmark.path);
    await expect(page).toHaveURL(bookmark.destination);
    if (bookmark.focused) await expect(page.getByText("FOCUSED PRACTICE", { exact: true })).toHaveCount(1);
    else {
      expect((await resumed!).ok()).toBe(true);
      await expect(page.getByRole("button", { name: "Reveal move", exact: true })).toBeVisible();
    }
    const length = await page.evaluate(() => history.length);
    await page.getByRole("link", { name: "Home", exact: true }).click();
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { name: "Home", exact: true })).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(bookmark.destination);
    expect(await page.evaluate(() => history.length)).toBe(length + 1);
    await page.goBack();
    await expect(page).toHaveURL("/study");
  }
  await page.goto("/?unit=archived&exercise=archived-card");
  await expect(page).toHaveURL("/study");
  await expect(page.getByRole("heading", { name: "Study", exact: true })).toBeVisible();
});

test("puzzles retain retries, animate committed replies, resume and finish without revealing future moves", async ({ page }, info) => {
  const puzzle = await fixture(page, `multi-${info.project.name}`);
  await page.request.put("/api/preferences/motion", { data: { motion: "natural" } });
  const searches: string[] = [];
  page.on("request", request => { if (/\/(?:analyze|review)$/.test(new URL(request.url()).pathname)) searches.push(request.url()); });
  await page.goto(puzzle.path);
  await expect(page.getByRole("heading", { name: "Find the continuation." })).toBeVisible();
  await expect(page.getByRole("region", { name: "Puzzle solution" })).toHaveCount(0);
  expect((await saved(page, puzzle.id)).completion).toBeNull();
  const layout = await page.locator(".board-shell").boundingBox();
  expect(layout?.width).toBeGreaterThan(300);
  if (info.project.name === "mobile") {
    const coach = await page.locator(".review-coach").boundingBox();
    expect(coach!.y + coach!.height).toBeLessThan(layout!.y);
  }
  await move(page, "d2d4");
  await expect(page.getByRole("heading", { name: "Try a different move." })).toBeVisible();
  await expect(piece(page, "d2", "wP")).toBeVisible();
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  const firstMoveResponse = page.waitForResponse(response => response.url().endsWith(`/puzzle-sessions/${puzzle.id}/move`));
  await move(page, "e2e4");
  const result: Schema["PuzzleSessionView"] = await (await firstMoveResponse).json();
  expect(result.playback.map(frame => frame.uci)).toEqual(["e2e4", "e7e5"]);
  expect(result.history.map(frame => frame.uci)).toEqual(["e2e4", "e7e5"]);
  expect(result.completion).toBeNull();
  await expect(piece(page, "e4", "wP")).toBeVisible();
  await expect(piece(page, "e5", "bP")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Keep going." })).toBeVisible();
  await page.reload();
  await expect(piece(page, "e5", "bP")).toBeVisible();
  expect((await saved(page, puzzle.id)).revision).toBe(result.revision);
  await move(page, "g1f3");
  await expect(page.getByRole("heading", { name: "Puzzle solved." })).toBeVisible();
  await expect(page.locator(".review-coach").getByRole("status")).toContainText("failed, then solved");
  await expect(page.getByRole("region", { name: "Puzzle solution" })).toBeVisible();
  await expect(page.locator(".puzzle-provenance").last()).not.toBeEmpty();
  const complete = await saved(page, puzzle.id);
  expect(complete.status).toBe("solved");
  expect(complete.failed).toBe(true);
  expect(complete.current_step).toBe(3);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Puzzle solved." })).toBeVisible();
  expect((await saved(page, puzzle.id)).revision).toBe(complete.revision);
  expect(searches).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/study-puzzle-${info.project.name}.png`, fullPage: true });
});

test("reload during opponent playback resumes the committed decision without double advancing", async ({ page }, info) => {
  const puzzle = await fixture(page, `playback-${info.project.name}`);
  await page.request.put("/api/preferences/motion", { data: { motion: "natural" } });
  await page.goto(puzzle.path);
  await expect(page.getByRole("heading", { name: "Find the continuation." })).toBeVisible();
  const committed = page.waitForResponse(response => response.url().endsWith(`/puzzle-sessions/${puzzle.id}/move`));
  await move(page, "e2e4");
  const result: Schema["PuzzleSessionView"] = await (await committed).json();
  await page.reload();
  await expect(piece(page, "e4", "wP")).toBeVisible();
  await expect(piece(page, "e5", "bP")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Keep going." })).toBeVisible();
  const resumed = await saved(page, puzzle.id);
  expect(resumed.revision).toBe(result.revision);
  expect(resumed.current_step).toBe(2);
  expect(resumed.playback).toEqual([]);
  await move(page, "g1f3");
  await expect(page.getByRole("heading", { name: "Puzzle solved." })).toBeVisible();
});

test("reveal and Still motion show an inspectable solution without creating a clean solve", async ({ page }, info) => {
  const puzzle = await fixture(page, `reveal-${info.project.name}`);
  await page.request.put("/api/preferences/motion", { data: { motion: "still" } });
  await page.goto(puzzle.path);
  await page.getByRole("button", { name: "Reveal solution", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Solution revealed." })).toBeVisible();
  await expect(piece(page, "f3", "wN")).toBeVisible();
  const revealed = await saved(page, puzzle.id);
  expect(revealed.status).toBe("revealed");
  expect(revealed.completion?.solution).toHaveLength(3);
  await page.getByRole("button", { name: "View solution", exact: true }).click();
  await expect(piece(page, "e2", "wP")).toBeVisible();
  await page.getByRole("button", { name: "e4", exact: true }).click();
  await expect(piece(page, "e4", "wP")).toBeVisible();
  await expect(piece(page, "e7", "bP")).toBeVisible();
  await page.getByRole("button", { name: "Nf3", exact: true }).click();
  await expect(piece(page, "f3", "wN")).toBeVisible();
  await page.getByRole("link", { name: "All puzzles", exact: true }).click();
  await expect(page).toHaveURL("/study/puzzles");
  await expect(page.getByRole("heading", { name: "Your puzzle practice" })).toBeVisible();
  expect((await saved(page, puzzle.id)).revision).toBe(revealed.revision);
});

test("an out-of-date tab must reload the committed session before another write", async ({ page }, info) => {
  const puzzle = await fixture(page, `stale-${info.project.name}`);
  await page.goto(puzzle.path);
  await expect(page.getByRole("heading", { name: "Find the continuation." })).toBeVisible();
  const original = await saved(page, puzzle.id);
  const other = await page.request.post(`/api/puzzle-sessions/${puzzle.id}/move`, { data: {
    request_id: `other-${info.project.name}`, revision: original.revision, uci: "e2e4", elapsed_ms: 200,
  } });
  expect(other.ok()).toBe(true);
  await move(page, "d2d4");
  await expect(page.getByRole("button", { name: "Reload session", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Reload session", exact: true }).click();
  await expect(piece(page, "e5", "bP")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Keep going." })).toBeVisible();
  await move(page, "g1f3");
  await expect(page.getByRole("heading", { name: "Puzzle solved." })).toBeVisible();
  expect((await saved(page, puzzle.id)).failed).toBe(false);
});

test("promotion and coach changes use the shared player without losing saved progress", async ({ page }, info) => {
  const puzzle = await fixture(page, `promotion-${info.project.name}`);
  await page.request.put("/api/preferences/motion", { data: { motion: "still" } });
  await page.goto(puzzle.path);
  await expect(page.getByRole("heading", { name: "Find the continuation." })).toBeVisible();
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await page.getByRole("navigation", { name: "Settings sections" }).getByRole("link", { name: "Coach & animations", exact: true }).click();
  const selected = page.getByRole("radio", {
    name: preferences.get(page)!.coach.coach_id === "dog-collie" ? "Walter" : "Scout",
    exact: true,
  });
  const savedPreference = page.waitForResponse(response =>
    response.url().endsWith("/api/preferences/coach") && response.request().method() === "PUT");
  await selected.click();
  expect((await savedPreference).ok()).toBe(true);
  await expect(selected).toBeChecked();
  await page.goBack();
  await expect(page).toHaveURL("/settings");
  await page.goBack();
  await expect(page).toHaveURL(puzzle.path);
  await expect(page.getByRole("heading", { name: "Find the continuation." })).toBeVisible();
  expect((await saved(page, puzzle.id)).current_step).toBe(0);
  await move(page, "a7a8");
  await expect(page.getByRole("dialog", { name: "Choose promotion" })).toBeVisible();
  await page.getByRole("button", { name: "Queen", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Puzzle solved." })).toBeVisible();
  await expect(piece(page, "a8", "wQ")).toBeVisible();
  const complete = await saved(page, puzzle.id);
  expect(complete.status).toBe("solved");
  expect(complete.history.map(frame => frame.uci)).toEqual(["a7a8q"]);
  expect(complete.failed).toBe(false);
});

test("system reduced motion skips automatic playback and keeps manual solution inspection", async ({ page }, info) => {
  const puzzle = await fixture(page, `reduced-${info.project.name}`);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.request.put("/api/preferences/motion", { data: { motion: "system" } });
  await page.goto(puzzle.path);
  await page.getByRole("button", { name: "Reveal solution", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Solution revealed." })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.dataset.interfaceMotion)).toBe("still");
  await expect(piece(page, "f3", "wN")).toBeVisible();
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(piece(page, "e2", "wP")).toBeVisible();
  await page.getByRole("button", { name: "e5", exact: true }).click();
  await expect(piece(page, "e5", "bP")).toBeVisible();
  expect((await saved(page, puzzle.id)).status).toBe("revealed");
});

test("leaving during a pending move cannot apply late feedback to another Study screen", async ({ page }, info) => {
  const puzzle = await fixture(page, `leaving-${info.project.name}`);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let handled: Promise<void> | undefined;
  const pattern = `**/api/puzzle-sessions/${puzzle.id}/move`;
  await page.route(pattern, route => {
    handled = (async () => {
      const response = await route.fetch();
      await gate;
      await route.fulfill({ response });
    })();
    return handled;
  });
  try {
    await page.goto(puzzle.path);
    await expect(page.getByRole("heading", { name: "Find the continuation." })).toBeVisible();
    await move(page, "e2e4");
    await expect.poll(async () => (await saved(page, puzzle.id)).current_step).toBe(2);
    await page.getByRole("link", { name: "Study", exact: true }).click();
    await expect(page).toHaveURL("/study");
    release();
    await handled;
    await expect(page.getByRole("heading", { name: "Study", exact: true })).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
    await page.goto(puzzle.path);
    await expect(piece(page, "e5", "bP")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Keep going." })).toBeVisible();
  } finally {
    release();
    await handled;
    await page.unroute(pattern);
  }
});
