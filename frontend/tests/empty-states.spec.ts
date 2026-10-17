import { expect, test, type Locator } from "./helpers/browserTest";
import type { Schema } from "../src/api";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/games?offset=*", route =>
    route.fulfill({ json: { items: [], total: 0 } }),
  );
  await page.route("**/api/study/courses", route =>
    route.fulfill({
      json: { courses: [], resume: [], can_manage: false } satisfies Schema["LessonLibrary"],
    }),
  );
  await page.route("**/api/puzzles", route =>
    route.fulfill({
      json: {
        available: 0,
        sources: [],
        themes: [],
        retry_available: 0,
        solved_puzzles: 0,
        resume: [],
        stats: { solved: 0, clean: 0, failed_then_solved: 0, revealed: 0 },
        generation: {
          automatic: true,
          analyzed_games: 0,
          searched_games: 0,
          unsearched_games: 0,
          puzzles: 0,
          candidates: 0,
          kept: 0,
          last_searched_at: null,
          job_status: null,
        },
      } satisfies Schema["PuzzleLibrary"],
    }),
  );
});

async function sectionStyle(empty: Locator) {
  await expect(empty).toBeVisible();
  return empty.evaluate(element => {
    const style = getComputedStyle(element);
    return {
      textAlign: style.textAlign,
      paddingTop: style.paddingTop,
      paddingBottom: style.paddingBottom,
    };
  });
}

test("empty sections share the lesson presentation and preserve recovery destinations", async ({
  page,
}) => {
  await page.route("**/api/weaknesses", async route => {
    const response = await route.fetch();
    const data: Schema["Weaknesses"] = await response.json();
    await route.fulfill({ response, json: { ...data, skills: [] } });
  });
  await page.goto("/study/openings");
  const lessons = page
    .locator(".empty-state--section")
    .filter({ has: page.getByRole("heading", { name: "No opening lessons yet.", exact: true }) });
  const canonical = await sectionStyle(lessons);
  expect(canonical.textAlign).toBe("center");
  await expect(lessons.getByRole("link", { name: "Go to Due", exact: true })).toHaveAttribute(
    "href",
    "/study/due",
  );

  for (const [path, title, body] of [
    [
      "/study/puzzles",
      "No puzzles available yet.",
      "There are no installed puzzle collections for this source.",
    ],
    ["/weaknesses", "No supported weaknesses yet.", "Classify saved games in Settings."],
    ["/games", "Your next insight starts with a game.", "Import a PGN or your Chess.com games"],
  ]) {
    await page.goto(path);
    const empty = page
      .locator(".empty-state--section")
      .filter({ has: page.getByRole("heading", { name: title, exact: true }) });
    expect(await sectionStyle(empty)).toEqual(canonical);
    await expect(empty).toContainText(body);
    await expect(empty.locator('[role="alert"], [role="status"]')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  await page.getByRole("link", { name: "Import games in Settings", exact: true }).click();
  await expect(page).toHaveURL("/settings");
  await page.goto("/games?page=5");
  await expect(
    page.getByRole("heading", { name: "No games on this page.", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Back to your games", exact: true }).click();
  await expect(page).toHaveURL("/games");
});

test("a Due queue that fails to load offers Try again instead of the study-queue start", async ({
  page,
}) => {
  let failures = 0;
  await page.route("**/api/review/queue**", route =>
    failures++
      ? route.fallback()
      : route.fulfill({ status: 503, json: { detail: "Queue unavailable." } }),
  );
  await page.goto("/study/due");
  await expect(page.getByRole("alert")).toContainText("Couldn’t load your practice.");
  await expect(page.getByRole("heading", { name: "Build your study queue." })).toHaveCount(0);
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  // The retried queue loads (a position or the start panel, depending on this project's data).
  await expect.poll(() => failures).toBe(2);
  await expect(page.getByText("Couldn’t load your practice.")).toHaveCount(0);
});
