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
    id: "italian-black-foundations", revision: "2026-10-v5", color: "black", chapter: "quiet-development",
    moves: ["e7e5", "b8c6", "f8c5", "g8f6", "d7d6", "e8g8"],
    line: "black-quiet-italian", branches: 5, sourceGame: true,
    branchMoves: {
      "early-castle-knight": "g8f6", "early-castle-support": "d7d6",
      "early-knight-develop": "g8f6", "early-knight-support": "d7d6",
      "early-attack-take": "d8g5", "early-attack-punish": "g5g2",
      "early-center-take": "c5d4", "early-center-recapture": "c6d4", "early-center-retreat": "d4c6", "early-center-guard": "d8f6",
      "quiet-threat-castle": "e8g8",
    },
  },
  {
    id: "italian-black-foundations", revision: "2026-10-v5", color: "black", chapter: "quiet-bishop-plan",
    moves: ["a7a5", "c8e6", "f7e6"],
    line: "black-quiet-bishop-plan", branches: 0, sourceGame: false,
    // Rehearsal retains the opening history and automatically plays White's Re1.
    rehearsalAnchor: ["e2e4", "e7e5", "g1f3", "b8c6", "f1c4", "f8c5", "d2d3", "g8f6", "e1g1", "d7d6", "c2c3", "e8g8", "f1e1"],
  },
  {
    id: "italian-black-foundations", revision: "2026-10-v5", color: "black", chapter: "knight-block",
    moves: ["f6e4", "b4c3", "d7d5", "e8g8"],
    line: "black-knight-block", branches: 2, sourceGame: false,
    branchMoves: {
      "block-queen-defend": "d7d5", "block-queen-castle": "e8g8",
      "block-moller-bishop": "c3f6", "block-moller-recapture": "b7c6",
    },
    // Rehearsal starts at the bishop check and automatically plays White's Nc3.
    rehearsalAnchor: ["e2e4", "e7e5", "g1f3", "b8c6", "f1c4", "f8c5", "c2c3", "g8f6", "d2d4", "e5d4", "c3d4", "c5b4", "b1c3"],
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
  {
    id: "sicilian-dragon", revision: "2026-10-v1", color: "black", chapter: "dragon-setup",
    moves: ["c7c5", "d7d6", "c5d4", "g8f6", "g7g6", "f8g7", "e8g8", "b8c6", "b7c6", "d6d5"],
    line: "dragon-classical", branches: 4, sourceGame: false,
    branchMoves: {
      "setup-queen-knight": "b8c6", "setup-queen-pin": "c8d7", "setup-queen-recapture": "d7c6",
      "setup-queen-develop": "g8f6", "setup-queen-center": "e7e6", "setup-c4-fianchetto": "f8g7",
      "setup-c4-castle": "e8g8", "setup-e3-castle": "e8g8", "setup-e3-knight": "b8c6",
      "setup-e3-break": "d6d5", "setup-d2-break": "d6d5",
    },
  },
  {
    id: "sicilian-dragon", revision: "2026-10-v1", color: "black", chapter: "dragon-yugoslav",
    moves: ["f8g7", "e8g8", "b8c6", "d6d5", "f6d5", "d8d5", "d5c6", "c8e6"],
    line: "dragon-yugoslav", branches: 5, sourceGame: false,
    branchMoves: {
      "yugoslav-queen-jump": "f6g4", "yugoslav-queen-take": "g7d4", "yugoslav-queen-fork": "e7e5",
      "yugoslav-queen-capture": "d6e5", "yugoslav-queen-king": "e8d8", "yugoslav-c4-knight": "b8c6",
      "yugoslav-c4-trade": "c6d4", "yugoslav-c4-block": "c8e6", "yugoslav-c4-recapture": "f7e6",
      "yugoslav-c4-queen": "d8a5", "yugoslav-exchange-recapture": "b7c6", "yugoslav-exchange-bishop": "c8e6",
      "yugoslav-gambit-recapture": "b7c6", "yugoslav-gambit-pawn": "c6d5", "yugoslav-gambit-knight": "f6d5",
      "yugoslav-gambit-offer": "d8c7", "yugoslav-gambit-bishop": "c8f5", "yugoslav-gambit-king": "g8f8",
      "yugoslav-late-recapture": "b7c6", "yugoslav-late-pawn": "c6d5", "yugoslav-late-offer": "d8c7",
    },
  },
  {
    id: "sicilian-dragon", revision: "2026-10-v1", color: "black", chapter: "dragon-bg5",
    moves: ["f8g7", "h7h6", "f6g4", "e7e5", "e5d4", "d4c3"],
    line: "dragon-bg5", branches: 6, sourceGame: false,
    branchMoves: {
      "bg5-check-block": "c8d7", "bg5-check-recapture": "b8d7", "bg5-check-fianchetto": "f8g7",
      "bg5-c4-castle": "e8g8", "bg5-c4-ask": "h7h6", "bg5-c4-knight": "b8c6",
      "bg5-b5-block": "c8d7", "bg5-b5-recapture": "b8d7", "bg5-b5-castle": "e8g8",
      "bg5-h4-knight": "b8c6", "bg5-f6-recapture": "g7f6", "bg5-f6-knight": "b8c6",
      "bg5-f4-fork": "e7e5",
    },
  },
  {
    id: "sicilian-dragon", revision: "2026-10-v1", color: "black", chapter: "dragon-second-moves",
    moves: ["c7c5", "e7e6", "b8c6", "g8f6", "d7d5", "e6d5"],
    line: "dragon-second-bishop", branches: 4, sourceGame: false,
    branchMoves: {
      "second-nc3-pawn": "d7d6", "second-nc3-knight": "g8f6", "second-nc3-trade": "c5d4",
      "second-nc3-dragon": "g7g6", "second-c3-knight": "g8f6", "second-c3-jump": "f6d5",
      "second-c3-trade": "c5d4", "second-c3-pawn": "d7d6", "second-c3-develop": "b8c6",
      "second-queen-knight": "b8c6", "second-queen-develop": "g8f6", "second-queen-fianchetto": "g7g6",
      "second-morra-accept": "d4c3", "second-morra-pawn": "d7d6", "second-morra-knight": "b8c6",
      "second-morra-block": "e7e6", "second-morra-develop": "g8f6",
    },
  },
  {
    id: "sicilian-dragon", revision: "2026-10-v1", color: "black", chapter: "dragon-third-moves",
    moves: ["d7d6", "g8f6", "b8c6", "g7g6", "f8g7", "e8g8"],
    line: "dragon-third-bishop", branches: 5, sourceGame: false,
    branchMoves: {
      "third-check-block": "c8d7", "third-check-recapture": "b8d7", "third-check-knight": "g8f6",
      "third-check-fianchetto": "g7g6", "third-check-bishop": "f8g7", "third-nc3-knight": "g8f6",
      "third-nc3-trade": "c5d4", "third-nc3-dragon": "g7g6", "third-c3-knight": "g8f6",
      "third-c3-take": "f6e4", "third-c3-recapture": "e4c5", "third-ng5-block": "e7e6",
      "third-ng5-break": "d6d5", "third-bc4-nc3-block": "e7e6", "third-bc4-nc3-trade": "c5d4",
    },
  },
  {
    id: "vienna-gambit", revision: "2026-10-v1", color: "white", chapter: "vienna-accepted",
    moves: ["e2e4", "b1c3", "f2f4", "e4e5", "g1f3", "d2d4", "f1b5", "b5c4", "c1f4", "c4f7", "d1e2", "f3e5", "f4g5", "e5f7"],
    line: "vienna-accepted", branches: 6, sourceGame: false,
    branchMoves: {
      "accepted-queen-guard": "d1e2", "accepted-queen-develop": "d2d4", "accepted-queen-jump": "c3d5",
      "accepted-queen-discover": "e5d6", "accepted-queen-fork": "d6c7", "accepted-knight-center": "d2d4",
      "accepted-knight-pin": "f1b5", "accepted-knight-queen": "d1e2", "accepted-knight-recapture": "c1f4",
      "accepted-pin-take": "c1f4", "accepted-pin-recapture": "f4e5", "accepted-pin-bishop": "f1b5",
      "accepted-block-queen": "d1e2", "accepted-block-recapture": "c3b5", "accepted-king-takes-queen": "d1d8",
      "accepted-king-back-discover": "e5c6", "accepted-king-back-queen": "c6e7",
    },
  },
  {
    id: "vienna-gambit", revision: "2026-10-v1", color: "white", chapter: "vienna-strike",
    moves: ["f4e5", "g1f3", "b2c3", "d2d4", "f1d3", "e1g1", "h2h3"],
    line: "vienna-strike", branches: 3, sourceGame: false,
    branchMoves: {
      "strike-pin-queen": "d1e2", "strike-pin-recapture": "d2c3", "strike-pin-guard": "c1f4",
      "strike-bishop-center": "d2d4", "strike-bishop-block": "c1d2", "strike-bishop-recapture": "d1d2",
      "strike-knight-center": "d2d4", "strike-knight-bishop": "f1d3", "strike-knight-castle": "e1g1",
    },
  },
  {
    id: "vienna-gambit", revision: "2026-10-v1", color: "white", chapter: "vienna-declined",
    moves: ["g1f3", "d2d4", "f3d4", "d1d4", "c1e3", "e1c1"],
    line: "vienna-solid", branches: 3, sourceGame: false,
    branchMoves: {
      "solid-defended-take": "f4e5", "solid-defended-chase": "d2d4", "solid-defended-push": "e4e5",
      "solid-defended-develop": "g1f3", "solid-pin-ask": "h2h3", "solid-pin-recapture": "d1f3",
      "solid-pin-bishop": "f1b5", "solid-take-center": "d2d4", "solid-take-back": "c1f4",
    },
  },
  {
    id: "vienna-gambit", revision: "2026-10-v1", color: "white", chapter: "vienna-second-moves",
    moves: ["f1c4", "d2d3", "g1f3", "e1g1", "h2h3"],
    line: "vienna-second-knights", branches: 3, sourceGame: false,
    branchMoves: {
      "anderssen-knight": "g1f3", "anderssen-center": "d2d4", "anderssen-recapture": "f3d4",
      "anderssen-pin": "c1g5", "anderssen-keep": "g5h4", "anderssen-retreat": "h4g3",
      "knights-early-knight": "g1f3", "knights-early-castle": "e1g1", "knights-early-support": "d2d3",
      "knights-pin-develop": "g1f3", "knights-pin-recapture": "b2c3",
    },
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

// Each journey restores what it changes, and one alone takes most of a minute, so the
// journeys spread over workers instead of queueing behind one another in one.
test.describe.configure({ mode: "parallel" });

for (const content of courses) {
  test(`${content.id}/${content.chapter} teaches its own side and preserves exploration without automatic recalls`, async ({ page }, info) => {
    // Each journey walks every side trip and reloads at each one, which outlasts the default 30s.
    test.setTimeout(90_000);
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
