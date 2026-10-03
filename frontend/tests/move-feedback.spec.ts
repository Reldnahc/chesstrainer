import { expect, test, type Page } from "@playwright/test";
import type { Schema } from "../src/api";
import walterBank from "../src/audio/speech/bank/manifest.json" with { type: "json" };

type LessonSession = Schema["LessonSessionView"];
const preferences = new WeakMap<Page, {
  coach: Schema["CoachPreferences"];
  motion: Schema["MotionPreferences"];
}>();

test.beforeEach(async ({ page }) => {
  const coach = await (await page.request.get("/api/preferences/coach")).json();
  const motion = await (await page.request.get("/api/preferences/motion")).json();
  preferences.set(page, { coach, motion });
  expect((await page.request.put("/api/preferences/coach", { data: { ...coach, motion: "still" } })).ok()).toBe(true);
  expect((await page.request.put("/api/preferences/motion", { data: { motion: "still" } })).ok()).toBe(true);
});

test.afterEach(async ({ page }) => {
  const original = preferences.get(page)!;
  expect((await page.request.put("/api/preferences/coach", { data: original.coach })).ok()).toBe(true);
  expect((await page.request.put("/api/preferences/motion", { data: original.motion })).ok()).toBe(true);
});

async function move(page: Page, uci: string) {
  await page.locator(`.board-shell [data-square="${uci.slice(0, 2)}"]`).click();
  await page.locator(`.board-shell [data-square="${uci.slice(2, 4)}"]`).click();
}

async function holdResponse(page: Page, pattern: string) {
  let release!: () => void;
  let entered!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const arrived = new Promise<void>(resolve => { entered = resolve; });
  let operation: Promise<void> | undefined;
  await page.route(pattern, route => {
    operation = (async () => {
      const response = await route.fetch();
      entered();
      await gate;
      await route.fulfill({ response });
    })();
    return operation;
  }, { times: 1 });
  return {
    arrived,
    async finish() {
      release();
      await operation;
      await page.unroute(pattern);
    },
  };
}

async function lessonFixture(page: Page, key: string): Promise<LessonSession> {
  const fixture = await page.request.post(`/__test/lesson-fixture/${key}`);
  expect(fixture.ok()).toBe(true);
  const { session_id } = await fixture.json();
  const response = await page.request.get(`/api/study/lesson-sessions/${session_id}`);
  expect(response.ok()).toBe(true);
  return response.json();
}

async function lessonCommand(page: Page, session: LessonSession, action: Schema["LessonCommand"]["action"], uci?: string): Promise<LessonSession> {
  const response = await page.request.post(`/api/study/lesson-sessions/${session.id}/command`, { data: {
    action, uci, revision: session.revision, request_id: `feedback-${session.id}-${session.revision}`,
  } });
  expect(response.ok()).toBe(true);
  return response.json();
}

