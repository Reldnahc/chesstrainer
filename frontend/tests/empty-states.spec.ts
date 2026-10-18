import { expect, test } from "./helpers/browserTest";
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
