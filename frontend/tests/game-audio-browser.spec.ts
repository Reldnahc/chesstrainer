import { expect, test } from "@playwright/test";
import { audioCues, captureAudio, clearAudio } from "./helpers/audio";

test("game review plays explicit moves through the audio service and keeps graph dragging quiet", async ({page}, info) => {
  const {id} = await (await page.request.post(`/__test/game-review-fixture/audio-review-${info.project.name}`)).json();
  const game = await (await page.request.get(`/api/games/${id}`)).json();
  game.frames = game.frames.map((frame: typeof game.frames[number], ply: number) => {
    if (!ply) return frame;
    const candidate = {uci: frame.uci, san: frame.san, pv: [], score: {kind: "cp", value: ply * 100}};
    return {...frame, report: {label: ply === 3 ? "Brilliant" : ply === 4 ? "Blunder" : "Good",
      best: candidate, actual: candidate, white_score: candidate.score,
      depth: 1, engine_version: "Audio navigation fixture", board_cues: null}};
  });
  game.job = {status: "completed", completed: 4, total: 4};
  await page.route(`**/api/games/${id}`, route => route.fulfill({json: game}));
  await page.route(`**/api/games/${id}/review`, route => route.fulfill({json: {job_id: "audio-review", status: "completed"}}));
  await page.route("**/api/preferences/audio", route => route.fulfill({json: {
    enabled: true, volume: .35, board: true, practice: true, review: true,
  }}));
  await captureAudio(page);
  const preferences = page.waitForResponse(response => response.url().endsWith("/api/preferences/audio"));
  await page.goto(`/games/${id}?ply=2`);
  await preferences;
  await expect(page.locator(".move-playback-counter")).toHaveText("2 / 4");
  expect(await audioCues(page)).toEqual([]);

  await page.getByRole("button", {name: "Flip board", exact: true}).click();
  expect(await audioCues(page)).toEqual([]);
  await page.getByRole("button", {name: "Next move", exact: true}).click();
  await expect.poll(() => audioCues(page)).toEqual(["move", "brilliant"]);
  await clearAudio(page);
  await page.getByRole("button", {name: "Next move", exact: true}).click();
  await expect.poll(() => audioCues(page)).toEqual(["mate"]);
  await page.getByRole("button", {name: "Previous move", exact: true}).click();
  await expect.poll(() => audioCues(page)).toEqual(["mate", "move", "brilliant"]);
  await clearAudio(page);

  const plot = page.locator(".game-evaluation-plot");
  await plot.scrollIntoViewIfNeeded();
  const bounds = (await plot.boundingBox())!;
  const x = async (ply: number) => bounds.x + Number(await plot.locator(`[data-ply="${ply}"]`).getAttribute("cx"));
  const y = bounds.y + 25;
  await page.mouse.move(await x(1), y);
  await page.mouse.down();
  await page.mouse.move(await x(4), y);
  await expect(page.locator(".move-playback-counter")).toHaveText("4 / 4");
  expect(await audioCues(page)).toEqual([]);
  await page.mouse.up();
  await expect.poll(() => audioCues(page)).toEqual(["move"]);
});
