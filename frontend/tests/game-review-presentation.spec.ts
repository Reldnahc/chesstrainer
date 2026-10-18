import { test, expect } from "./helpers/browserTest";

test("player bars show each side's PGN clock at the selected move", async ({ page }, info) => {
  const { id } = await (
    await page.request.post(`/__test/clock-review-fixture/${info.project.name}`)
  ).json();
  await page.goto(`/games/${id}?ply=0`);
  const white = page.getByLabel(/^White clock /),
    black = page.getByLabel(/^Black clock /);
  // Before any move both sides show the TimeControl's starting time; White's clock runs.
  await expect(white).toHaveText("3:00");
  await expect(black).toHaveText("3:00");
  await expect(white).toHaveAttribute("data-running", "true");
  await expect(black).not.toHaveAttribute("data-running", /./);
  await page.goto(`/games/${id}?ply=4`);
  await expect(white).toHaveText("2:55");
  await expect(black).toHaveText("2:50");
  await page.goto(`/games/${id}?ply=6`);
  await expect(black).toHaveText("0:08.4");
  await expect(white).toHaveText("2:51");
  await expect(black).not.toHaveAttribute("data-running", /./);
  await expect(white).toHaveAttribute("data-running", "true");
  // The bottom bar belongs to the learner (White here), so its clock sits below the board.
  const board = (await page.locator(".board-shell").boundingBox())!;
  expect((await white.boundingBox())!.y).toBeGreaterThan(board.y + board.height - 1);
  expect((await black.boundingBox())!.y).toBeLessThan(board.y);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: `test-results/player-clocks-${info.project.name}.png`,
    fullPage: true,
  });
});
