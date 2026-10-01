import {expect, test, type Page} from "@playwright/test";
import {captureSpeech, speechActivity} from "./helpers/speech";

const studies = new WeakMap<Page, string[]>();

test.beforeEach(async ({page}) => {
  await captureSpeech(page);
  await page.route("**/api/preferences/coach", route => route.fulfill({json: {coach_id: "classic", motion: "natural"}}));
  await page.route("**/api/preferences/audio", route => route.fulfill({json: {
    enabled: true, volume: .35, board: false, practice: false, voice: "automatic",
  }}));
  await page.route("**/api/preferences/motion", route => route.fulfill({json: {motion: "still"}}));
});

test.afterEach(async ({page}) => {
  for (const id of studies.get(page) ?? [])
    expect((await page.request.delete(`/api/opening-studies/${id}`)).ok()).toBe(true);
});

async function puzzle(page: Page, key: string) {
  const response = await page.request.post(`/__test/puzzle-fixture/voice-${key}`);
  expect(response.ok()).toBe(true);
  const {session_id}: {session_id: string} = await response.json();
  return {id: session_id, path: `/study/puzzles/sessions/${session_id}`};
}

async function opening(page: Page, key: string) {
  const response = await page.request.post(`/__test/opening-recall-fixture/voice-${key}`);
  expect(response.ok()).toBe(true);
  const result: {session_id: string; study_ids: string[]; wrong: string; accepted_moves: string[]} = await response.json();
  studies.set(page, [...studies.get(page) ?? [], ...result.study_ids]);
  return result;
}

async function move(page: Page, uci: string) {
  const response = page.waitForResponse(value => value.request().method() === "POST" && value.url().endsWith("/move"));
  await page.locator(`.board-shell [data-square="${uci.slice(0, 2)}"]`).click();
  await page.locator(`.board-shell [data-square="${uci.slice(2, 4)}"]`).click();
  expect((await response).ok()).toBe(true);
}

async function spoken(page: Page, id: string, count: number) {
  await expect.poll(async () => (await speechActivity(page)).started.length).toBe(count);
  expect((await speechActivity(page)).started.at(-1)).toContain(id);
}

async function unchanged(page: Page, count = 0) {
  // Cross both the counter-reply presentation and automatic narration deadlines.
  await page.waitForTimeout(800);
  expect((await speechActivity(page)).started).toHaveLength(count);
}

test("puzzle narration follows fresh responses, with cold and restored results manual only", async ({page}, info) => {
  const fixture = await puzzle(page, `responses-${info.project.name}`);
  await page.goto(fixture.path);
  await expect(page.getByRole("heading", {name: "Find the continuation.", exact: true})).toBeVisible();
  await unchanged(page);
  await page.getByRole("button", {name: "Listen to coach", exact: true}).click();
  await spoken(page, "puzzle-cold", 1);
  await page.getByRole("button", {name: "Stop coach voice", exact: true}).click();
  await move(page, "d2d4");
  await spoken(page, "puzzle-rejected", 2);
  await unchanged(page, 2);
  await page.reload();
  await expect(page.getByRole("heading", {name: "Try a different move.", exact: true})).toBeVisible();
  await unchanged(page);
  await page.getByRole("button", {name: "Try again", exact: true}).click();
  await move(page, "e2e4");
  await spoken(page, "puzzle-next-move", 1);
  await move(page, "g1f3");
  await spoken(page, "puzzle-solved-after-retry", 2);
  await page.reload();
  await expect(page.getByRole("heading", {name: "Puzzle solved.", exact: true})).toBeVisible();
  await unchanged(page);
});

test("revealing a puzzle stays silent and a late response cannot narrate after leaving", async ({page}, info) => {
  const revealed = await puzzle(page, `revealed-${info.project.name}`);
  await page.goto(revealed.path);
  await page.getByRole("button", {name: "Reveal solution", exact: true}).click();
  await expect(page.getByRole("heading", {name: "Solution revealed.", exact: true})).toBeVisible();
  await unchanged(page);
  await page.getByRole("button", {name: "Listen to coach", exact: true}).click();
  await spoken(page, "puzzle-revealed", 1);

  const delayed = await puzzle(page, `late-${info.project.name}`);
  await page.goto(delayed.path);
  await expect(page.getByRole("heading", {name: "Find the continuation.", exact: true})).toBeVisible();
  let release!: () => void;
  const gate = new Promise<void>(resolve => {release = resolve;});
  let handled: Promise<void> | undefined;
  await page.route(`**/api/puzzle-sessions/${delayed.id}/move`, route => {
    handled = (async () => {
      const response = await route.fetch();
      await gate;
      await route.fulfill({response});
    })();
    return handled;
  });
  try {
    const request = page.waitForRequest(value => value.url().endsWith("/move") && value.method() === "POST");
    await page.locator('.board-shell [data-square="e2"]').click();
    await page.locator('.board-shell [data-square="e4"]').click();
    await request;
    await page.getByRole("link", {name: "All puzzles", exact: true}).click();
    await expect(page).toHaveURL("/study/puzzles");
    release();
    await handled;
    await unchanged(page);
  } finally { release(); await handled; }
});

