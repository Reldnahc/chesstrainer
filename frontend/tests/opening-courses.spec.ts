import { expect, test, type Page } from "@playwright/test";
import type { Schema } from "../src/api";
import { expectNoNewDueReviews, settledDueReviews } from "./helpers/server";

type CourseJourney = {
  id: string;
  revision: string;
  color: "white" | "black";
  chapter: string;
  moves: string[];
  line: string;
  branches: number;
  // Learner moves inside side trips, keyed by decision step.
  branchMoves?: Record<string, string>;
  sourceGame: boolean;
  rehearsalAnchor?: string[];
};
const courses: CourseJourney[] = [
  {
    id: "italian-black-foundations", revision: "2026-10-v4", color: "black", chapter: "quiet-development",
    moves: ["e7e5", "b8c6", "f8c5", "g8f6", "d7d6", "e8g8"],
    line: "black-quiet-italian", branches: 1, sourceGame: true,
  },
  {
    id: "italian-black-foundations", revision: "2026-10-v4", color: "black", chapter: "quiet-bishop-plan",
    moves: ["a7a5", "c8e6", "f7e6"],
    line: "black-quiet-bishop-plan", branches: 0, sourceGame: false,
    // Rehearsal retains the opening history and automatically plays White's Re1.
    rehearsalAnchor: ["e2e4", "e7e5", "g1f3", "b8c6", "f1c4", "f8c5", "d2d3", "g8f6", "e1g1", "d7d6", "c2c3", "e8g8", "f1e1"],
  },
  {
    id: "kings-gambit-foundations", revision: "2026-10-v5", color: "white", chapter: "pawn-chain",
    moves: ["h2h4", "f3e5", "f1c4", "e4d5", "d2d4", "e1g1"],
    line: "challenge-pawn-chain", branches: 1, sourceGame: true,
  },
  {
    id: "kings-gambit-foundations", revision: "2026-10-v5", color: "white", chapter: "falkbeer-countergambit",
    moves: ["e4d5", "d2d3", "d3e4", "g1f3", "d1e2", "b1c3", "c1e3"],
    line: "falkbeer-center", branches: 5, sourceGame: false,
    branchMoves: {
      "falkbeer-modern-knight": "g1f3", "falkbeer-modern-check": "f1b5",
      "falkbeer-early-chase": "b1c3", "falkbeer-early-pawn": "f4e5", "falkbeer-early-block": "f1e2", "falkbeer-early-center": "d2d4",
      "falkbeer-wedge-queen-knight": "b1c3", "falkbeer-wedge-queen-pin": "c1d2", "falkbeer-wedge-queen-recapture": "d2c3",
      "falkbeer-wedge-take-bishop": "f1d3", "falkbeer-wedge-take-knight": "b1c3",
      "falkbeer-resolution-counter": "e3c5", "falkbeer-resolution-recapture": "f1e2", "falkbeer-resolution-king": "e1e2",
    },
    rehearsalAnchor: ["e2e4", "e7e5", "f2f4", "d7d5"],
  },
];

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
  test(`${content.id}/${content.chapter} teaches its own side and preserves exploration without automatic recalls`, async ({ page }, info) => {
    const preferences = await page.request.get("/api/preferences/motion");
    expect(preferences.ok()).toBe(true);
    const originalMotion: Schema["MotionPreferences"] = await preferences.json();
    let enrolledId: string | null = null;
    try {
      expect((await page.request.put("/api/preferences/motion", { data: { motion: "still" } })).ok()).toBe(true);
      const before = await studyIds(page);
      const dueBefore = await settledDueReviews(page);
      const detail = await page.request.get(`/api/study/courses/${content.id}?revision=${content.revision}`);
      expect(detail.ok()).toBe(true);
      const course: Schema["LessonCourseView"] = await detail.json();
      expect(course.learner_color).toBe(content.color);
      const chapter = course.chapters.find(item => item.id === content.chapter)!;
      expect(chapter).toBeTruthy();
      await page.goto("/study/openings");
      await page.locator(`.lesson-course-card[href="/study/openings/courses/${content.id}?revision=${content.revision}"]`).click();
      await expect(page.getByRole("heading", { name: course.title, exact: true })).toBeVisible();
      const row = page.locator(".lesson-chapters li").filter({ has: page.getByRole("heading", { name: chapter.title, exact: true }) });
      const pending = page.waitForResponse(response => new URL(response.url()).pathname === "/api/study/lesson-sessions" && response.request().method() === "POST");
      await row.getByRole("button", { name: /^(Start|Revisit)$/ }).click();
      const response = await pending;
      expect(response.ok()).toBe(true);
      let session: Schema["LessonSessionView"] = await response.json();
      expect(session.orientation).toBe(content.color);
      expect(session.course_revision).toBe(content.revision);
      await expect(page).toHaveURL(`/study/openings/sessions/${session.id}`);
      await expect(page.getByRole("region", { name: "Lesson position" })).toBeVisible();
      const initial = session;
      await page.reload();
      session = await saved(page, session.id);
      expect(session.step.id).toBe(initial.step.id);
      expect(session.fen).toBe(initial.fen);
      expect(session.history).toEqual(initial.history);
      await expect(page).toHaveURL(`/study/openings/sessions/${session.id}`);
      await expect(page.getByRole("region", { name: "Lesson position" })).toBeVisible();
      const left = await page.locator('.board-shell [data-square="a1"]').boundingBox();
      const right = await page.locator('.board-shell [data-square="h1"]').boundingBox();
      expect(left).not.toBeNull();
      expect(right).not.toBeNull();
      expect(left!.x < right!.x).toBe(content.color === "white");

      let decisions = 0;
      let sourceInspected = false;
      let branchAnchor: Schema["LessonSessionView"] | null = null;
      const explored = new Set<string>();
      // Include the new teaching contrasts, then resume the exact main-line board.
      for (let step = 0; session.step.kind !== "rehearsal" && step < 200; step++) {
        if (session.step.kind === "branch" && !session.branch && !explored.has(session.step.id)) {
          explored.add(session.step.id);
          branchAnchor = session;
          session = await command(page, "Explore alternative");
          expect(session.branch).not.toBeNull();
        } else if (session.branch && !session.actions.includes("continue") && !session.actions.includes("move")) {
          expect(branchAnchor).not.toBeNull();
          const branch = session;
          await page.reload();
          await expect(page.getByRole("button", { name: "Return to main line", exact: true })).toBeVisible();
          const restored = await saved(page, session.id);
          expect(restored.fen).toBe(branch.fen);
          expect(restored.branch).toEqual(branch.branch);
          await expect(page.locator(".coach-message")).toContainText(branch.step.text);
          await page.screenshot({ path: `test-results/${content.id}-${content.chapter}-${branch.step.id}-contrast-${info.project.name}.png`, fullPage: true });
          session = await command(page, "Return to main line");
          expect(session.fen).toBe(branchAnchor!.fen);
          expect(session.history).toEqual(branchAnchor!.history);
          expect(session.step.id).toBe(branchAnchor!.step.id);
          expect(session.branch).toBeNull();
          branchAnchor = null;
        } else if (session.actions.includes("move")) {
          expect(session.step.kind).toBe("decision");
          expect(session.fen.split(" ")[1]).toBe(content.color === "white" ? "w" : "b");
          if (session.branch) {
            const uci = content.branchMoves?.[session.step.id];
            expect(uci, session.step.id).toBeTruthy();
            session = await move(page, uci!);
            continue;
          }
          expect(decisions).toBeLessThan(content.moves.length);
          if (decisions === 0 && content.rehearsalAnchor) {
            expect(session.history.map(frame => frame.uci)).toEqual(content.rehearsalAnchor);
          }
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
      expect(explored.size).toBe(content.branches);
      expect(branchAnchor).toBeNull();
      expect(sourceInspected).toBe(content.sourceGame);
      expect(session.step.kind).toBe("rehearsal");
      expect(session.fen.split(" ")[1]).toBe(content.color === "white" ? "w" : "b");
      expect(session.step.text).toBe("Play this line from memory.");
      expect(session.step.annotations).toEqual({ squares: [], arrows: [] });
      await expect(page.getByRole("button", { name: "Hint", exact: true })).toHaveCount(0);
      await expect(page.locator(".coach-message")).toContainText("Play this line from memory.");
      expect(await studyIds(page)).toEqual(before);
      await expectNoNewDueReviews(page, dueBefore);
      expect(session.failed).toBe(false);
      expect(session.assisted).toBe(false);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: `test-results/${content.id}-${content.chapter}-${info.project.name}.png`, fullPage: true });
      if (content.rehearsalAnchor) {
        expect(session.history.map(frame => frame.uci)).toEqual(content.rehearsalAnchor);
        const rehearsal = session;
        await page.reload();
        await expect(page.locator(".coach-message")).toHaveText("Play this line from memory.");
        session = await saved(page, session.id);
        expect(session.history).toEqual(rehearsal.history);
        expect(session.fen).toBe(rehearsal.fen);
        expect(session.playback).toEqual([]);
        expect(session.step.annotations).toEqual({ squares: [], arrows: [] });
        await expect(page.getByRole("button", { name: "Hint", exact: true })).toHaveCount(0);
        for (const uci of content.moves) session = await move(page, uci);
        if (session.status !== "completed") session = await command(page, "Continue");
        expect(session.status).toBe("completed");
        expect(session.failed).toBe(false);
        expect(session.assisted).toBe(false);
        expect(session.history.slice(0, rehearsal.history.length)).toEqual(rehearsal.history);
        expect(await studyIds(page)).toEqual(before);
        await expectNoNewDueReviews(page, dueBefore);
        await page.getByRole("link", { name: "Choose a chapter", exact: true }).click();
      } else {
        await page.getByRole("link", { name: "Chapters", exact: true }).click();
      }

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
      expect(study.source_version).toBe(content.revision);
      expect(study.positions).toBeGreaterThan(0);
      await expect(page.getByRole("button", { name: "Added to study", exact: true })).toBeDisabled();
    } finally {
      if (enrolledId) expect((await page.request.delete(`/api/opening-studies/${enrolledId}`)).ok()).toBe(true);
      expect((await page.request.put("/api/preferences/motion", { data: originalMotion })).ok()).toBe(true);
    }
  });
}
