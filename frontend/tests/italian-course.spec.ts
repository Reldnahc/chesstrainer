import { expect, test, type Page } from "@playwright/test";
import type { Schema } from "../src/api";

const courseId = "italian-foundations";
const courseRevision = "2026-09-v1";
const coursePath = `/study/openings/courses/${courseId}?revision=${courseRevision}`;
const savedMotion = new WeakMap<Page, Schema["MotionPreferences"]>();
const enrolled = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const preferences = await page.request.get("/api/preferences/motion");
  expect(preferences.ok()).toBe(true);
  savedMotion.set(page, await preferences.json());
  enrolled.set(page, []);
  expect((await page.request.put("/api/preferences/motion", { data: { motion: "still" } })).ok()).toBe(true);
});
test.afterEach(async ({ page }) => {
  for (const id of enrolled.get(page) || []) expect((await page.request.delete(`/api/opening-studies/${id}`)).ok()).toBe(true);
  expect((await page.request.put("/api/preferences/motion", { data: savedMotion.get(page) })).ok()).toBe(true);
});

async function course(page: Page): Promise<Schema["LessonCourseView"]> {
  const response = await page.request.get(`/api/study/courses/${courseId}?revision=${courseRevision}`);
  expect(response.ok()).toBe(true);
  return response.json();
}
async function saved(page: Page, id: string): Promise<Schema["LessonSessionView"]> {
  const response = await page.request.get(`/api/study/lesson-sessions/${id}`);
  expect(response.ok()).toBe(true);
  return response.json();
}
async function start(page: Page, chapterId: string) {
  const content = await course(page);
  const chapter = content.chapters.find(item => item.id === chapterId)!;
  expect(chapter).toBeTruthy();
  await page.goto(coursePath);
  const row = page.locator(".lesson-chapters li").filter({ has: page.getByRole("heading", { name: chapter.title, exact: true }) });
  const pending = page.waitForResponse(response => new URL(response.url()).pathname === "/api/study/lesson-sessions" && response.request().method() === "POST");
  await row.getByRole("button", { name: /^(Start|Revisit)$/ }).click();
  const response = await pending;
  expect(response.ok()).toBe(true);
  const session: Schema["LessonSessionView"] = await response.json();
  await expect(page).toHaveURL(`/study/openings/sessions/${session.id}`);
  await expect(page.getByRole("region", { name: "Lesson position" })).toBeVisible();
  return session;
}
async function command(page: Page, label: string) {
  const pending = page.waitForResponse(response => response.url().includes("/lesson-sessions/") && response.url().endsWith("/command"));
  await page.getByRole("button", { name: label, exact: true }).click();
  const response = await pending;
  expect(response.ok()).toBe(true);
  return response.json() as Promise<Schema["LessonSessionView"]>;
}
async function move(page: Page, uci: string) {
  const pending = page.waitForResponse(response => response.url().includes("/lesson-sessions/") && response.url().endsWith("/command"));
  await page.locator(`.board-shell [data-square="${uci.slice(0, 2)}"]`).click();
  await page.locator(`.board-shell [data-square="${uci.slice(2, 4)}"]`).click();
  const response = await pending;
  expect(response.ok()).toBe(true);
  const session: Schema["LessonSessionView"] = await response.json();
  expect(session.feedback?.kind).toBe("correct");
  return session;
}
async function studyIds(page: Page) {
  const response = await page.request.get("/api/opening-studies");
  expect(response.ok()).toBe(true);
  const library: Schema["OpeningStudyLibrary"] = await response.json();
  return library.items.map(item => item.id).sort();
}

