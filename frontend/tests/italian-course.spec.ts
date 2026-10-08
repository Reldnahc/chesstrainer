import { expect, test, type Page } from "@playwright/test";
import type { Schema } from "../src/api";
import { expectNoNewDueReviews, settledDueReviews } from "./helpers/server";

const courseId = "italian-foundations";
const courseRevision = "2026-10-v3";
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
  expect(alternative.playback.map(frame => frame.uci)).toEqual(["g8f6"]);
  await command(page, "Continue");
  const defended = await move(page, "d2d3");
  expect(defended.playback.map(frame => frame.uci)).toEqual(["d2d3", "f8c5"]);
  let branch = await command(page, "Continue");
  let sourceInspected = false;
  for (let steps = 0; branch.actions.includes("continue") && steps < 12; steps++) {
    if (branch.step.kind === "game_excerpt" && branch.step.phase === "complete" && !sourceInspected) {
      const game = await command(page, "Explore full game");
      expect(game.game?.title).toContain("Pollock–Schiffers");
      expect(game.game?.attributions.length).toBeGreaterThan(0);
      await expect(page.locator(".lesson-attributions")).toContainText(game.game!.attributions[0].text);
      await command(page, "From the beginning");
      await command(page, "Next game move");
      const closed = await command(page, "Return to lesson");
      expect(closed.history).toEqual(branch.history);
      expect(closed.fen).toBe(branch.fen);
      branch = closed;
      sourceInspected = true;
    } else {
      branch = await command(page, ["demonstration", "game_excerpt"].includes(branch.step.kind) && branch.step.phase === "ready" ? "Play continuation" : "Continue");
    }
  }
  expect(sourceInspected).toBe(true);
  expect(branch.branch).not.toBeNull();
  expect(branch.actions).not.toContain("continue");
  await page.reload();
  await expect(page.getByRole("button", { name: "Return to main line", exact: true })).toBeVisible();
  expect((await saved(page, session.id)).history).toEqual(branch.history);
  const returned = await command(page, "Return to main line");
  expect(returned.history).toEqual(anchor.history);
  expect(returned.fen).toBe(anchor.fen);
  await command(page, "Continue");
  await command(page, "Play continuation");
  await command(page, "Continue");
  await move(page, "d2d3");
  await command(page, "Continue");
  const castled = await move(page, "e1g1");
  expect(castled.playback.map(frame => frame.uci)).toEqual(["e1g1", "d7d6"]);
  await command(page, "Continue");
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

test("full-game controls interrupt Mason-Lasker playback without waiting for its timer", async ({ page }) => {
  let session = await start(page, "finish-development");
  for (let steps = 0; session.step.kind !== "game_excerpt" && steps < 24; steps++) {
    const label = session.actions.includes("show_move") ? "Show move"
      : session.step.kind === "demonstration" && session.step.phase === "ready" ? "Play continuation" : "Continue";
    session = await command(page, label);
  }
  expect(session.step.kind).toBe("game_excerpt");
  const excerpt = await command(page, "Play continuation");
  const boardPieces = () => page.locator('.board-shell [data-square] [data-piece]').evaluateAll(pieces => pieces.map(piece => `${piece.closest('[data-square]')!.getAttribute('data-square')}:${piece.getAttribute('data-piece')}`).sort());
  const anchorPieces = await boardPieces();
  const opened = await command(page, "Explore full game");
  expect(opened.game?.title).toContain("Mason–Lasker");
  await command(page, "From the beginning");
  expect((await page.request.put("/api/preferences/motion", { data: { motion: "natural" } })).ok()).toBe(true);
  await page.reload();
  await expect(page.getByRole("button", { name: "Next game move" })).toBeEnabled();
  await page.clock.install();
  await page.clock.pauseAt(new Date());

  // Freeze both the piece animation and the lesson dwell: controls must not wait
  // for either timer before committing another navigation command.
  const first = await command(page, "Next game move");
  expect(first.game?.ply).toBe(1);
  await expect(page.locator(".coach-title")).toHaveText(first.game!.title);
  await expect(page.locator(".coach-message")).toHaveText("Explore the full game. Return to the lesson whenever you’re ready.");
  await expect(page.getByRole("button", { name: "Next game move" })).toBeEnabled();
  expect((await command(page, "Next game move")).game?.ply).toBe(2);
  expect((await command(page, "Previous game move")).game?.ply).toBe(1);
  let annotated = first;
  for (let ply = 2; ply <= 8; ply++) annotated = await command(page, "Next game move");
  expect(annotated.game?.note?.text).toBeTruthy();
  await expect(page.locator(".coach-title")).toHaveText(annotated.game!.title);
  await expect(page.locator(".coach-message")).toHaveText(annotated.game!.note!.text);
  const explanation = (await page.locator(".coach-speech").textContent())!;
  await page.clock.runFor(1200);
  await expect(page.locator(".coach-speech")).toHaveText(explanation);
  expect((await command(page, "Previous game move")).game?.ply).toBe(7);
  await expect(page.locator(".coach-message")).not.toContainText(annotated.game!.note!.text);
  await command(page, "Next game move");
  expect((await command(page, "From the beginning")).game?.ply).toBe(0);
  await expect(page.getByRole("button", { name: "Previous game move" })).toBeDisabled();
  await command(page, "Next game move");
  const returned = await command(page, "Return to lesson");
  expect(returned.game).toBeNull();
  expect(returned.history).toEqual(excerpt.history);
  expect(returned.fen).toBe(excerpt.fen);
  await page.clock.runFor(5000);
  await expect(page.getByRole("heading", { name: returned.step.title, exact: true })).toBeVisible();
  expect(await boardPieces()).toEqual(anchorPieces);
  expect((await saved(page, session.id)).revision).toBe(returned.revision);
});

