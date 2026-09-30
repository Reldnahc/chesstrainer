import { expect, test } from "@playwright/test";
import { cueCatalog, paletteCatalog } from "../src/audio/catalog";
import { studioStorageKey } from "../src/audio/studio/selections";

test("studio stays silent on entry and auditions every actual cue and palette", async ({ page }) => {
  const requests: string[] = [];
  const errors: string[] = [];
  page.on("request", request => requests.push(request.url()));
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "A little sound. A clearer game." })).toBeVisible();
  await expect(page.locator(".audio-studio-cue-row")).toHaveCount(cueCatalog.length);
  expect(requests.filter(url => url.endsWith(".wav"))).toEqual([]);
  for (const cue of cueCatalog) {
    for (const palette of paletteCatalog) {
      await page.getByRole("button", { name: `Play ${cue.label} · ${palette.label}`, exact: true }).click();
      await expect(page.locator('[data-event-type="started"]').first()).toHaveAttribute("data-cue", cue.id);
      await expect(page.locator('[data-event-type="started"]').first()).toContainText(palette.label);
    }
  }
  expect(new Set(requests.filter(url => url.endsWith(".wav"))).size).toBe(cueCatalog.length * paletteCatalog.length);
  expect(requests.filter(url => new URL(url).pathname.startsWith("/api/"))).toEqual([]);
  expect(errors).toEqual([]);
});

test("cue favorites persist only in the studio and export the selected mapping", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("radio", { name: "Choose Soft digital for Move", exact: true }).check();
  await page.getByRole("button", { name: "Practice", exact: true }).click();
  await expect(page.locator(".audio-studio-cue-row")).toHaveCount(3);
  await page.getByRole("radio", { name: "Choose Clean minimal for Correct", exact: true }).check();
  const stored = await page.evaluate(key => ({ keys: Object.keys(localStorage), value: JSON.parse(localStorage.getItem(key)!) }), studioStorageKey);
  expect(stored).toEqual({ keys: [studioStorageKey], value: { move: "soft-digital", correct: "clean-minimal" } });
  await page.reload();
  await expect(page.getByRole("radio", { name: "Choose Soft digital for Move", exact: true })).toBeChecked();
  await expect(page.getByRole("radio", { name: "Choose Clean minimal for Correct", exact: true })).toBeChecked();
  await page.getByText("View cue mapping", { exact: true }).click();
  const mapping = JSON.parse((await page.getByLabel("Cue mapping JSON").textContent())!);
  expect(mapping).toEqual({ schemaVersion: 1, purpose: "fieldwork-audio-audition", fallbackPalette: "warm-wood", cuePalettes: { move: "soft-digital", correct: "clean-minimal" } });
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download", exact: true }).click();
  expect((await downloadEvent).suggestedFilename()).toBe("fieldwork-audio-picks.json");
});

test("scenario playback uses the engine, respects mute and cancels stale feedback", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("combobox", { name: "Sound palette", exact: true }).selectOption("soft-digital");
  await page.getByRole("button", { name: "Play scenario", exact: true }).click();
  await expect(page.locator('[data-event-type="started"][data-cue="capture"]')).toHaveCount(1);
  await expect(page.locator('[data-event-type="started"][data-cue="check"]')).toHaveCount(1);
  await expect(page.locator('[data-event-type="started"][data-cue="check"]')).toContainText("Soft digital");

  await page.getByRole("combobox", { name: "Scenario", exact: true }).selectOption("skipped-playback");
  await page.getByRole("button", { name: "Play scenario", exact: true }).click();
  await expect(page.locator('[data-event-type="cancelled"][data-cue="check"][data-reason="scope-cancelled"]')).toHaveCount(1);
  await expect(page.locator('[data-event-type="cancelled"][data-cue="brilliant"][data-reason="scope-cancelled"]')).toHaveCount(1);
  await expect(page.locator('[data-event-type="started"][data-cue="move"]')).toHaveCount(2);

  await page.getByRole("combobox", { name: "Scenario", exact: true }).selectOption("brilliant-blunder");
  await page.getByRole("button", { name: "Play scenario", exact: true }).click();
  await expect(page.locator('[data-event-type="started"][data-cue="brilliant"]')).toHaveCount(1);
  await page.getByRole("button", { name: "Stop all", exact: true }).click();
  await expect(page.locator('[data-event-type="cancelled"][data-cue="blunder"][data-reason="stopped"]')).toHaveCount(1);
  await expect(page.locator('[data-event-type="started"][data-cue="blunder"]')).toHaveCount(0);

  await page.getByRole("button", { name: "Mute audio", exact: true }).click();
  await page.getByRole("button", { name: "Play Move · Warm wood", exact: true }).click();
  await expect(page.locator('[data-event-type="suppressed"][data-cue="move"][data-reason="muted"]')).toHaveCount(1);
  await page.getByRole("button", { name: "Unmute audio", exact: true }).click();
  await page.getByRole("slider", { name: "Volume", exact: true }).focus();
  await page.getByRole("slider", { name: "Volume", exact: true }).press("Home");
  await expect(page.getByRole("slider", { name: "Volume", exact: true })).toHaveValue("0");
  await page.getByRole("button", { name: "Play Move · Warm wood", exact: true }).click();
  await expect(page.locator('[data-event-type="suppressed"][data-cue="move"][data-reason="muted"]')).toHaveCount(2);
});