test("puzzle feedback delays checking across repeated attempts and cancels fast-response timers", async ({ page }, info) => {
  const fixture = await page.request.post(`/__test/puzzle-fixture/feedback-${info.project.name}`);
  expect(fixture.ok()).toBe(true);
  const { session_id } = await fixture.json();
  await page.goto(`/study/puzzles/sessions/${session_id}`);
  const status = page.locator(".review-coach .move-status");
  await expect(status).toHaveText("Take your time and calculate before moving.");
  await expect(status).toHaveAttribute("aria-atomic", "true");
  await expect(status).toHaveAttribute("aria-live", "polite");
  await expect(page.getByRole("region", { name: "Puzzle solution" })).toHaveCount(0);
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  const observed = await status.evaluateHandle(element => {
    const texts: string[] = [];
    const observer = new MutationObserver(() => { texts.push(element.textContent || ""); });
    observer.observe(element, { childList: true, characterData: true, subtree: true });
    return { texts, observer };
  });
  try {
    for (const slow of [true, true, false]) {
      const pending = await holdResponse(page, `**/api/puzzle-sessions/${session_id}/move`);
      try {
        await move(page, "d2d4");
        await pending.arrived;
        await expect(page.getByRole("button", { name: "Reveal solution", exact: true })).toBeDisabled();
        await expect(status).toHaveText("Take your time and calculate before moving.");
        const before = await observed.evaluate(value => value.texts.length);
        await page.clock.runFor(slow ? 349 : 100);
        await expect(status).not.toContainText("Checking your move");
        if (slow) {
          await page.clock.runFor(1);
          await expect(status).toHaveText("Checking your move...");
          await expect(status).not.toHaveClass(/retry/);
        }
        await pending.finish();
        await expect(status).toContainText("That move does not solve this puzzle.");
        await expect(status).toHaveClass(/retry/);
        await page.clock.runFor(500);
        await expect(status).not.toContainText("Checking your move");
        if (!slow) {
          expect(await observed.evaluate((value, start) => value.texts.slice(start).some(text => text.includes("Checking your move")), before)).toBe(false);
        }
        await expect(page.getByRole("region", { name: "Puzzle solution" })).toHaveCount(0);
        await page.getByRole("button", { name: "Try again", exact: true }).click();
        await expect(status).toHaveText("Take your time and calculate before moving.");
      } finally {
        await pending.finish();
      }
    }
  } finally {
    await observed.evaluate(value => value.observer.disconnect());
    await observed.dispose();
  }
});

test("lesson feedback keeps its instruction and authored result in one atomic status", async ({ page }, info) => {
  let session = await lessonFixture(page, `feedback-rich-${info.project.name}`);
  for (let i = 0; i < 3; i++) session = await lessonCommand(page, session, "continue");
  expect(session.step.id).toBe("develop");
  await page.goto(`/study/openings/sessions/${session.id}`);
  const status = page.locator(".review-coach .move-status");
  await expect(status).toHaveText("Play a knight move taught in this lesson.");
  await expect(status).toHaveAttribute("aria-atomic", "true");
  await expect(status).toHaveCSS("display", "block");
  const answered = page.waitForResponse(response => response.url().endsWith(`/lesson-sessions/${session.id}/command`));
  await move(page, "d2d4");
  const result: LessonSession = await (await answered).json();
  expect(result.feedback?.kind).toBe("incorrect");
  await expect(status.locator("p")).toHaveCount(2);
  await expect(status.locator("p").first()).toHaveText(result.step.text);
  // The generic wrong-move sentence shows as the coach (Walter by default) says it.
  await expect(status.locator(".lesson-feedback.incorrect")).toHaveText(
    walterBank.recordings.find(row => row.id === "lesson-wrong-move")!.text);
  await expect(status).not.toContainText("Mistake. Try again.");
});

test("lesson game navigation preserves rich commentary while a command is pending", async ({ page }, info) => {
  let session = await lessonFixture(page, `feedback-game-${info.project.name}`);
  for (let i = 0; i < 3; i++) session = await lessonCommand(page, session, "continue");
  session = await lessonCommand(page, session, "move", "g1f3");
  for (let i = 0; i < 5; i++) session = await lessonCommand(page, session, "continue");
  expect(session.step.id).toBe("example");
  session = await lessonCommand(page, session, "open_game");
  expect(session.game?.ply).toBe(7);
  await page.goto(`/study/openings/sessions/${session.id}`);
  const status = page.locator(".review-coach .move-status");
  await expect(status).toHaveText("The c3-pawn supports d4.");
  const original = await status.elementHandle();
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  const pending = await holdResponse(page, `**/api/study/lesson-sessions/${session.id}/command`);
  try {
    await page.getByRole("button", { name: "Previous game move", exact: true }).click();
    await pending.arrived;
    await page.clock.runFor(500);
    await expect(status).toHaveText("The c3-pawn supports d4.");
    await expect(status).not.toContainText("Checking your move");
    expect(await original!.evaluate(element => element === document.querySelector(".review-coach .move-status"))).toBe(true);
    await pending.finish();
    await expect(status).toHaveText("Black develops the bishop to c5.");
    await expect(status).toHaveAttribute("aria-atomic", "true");
  } finally {
    await pending.finish();
    await original?.dispose();
  }
});