test("full-game seeking keeps the coach and controls steady while serializing requests", async ({ page }, info) => {
  const preference = await page.request.get("/api/preferences/coach");
  expect(preference.ok()).toBe(true);
  const originalCoach: Schema["CoachPreferences"] = await preference.json();
  try {
    let session = await start(page, "finish-development");
    for (let steps = 0; session.step.kind !== "game_excerpt" && steps < 24; steps++) {
      const label = session.actions.includes("show_move") ? "Show move"
        : session.step.kind === "demonstration" && session.step.phase === "ready" ? "Play continuation" : "Continue";
      session = await command(page, label);
    }
    expect(session.step.kind).toBe("game_excerpt");
    await command(page, "Play continuation");
    const opened = await command(page, "Explore full game");
    expect(opened.game?.title).toContain("Mason–Lasker");
    await command(page, "From the beginning");
    expect((await page.request.put("/api/preferences/motion", { data: { motion: "natural" } })).ok()).toBe(true);
    expect((await page.request.put("/api/preferences/coach", { data: { coach_id: "classic", motion: "natural" } })).ok()).toBe(true);
    await page.reload();
    const next = page.getByRole("button", { name: "Next game move", exact: true });
    const previous = page.getByRole("button", { name: "Previous game move", exact: true });
    const beginning = page.getByRole("button", { name: "From the beginning", exact: true });
    await expect(next).toBeEnabled();
    await expect(previous).toBeDisabled();
    await expect(beginning).toBeDisabled();
    await page.clock.install();
    await page.clock.pauseAt(new Date());
    const first = await command(page, "Next game move");
    expect(first.game?.ply).toBe(1);
    const avatar = page.locator(".coach-avatar");
    await expect(avatar).toHaveAttribute("data-motion", "natural");
    await next.hover();
    // Let the initial reaction dwell and hover transition settle before recording
    // the in-range state; the next request must preserve this same performance.
    await page.clock.runFor(200);
    await expect.poll(() => next.evaluate(element => element.getAnimations().filter(animation => animation.playState === "running").length)).toBe(0);
    const portrait = () => avatar.evaluate(element => ({
      requested: element.getAttribute("data-requested"),
      expression: element.getAttribute("data-expression"),
      take: element.getAttribute("data-take"),
    }));
    const buttons = () => page.locator(".move-playback-controls button, .coach-actions button").evaluateAll(elements => elements.map(element => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return { opacity: style.opacity, background: style.backgroundColor, width: rect.width, height: rect.height };
    }));
    const originalPortrait = await portrait();
    expect(originalPortrait.requested).toBe("explaining");
    expect(originalPortrait.expression).toBe("explaining");
    expect(Number(originalPortrait.take)).toBeGreaterThan(0);
    const originalButtons = await buttons();
    const artwork = await avatar.locator("svg").first().elementHandle();
    expect(artwork).not.toBeNull();
    // Viewport captures: a full-page capture resizes the phone viewport and drops hover.
    await page.screenshot({ path: `test-results/italian-game-steady-before-${info.project.name}.png` });

    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    let entered!: () => void;
    const requested = new Promise<void>(resolve => { entered = resolve; });
    const operations: Promise<void>[] = [];
    let requests = 0;
    const pattern = `**/api/study/lesson-sessions/${session.id}/command`;
    await page.route(pattern, route => {
      const number = ++requests;
      const operation = (async () => {
        const response = await route.fetch();
        if (number === 1) {
          entered();
          await gate;
        }
        await route.fulfill({ response });
      })();
      operations.push(operation);
      return operation;
    });
    try {
      await next.click();
      await requested;
      await expect(next).toBeDisabled();
      await expect(page.getByRole("button", { name: "Return to lesson", exact: true })).toBeDisabled();
      await page.clock.runFor(500);
      await page.screenshot({ path: `test-results/italian-game-steady-pending-${info.project.name}.png` });
      expect.soft(await buttons()).toEqual(originalButtons);
      expect.soft(await portrait()).toEqual(originalPortrait);
      expect.soft(await artwork!.evaluate(element => element === document.querySelector(".coach-avatar svg"))).toBe(true);
      // Dispatch bypasses the browser's disabled-button behavior to exercise the
      // synchronous request guard, including when pending uses aria-disabled.
      await next.dispatchEvent("click");
      expect(requests).toBe(1);
      const response = page.waitForResponse(value => value.url().endsWith(`/lesson-sessions/${session.id}/command`));
      release();
      const completed = await response;
      expect(completed.ok()).toBe(true);
      const sought: Schema["LessonSessionView"] = await completed.json();
      await Promise.all(operations);
      expect(sought.game?.ply).toBe(2);
      await expect(next).toBeEnabled();
      await expect(previous).toBeEnabled();
      await expect(beginning).toBeEnabled();
      await expect(page.getByRole("button", { name: "Return to lesson", exact: true })).toBeEnabled();
      await page.clock.runFor(150);
      expect.soft(await buttons()).toEqual(originalButtons);
      expect.soft(await portrait()).toEqual(originalPortrait);
      expect.soft(await artwork!.evaluate(element => element === document.querySelector(".coach-avatar svg"))).toBe(true);
      expect(requests).toBe(1);
      expect((await saved(page, session.id)).game?.ply).toBe(2);
    } finally {
      release();
      await page.unroute(pattern);
      await Promise.all(operations);
      await artwork!.dispose();
    }
    expect((await command(page, "From the beginning")).game?.ply).toBe(0);
    await expect(previous).toBeDisabled();
    await expect(beginning).toBeDisabled();
    await expect(next).toBeEnabled();
  } finally {
    expect((await page.request.put("/api/preferences/coach", { data: originalCoach })).ok()).toBe(true);
  }
});

