import { expect, test, type Page } from "./helpers/browserTest";
import type { Schema } from "../src/api";
import type { AudioPreferences, SoundCue } from "../src/audio/model";
import { captureAudio, audioCues } from "./helpers/audio";

const preferences = new WeakMap<
  Page,
  { audio: AudioPreferences; motion: Schema["MotionPreferences"] }
>();
const studies = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  preferences.set(page, {
    audio: await (await page.request.get("/api/preferences/audio")).json(),
    motion: await (await page.request.get("/api/preferences/motion")).json(),
  });
  expect(
    (
      await page.request.put("/api/preferences/audio", {
        data: {
          enabled: true,
          volume: 0.4,
          board: true,
          practice: true,
        },
      })
    ).ok(),
  ).toBe(true);
  expect(
    (await page.request.put("/api/preferences/motion", { data: { motion: "still" } })).ok(),
  ).toBe(true);
  await captureAudio(page);
});

test.afterEach(async ({ page }) => {
  for (const id of studies.get(page) ?? []) {
    expect((await page.request.delete(`/api/opening-studies/${id}`)).ok()).toBe(true);
  }
  const original = preferences.get(page)!;
  expect((await page.request.put("/api/preferences/audio", { data: original.audio })).ok()).toBe(
    true,
  );
  expect((await page.request.put("/api/preferences/motion", { data: original.motion })).ok()).toBe(
    true,
  );
});

async function fixture(page: Page, kind: "puzzle" | "lesson", key: string) {
  const response = await page.request.post(`/__test/${kind}-fixture/audio-${key}`);
  expect(response.ok()).toBe(true);
  const { session_id }: { session_id: string } = await response.json();
  return {
    id: session_id,
    path: `/study/${kind === "puzzle" ? "puzzles" : "openings"}/sessions/${session_id}`,
  };
}

async function move(page: Page, uci: string) {
  const response = page.waitForResponse(
    value =>
      value.request().method() === "POST" &&
      /\/(?:move|command)$/.test(new URL(value.url()).pathname),
  );
  await page.locator(`.board-shell [data-square="${uci.slice(0, 2)}"]`).click();
  await page.locator(`.board-shell [data-square="${uci.slice(2, 4)}"]`).click();
  const result = await response;
  expect(result.ok()).toBe(true);
  return result;
}

async function command(page: Page, label: string) {
  const response = page.waitForResponse(
    value => value.request().method() === "POST" && value.url().endsWith("/command"),
  );
  await page.getByRole("button", { name: label, exact: true }).click();
  const result = await response;
  expect(result.ok()).toBe(true);
  return result.json() as Promise<Schema["LessonSessionView"]>;
}

async function expectCues(page: Page, expected: SoundCue[]) {
  await expect.poll(() => audioCues(page)).toEqual(expected);
}

async function expectSilent(page: Page, expected: SoundCue[] = []) {
  // Cross the 160 ms practice cue and 400 ms counter-reply deadlines.
  await page.waitForTimeout(550);
  expect(await audioCues(page)).toEqual(expected);
}

const piece = (page: Page, square: string, symbol: string) =>
  page.locator(`.board-shell [data-square="${square}"] [data-piece="${symbol}"]`);

test("Still puzzle feedback sounds retry once and replaces correct with complete", async ({
  page,
}, info) => {
  const puzzle = await fixture(page, "puzzle", `still-${info.project.name}`);
  await page.goto(puzzle.path);
  await expect(
    page.getByRole("heading", { name: "Find the continuation.", exact: true }),
  ).toBeVisible();
  await expectSilent(page);
  await move(page, "d2d4");
  await expect(
    page.getByRole("heading", { name: "Try a different move.", exact: true }),
  ).toBeVisible();
  await expectCues(page, ["move", "retry"]);
  await expectSilent(page, ["move", "retry"]);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Try a different move.", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expectSilent(page);
  const response: Schema["PuzzleSessionView"] = await (await move(page, "e2e4")).json();
  expect(response.playback.map(frame => frame.uci)).toEqual(["e2e4", "e7e5"]);
  await expect(piece(page, "e5", "bP")).toBeVisible();
  await expectCues(page, ["move", "correct"]);
  await expectSilent(page, ["move", "correct"]);
  await move(page, "g1f3");
  await expect(page.getByRole("heading", { name: "Puzzle solved.", exact: true })).toBeVisible();
  await expectCues(page, ["move", "correct", "move", "complete"]);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Puzzle solved.", exact: true })).toBeVisible();
  await expectSilent(page);
});

test("lesson demonstrations and accepted decisions sound only their live transitions", async ({
  page,
}, info) => {
  const lesson = await fixture(page, "lesson", `lesson-${info.project.name}`);
  await page.request.put("/api/preferences/motion", { data: { motion: "natural" } });
  await page.goto(lesson.path);
  await command(page, "Continue");
  await command(page, "Play continuation");
  // The demonstration goes straight on to the decision it leads to.
  await expect(page.getByRole("heading", { name: "Develop a knight", exact: true })).toBeVisible();
  await expectCues(page, ["move", "move"]);
  await page.request.put("/api/preferences/motion", { data: { motion: "still" } });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Develop a knight", exact: true })).toBeVisible();
  await expectSilent(page);
  await move(page, "d2d4");
  await expectCues(page, ["move", "retry"]);
  await expectSilent(page, ["move", "retry"]);
  await move(page, "b1c3");
  await expectCues(page, ["move", "retry", "move", "correct"]);
  await page.reload();
  await expect(piece(page, "c3", "wN")).toBeVisible();
  await expectSilent(page);
  await command(page, "Continue");
  await expect(
    page.getByRole("heading", { name: "A separate continuation", exact: true }),
  ).toBeVisible();
  await expectSilent(page);
  await command(page, "Continue");
  await expect(
    page.getByRole("heading", { name: "Chapter completed.", exact: true }),
  ).toBeVisible();
  await expectCues(page, ["complete"]);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Chapter completed.", exact: true }),
  ).toBeVisible();
  await expectSilent(page);
});

test("SRS sounds the visible counter reply and retry cancels a pending reply", async ({
  page,
}, info) => {
  const response = await page.request.post(
    `/__test/review-explanation-fixture/audio-counter-${info.project.name}`,
  );
  expect(response.ok()).toBe(true);
  const recall: { exercise_id: string; wrong: string; best: string } = await response.json();
  await page.goto(`/study/due?exercise=${recall.exercise_id}`);
  await expect(page.getByRole("button", { name: "Reveal move", exact: true })).toBeVisible();
  await move(page, recall.wrong);
  await expect(piece(page, "a1", "bQ")).toBeVisible();
  await expectCues(page, ["move", "retry", "check"]);
  await expectSilent(page, ["move", "retry", "check"]);
  await page.getByRole("button", { name: "Try again", exact: true }).click();

  // Freeze the presentation timer while the real server grades the retry.
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await move(page, recall.wrong);
  await page.clock.runFor(200);
  await expectCues(page, ["move", "retry", "check", "move", "retry"]);
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await page.clock.runFor(700);
  await expect(piece(page, "a1", "wR")).toBeVisible();
  expect(await audioCues(page)).toEqual(["move", "retry", "check", "move", "retry"]);
  await page.clock.resume();
  await move(page, recall.best);
  await expect(page.getByRole("heading", { name: "Good decision.", exact: true })).toBeVisible();
  await expectCues(page, ["move", "retry", "check", "move", "retry", "capture", "correct"]);
});
