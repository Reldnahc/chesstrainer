import { expect, test, type Locator } from "@playwright/test";
import type { Schema } from "../src/api";

async function appearance(link: Locator) {
  await expect(link).toBeVisible();
  await expect(link.locator("small")).toBeVisible();
  await expect(link.locator("svg")).toHaveAttribute("aria-hidden", "true");
  return link.evaluate(element => {
    const style = getComputedStyle(element);
    const arrow = element.querySelector("svg")!.getBoundingClientRect();
    return { padding: style.padding, gap: style.gap, background: style.backgroundColor,
      radius: style.borderRadius, arrowWidth: arrow.width, arrowHeight: arrow.height };
  });
}

test("shared resume rows keep real puzzle, lesson and course-line destinations", async ({ page, context }, info) => {
  const puzzleResponse = await page.request.post(`/__test/puzzle-fixture/resume-row-${info.project.name}`);
  expect(puzzleResponse.ok()).toBe(true);
  const puzzle: { session_id: string } = await puzzleResponse.json();
  const puzzlePath = `/study/puzzles/sessions/${puzzle.session_id}`;
  const started: Schema["PuzzleSessionView"] = await (await page.request.get(`/api/puzzle-sessions/${puzzle.session_id}`)).json();
  // Only a committed move makes a puzzle resumable.
  const moved = await page.request.post(`/api/puzzle-sessions/${puzzle.session_id}/move`, {
    data: { request_id: `resume-row-${info.project.name}`, revision: started.revision, uci: "e2e4", elapsed_ms: 0 },
  });
  expect(moved.ok()).toBe(true);
  const puzzleBefore: Schema["PuzzleSessionView"] = await moved.json();
  await page.goto("/study/puzzles");
  const puzzleLink = page.locator(`a[href="${puzzlePath}"]`);
  await expect(puzzleLink).toHaveAccessibleName("Unfinished puzzle Your position is saved");
  const sharedAppearance = await appearance(puzzleLink);
  expect(sharedAppearance).toMatchObject({ padding: "14px", gap: "16px", radius: "5px", arrowWidth: 18, arrowHeight: 18 });
  await puzzleLink.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(puzzlePath);
  await expect(page.getByRole("heading", { name: "Keep going.", exact: true })).toBeVisible();
  const puzzleAfter: Schema["PuzzleSessionView"] = await (await page.request.get(`/api/puzzle-sessions/${puzzle.session_id}`)).json();
  expect(puzzleAfter.revision).toBe(puzzleBefore.revision);
  expect(puzzleAfter.current_step).toBe(puzzleBefore.current_step);
  await page.goBack();
  await expect(page).toHaveURL("/study/puzzles");

  const lessonResponse = await page.request.post(`/__test/lesson-fixture/resume-row-${info.project.name}`);
  expect(lessonResponse.ok()).toBe(true);
  const lesson: { session_id: string; course_id: string; revision: string } = await lessonResponse.json();
  const lessonPath = `/study/openings/sessions/${lesson.session_id}`;
  const lessonBefore: Schema["LessonSessionView"] = await (await page.request.get(`/api/study/lesson-sessions/${lesson.session_id}`)).json();
  await page.goto("/study/openings");
  const lessonLink = page.locator(`a[href="${lessonPath}"]`);
  await expect(lessonLink).toContainText(lessonBefore.course_title);
  await expect(lessonLink.locator("small")).toHaveText(lessonBefore.chapter_title);
  expect(await appearance(lessonLink)).toEqual(sharedAppearance);
  if (info.project.name === "desktop") {
    const [other] = await Promise.all([
      context.waitForEvent("page"),
      lessonLink.click({ modifiers: ["ControlOrMeta"] }),
    ]);
    try {
      await expect(other).toHaveURL(lessonPath);
      await expect(page).toHaveURL("/study/openings");
    } finally {
      await other.close();
    }
  }
  await lessonLink.click();
  await expect(page).toHaveURL(lessonPath);
  await expect(page.getByRole("heading", { name: "Start from the beginning", exact: true })).toBeVisible();
  const lessonAfter: Schema["LessonSessionView"] = await (await page.request.get(`/api/study/lesson-sessions/${lesson.session_id}`)).json();
  expect(lessonAfter.revision).toBe(lessonBefore.revision);
  expect(lessonAfter.history).toEqual(lessonBefore.history);
  await page.getByRole("link", { name: "Chapters", exact: true }).click();
  const linePath = `/study/openings/courses/${lesson.course_id}/lines/fixture-main?revision=${lesson.revision}`;
  const line = page.getByRole("region", { name: "Course recall lines" }).getByRole("link", { name: /Fixture main line/ });
  await expect(line).toHaveAttribute("href", linePath);
  await expect(line.locator("small")).toHaveText("Preview and add to study");
  expect(await appearance(line)).toEqual(sharedAppearance);
  await line.click();
  await expect(page).toHaveURL(linePath);
  await expect(page.getByRole("heading", { name: `${lessonBefore.course_title}: Fixture main line`, exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add to study", exact: true })).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
