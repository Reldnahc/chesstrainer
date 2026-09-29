import { expect, test, type Page } from "@playwright/test";
import type { Schema } from "../src/api";

const preferences = new WeakMap<Page, { coach: Schema["CoachPreferences"]; motion: Schema["MotionPreferences"] }>();
test.beforeEach(async ({ page }) => {
  preferences.set(page, {
    coach: await (await page.request.get("/api/preferences/coach")).json(),
    motion: await (await page.request.get("/api/preferences/motion")).json(),
  });
  await page.request.put("/api/preferences/motion", { data: { motion: "still" } });
});
test.afterEach(async ({ page }) => {
  const original = preferences.get(page)!;
  expect((await page.request.put("/api/preferences/coach", { data: original.coach })).ok()).toBe(true);
  expect((await page.request.put("/api/preferences/motion", { data: original.motion })).ok()).toBe(true);
});
async function fixture(page: Page, key: string) {
  const response = await page.request.post(`/__test/lesson-fixture/${key}`);
  expect(response.ok()).toBe(true);
  const value: { session_id: string; course_id: string; revision: string; chapter_id: string } = await response.json();
  return { ...value, path: `/study/openings/sessions/${value.session_id}` };
}
async function saved(page: Page, id: string): Promise<Schema["LessonSessionView"]> {
  const response = await page.request.get(`/api/study/lesson-sessions/${id}`);
  expect(response.ok()).toBe(true);
  return response.json();
}
async function command(page: Page, label: string) {
  const response = page.waitForResponse(value => value.url().includes("/lesson-sessions/") && value.url().endsWith("/command"));
  await page.getByRole("button", { name: label, exact: true }).click();
  const result = await response;
  expect(result.ok()).toBe(true);
  return result.json() as Promise<Schema["LessonSessionView"]>;
}
async function move(page: Page, uci: string) {
  const response = page.waitForResponse(value => value.url().includes("/lesson-sessions/") && value.url().endsWith("/command"));
  await page.locator(`.board-shell [data-square="${uci.slice(0, 2)}"]`).click();
  await page.locator(`.board-shell [data-square="${uci.slice(2, 4)}"]`).click();
  if (uci.length === 5) await page.getByRole("button", { name: "Queen", exact: true }).click();
  const result = await response;
  expect(result.ok()).toBe(true);
  return result.json() as Promise<Schema["LessonSessionView"]>;
}
const piece = (page: Page, square: string, symbol: string) => page.locator(`.board-shell [data-square="${square}"] [data-piece="${symbol}"]`);
async function reachDecision(page: Page) {
  await command(page, "Continue");
  await command(page, "Play continuation");
  await command(page, "Continue");
  await expect(page.getByRole("heading", { name: "Develop a knight", exact: true })).toBeVisible();
}

