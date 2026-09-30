import { expect, test } from "@playwright/test";
import { cueCatalog, paletteCatalog } from "../src/audio/catalog";
import recordedSources from "../src/audio/assets/sources.json" with { type: "json" };
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
  await page.getByRole("radio", { name: "Choose Soft objects for Move", exact: true }).check();
  await page.getByRole("button", { name: "Practice", exact: true }).click();
  await expect(page.locator(".audio-studio-cue-row")).toHaveCount(3);
  await page.getByRole("radio", { name: "Choose Tabletop for Correct", exact: true }).check();
  const stored = await page.evaluate(key => ({ keys: Object.keys(localStorage), value: JSON.parse(localStorage.getItem(key)!) }), studioStorageKey);
  expect(stored).toEqual({ keys: [studioStorageKey], value: { move: "soft-objects", correct: "tabletop" } });
  await page.reload();
  await expect(page.getByRole("radio", { name: "Choose Soft objects for Move", exact: true })).toBeChecked();
  await expect(page.getByRole("radio", { name: "Choose Tabletop for Correct", exact: true })).toBeChecked();
  await page.getByText("View cue mapping", { exact: true }).click();
  const mapping = JSON.parse((await page.getByLabel("Cue mapping JSON").textContent())!);
  expect(mapping).toEqual({ schemaVersion: 2, purpose: "fieldwork-audio-audition", fallbackPalette: "recorded-chess", cuePalettes: { move: "soft-objects", correct: "tabletop" } });
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download", exact: true }).click();
  expect((await downloadEvent).suggestedFilename()).toBe("fieldwork-audio-picks.json");
});

test("each recorded candidate exposes its source and CC0 attribution", async ({ page }) => {
  await page.goto("/");
  expect(recordedSources.schemaVersion).toBe(1);
  expect(recordedSources.assets).toHaveLength(cueCatalog.length * paletteCatalog.length);
  expect(new Set(recordedSources.assets.map(source => `${source.palette}:${source.cue}`)).size)
    .toBe(cueCatalog.length * paletteCatalog.length);
  await expect(page.locator(".audio-studio-source")).toHaveCount(recordedSources.assets.length);
  for (const source of recordedSources.assets) {
    const disclosure = page.locator(`.audio-studio-cue-row[data-cue="${source.cue}"] [data-palette="${source.palette}"] .audio-studio-source`);
    await expect(disclosure).not.toHaveAttribute("open");
    await expect(disclosure.locator(".source-line")).toContainText(`${source.title} — ${source.author}`);
    await expect(disclosure.locator('a').filter({ hasText: "View source" })).toHaveAttribute("href", source.sourceUrl);
    await expect(disclosure.locator('a').filter({ hasText: "CC0" })).toHaveAttribute("href", "https://creativecommons.org/publicdomain/zero/1.0/");
  }
  const firstSource = recordedSources.assets.find(source => source.palette === "recorded-chess" && source.cue === "move")!;
  const first = page.locator('.audio-studio-cue-row[data-cue="move"] [data-palette="recorded-chess"] .audio-studio-source');
  await first.locator("summary").click();
  await expect(first.getByRole("link", { name: "View source", exact: true })).toHaveAttribute("href", firstSource.sourceUrl);
  await expect(first.getByRole("link", { name: "CC0", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("rejected synthetic picks are never carried over to recorded candidates", async ({ page }) => {
  await page.addInitScript(key => {
    localStorage.setItem("fieldwork.audio-studio.picks.v1", JSON.stringify({ move: "warm-wood", correct: "clean-minimal", brilliant: "soft-digital" }));
    localStorage.setItem(key, JSON.stringify({ move: "warm-wood", correct: "clean-minimal", brilliant: "soft-digital", unknownCue: "tabletop" }));
  }, studioStorageKey);
  await page.goto("/");
  await expect(page.locator('.audio-studio-cue-option input:checked')).toHaveCount(0);
  await expect(page.locator(".audio-studio-count")).toHaveText("0 / 14 picked");
  await page.getByText("View cue mapping", { exact: true }).click();
  expect(JSON.parse((await page.getByLabel("Cue mapping JSON").textContent())!).cuePalettes).toEqual({});
  await page.getByRole("radio", { name: "Choose Recorded chess for Move", exact: true }).check();
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), studioStorageKey)).toEqual({ move: "recorded-chess" });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("fieldwork.audio-studio.picks.v1")!)))
    .toEqual({ move: "warm-wood", correct: "clean-minimal", brilliant: "soft-digital" });
});

