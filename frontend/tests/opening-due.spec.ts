import { expect, test, type Page } from "@playwright/test";
import type { ColdPosition, Feedback, Schema } from "../src/api";
import walterBank from "../src/audio/speech/bank/manifest.json" with { type: "json" };

// The bubble shows the default coach's (Walter's) spoken line for each recall state.
const walter = (id: string) => walterBank.recordings.find(row => row.id === id)!.text;

type RecallFixture = {
  exercise_id: string;
  session_id: string;
  study_ids: string[];
  accepted_moves: string[];
  names: string[];
  wrong: string;
};
const studies = new WeakMap<Page, string[]>();

async function fixture(page: Page, key: string): Promise<RecallFixture> {
  const response = await page.request.post(`/__test/opening-recall-fixture/${key}`);
  expect(response.ok()).toBe(true);
  const result: RecallFixture = await response.json();
  studies.set(page, result.study_ids);
  return result;
}
test.afterEach(async ({ page }) => {
  for (const id of studies.get(page) ?? []) {
    expect((await page.request.delete(`/api/opening-studies/${id}`)).ok()).toBe(true);
  }
});
async function move(page: Page, uci: string) {
  const response = page.waitForResponse(result => /\/api\/review\/sessions\/[^/]+\/move$/.test(new URL(result.url()).pathname));
  await page.locator(`.board-shell [data-square="${uci.slice(0, 2)}"]`).click();
  await page.locator(`.board-shell [data-square="${uci.slice(2, 4)}"]`).click();
  const result = await response;
  expect(result.ok()).toBe(true);
  return result.json() as Promise<Feedback>;
}
async function saved(page: Page, id: string): Promise<ColdPosition> {
  const response = await page.request.get(`/api/review/sessions/${id}`);
  expect(response.ok()).toBe(true);
  return response.json();
}