test("opening recall speaks fresh repertoire feedback without replaying saved or revealed success", async ({page}, info) => {
  const fixture = await opening(page, `opening-${info.project.name}`);
  await page.goto(`/study/due?session=${fixture.session_id}`);
  await expect(page.getByRole("heading", {name: "Play your studied move.", exact: true})).toBeVisible();
  await unchanged(page);
  await move(page, fixture.wrong);
  await spoken(page, "opening-recall-rejected", 1);
  await move(page, fixture.accepted_moves[0]);
  await spoken(page, "opening-recall-accepted", 2);
  await page.reload();
  await expect(page.getByRole("heading", {name: "Opening recalled.", exact: true})).toBeVisible();
  await unchanged(page);
  const reveal = await opening(page, `opening-reveal-${info.project.name}`);
  await page.goto(`/study/due?session=${reveal.session_id}`);
  await page.getByRole("button", {name: "Reveal move", exact: true}).click();
  await expect(page.getByRole("heading", {name: "Studied move revealed.", exact: true})).toBeVisible();
  await unchanged(page);
  await page.getByRole("button", {name: "Listen to coach", exact: true}).click();
  await spoken(page, "opening-recall-revealed", 1);
});

test("SRS speaks one fresh visible counter reply and leaves cold restored cards silent", async ({page}, info) => {
  const response = await page.request.post(`/__test/review-explanation-fixture/voice-srs-${info.project.name}`);
  expect(response.ok()).toBe(true);
  const fixture: {exercise_id: string; wrong: string; best: string} = await response.json();
  await page.goto(`/study/due?exercise=${fixture.exercise_id}`);
  await expect(page.getByRole("button", {name: "Reveal move", exact: true})).toBeVisible();
  await unchanged(page);
  await move(page, fixture.wrong);
  await expect(page.locator('.board-shell [data-square="a1"] [data-piece="bQ"]')).toBeVisible();
  await spoken(page, "explanation-frame-capture-move-check", 1);
  await unchanged(page, 1);
  await page.reload();
  await expect(page.locator('.board-shell [data-square="a1"] [data-piece="wR"]')).toBeVisible();
  await unchanged(page);
  await move(page, fixture.best);
  await expect(page.getByRole("heading", {name: "Good decision.", exact: true})).toBeVisible();
  await spoken(page, "srs-summary-material-gain", 1);
  await unchanged(page, 1);
});

test("Show why has one primary frame and explicit summary and note playback that stop on close", async ({page}, info) => {
  const response = await page.request.post(`/__test/review-explanation-fixture/voice-explain-${info.project.name}`);
  expect(response.ok()).toBe(true);
  const fixture: {exercise_id: string; wrong: string} = await response.json();
  await page.goto(`/study/due?exercise=${fixture.exercise_id}`);
  await expect(page.getByRole("button", {name: "Reveal move", exact: true})).toBeVisible();
  await move(page, fixture.wrong);
  await spoken(page, "explanation-frame-capture-move-check", 1);
  await page.getByRole("button", {name: "Show me why", exact: true}).click();
  const explanation = page.getByRole("region", {name: "Move explanation"});
  await expect(explanation).toBeVisible();
  await spoken(page, "explanation-frame-capture-move-check", 2);
  await unchanged(page, 2);
  await explanation.getByRole("button", {name: "Listen to summary", exact: true}).click();
  await spoken(page, "srs-summary-material-loss", 3);
  await explanation.getByText("About this explanation", {exact: true}).click();
  await expect(explanation.getByRole("button", {name: "Listen to explanation note 1", exact: true})).toBeVisible();
  await unchanged(page, 3);
  await explanation.getByRole("button", {name: "Listen to explanation note 1", exact: true}).click();
  await spoken(page, "explanation-note-strong-replies", 4);
  await page.keyboard.press("Escape");
  await expect(explanation).toHaveCount(0);
  await expect.poll(async () => (await speechActivity(page)).stopped.length).toBeGreaterThan(0);
  await unchanged(page, 4);
});
