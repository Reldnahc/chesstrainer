import { expect, test, type Page } from "@playwright/test";
import type { Schema } from "../src/api";

const created = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => { created.set(page, []); });
test.afterEach(async ({ page }) => {
  for (const id of created.get(page) || []) expect((await page.request.delete(`/api/opening-studies/${id}`)).ok()).toBe(true);
});
async function library(page: Page): Promise<Schema["OpeningStudyLibrary"]> {
  const response = await page.request.get("/api/opening-studies");
  expect(response.ok()).toBe(true);
  return response.json();
}
async function enroll(page: Page): Promise<Schema["OpeningStudyView"]> {
  const pending = page.waitForResponse(response => new URL(response.url()).pathname === "/api/opening-studies" && response.request().method() === "POST");
  await page.getByRole("button", { name: "Add to study", exact: true }).click();
  const response = await pending;
  expect(response.ok()).toBe(true);
  const value: Schema["OpeningStudyView"] = await response.json();
  created.get(page)!.push(value.id);
  await expect(page.locator(".opening-preview-details").getByRole("status")).toContainText("Study saved.");
  return value;
}

test("catalogue search previews a real line, enrolls either side and preserves history when paused", async ({ page }, info) => {
  const catalogResponse = await page.request.get("/api/openings/catalog?q=Italian%20Game&eco=C50&limit=50");
  expect(catalogResponse.ok()).toBe(true);
  const catalogue: Schema["OpeningCatalogue"] = await catalogResponse.json();
  const candidate = catalogue.items.find(line => line.name === "Italian Game") || catalogue.items[0];
  expect(candidate).toBeTruthy();
  const side = info.project.name === "mobile" ? "black" : "white";
  for (const study of (await library(page)).items) if (study.source === "lichess_catalogue" && study.source_key === candidate.source_key && study.color === side) {
    // The two projects share a test database; stable catalogue entries may have prior history.
    expect((await page.request.delete(`/api/opening-studies/${study.id}`)).ok()).toBe(true);
  }
  await page.goto("/study/openings");
  await expect(page).toHaveTitle("Openings · Fieldwork");
  await page.getByRole("link", { name: "Catalogue", exact: true }).click();
  await expect(page).toHaveTitle("Opening catalogue · Fieldwork");
  await page.getByLabel("Opening name", { exact: true }).fill("Italian Game");
  await page.getByLabel("ECO", { exact: true }).fill("C50");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page).toHaveURL("/study/openings/catalogue?q=Italian+Game&eco=C50");
  await page.locator(`a[href="/study/openings/catalogue/${encodeURIComponent(candidate.source_key)}"]`).click();
  await expect(page.getByRole("heading", { name: candidate.name, exact: true })).toBeVisible();
  await expect(page).toHaveTitle(`${candidate.name} · Fieldwork`);
  await expect(page.locator(".board-shell")).toBeVisible();
  await page.getByRole("radio", { name: side === "white" ? /White/ : /Black/ }).check();
  expect(await page.locator(".opening-color label").first().evaluate(label => label.getBoundingClientRect().height)).toBeLessThan(84);
  const details = page.locator(".opening-preview-details");
  await expect(details).toContainText(`${side === "white" ? candidate.white_positions : candidate.black_positions} ${side === "white" ? "White" : "Black"} recall decisions`);
  await page.getByRole("button", { name: "Next line move", exact: true }).click();
  await expect(page.locator('.board-shell [data-square="e4"] [data-piece="wP"]')).toBeVisible();
  const existing = (await library(page)).items.find(study => study.source === "lichess_catalogue" && study.source_key === candidate.source_key && study.color === side);
  let selected: Schema["OpeningStudySummary"];
  if (existing) {
    const restore = page.waitForResponse(response => response.url().endsWith(`/opening-studies/${existing.id}/restore`));
    await page.getByRole("button", { name: "Resume recalls", exact: true }).click();
    expect((await restore).ok()).toBe(true);
    selected = { ...existing, active: true };
    created.get(page)!.push(existing.id);
  } else selected = await enroll(page);
  expect(selected.color).toBe(side);
  expect(selected.positions).toBe(side === "white" ? candidate.white_positions : candidate.black_positions);
  await expect(page.getByRole("button", { name: "Added to study", exact: true })).toBeDisabled();
  await page.getByRole("link", { name: "My studies", exact: true }).click();
  await expect(page).toHaveTitle("My opening studies · Fieldwork");
  const row = page.getByRole("article", { name: `${candidate.name} as ${side}`, exact: true });
  await expect(row).toContainText("Active");
  await row.getByRole("button", { name: "Pause recalls", exact: true }).click();
  await expect(row).toContainText("Paused");
  await expect(row).toContainText("History preserved");
  await page.reload();
  await expect(row).toContainText("Paused");
  await row.getByRole("button", { name: "Resume recalls", exact: true }).click();
  await expect(row).toContainText("Active");
  expect((await library(page)).items.filter(study => study.id === selected.id)).toHaveLength(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/opening-studies-${info.project.name}.png`, fullPage: true });
});

test("only designated course lines can be enrolled and dedicated practice leaves Due unchanged", async ({ page }, info) => {
  const response = await page.request.post(`/__test/lesson-fixture/enrollment-${info.project.name}`);
  expect(response.ok()).toBe(true);
  const fixture: { course_id: string; revision: string } = await response.json();
  await page.goto(`/study/openings/courses/${fixture.course_id}?revision=${fixture.revision}`);
  const lines = page.getByRole("region", { name: "Course recall lines" });
  await expect(lines).toContainText("Fixture main line");
  await expect(lines).not.toContainText("Demonstration only");
  await lines.getByRole("link", { name: /Fixture main line/ }).click();
  await expect(page.getByRole("heading", { name: /Fixture main line/ })).toBeVisible();
  const study = await enroll(page);
  expect(study.source).toBe("course_line");
  expect(study.source_version).toBe(fixture.revision);
  expect(study.line.course_id).toBe(fixture.course_id);
  expect(study.line.line_id).toBe("fixture-main");
  const before = await (await page.request.get("/api/review/count")).json();
  const start = page.waitForResponse(value => value.url().endsWith(`/opening-studies/${study.id}/practice`));
  await page.getByRole("button", { name: "Practice line", exact: true }).click();
  const session: Schema["LessonSessionView"] = await (await start).json();
  await expect(page).toHaveURL(`/study/openings/sessions/${session.id}`);
  await expect(page.getByRole("region", { name: "Lesson position" })).toBeVisible();
  await page.locator('.board-shell [data-square="g1"]').click();
  await page.locator('.board-shell [data-square="f3"]').click();
  await expect(page.locator(".coach-message")).toContainText("different continuation");
  await expect(page.locator(".coach-title")).not.toContainText("Mistake");
  await page.getByRole("button", { name: "Show move", exact: true }).click();
  await expect(page.locator('.board-shell [data-square="e4"] [data-piece="wP"]')).toBeVisible();
  const after = await (await page.request.get("/api/review/count")).json();
  expect(after).toEqual(before);
  await page.reload();
  await expect(page.getByRole("region", { name: "Lesson position" })).toBeVisible();
  expect((await (await page.request.get(`/api/study/lesson-sessions/${session.id}`)).json()).course_revision).toBe(session.course_revision);
});

test("Study home uses the exact due count rather than its review batch size", async ({ page }) => {
  await page.route("**/api/review/count", route => route.fulfill({ json: { due: 83 } }));
  await page.goto("/study");
  await expect(page.locator(".study-due .study-count")).toHaveText("83 Scheduled recalls");
  await page.getByRole("link", { name: "Start studying", exact: true }).click();
  await expect(page).toHaveTitle("Due · Fieldwork");
});