test("the connected lesson preserves Back, guidance, branch return, full-game context and independent rehearsal", async ({ page }, info) => {
  const lesson = await fixture(page, `journey-${info.project.name}`);
  await page.goto(lesson.path);
  await expect(page.getByRole("heading", { name: "Start from the beginning" })).toBeVisible();
  const start = await saved(page, lesson.session_id);
  await command(page, "Continue");
  const backed = await command(page, "Back");
  expect(backed.fen).toBe(start.fen);
  expect(backed.history).toEqual(start.history);
  await reachDecision(page);
  const hinted = await command(page, "Hint");
  expect(hinted.feedback?.kind).toBe("hint");
  const wrong = await move(page, "d2d4");
  expect(wrong.feedback?.kind).toBe("incorrect");
  await expect(piece(page, "d2", "wP")).toBeVisible();
  const revealed = await command(page, "Show move");
  expect(revealed.feedback?.kind).toBe("revealed");
  await expect(piece(page, "f3", "wN")).toBeVisible();
  await command(page, "Continue");
  const anchor = await saved(page, lesson.session_id);
  await command(page, "Explore alternative");
  await command(page, "Play continuation");
  await command(page, "Continue");
  const branch = await saved(page, lesson.session_id);
  expect(branch.branch).not.toBeNull();
  expect(branch.step.id).toBe("quiet-explanation");
  await page.reload();
  await expect(page.getByRole("button", { name: "Return to main line" })).toBeVisible();
  expect((await saved(page, lesson.session_id)).history).toEqual(branch.history);
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  const radio = page.getByRole("radio", { name: preferences.get(page)!.coach.coach_id === "dog-collie" ? "Walter" : "Scout", exact: true });
  const preference = page.waitForResponse(response => response.url().endsWith("/api/preferences/coach") && response.request().method() === "PUT");
  await radio.click();
  expect((await preference).ok()).toBe(true);
  await expect(radio).toBeChecked();
  await page.goBack();
  await expect(page.getByRole("button", { name: "Return to main line" })).toBeVisible();
  expect((await saved(page, lesson.session_id)).fen).toBe(branch.fen);
  const returned = await command(page, "Return to main line");
  expect(returned.branch).toBeNull();
  expect(returned.fen).toBe(anchor.fen);
  expect(returned.history).toEqual(anchor.history);
  await command(page, "Continue");
  await command(page, "Play continuation");
  await command(page, "Continue");
  await command(page, "Play continuation");
  const excerpt = await saved(page, lesson.session_id);
  expect(excerpt.step.id).toBe("example");
  await expect(page.locator(".coach-message")).toContainText("The c3-pawn supports d4.");
  await expect(page.locator('.board-shell [data-square="c3"] .playback-highlight')).toHaveCount(1);
  const game = await command(page, "Explore full game");
  expect(game.game).not.toBeNull();
  await command(page, "Previous game move");
  await expect(page.locator(".coach-message")).toContainText("Black develops the bishop to c5.");
  await expect(page.locator('.board-shell [data-square="c3"] .playback-highlight')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("button", { name: "Return to lesson" })).toBeVisible();
  const closed = await command(page, "Return to lesson");
  expect(closed.fen).toBe(excerpt.fen);
  expect(closed.history).toEqual(excerpt.history);
  const rehearsal = await command(page, "Continue");
  expect(rehearsal.step.kind).toBe("rehearsal");
  expect(rehearsal.legal_moves.length).toBeGreaterThan(0);
  await expect(page.getByRole("button", { name: "Hint", exact: true })).toHaveCount(0);
  await expect(page.locator(".coach-message")).not.toContainText("Nf3");
  await move(page, "e2e4");
  await expect(piece(page, "e5", "bP")).toBeVisible();
  await move(page, "g1f3");
  await expect(piece(page, "c6", "bN")).toBeVisible();
  await move(page, "f1c4");
  if ((await saved(page, lesson.session_id)).status !== "completed") await command(page, "Continue");
  await expect(page.getByRole("heading", { name: "Chapter completed." })).toBeVisible();
  const complete = await saved(page, lesson.session_id);
  expect(complete.status).toBe("completed");
  expect(complete.assisted).toBe(true);
  expect(complete.failed).toBe(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Chapter completed." })).toBeVisible();
  expect((await saved(page, lesson.session_id)).revision).toBe(complete.revision);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (info.project.name === "mobile") {
    const positions = await page.evaluate(() => {
      const coach = document.querySelector(".review-coach")!.getBoundingClientRect();
      const board = document.querySelector(".board-shell")!.getBoundingClientRect();
      return { coachBottom: coach.bottom + scrollY, boardTop: board.top + scrollY };
    });
    expect(positions.coachBottom).toBeLessThan(positions.boardTop);
  }
  await page.screenshot({ path: `test-results/connected-lesson-${info.project.name}.png`, fullPage: true });
});

test("an accepted alternate decision follows its own continuation", async ({ page }, info) => {
  const lesson = await fixture(page, `alternative-${info.project.name}`);
  await page.goto(lesson.path);
  await reachDecision(page);
  const response = await move(page, "b1c3");
  expect(response.feedback?.kind).toBe("correct");
  const next = await command(page, "Continue");
  expect(next.step.id).toBe("other-knight");
  await expect(page.getByRole("heading", { name: "A separate continuation" })).toBeVisible();
  await expect(piece(page, "c3", "wN")).toBeVisible();
  await expect(piece(page, "g1", "wN")).toBeVisible();
  await expect(page.getByRole("button", { name: "Explore alternative" })).toHaveCount(0);
});

test("reload during a demonstration restores its committed end without replaying or completing twice", async ({ page }, info) => {
  const lesson = await fixture(page, `demo-${info.project.name}`);
  await page.request.put("/api/preferences/motion", { data: { motion: "natural" } });
  await page.goto(lesson.path);
  await command(page, "Continue");
  const played = await command(page, "Play continuation");
  expect(played.playback.map(frame => frame.uci)).toEqual(["e2e4", "e7e5"]);
  await page.reload();
  await expect(piece(page, "e4", "wP")).toBeVisible();
  await expect(piece(page, "e5", "bP")).toBeVisible();
  const resumed = await saved(page, lesson.session_id);
  expect(resumed.revision).toBe(played.revision);
  expect(resumed.playback).toEqual([]);
  expect(resumed.step.phase).toBe("complete");
  await command(page, "Continue");
  await expect(page.getByRole("heading", { name: "Develop a knight" })).toBeVisible();
});

test("the lesson library resumes saved content and opens a chapter without exposing step answers", async ({ page }, info) => {
  const lesson = await fixture(page, `library-${info.project.name}`);
  await page.goto("/study/openings");
  await expect(page.getByRole("heading", { name: "Continue learning" })).toBeVisible();
  const resume = page.locator(`a[href="${lesson.path}"]`);
  await resume.click();
  await expect(page.getByRole("heading", { name: "Start from the beginning" })).toBeVisible();
  await page.getByRole("link", { name: "Chapters", exact: true }).click();
  await expect(page).toHaveURL(`/study/openings/courses/${lesson.course_id}?revision=${lesson.revision}`);
  await expect(page.getByRole("heading", { name: "A complete lesson journey" })).toBeVisible();
  await expect(page.locator(".lesson-chapters")).not.toContainText("Nf3");
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Start from the beginning" })).toBeVisible();
});

test("Still motion shows the committed demonstration without a playback phase", async ({ page }, info) => {
  const lesson = await fixture(page, `still-${info.project.name}`);
  await page.goto(lesson.path);
  await command(page, "Continue");
  expect(await page.evaluate(() => document.documentElement.dataset.interfaceMotion)).toBe("still");
  const observed = await page.evaluateHandle(() => {
    const titles: string[] = [];
    const target = document.querySelector(".coach-title")!;
    const observer = new MutationObserver(() => { titles.push(target.textContent || ""); });
    observer.observe(target, { childList: true, subtree: true, characterData: true });
    return { titles, observer };
  });
  try {
    const played = await command(page, "Play continuation");
    expect(played.playback.map(frame => frame.uci)).toEqual(["e2e4", "e7e5"]);
    await expect(piece(page, "e4", "wP")).toBeVisible();
    await expect(piece(page, "e5", "bP")).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeEnabled();
    await expect(page.locator(".coach-title")).toHaveText("Both sides enter the center");
    expect(await observed.evaluate(value => value.titles)).not.toContain("Follow the continuation.");
    const resumed = await saved(page, lesson.session_id);
    expect(resumed.step.phase).toBe("complete");
    expect(resumed.history.map(frame => frame.uci)).toEqual(["e2e4", "e7e5"]);
  } finally {
    await observed.evaluate(value => value.observer.disconnect());
    await observed.dispose();
  }
});

test("leaving during a lesson command discards late feedback and resumes committed progress", async ({ page }, info) => {
  const lesson = await fixture(page, `leaving-${info.project.name}`);
  const errors: string[] = [];
  page.on("pageerror", error => { errors.push(error.message); });
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let handled: Promise<void> | undefined;
  const pattern = `**/api/study/lesson-sessions/${lesson.session_id}/command`;
  await page.route(pattern, route => {
    handled = (async () => {
      const response = await route.fetch();
      await gate;
      await route.fulfill({ response });
    })();
    return handled;
  });
  try {
    await page.goto(lesson.path);
    await expect(page.getByRole("heading", { name: "Start from the beginning" })).toBeVisible();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect.poll(async () => (await saved(page, lesson.session_id)).step.id).toBe("center");
    await page.getByRole("link", { name: "Study", exact: true }).click();
    await expect(page).toHaveURL("/study");
    release();
    await handled;
    await expect(page.getByRole("heading", { name: "Study", exact: true })).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
    await page.goto(lesson.path);
    await expect(page.getByRole("heading", { name: "Both sides enter the center" })).toBeVisible();
    expect((await saved(page, lesson.session_id)).step.phase).toBe("ready");
    expect(errors).toEqual([]);
  } finally {
    release();
    await handled;
    await page.unroute(pattern);
  }
});

test("a new lesson explanation returns its scroll bubble to the start without replacing the coach or losing focus", async ({ page }, info) => {
  const lesson = await fixture(page, `message-scroll-${info.project.name}`);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let handled: Promise<void> | undefined;
  const pattern = `**/api/study/lesson-sessions/${lesson.session_id}**`;
  await page.route(pattern, route => {
    const operation = (async () => {
      const response = await route.fetch();
      const session: Schema["LessonSessionView"] = await response.json();
      // Keep real saved state and transitions, but exercise two scrollable texts.
      session.step.text = `${session.step.id === "welcome" ? "First explanation." : "Next explanation."} ${"This lesson connects the pieces, their development, and the plans available from this position. ".repeat(12)}`;
      if (route.request().method() === "POST") await gate;
      await route.fulfill({ response, json: session });
    })();
    handled = operation;
    return operation;
  });
  await page.goto(lesson.path);
  const message = page.getByLabel("Coach explanation", { exact: true });
  await expect(message).toContainText("First explanation.");
  const original = await page.evaluateHandle(() => ({
    message: document.querySelector(".coach-message"),
    avatar: document.querySelector(".coach-avatar"),
  }));
  try {
    await message.evaluate(element => { element.scrollTop = element.scrollHeight; });
    expect(await message.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
    const pending = page.waitForResponse(response => response.url().endsWith(`/lesson-sessions/${lesson.session_id}/command`));
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await message.focus();
    release();
    expect((await pending).ok()).toBe(true);
    await handled;
    await expect(message).toContainText("Next explanation.");
    await expect.poll(() => message.evaluate(element => element.scrollTop)).toBe(0);
    expect(await original.evaluate(value => ({
      sameMessage: value.message === document.querySelector(".coach-message"),
      sameAvatar: value.avatar === document.querySelector(".coach-avatar"),
      focused: value.message === document.activeElement,
    }))).toEqual({ sameMessage: true, sameAvatar: true, focused: true });
  } finally {
    release();
    await handled;
    await original.dispose();
    await page.unroute(pattern);
  }
});