test("opening Due shows combined study context and accepts the repertoire union without engine claims", async ({ page }, info) => {
  const data = await fixture(page, `union-${info.project.name}`);
  const engineRequests: string[] = [];
  page.on("request", request => {
    if (/\/(?:analyze|explanation)$/.test(new URL(request.url()).pathname)) engineRequests.push(request.url());
  });
  await page.goto(`/study/due?exercise=${data.exercise_id}`);
  await expect(page.getByRole("heading", { name: "Play your studied move.", exact: true })).toBeVisible();
  for (const name of data.names) await expect(page.locator(".opening-recall-names")).toContainText(name);
  await expect(page.getByRole("region", { name: "Studied continuations" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Show.*why/ })).toHaveCount(0);
  await expect(page).toHaveURL(`/study/due?session=${data.session_id}`);
  const cold = await saved(page, data.session_id);
  expect(cold.feedback).toBeFalsy();
  expect(cold.opening?.names).toEqual(data.names);
  expect(JSON.stringify(cold)).not.toContain('"answers"');
  if (info.project.name === "mobile") {
    const coach = await page.locator(".review-coach").boundingBox();
    const board = await page.locator(".board-shell").boundingBox();
    expect(coach!.y + coach!.height).toBeLessThan(board!.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }

  const failed = await move(page, data.wrong);
  expect(failed.completed).toBe(false);
  expect(failed.scheduling_status).toBe("recorded");
  await expect(page.getByRole("heading", { name: "Try your studied move." })).toBeVisible();
  await expect(page.locator(".coach-avatar")).toHaveAttribute("data-expression", "encouraging");
  await expect(page.locator(".review-coach")).not.toContainText(/blunder|mistake|Stockfish/i);
  await expect(page.getByRole("region", { name: "Studied continuations" })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Try your studied move." })).toBeVisible();
  const result = await move(page, data.accepted_moves[1]);
  expect(result.completed).toBe(true);
  expect(result.scheduling_status).toBe("recorded");
  expect(result.answers?.map(answer => answer.uci).sort()).toEqual([...data.accepted_moves].sort());
  await expect(page.getByRole("heading", { name: "Opening recalled." })).toBeVisible();
  const continuations = page.getByRole("region", { name: "Studied continuations" });
  for (const name of data.names) await expect(continuations).toContainText(name);
  // Recorded takes rotate, so any take of the accepted line may speak.
  const acceptedTakes = walterBank.recordings.filter(row => /^opening-recall-accepted(?:-\d+)?$/.test(row.id)).map(row => row.text);
  expect(acceptedTakes.length).toBeGreaterThan(1);
  await expect.poll(async () => acceptedTakes.includes((await page.locator(".review-coach .move-status").textContent())?.trim() ?? ""))
    .toBe(true);
  await expect(page.locator(".review-coach")).not.toContainText(/relearning|Next review|recall saved/i);
  await expect(page.locator(".review-schedule")).toContainText("first attempt stays marked for relearning");
  expect(engineRequests).toEqual([]);
});

test("opening reveal and completed reload retain the same saved answer and session", async ({ page }, info) => {
  const data = await fixture(page, `reveal-${info.project.name}`);
  await page.goto(`/study/due?session=${data.session_id}`);
  const revealed = page.waitForResponse(response => response.url().endsWith(`/review/sessions/${data.session_id}/reveal`));
  await page.getByRole("button", { name: "Reveal move", exact: true }).click();
  const result: Feedback = await (await revealed).json();
  expect(result.grade).toBe("revealed");
  await expect(page.getByRole("heading", { name: "Studied move revealed." })).toBeVisible();
  await expect(page.locator(".review-coach .move-status")).toHaveText(walter("opening-recall-revealed"));
  await expect(page.locator(".review-coach")).not.toContainText(/relearning|Next review|recall saved/i);
  const before = await saved(page, data.session_id);
  expect(before.completed).toBe(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Studied move revealed." })).toBeVisible();
  await expect(page.getByRole("region", { name: "Studied continuations" })).toBeVisible();
  expect(await saved(page, data.session_id)).toEqual(before);
  const next = page.waitForResponse(response => new URL(response.url()).pathname === "/api/review/queue");
  await page.getByRole("button", { name: "Next position", exact: true }).click();
  await (await next).finished();
  await expect(page).not.toHaveURL(`/study/due?session=${data.session_id}`);
});

test("an opening attempt resumes its removed answer and explains why it cannot update the current schedule", async ({ page }, info) => {
  const data = await fixture(page, `stale-${info.project.name}`);
  await page.goto(`/study/due?session=${data.session_id}`);
  await expect(page.getByRole("heading", { name: "Play your studied move.", exact: true })).toBeVisible();
  expect((await page.request.delete(`/api/opening-studies/${data.study_ids[1]}`)).ok()).toBe(true);
  await page.reload();
  const stale = await saved(page, data.session_id);
  expect(stale.non_scheduling_reason).toBeTruthy();
  expect(stale.opening?.names).toEqual(data.names);
  await expect(page.locator(".review-schedule")).toHaveText(stale.non_scheduling_reason!);
  const result = await move(page, data.accepted_moves[1]);
  expect(result.completed).toBe(true);
  expect(result.scheduling_status).toBe("content_changed");
  await expect(page.getByRole("heading", { name: "Opening recalled." })).toBeVisible();
  await expect(page.locator(".review-schedule")).toHaveText(result.non_scheduling_reason!);
  await expect(page.getByRole("region", { name: "Studied continuations" })).toContainText(data.names[1]);
  const current = await page.request.post(`/api/review/${data.exercise_id}/start`);
  expect(current.ok()).toBe(true);
  const fresh: ColdPosition = await current.json();
  expect(fresh.session_id).not.toBe(data.session_id);
  expect(fresh.opening?.names).not.toContain(data.names[1]);
  await expect(page.locator(".review-session-count")).toHaveText("0 reviewed this session");
});

test("changing the opening coach preserves the exact cold recall across browser Back", async ({ page }, info) => {
  const data = await fixture(page, `coach-${info.project.name}`);
  const original: Schema["CoachPreferences"] = await (await page.request.get("/api/preferences/coach")).json();
  const selected = original.coach_id === "dog-collie" ? "woman-analyst" : "dog-collie";
  try {
    await page.goto(`/study/due?session=${data.session_id}`);
    await expect(page.getByRole("heading", { name: "Play your studied move.", exact: true })).toBeVisible();
    const before = await saved(page, data.session_id);
    await page.getByRole("navigation").getByRole("link", { name: "Settings", exact: true }).click();
    await page.getByRole("navigation", { name: "Settings sections" }).getByRole("link", { name: "Coach & animations", exact: true }).click();
    const radio = page.locator(`input[name="coach"][value="${selected}"]`);
    await Promise.all([
      page.waitForResponse(response => response.request().method() === "PATCH" && response.url().endsWith("/api/preferences/coach"))
        .then(async response => { expect(response.ok()).toBe(true); expect((await response.json()).coach_id).toBe(selected); }),
      radio.click(),
    ]);
    await expect(radio).toBeChecked();
    await page.goBack();
    await expect(page).toHaveURL("/settings");
    await page.goBack();
    await expect(page.locator(".review-coach .coach-avatar")).toHaveAttribute("data-coach", selected);
    await expect(page).toHaveURL(`/study/due?session=${data.session_id}`);
    await expect(page.getByRole("region", { name: "Studied continuations" })).toHaveCount(0);
    expect(await saved(page, data.session_id)).toEqual(before);
  } finally {
    expect((await page.request.put("/api/preferences/coach", { data: original })).ok()).toBe(true);
  }
});

test("Due reads the exact count for a requested card outside the batch and an old completed session", async ({ page }, info) => {
  const data = await fixture(page, `count-${info.project.name}`);
  // The queue is deliberately bounded; its membership cannot stand in for the
  // authoritative count or tell whether a pinned completed recall is due again.
  const batch = Array.from({ length: 30 }, (_, index) => ({
    exercise_id: `batch-${index}`, due: "2026-01-01T00:00:00Z", new: false,
  }));
  let count = 83;
  await page.route("**/api/review/queue*", route => route.fulfill({ json: batch }));
  await page.route("**/api/review/count", route => route.fulfill({ json: { due: count } }));
  await page.goto(`/study/due?exercise=${data.exercise_id}`);
  await expect(page.locator(".review-position-status")).toContainText("83 IN QUEUE");
  count = 82;
  await move(page, data.accepted_moves[0]);
  await expect(page.getByRole("heading", { name: "Opening recalled." })).toBeVisible();
  await expect(page.locator(".review-position-status")).toContainText("82 IN QUEUE");
  // Simulate the current card becoming due again while revisiting its completed
  // historical attempt. Reading history must not decrement the current count.
  batch[0].exercise_id = data.exercise_id;
  count = 83;
  await page.reload();
  await expect(page.getByRole("heading", { name: "Opening recalled." })).toBeVisible();
  await expect(page.locator(".review-position-status")).toContainText("83 IN QUEUE");
});
