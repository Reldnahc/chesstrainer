import { test, expect } from "@playwright/test";

test("puzzle and opening statistics retain labels, zeroes and shared definition-list layout", async ({page}) => {
  await page.route("**/api/puzzles", route => route.fulfill({json: {
    available: 0, sources: [], resume: [], stats: {clean: 2, failed_then_solved: 0, revealed: 1},
  }}));
  await page.route("**/api/opening-studies", route => route.fulfill({json: {
    active_studies: 1, learning_positions: 3, due_positions: 0,
    items: [{id: "stats", name: "Italian Game", active: true, color: "white", positions: 3, due_positions: 0}],
  }}));
  await page.goto("/study/puzzles");
  const stats = page.locator("dl.stat-list");
  await expect(stats.locator("dt")).toHaveText(["Solved cleanly", "Failed, then solved", "Revealed"]);
  await expect(stats.locator("dd")).toHaveText(["2", "0", "1"]);
  const layout = await stats.evaluate(list => ({display: getComputedStyle(list).display, gap: getComputedStyle(list).gap}));
  await page.goto("/study/openings/studies");
  await expect(stats.locator("dt")).toHaveText(["Active studies", "Learning positions", "Due now"]);
  await expect(stats.locator("dd")).toHaveText(["1", "3", "0"]);
  expect(await stats.evaluate(list => ({display: getComputedStyle(list).display, gap: getComputedStyle(list).gap}))).toEqual(layout);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