test("the development and central-break chapters show distinct sourced game passages with exact returns from full-game playback", async ({ page }, info) => {
  const games = new Set<string>();
  for (const chapterId of ["central-break", "finish-development"]) {
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


const continuationChapters: {
  id: string;
  anchor: string[];
  moves: string[];
  branchMoves: Record<string, string>;
  branches: number;
}[] = [
  {
    id: "finish-development",
    anchor: ["e2e4", "e7e5", "g1f3", "b8c6", "f1c4", "f8c5", "d2d3", "g8f6", "e1g1", "d7d6"],
    moves: ["c2c3", "f1e1", "c4b3", "b1d2", "d2f1", "c1e3", "f1e3"],
    branchMoves: { "capture-break": "e4d5", "win-center-pawn": "f3e5", "recover-knight": "e1e5", "save-bishop": "b3c2" },
    branches: 2,
  },
  {
    id: "central-break",
    anchor: ["e2e4", "e7e5", "g1f3", "b8c6", "f1c4", "f8c5", "d2d3", "g8f6", "e1g1", "d7d6", "c2c3", "e8g8", "f1e1", "a7a6", "c4b3", "c5a7", "b1d2", "h7h6", "d2f1", "f8e8"],
    moves: ["f1g3", "d3d4", "b3e6", "c3d4", "c1e3"],
    branchMoves: { "answer-active-break": "d4e5", "centralize-under-pressure": "f3d4" },
    branches: 1,
  },
];

for (const content of continuationChapters) {
  test(`${content.id} teaches the continuation and counterplay before anchored recall`, async ({ page }) => {
    const before = await studyIds(page);
    const dueBefore = await settledDueReviews(page);
    let session = await start(page, content.id);
    const anchorMoves = content.anchor;
    expect(session.history.map(frame => frame.uci)).toEqual(anchorMoves);
    const initial = session;
    await page.reload();
    session = await saved(page, session.id);
    expect(session.history).toEqual(initial.history);
    expect(session.fen).toBe(initial.fen);
    const mainMoves = content.moves;
    const branchMoves = content.branchMoves;
    let decisions = 0;
    let branchAnchor: Schema["LessonSessionView"] | null = null;
    const explored = new Set<string>();
    const attemptedBranches = new Set<string>();
    for (let step = 0; session.step.kind !== "rehearsal" && step < 80; step++) {
      if (session.step.kind === "branch" && !session.branch && !explored.has(session.step.id)) {
        explored.add(session.step.id);
        branchAnchor = session;
        session = await command(page, "Explore alternative");
      } else if (session.branch && !session.actions.includes("continue") && !session.actions.includes("move")) {
        expect(branchAnchor).not.toBeNull();
        const terminal = session;
        await page.reload();
        await expect(page.getByRole("button", { name: "Return to main line", exact: true })).toBeVisible();
        expect((await saved(page, session.id)).history).toEqual(terminal.history);
        session = await command(page, "Return to main line");
        expect(session.history).toEqual(branchAnchor!.history);
        expect(session.fen).toBe(branchAnchor!.fen);
        expect(session.step.id).toBe(branchAnchor!.step.id);
        branchAnchor = null;
      } else if (session.actions.includes("move")) {
        expect(session.fen.split(" ")[1]).toBe("w");
        const uci = session.branch ? branchMoves[session.step.id] : mainMoves[decisions++];
        expect(uci).toBeTruthy();
        if (session.branch) attemptedBranches.add(session.step.id);
        session = await move(page, uci);
      } else {
        session = await command(page, ["demonstration", "game_excerpt"].includes(session.step.kind) && session.step.phase === "ready" ? "Play continuation" : "Continue");
      }
    }
    expect(decisions).toBe(mainMoves.length);
    expect([...attemptedBranches].sort()).toEqual(Object.keys(branchMoves).sort());
    expect(explored.size).toBe(content.branches);
    expect(branchAnchor).toBeNull();
    expect(session.step.kind).toBe("rehearsal");
    expect(session.history.map(frame => frame.uci)).toEqual(anchorMoves);
    expect(session.step.annotations).toEqual({ squares: [], arrows: [] });
    expect(session.step.text).toBe("Play this line from memory.");
    const rehearsal = session;
    await page.reload();
    await expect(page.locator(".coach-message")).toHaveText("Play this line from memory.");
    await expect(page.getByRole("button", { name: "Hint", exact: true })).toHaveCount(0);
    session = await saved(page, session.id);
    expect(session.history).toEqual(rehearsal.history);
    expect(session.playback).toEqual([]);
    for (const uci of mainMoves) session = await move(page, uci);
    if (session.status !== "completed") session = await command(page, "Continue");
    expect(session.status).toBe("completed");
    expect(session.failed).toBe(false);
    expect(session.assisted).toBe(false);
    expect(session.history.slice(0, rehearsal.history.length)).toEqual(rehearsal.history);
    expect(await studyIds(page)).toEqual(before);
    await expectNoNewDueReviews(page, dueBefore);
  });
}