test("studio comparisons remain side by side with accessible narrow-phone controls", async ({ page }, info) => {
  await page.goto("/");
  if (info.project.name === "mobile") await page.setViewportSize({ width: 320, height: 780 });
  await page.getByRole("button", { name: "Board", exact: true }).click();
  await expect(page.locator(".audio-studio-cue-row")).toHaveCount(6);
  const cells = await page.locator('.audio-studio-cue-row[data-cue="move"] .audio-studio-cue-option').evaluateAll(elements => elements.map(element => {
    const { x, y, width } = element.getBoundingClientRect();
    return { x, y, width };
  }));
  expect(cells).toHaveLength(3);
  expect(cells.every(cell => cell.width > 70)).toBe(true);
  expect(Math.max(...cells.map(cell => cell.y)) - Math.min(...cells.map(cell => cell.y))).toBeLessThan(1);
  expect(cells[1].x).toBeGreaterThanOrEqual(cells[0].x + cells[0].width);
  expect(cells[2].x).toBeGreaterThanOrEqual(cells[1].x + cells[1].width);
  if (info.project.name === "mobile") {
    const controls = await page.locator("button, .audio-studio-pick, select").evaluateAll(elements => elements.map(element => element.getBoundingClientRect().height));
    expect(controls.every(height => height >= 44)).toBe(true);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("audio-studio.png"), fullPage: true });
});

test("unmuting never resumes a skipped scenario and blocked audio has clear feedback", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-01-01T12:00:00Z") });
  await page.goto("/");
  await page.clock.pauseAt(new Date("2026-01-01T12:00:01Z"));
  await page.getByRole("combobox", { name: "Scenario", exact: true }).selectOption("skipped-playback");
  await page.getByRole("button", { name: "Mute audio", exact: true }).click();
  await page.getByRole("button", { name: "Play scenario", exact: true }).click();
  await expect(page.locator('[data-event-type="suppressed"][data-reason="muted"]')).toHaveCount(3);
  await page.getByRole("button", { name: "Unmute audio", exact: true }).click();
  await page.clock.runFor(500);
  await expect(page.locator('[data-event-type="started"]')).toHaveCount(0);

  await page.getByRole("button", { name: "Play scenario", exact: true }).click();
  await expect(page.locator('[data-event-type="started"][data-cue="move"]')).toHaveCount(1);
  await page.getByRole("button", { name: "Mute audio", exact: true }).click();
  await page.getByRole("button", { name: "Unmute audio", exact: true }).click();
  await page.clock.runFor(1500);
  await expect(page.locator('[data-event-type="started"]')).toHaveCount(1);

  await page.addInitScript(() => {
    Object.defineProperty(window, "AudioContext", { value: undefined, configurable: true });
    Object.defineProperty(window, "webkitAudioContext", { value: undefined, configurable: true });
  });
  await page.reload();
  await page.getByRole("button", { name: "Play Move · Warm wood", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Audio is unavailable or blocked by the browser");
});
