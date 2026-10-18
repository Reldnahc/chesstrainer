import { expect, test, type Page } from "./helpers/browserTest";
import type { Schema } from "../src/api";

const courseId = "italian-foundations";
const courseRevision = "2026-10-v5";
const coursePath = `/study/openings/courses/${courseId}?revision=${courseRevision}`;
const savedMotion = new WeakMap<Page, Schema["MotionPreferences"]>();
const enrolled = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const preferences = await page.request.get("/api/preferences/motion");
  expect(preferences.ok()).toBe(true);
  savedMotion.set(page, await preferences.json());
  enrolled.set(page, []);
  expect(
    (await page.request.put("/api/preferences/motion", { data: { motion: "still" } })).ok(),
  ).toBe(true);
});
test.afterEach(async ({ page }) => {
  for (const id of enrolled.get(page) || [])
    expect((await page.request.delete(`/api/opening-studies/${id}`)).ok()).toBe(true);
  expect(
    (await page.request.put("/api/preferences/motion", { data: savedMotion.get(page) })).ok(),
  ).toBe(true);
});

async function course(page: Page): Promise<Schema["LessonCourseView"]> {
  const response = await page.request.get(
    `/api/study/courses/${courseId}?revision=${courseRevision}`,
  );
  expect(response.ok()).toBe(true);
  return response.json();
}
async function start(page: Page, chapterId: string) {
  const content = await course(page);
  const chapter = content.chapters.find(item => item.id === chapterId)!;
  expect(chapter).toBeTruthy();
  await page.goto(coursePath);
  const row = page
    .locator(".lesson-chapters li")
    .filter({ has: page.getByRole("heading", { name: chapter.title, exact: true }) });
  const pending = page.waitForResponse(
    response =>
      new URL(response.url()).pathname === "/api/study/lesson-sessions" &&
      response.request().method() === "POST",
  );
  await row.getByRole("button", { name: /^(Start|Revisit)$/ }).click();
  const response = await pending;
  expect(response.ok()).toBe(true);
  const session: Schema["LessonSessionView"] = await response.json();
  await expect(page).toHaveURL(`/study/openings/sessions/${session.id}`);
  await expect(page.getByRole("region", { name: "Lesson position" })).toBeVisible();
  return session;
}
async function command(page: Page, label: string) {
  const pending = page.waitForResponse(
    response => response.url().includes("/lesson-sessions/") && response.url().endsWith("/command"),
  );
  await page.getByRole("button", { name: label, exact: true }).click();
  const response = await pending;
  expect(response.ok()).toBe(true);
  return response.json() as Promise<Schema["LessonSessionView"]>;
}

// Natural motion: the beforeEach default is still motion.
test("first lesson drags show legal destinations after instructions with natural motion", async ({
  page,
}) => {
  expect(
    (await page.request.put("/api/preferences/motion", { data: { motion: "natural" } })).ok(),
  ).toBe(true);
  await start(page, "quiet-development");
  await command(page, "Continue");
  let position = await command(page, "Play continuation");
  const board = page.locator(".board-shell");
  for (const uci of ["g1f3", "f1c4"]) {
    if (uci !== "g1f3") position = await command(page, "Continue");
    await expect(
      page.getByRole("heading", { name: position.step.title, exact: true }),
    ).toBeVisible();
    const source = board.locator(`[data-square="${uci.slice(0, 2)}"]`);
    const target = board.locator(`[data-square="${uci.slice(2, 4)}"]`);
    await source.scrollIntoViewIfNeeded();
    const from = (await source.boundingBox())!,
      to = (await target.boundingBox())!;
    const expected = position.legal_moves
      .filter(move => move.from_square === uci.slice(0, 2))
      .map(move => move.to_square)
      .sort();
    expect(expected.length).toBeGreaterThan(1);
    await expect(board.locator("[data-legal-destination]")).toHaveCount(0);
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    try {
      await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
      await expect
        .poll(() =>
          board
            .locator("[data-legal-destination]")
            .evaluateAll(markers =>
              markers.map(marker => marker.getAttribute("data-legal-destination")).sort(),
            ),
        )
        .toEqual(expected);
      const pending = page.waitForResponse(
        response =>
          response.url().includes("/lesson-sessions/") && response.url().endsWith("/command"),
      );
      await page.mouse.up();
      const response = await pending;
      expect(response.ok()).toBe(true);
      const result: Schema["LessonSessionView"] = await response.json();
      expect(result.feedback?.kind).toBe("correct");
    } finally {
      await page.mouse.up();
    }
    await expect(board.locator("[data-legal-destination]")).toHaveCount(0);
  }
});
