import { expect, test, type Locator } from "@playwright/test";
import type { Schema } from "../src/api";

async function geometry(controls: Locator) {
  return controls.evaluate(element => Array.from(element.querySelectorAll("button, .move-playback-counter"), child => {
    const rect = child.getBoundingClientRect();
    return { x: rect.x - element.getBoundingClientRect().x, width: rect.width, height: rect.height };
  }));
}

test("shared move playback preserves counter geometry and fits the complete game toolbar on phones", async ({ page }, info) => {
  const fixture = await page.request.post(`/__test/game-review-fixture/playback-controls-${info.project.name}`);
  expect(fixture.ok()).toBe(true);
  const { id } = await fixture.json();
  // Exercise the real navigation without requiring any engine searches.
  await page.route(`**/api/games/${id}/review`, route => route.fulfill({ json: { job_id: "playback-controls", status: "completed" } }));
  await page.route(`**/api/games/${id}/analyze`, route => route.fulfill({ json: { report: null, score: null, best_move: null } }));
  await page.goto(`/games/${id}?ply=2`);
  const gameControls = page.getByRole("group", { name: "Game move playback", exact: true });
  await expect(gameControls.locator(".move-playback-counter")).toHaveText("2 / 4");
  await page.evaluate(() => document.fonts.ready);
  const nextSize = (await gameControls.getByRole("button", { name: "Next move", exact: true }).boundingBox())!;

  await page.setViewportSize({ width: 320, height: 700 });
  const toolbar = page.getByRole("group", { name: "Game navigation", exact: true });
  await toolbar.scrollIntoViewIfNeeded();
  const bounds = await toolbar.evaluate(element => {
    const row = element.getBoundingClientRect();
    const controls = Array.from(element.querySelectorAll("a, button, .move-playback-counter"), control => {
      const rect = control.getBoundingClientRect();
      return { left: rect.left, right: rect.right, centerY: rect.y + rect.height / 2 };
    });
    return { left: row.left, right: row.right, centerY: row.y + row.height / 2, controls };
  });
  for (const [index, control] of bounds.controls.entries()) {
    expect(control.left).toBeGreaterThanOrEqual(bounds.left - 1);
    expect(control.right).toBeLessThanOrEqual(bounds.right + 1);
    expect(Math.abs(control.centerY - bounds.centerY)).toBeLessThan(1);
    if (index) expect(control.left).toBeGreaterThanOrEqual(bounds.controls[index - 1].right - 1);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await toolbar.getByRole("button", { name: "Start of game", exact: true }).click();
  await expect(gameControls.locator(".move-playback-counter")).toHaveText("0 / 4");
  await expect(toolbar.getByRole("button", { name: "Previous move", exact: true })).toBeDisabled();
  await toolbar.getByRole("button", { name: "Last move", exact: true }).click();
  await expect(gameControls.locator(".move-playback-counter")).toHaveText("4 / 4");

  await page.setViewportSize(info.project.use.viewport!);
  const response = await page.request.get("/api/openings/catalog?q=Italian%20Game&limit=50");
  expect(response.ok()).toBe(true);
  const catalogue: Schema["OpeningCatalogue"] = await response.json();
  const line = catalogue.items.find(item => item.plies >= 12);
  expect(line).toBeTruthy();
  await page.goto(`/study/openings/catalogue/${encodeURIComponent(line!.source_key)}`);
  const openingControls = page.getByRole("group", { name: "Opening line playback", exact: true });
  const counter = openingControls.locator(".move-playback-counter");
  await expect(counter).toHaveText(`0 / ${line!.plies}`);
  const next = openingControls.getByRole("button", { name: "Next line move", exact: true });
  const openingSize = (await next.boundingBox())!;
  expect(openingSize.height).toBe(nextSize.height);
  if (info.project.name === "desktop") expect(openingSize.width).toBe(nextSize.width);
  await page.getByRole("group", { name: "Opening continuation", exact: true }).getByRole("button").nth(9).click();
  await expect(counter).toHaveText(`9 / ${line!.plies}`);
  const before = await geometry(openingControls);
  await next.click();
  await expect(counter).toHaveText(`10 / ${line!.plies}`);
  expect(await geometry(openingControls)).toEqual(before);
  await openingControls.getByRole("button", { name: "Previous line move", exact: true }).click();
  await expect(counter).toHaveText(`9 / ${line!.plies}`);
});