for (const motion of ["still", "natural"] as const) {
  test(`first lesson drags show legal destinations after instructions with ${motion} motion`, async ({ page }) => {
    expect((await page.request.put("/api/preferences/motion", { data: { motion } })).ok()).toBe(true);
    await start(page, "quiet-development");
    await command(page, "Continue");
    await command(page, "Play continuation");
    const board = page.locator(".board-shell");
    for (const uci of ["g1f3", "f1c4"]) {
      const position = await command(page, "Continue");
      await expect(page.getByRole("heading", { name: position.step.title, exact: true })).toBeVisible();
      const source = board.locator(`[data-square="${uci.slice(0, 2)}"]`);
      const target = board.locator(`[data-square="${uci.slice(2, 4)}"]`);
      await source.scrollIntoViewIfNeeded();
      const from = (await source.boundingBox())!, to = (await target.boundingBox())!;
      const expected = position.legal_moves.filter(move => move.from_square === uci.slice(0, 2)).map(move => move.to_square).sort();
      expect(expected.length).toBeGreaterThan(1);
      await expect(board.locator("[data-legal-destination]")).toHaveCount(0);
      await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
      await page.mouse.down();
      try {
        await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
        await expect.poll(() => board.locator("[data-legal-destination]").evaluateAll(markers => markers.map(marker => marker.getAttribute("data-legal-destination")).sort())).toEqual(expected);
        const pending = page.waitForResponse(response => response.url().includes("/lesson-sessions/") && response.url().endsWith("/command"));
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
}

test("the real Italian course teaches a quiet line, returns from its alternative, rehearses and enrolls only on request", async ({ page }, info) => {
  const before = await studyIds(page);
  const session = await start(page, "quiet-development");
  expect(session.course_revision).toBe(courseRevision);
  expect(session.orientation).toBe("white");
  expect(session.step.id).toBe("welcome");
  await command(page, "Continue");
  const center = await command(page, "Play continuation");
  expect(center.playback.map(frame => frame.uci)).toEqual(["e2e4", "e7e5"]);
  await command(page, "Continue");
  const knight = await move(page, "g1f3");
  expect(knight.playback.map(frame => frame.uci)).toEqual(["g1f3", "b8c6"]);
  await command(page, "Continue");
  await move(page, "f1c4");
  const anchor = await command(page, "Continue");
  expect(anchor.step.id).toBe("black-choice");
  await command(page, "Explore alternative");
  const alternative = await command(page, "Play continuation");
  expect(alternative.playback.map(frame => frame.uci)).toEqual(["g8f6", "d2d3", "f8c5"]);
  const branch = await command(page, "Continue");
  expect(branch.branch).not.toBeNull();
  await page.reload();
  await expect(page.getByRole("button", { name: "Return to main line", exact: true })).toBeVisible();
  expect((await saved(page, session.id)).history).toEqual(branch.history);
  const returned = await command(page, "Return to main line");
  expect(returned.history).toEqual(anchor.history);
  expect(returned.fen).toBe(anchor.fen);
  await command(page, "Continue");
  await command(page, "Play continuation");
  await command(page, "Continue");
  const castled = await move(page, "e1g1");
  expect(castled.playback.map(frame => frame.uci)).toEqual(["e1g1", "d7d6"]);
  await command(page, "Continue");
  const excerpt = await command(page, "Play continuation");
  expect(excerpt.step.id).toBe("quiet-game");
  await expect(page.locator(".coach-message")).toContainText(excerpt.step.text);
  const game = await command(page, "Explore full game");
  expect(game.game?.attributions.length).toBeGreaterThan(0);
  await expect(page.locator(".lesson-attributions")).toContainText(game.game!.attributions[0].text);
  await command(page, "From the beginning");
  await command(page, "Next game move");
  const closed = await command(page, "Return to lesson");
  expect(closed.history).toEqual(excerpt.history);
  const rehearsal = await command(page, "Continue");
  expect(rehearsal.step.id).toBe("quiet-recall");
  await expect(page.getByRole("button", { name: "Hint", exact: true })).toHaveCount(0);
  await expect(page.locator(".coach-message")).not.toContainText("Nf3");
  await expect(page.locator(".lesson-context")).not.toContainText("Bc4");
  expect(await studyIds(page)).toEqual(before);
  let completed = rehearsal;
  for (const uci of ["e2e4", "g1f3", "f1c4", "d2d3", "e1g1"]) completed = await move(page, uci);
  if (completed.status !== "completed") completed = await command(page, "Continue");
  expect(completed.status).toBe("completed");
  expect(completed.failed).toBe(false);
  expect(completed.assisted).toBe(false);
  await expect(page.getByRole("heading", { name: "Chapter completed.", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Chapter completed.", exact: true })).toBeVisible();
  expect((await saved(page, session.id)).revision).toBe(completed.revision);
  expect(await studyIds(page)).toEqual(before);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/italian-course-${info.project.name}.png`, fullPage: true });

  await page.getByRole("link", { name: "Choose a chapter", exact: true }).click();
  const content = await course(page);
  const repertoire = content.lines.find(line => line.id === "quiet-italian")!;
  expect(repertoire.repertoire).toBe(true);
  await page.getByRole("region", { name: "Course recall lines" }).locator(`a[href="/study/openings/courses/${courseId}/lines/${repertoire.id}?revision=${courseRevision}"]`).click();
  // Projects share one account. The second run can restore the same pinned study.
  const add = page.getByRole("button", { name: /^(Add to study|Resume recalls)$/ });
  const pending = page.waitForResponse(response => response.url().includes("/api/opening-studies") && response.request().method() === "POST");
  await add.click();
  const response = await pending;
  expect(response.ok()).toBe(true);
  const study: Schema["OpeningStudyView"] = await response.json();
  enrolled.get(page)!.push(study.id);
  expect(study.line.course_id).toBe(courseId);
  expect(study.line.line_id).toBe("quiet-italian");
  expect(study.source_version).toBe(courseRevision);
  await expect(page.getByRole("button", { name: "Added to study", exact: true })).toBeDisabled();
});

test("the other Italian chapters show distinct sourced game passages with exact returns from full-game playback", async ({ page }, info) => {
  const games = new Set<string>();
  for (const chapterId of ["central-break", "two-knights"]) {
    let session = await start(page, chapterId);
    // Walk authored guidance to its real game passage; no fixture curriculum.
    for (let steps = 0; session.step.kind !== "game_excerpt" && steps < 24; steps++) {
      const label = session.actions.includes("show_move") ? "Show move"
        : session.step.kind === "demonstration" && session.step.phase === "ready" ? "Play continuation" : "Continue";
      session = await command(page, label);
    }
    expect(session.step.kind).toBe("game_excerpt");
    const excerpt = await command(page, "Play continuation");
    expect(excerpt.step.text.length).toBeGreaterThan(10);
    await expect(page.locator(".coach-message")).toContainText(excerpt.step.text);
    const opened = await command(page, "Explore full game");
    expect(opened.game?.attributions.length).toBeGreaterThan(0);
    games.add(opened.game!.title);
    await expect(page.locator(".lesson-attributions")).toContainText(opened.game!.attributions[0].text);
    const beginning = await command(page, "From the beginning");
    expect(beginning.game?.ply).toBe(0);
    await command(page, "Next game move");
    await page.reload();
    await expect(page.getByRole("button", { name: "Return to lesson", exact: true })).toBeVisible();
    expect((await saved(page, session.id)).game?.ply).toBe(1);
    const returned = await command(page, "Return to lesson");
    expect(returned.history).toEqual(excerpt.history);
    expect(returned.fen).toBe(excerpt.fen);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/italian-${chapterId}-${info.project.name}.png`, fullPage: true });
  }
  expect(games.size).toBe(2);
});