test("clearing studio picks survives reload and preserves unrelated settings", async ({ page }) => {
  const apiRequests: string[] = [];
  page.on("request", request => {
    if (new URL(request.url()).pathname.startsWith("/api/")) apiRequests.push(request.url());
  });
  await page.goto("/");
  const clear = page.getByRole("button", { name: "Clear picks", exact: true });
  await expect(clear).toBeDisabled();
  await page.evaluate(() => {
    localStorage.setItem("unrelated-setting", "keep-me");
    localStorage.setItem("fieldwork.audio-studio.picks.v1", JSON.stringify({ move: "warm-wood" }));
  });
  await page.getByRole("radio", { name: "Choose Soft objects for Move", exact: true }).check();
  await page.getByRole("radio", { name: "Choose Tabletop for Correct", exact: true }).check();
  await expect(clear).toBeEnabled();
  await clear.click();
  await expect(page.locator('.audio-studio-cue-option input:checked')).toHaveCount(0);
  await expect(clear).toBeDisabled();
  await expect(page.locator(".audio-studio-save-status")).toHaveText("Cleared your studio picks.");
  expect(await page.evaluate(key => ({
    current: localStorage.getItem(key),
    legacy: localStorage.getItem("fieldwork.audio-studio.picks.v1"),
    unrelated: localStorage.getItem("unrelated-setting"),
  }), studioStorageKey)).toEqual({ current: null, legacy: JSON.stringify({ move: "warm-wood" }), unrelated: "keep-me" });
  await page.reload();
  await expect(page.locator('.audio-studio-cue-option input:checked')).toHaveCount(0);
  await expect(clear).toBeDisabled();
  await page.getByRole("radio", { name: "Choose Recorded chess for Move", exact: true }).check();
  await expect(clear).toBeEnabled();
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), studioStorageKey)).toEqual({ move: "recorded-chess" });
  expect(apiRequests).toEqual([]);
});

test("scenario playback uses the engine, respects mute and cancels stale feedback", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("combobox", { name: "Sound palette", exact: true }).selectOption("soft-objects");
  await page.getByRole("button", { name: "Play scenario", exact: true }).click();
  await expect(page.locator('[data-event-type="started"][data-cue="capture"]')).toHaveCount(1);
  await expect(page.locator('[data-event-type="started"][data-cue="check"]')).toHaveCount(1);
  await expect(page.locator('[data-event-type="started"][data-cue="check"]')).toContainText("Soft objects");

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
  await page.getByRole("button", { name: "Play Move · Recorded chess", exact: true }).click();
  await expect(page.locator('[data-event-type="suppressed"][data-cue="move"][data-reason="muted"]')).toHaveCount(1);
  await page.getByRole("button", { name: "Unmute audio", exact: true }).click();
  await page.getByRole("slider", { name: "Volume", exact: true }).focus();
  await page.getByRole("slider", { name: "Volume", exact: true }).press("Home");
  await expect(page.getByRole("slider", { name: "Volume", exact: true })).toHaveValue("0");
  await page.getByRole("button", { name: "Play Move · Recorded chess", exact: true }).click();
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
    const controls = await page.locator("button, .audio-studio-pick, select, summary").evaluateAll(elements => elements.map(element => element.getBoundingClientRect().height));
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
  await page.getByRole("button", { name: "Play Move · Recorded chess", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Audio is unavailable or blocked by the browser");
});
