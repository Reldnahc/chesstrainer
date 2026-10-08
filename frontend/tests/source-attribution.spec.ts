import { expect, test, type Page } from "@playwright/test";
import type { Schema } from "../src/api";

async function lessonFixture(page: Page, key: string) {
  const response = await page.request.post(`/__test/lesson-fixture/${key}`);
  expect(response.ok()).toBe(true);
  return response.json() as Promise<{ course_id: string; revision: string }>;
}

test("lesson sources retain multiple citations and licenses but only link valid HTTP sources", async ({ page }, info) => {
  const fixture = await lessonFixture(page, `source-citations-${info.project.name}`);
  const path = `/api/study/courses/${encodeURIComponent(fixture.course_id)}`;
  const response = await page.request.get(`${path}?revision=${encodeURIComponent(fixture.revision)}`);
  expect(response.ok()).toBe(true);
  const course: Schema["LessonCourseView"] = await response.json();
  course.attributions = [
    { text: "Historical game collection", license: "Public domain", url: "https://example.test/chess/game" },
    { text: "Original lesson commentary", license: null, url: "http://example.test/commentary" },
    { text: "Printed reference", license: "CC BY 4.0", url: null },
    ...["javascript:alert(1)", "data:text/html,unsafe", "//example.test/source", "/relative-source", "https://"].map((url, index) => ({
      text: `Unlinked reference ${index + 1}`, license: null, url,
    })),
  ];
  await page.route(`**${path}?*`, route => route.fulfill({ json: course }));
  await page.goto(`/study/openings/courses/${encodeURIComponent(fixture.course_id)}?revision=${encodeURIComponent(fixture.revision)}`);
  const sources = page.locator(".lesson-attributions");
  await expect(sources.getByRole("heading", { name: "Sources", exact: true })).toBeVisible();
  const lines = sources.locator(".source-line");
  await expect(lines).toHaveCount(8);
  await expect(lines.nth(0)).toHaveText("Historical game collection · Public domain · View source");
  await expect(lines.nth(1)).toHaveText("Original lesson commentary · View source");
  await expect(lines.nth(2)).toHaveText("Printed reference · CC BY 4.0");
  const links = sources.getByRole("link", { name: "View source", exact: true });
  await expect(links).toHaveCount(2);
  await expect(links.nth(0)).toHaveAttribute("href", "https://example.test/chess/game");
  await expect(links.nth(1)).toHaveAttribute("href", "http://example.test/commentary");
  for (const link of await links.all()) {
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  }
  for (let index = 3; index < 8; index++) {
    await expect(lines.nth(index)).toHaveText(`Unlinked reference ${index - 2}`);
    await expect(lines.nth(index).getByRole("link")).toHaveCount(0);
  }
  course.attributions = [];
  await page.reload();
  await expect(page.getByRole("heading", { name: course.title, exact: true })).toBeVisible();
  await expect(sources).toHaveCount(0);

  await page.goto("/study/openings/courses/italian-foundations?revision=2026-10-v3");
  const license = sources.getByRole("link", { name: "Repository license", exact: true });
  await expect(license).toHaveAttribute("href", "https://github.com/Reldnahc/chesstrainer/blob/main/LICENSE");
  await expect(license).toHaveAttribute("target", "_blank");
  await expect(license).toHaveAttribute("rel", "noopener noreferrer");
});

test("puzzle attribution remains hidden until reveal and preserves its distinct source label", async ({ page }, info) => {
  await page.route("**/api/preferences/motion", route => route.fulfill({ json: { motion: "still" } }));
  const response = await page.request.post(`/__test/puzzle-fixture/source-provenance-${info.project.name}`);
  expect(response.ok()).toBe(true);
  const fixture: { session_id: string } = await response.json();
  const sessionPath = `/api/puzzle-sessions/${fixture.session_id}`;
  const coldResponse = await page.request.get(sessionPath);
  const cold: Schema["PuzzleSessionView"] = await coldResponse.json();
  expect(cold.completion).toBeNull();
  await page.route(`**${sessionPath}/reveal`, async route => {
    const response = await route.fetch();
    expect(response.ok()).toBe(true);
    const completed: Schema["PuzzleSessionView"] = await response.json();
    expect(completed.completion).not.toBeNull();
    completed.completion!.provenance = { attribution: "Puzzle source fixture", url: "https://example.test/puzzle/source" };
    await route.fulfill({ response, json: completed });
  });
  await page.goto(`/study/puzzles/sessions/${fixture.session_id}`);
  await expect(page.getByRole("heading", { name: "Find the continuation.", exact: true })).toBeVisible();
  await expect(page.locator(".source-line")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Puzzle solution", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Reveal solution", exact: true }).click();
  const solution = page.getByRole("region", { name: "Puzzle solution", exact: true });
  await expect(solution).toBeVisible();
  await expect(solution.locator(".source-line")).toHaveText([
    `Puzzle practice · ${cold.source === "games" ? "From your games" : "Collection puzzle"}`,
    "Puzzle source fixture · Source",
  ]);
  const source = solution.getByRole("link", { name: "Source", exact: true });
  await expect(source).toHaveAttribute("href", "https://example.test/puzzle/source");
  await expect(source).toHaveAttribute("target", "_blank");
  await expect(source).toHaveAttribute("rel", "noopener noreferrer");
});

test("opening sources distinguish catalogue CC0 revisions from authored repertoire provenance", async ({ page }, info) => {
  const response = await page.request.get("/api/openings/catalog?q=Italian%20Game&eco=C50&limit=50");
  expect(response.ok()).toBe(true);
  const catalogue: Schema["OpeningCatalogue"] = await response.json();
  const candidate = catalogue.items.find(line => line.name === "Italian Game") || catalogue.items[0];
  expect(candidate).toBeTruthy();
  await page.goto(`/study/openings/catalogue/${encodeURIComponent(candidate.source_key)}`);
  const source = page.locator(".opening-source.source-line");
  await expect(source).toHaveText(`Lichess opening catalogue · CC0 · Revision ${candidate.source_version}`);
  await expect(source.getByRole("link")).toHaveCount(0);

  const lesson = await lessonFixture(page, `source-repertoire-${info.project.name}`);
  await page.goto(`/study/openings/courses/${encodeURIComponent(lesson.course_id)}/lines/fixture-main?revision=${encodeURIComponent(lesson.revision)}`);
  await expect(source).toHaveText(`Authored course repertoire line · Revision ${lesson.revision}`);
  await expect(source).not.toContainText("CC0");
  await expect(source.getByRole("link")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
