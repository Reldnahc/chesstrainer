import { expect, test, type Locator } from "@playwright/test";
import type { Schema } from "../src/api";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/games?offset=*", route => route.fulfill({ json: { items: [], total: 0 } }));
  await page.route("**/api/study/courses", route => route.fulfill({ json: { courses: [], resume: [] } satisfies Schema["LessonLibrary"] }));
  await page.route("**/api/puzzles", route => route.fulfill({ json: {
    available: 0, sources: [], resume: [], stats: { solved: 0, clean: 0, failed_then_solved: 0, revealed: 0 },
  } satisfies Schema["PuzzleLibrary"] }));
});

async function sectionStyle(empty: Locator) {
  await expect(empty).toBeVisible();
  return empty.evaluate(element => {
    const style = getComputedStyle(element);
    return { textAlign: style.textAlign, paddingTop: style.paddingTop, paddingBottom: style.paddingBottom };
  });
}

test("empty sections share the lesson presentation and preserve recovery destinations", async ({ page }) => {
  await page.route("**/api/weaknesses", async route => {
    const response = await route.fetch();
    const data: Schema["Weaknesses"] = await response.json();
    await route.fulfill({ response, json: { ...data, skills: [] } });
  });
  await page.goto("/study/openings");
  const lessons = page.locator(".empty-state--section").filter({ has: page.getByRole("heading", { name: "No opening lessons yet.", exact: true }) });
  const canonical = await sectionStyle(lessons);
  expect(canonical.textAlign).toBe("center");
  await expect(lessons.getByRole("link", { name: "Go to Due", exact: true })).toHaveAttribute("href", "/study/due");

  for (const [path, title, body] of [
    ["/study/puzzles", "No puzzles available yet.", "There are no installed puzzle collections for this source."],
    ["/weaknesses", "No supported weaknesses yet.", "Classify saved games in Settings."],
    ["/games", "Your next insight starts with a game.", "Import a PGN or your Chess.com games"],
  ]) {
    await page.goto(path);
    const empty = page.locator(".empty-state--section").filter({ has: page.getByRole("heading", { name: title, exact: true }) });
    expect(await sectionStyle(empty)).toEqual(canonical);
    await expect(empty).toContainText(body);
    await expect(empty.locator('[role="alert"], [role="status"]')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.getByRole("link", { name: "Import games in Settings", exact: true }).click();
  await expect(page).toHaveURL("/settings");
  await page.goto("/games?page=5");
  await expect(page.getByRole("heading", { name: "No games on this page.", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Back to your games", exact: true }).click();
  await expect(page).toHaveURL("/games");
});

test("embedded activity and search emptiness remain compact inside their existing sections", async ({ page }) => {
  await page.route("**/api/jobs", route => route.fulfill({ json: [] }));
  await page.route("**/api/openings/catalog?*", route => route.fulfill({ json: { items: [], total: 0, version: "empty-state-fixture" } satisfies Schema["OpeningCatalogue"] }));
  await page.route("**/api/opening-studies", route => route.fulfill({ json: { items: [], active_studies: 0, learning_positions: 0, due_positions: 0 } satisfies Schema["OpeningStudyLibrary"] }));
  await page.goto("/settings");
  const activity = page.locator("#settings-activity .empty-state--compact");
  await expect(activity).toContainText("No activity yet");
  await expect(activity).toContainText("Imports and analysis progress will appear here.");
  await expect(activity.getByRole("heading")).toHaveCount(0);
  expect((await activity.boundingBox())!.height).toBeLessThan(100);
  await page.goto("/study/openings/catalogue?q=Nothing");
  const search = page.locator(".opening-catalogue .empty-state--compact");
  await expect(search).toHaveText("No opening lines match this search.");
  await expect(page.getByLabel("Opening name")).toHaveValue("Nothing");
  await expect(page.getByRole("button", { name: "Search", exact: true })).toBeEnabled();
  expect((await search.boundingBox())!.height).toBeLessThan(100);
  await expect(page.locator(".empty-state--section")).toHaveCount(0);
  await page.goto("/study/openings/studies");
  await expect(page.locator(".opening-studies .empty-state--compact")).toHaveText("No lines selected yet. Preview a catalogue or course line to add it to your study.");
  await page.getByRole("link", { name: "Browse catalogue", exact: true }).click();
  await expect(page).toHaveURL("/study/openings/catalogue");
});
