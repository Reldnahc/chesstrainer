import { expect, test, type Page } from "./helpers/browserTest";
import type { Schema } from "../src/api";
import { expectReturnAction } from "./return-action";

const preferences = new WeakMap<
  Page,
  { coach: Schema["CoachPreferences"]; motion: Schema["MotionPreferences"] }
>();
test.beforeEach(async ({ page }) => {
  preferences.set(page, {
    coach: await (await page.request.get("/api/preferences/coach")).json(),
    motion: await (await page.request.get("/api/preferences/motion")).json(),
  });
  await page.request.put("/api/preferences/motion", { data: { motion: "still" } });
});
test.afterEach(async ({ page }) => {
  const original = preferences.get(page)!;
  expect((await page.request.put("/api/preferences/coach", { data: original.coach })).ok()).toBe(
    true,
  );
  expect((await page.request.put("/api/preferences/motion", { data: original.motion })).ok()).toBe(
    true,
  );
});
async function fixture(page: Page, key: string) {
  const response = await page.request.post(`/__test/lesson-fixture/${key}`);
  expect(response.ok()).toBe(true);
  const value: { session_id: string; course_id: string; revision: string; chapter_id: string } =
    await response.json();
  return { ...value, path: `/study/openings/sessions/${value.session_id}` };
}
async function saved(page: Page, id: string): Promise<Schema["LessonSessionView"]> {
  const response = await page.request.get(`/api/study/lesson-sessions/${id}`);
  expect(response.ok()).toBe(true);
  return response.json();
}
async function command(page: Page, label: string) {
  const response = page.waitForResponse(
    value => value.url().includes("/lesson-sessions/") && value.url().endsWith("/command"),
  );
  await page.getByRole("button", { name: label, exact: true }).click();
  const result = await response;
  expect(result.ok()).toBe(true);
  return result.json() as Promise<Schema["LessonSessionView"]>;
}
async function move(page: Page, uci: string) {
  const response = page.waitForResponse(
    value => value.url().includes("/lesson-sessions/") && value.url().endsWith("/command"),
  );
  await page.locator(`.board-shell [data-square="${uci.slice(0, 2)}"]`).click();
  await page.locator(`.board-shell [data-square="${uci.slice(2, 4)}"]`).click();
  if (uci.length === 5) await page.getByRole("button", { name: "Queen", exact: true }).click();
  const result = await response;
  expect(result.ok()).toBe(true);
  return result.json() as Promise<Schema["LessonSessionView"]>;
}
const piece = (page: Page, square: string, symbol: string) =>
  page.locator(`.board-shell [data-square="${square}"] [data-piece="${symbol}"]`);
async function reachDecision(page: Page) {
  await command(page, "Continue");
  // A demonstration that ends where the next step starts goes straight on.
  await command(page, "Play continuation");
  await expect(page.getByRole("heading", { name: "Develop a knight", exact: true })).toBeVisible();
}

test("the connected lesson preserves Back, guidance, branch return, full-game context and independent rehearsal", async ({
  page,
}, info) => {
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
  const branch = await saved(page, lesson.session_id);
  expect(branch.branch).not.toBeNull();
  expect(branch.step.id).toBe("quiet-explanation");
  await page.reload();
  await expect(page.getByRole("button", { name: "Main line", exact: true })).toBeVisible();
  const branchReturn = page.getByRole("button", { name: "Main line", exact: true });
  const returnPresentation = await expectReturnAction(branchReturn);
  const viewport = page.viewportSize()!;
  await page.setViewportSize({ width: 320, height: 700 });
  await expectReturnAction(branchReturn);
  expect(
    await branchReturn.evaluate(element => element.scrollWidth <= element.clientWidth + 1),
  ).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize(viewport);
  expect((await saved(page, lesson.session_id)).history).toEqual(branch.history);
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await page
    .getByRole("navigation", { name: "Settings sections" })
    .getByRole("link", { name: "Coach & animations", exact: true })
    .click();
  const radio = page.getByRole("radio", {
    name: preferences.get(page)!.coach.coach_id === "dog-collie" ? "Walter" : "Scout",
    exact: true,
  });
  const preference = page.waitForResponse(
    response =>
      response.url().endsWith("/api/preferences/coach") && response.request().method() === "PATCH",
  );
  await radio.click();
  expect((await preference).ok()).toBe(true);
  await expect(radio).toBeChecked();
  await page.goBack();
  await expect(page).toHaveURL("/settings");
  await page.goBack();
  await expect(page.getByRole("button", { name: "Main line", exact: true })).toBeVisible();
  expect((await saved(page, lesson.session_id)).fen).toBe(branch.fen);
  const returned = await command(page, "Main line");
  expect(returned.branch).toBeNull();
  expect(returned.fen).toBe(anchor.fen);
  expect(returned.history).toEqual(anchor.history);
  await command(page, "Continue");
  await command(page, "Play continuation");
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
  expect(
    await expectReturnAction(page.getByRole("button", { name: "Return to lesson", exact: true })),
  ).toEqual(returnPresentation);
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
  if ((await saved(page, lesson.session_id)).status !== "completed")
    await command(page, "Continue");
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
  await page.screenshot({
    path: `test-results/connected-lesson-${info.project.name}.png`,
    fullPage: true,
  });
});

test("Study home opens Lessons, whose Fundamentals tab alone lists the tactics and fundamentals courses", async ({
  page,
}) => {
  const skillTitles = ["Fundamentals · Six basic skills", "Tactics · Six basic patterns"];
  await page.goto("/study");
  await expect(page.locator(".study-option h2")).toHaveText(["Due now", "Lessons", "Puzzles"]);
  const card = page
    .locator(".study-option")
    .filter({ has: page.getByRole("heading", { name: "Lessons", exact: true }) });
  await expect(card.locator("dt")).toHaveText(/^Chapters? to learn$/);
  await expect(card.locator("dd")).toHaveText(/^\d+$/);
  await card.getByRole("link", { name: "Open lessons", exact: true }).click();
  await expect(page).toHaveURL("/study/openings");
  await expect(page.getByRole("heading", { level: 1, name: "Lessons" })).toBeVisible();
  const sections = page.getByRole("navigation", { name: "Lesson sections" });
  await expect(sections.getByRole("link", { name: "Openings", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await sections.getByRole("link", { name: "Fundamentals", exact: true }).click();
  await expect(page).toHaveURL("/study/skills");
  await expect(sections.getByRole("link", { name: "Fundamentals", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.locator(".lesson-course-card h2")).toHaveText(skillTitles);
  await page.getByRole("link", { name: new RegExp(skillTitles[0]) }).click();
  await expect(page).toHaveURL(/\/study\/skills\/courses\/chess-fundamentals\?revision=/);
  await expect(page.getByRole("link", { name: "All fundamentals", exact: true })).toHaveAttribute(
    "href",
    "/study/skills",
  );
  await page.goto("/study/openings");
  await expect(page.locator(".lesson-course-card").first()).toBeVisible();
  for (const title of skillTitles)
    await expect(page.locator(".lesson-course-card", { hasText: title })).toHaveCount(0);
});
