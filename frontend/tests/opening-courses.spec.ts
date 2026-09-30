import { expect, test, type Page } from "@playwright/test";
import type { Schema } from "../src/api";

const revision = "2026-09-v1";
const courses = [
  {
    id: "italian-black-foundations", color: "black", chapter: "quiet-development",
    moves: ["e7e5", "b8c6", "f8c5", "g8f6", "d7d6", "e8g8"],
    line: "black-quiet-italian",
  },
  {
    id: "kings-gambit-foundations", color: "white", chapter: "pawn-chain",
    moves: ["h2h4", "f3e5", "d2d4", "e5d3", "c1f4", "g2g3"],
    line: "challenge-pawn-chain",
  },
] as const;

async function saved(page: Page, id: string): Promise<Schema["LessonSessionView"]> {
  const response = await page.request.get(`/api/study/lesson-sessions/${id}`);
  expect(response.ok()).toBe(true);
  return response.json();
}

async function command(page: Page, label: string): Promise<Schema["LessonSessionView"]> {
  const pending = page.waitForResponse(response => response.url().includes("/lesson-sessions/") && response.url().endsWith("/command"));
  await page.getByRole("button", { name: label, exact: true }).click();
  const response = await pending;
  expect(response.ok()).toBe(true);
  return response.json();
}

async function move(page: Page, uci: string): Promise<Schema["LessonSessionView"]> {
  const pending = page.waitForResponse(response => response.url().includes("/lesson-sessions/") && response.url().endsWith("/command"));
  await page.locator(`.board-shell [data-square="${uci.slice(0, 2)}"]`).click();
  await page.locator(`.board-shell [data-square="${uci.slice(2, 4)}"]`).click();
  const response = await pending;
  expect(response.ok()).toBe(true);
  const result: Schema["LessonSessionView"] = await response.json();
  expect(result.feedback?.kind).toBe("correct");
  return result;
}

async function studyIds(page: Page) {
  const response = await page.request.get("/api/opening-studies");
  expect(response.ok()).toBe(true);
  const library: Schema["OpeningStudyLibrary"] = await response.json();
  return library.items.map(item => item.id).sort();
}

for (const content of courses) {
  test(`${content.id} teaches its own side and preserves source exploration without automatic recalls`, async ({ page }, info) => {
    const preferences = await page.request.get("/api/preferences/motion");
    expect(preferences.ok()).toBe(true);
    const originalMotion: Schema["MotionPreferences"] = await preferences.json();
    let enrolledId: string | null = null;
    try {
      expect((await page.request.put("/api/preferences/motion", { data: { motion: "still" } })).ok()).toBe(true);
      const before = await studyIds(page);
      const dueBefore = await (await page.request.get("/api/review/count")).json();
      const detail = await page.request.get(`/api/study/courses/${content.id}?revision=${revision}`);
      expect(detail.ok()).toBe(true);
      const course: Schema["LessonCourseView"] = await detail.json();
      expect(course.learner_color).toBe(content.color);
      const chapter = course.chapters.find(item => item.id === content.chapter)!;
      expect(chapter).toBeTruthy();
      await page.goto("/study/openings");
      await page.locator(`.lesson-course-card[href="/study/openings/courses/${content.id}?revision=${revision}"]`).click();
      await expect(page.getByRole("heading", { name: course.title, exact: true })).toBeVisible();
      const row = page.locator(".lesson-chapters li").filter({ has: page.getByRole("heading", { name: chapter.title, exact: true }) });
      const pending = page.waitForResponse(response => new URL(response.url()).pathname === "/api/study/lesson-sessions" && response.request().method() === "POST");
      await row.getByRole("button", { name: /^(Start|Revisit)$/ }).click();
      const response = await pending;
      expect(response.ok()).toBe(true);
      let session: Schema["LessonSessionView"] = await response.json();
      expect(session.orientation).toBe(content.color);
      await expect(page).toHaveURL(`/study/openings/sessions/${session.id}`);
      await expect(page.getByRole("region", { name: "Lesson position" })).toBeVisible();
      const left = await page.locator('.board-shell [data-square="a1"]').boundingBox();
      const right = await page.locator('.board-shell [data-square="h1"]').boundingBox();
      expect(left).not.toBeNull();
      expect(right).not.toBeNull();
      expect(left!.x < right!.x).toBe(content.color === "white");

      let decisions = 0;
      let sourceInspected = false;
      for (let step = 0; session.step.kind !== "rehearsal" && step < 40; step++) {
        if (session.actions.includes("move")) {
          expect(session.step.kind).toBe("decision");
          expect(session.fen.split(" ")[1]).toBe(content.color === "white" ? "w" : "b");
          expect(decisions).toBeLessThan(content.moves.length);
          session = await move(page, content.moves[decisions++]);
        } else if (session.step.kind === "game_excerpt" && session.step.phase === "complete" && !sourceInspected) {
          const anchor = session;
          const opened = await command(page, "Explore full game");
          expect(opened.game?.attributions.length).toBeGreaterThan(0);
          await expect(page.locator(".lesson-attributions")).toContainText(opened.game!.attributions[0].text);
          await command(page, "From the beginning");
          const advanced = await command(page, "Next game move");
          await page.reload();
          await expect(page.getByRole("button", { name: "Return to lesson", exact: true })).toBeVisible();
          const restored = await saved(page, session.id);
          expect(restored.history).toEqual(advanced.history);
          expect(restored.game?.ply).toBe(1);
          expect(restored.playback).toEqual([]);
          session = await command(page, "Return to lesson");
          expect(session.fen).toBe(anchor.fen);
          expect(session.history).toEqual(anchor.history);
          sourceInspected = true;
        } else {
          session = await command(page,
            ["demonstration", "game_excerpt"].includes(session.step.kind) && session.step.phase === "ready"
              ? "Play continuation" : "Continue");
        }
      }
      expect(decisions).toBe(content.moves.length);
      expect(sourceInspected).toBe(true);
      expect(session.step.kind).toBe("rehearsal");
      expect(session.fen.split(" ")[1]).toBe(content.color === "white" ? "w" : "b");
      expect(session.step.text).toBe("Play this line from memory.");
      expect(session.step.annotations).toEqual({ squares: [], arrows: [] });
      await expect(page.getByRole("button", { name: "Hint", exact: true })).toHaveCount(0);
      await expect(page.locator(".coach-message")).toContainText("Play this line from memory.");
      expect(await studyIds(page)).toEqual(before);
      expect(await (await page.request.get("/api/review/count")).json()).toEqual(dueBefore);
      expect(session.failed).toBe(false);
      expect(session.assisted).toBe(false);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: `test-results/${content.id}-${info.project.name}.png`, fullPage: true });

      await page.getByRole("link", { name: "Chapters", exact: true }).click();
      const line = course.lines.find(item => item.id === content.line)!;
      expect(line.repertoire).toBe(true);
      await page.getByRole("region", { name: "Course recall lines" }).getByRole("link", { name: new RegExp(line.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) }).click();
      const selectedSide = page.getByRole("radio", { name: new RegExp(`^${content.color === "white" ? "White" : "Black"}`) });
      await expect(selectedSide).toBeChecked();
      await page.reload();
      await expect(selectedSide).toBeChecked();
      const otherSide = page.getByRole("radio", { name: new RegExp(`^${content.color === "white" ? "Black" : "White"}`) });
      await otherSide.check();
      await expect(otherSide).toBeChecked();
      await selectedSide.check();
      const enrollment = page.waitForResponse(value => value.url().includes("/api/opening-studies") && value.request().method() === "POST");
      await page.getByRole("button", { name: /^(Add to study|Resume recalls)$/ }).click();
      const added = await enrollment;
      expect(added.ok()).toBe(true);
      const study: Schema["OpeningStudyView"] = await added.json();
      enrolledId = study.id;
      expect(study.color).toBe(content.color);
      expect(study.line.course_id).toBe(content.id);
      expect(study.line.line_id).toBe(content.line);
      expect(study.source_version).toBe(revision);
      expect(study.positions).toBeGreaterThan(0);
      await expect(page.getByRole("button", { name: "Added to study", exact: true })).toBeDisabled();
    } finally {
      if (enrolledId) expect((await page.request.delete(`/api/opening-studies/${enrolledId}`)).ok()).toBe(true);
      expect((await page.request.put("/api/preferences/motion", { data: originalMotion })).ok()).toBe(true);
    }
  });
}
