import { expect, test } from "@playwright/test";
import { cueCatalog, fullPaletteCatalog, palettesForCue, productionCuePalettes } from "../src/audio/catalog";
import recordedSources from "../src/audio/assets/sources.json" with { type: "json" };
import { studioStorageKey } from "../src/audio/studio/selections";

const candidateCount = cueCatalog.reduce((total, cue) => total + palettesForCue(cue.id).length, 0);

test("studio stays silent on entry and auditions every available candidate", async ({ page }) => {
  const requests: string[] = [];
  const errors: string[] = [];
  page.on("request", request => requests.push(request.url()));
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "A little sound. A clearer game." })).toBeVisible();
  await expect(page.locator(".audio-studio-cue-row")).toHaveCount(cueCatalog.length);
  expect(requests.filter(url => url.endsWith(".wav"))).toEqual([]);
  for (const cue of cueCatalog) {
    for (const palette of palettesForCue(cue.id)) {
      await page.getByRole("button", { name: `Play ${cue.label} · ${palette.label}`, exact: true }).click();
      await expect(page.locator('[data-event-type="started"]').first()).toHaveAttribute("data-cue", cue.id);
      await expect(page.locator('[data-event-type="started"]').first()).toContainText(palette.label);
    }
  }
  expect(candidateCount).toBe(30);
  expect(new Set(requests.filter(url => url.endsWith(".wav"))).size).toBe(candidateCount);
  expect(requests.filter(url => new URL(url).pathname.startsWith("/api/"))).toEqual([]);
  expect(errors).toEqual([]);
});

test("cue favorites persist only in the studio and export the selected mapping", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("radio", { name: "Choose Soft objects for Move", exact: true }).check();
  await page.getByRole("button", { name: "Practice", exact: true }).click();
  await expect(page.locator(".audio-studio-cue-row")).toHaveCount(cueCatalog.filter(cue => cue.category === "practice").length);
  await page.getByRole("radio", { name: "Choose Tabletop for Correct", exact: true }).check();
  const stored = await page.evaluate(key => ({ keys: Object.keys(localStorage), value: JSON.parse(localStorage.getItem(key)!) }), studioStorageKey);
  expect(stored).toEqual({ keys: [studioStorageKey], value: { move: "soft-objects", correct: "tabletop" } });
  await page.reload();
  await expect(page.getByRole("radio", { name: "Choose Soft objects for Move", exact: true })).toBeChecked();
  await expect(page.getByRole("radio", { name: "Choose Tabletop for Correct", exact: true })).toBeChecked();
  await page.getByText("View cue mapping", { exact: true }).click();
  const mapping = JSON.parse((await page.getByLabel("Cue mapping JSON").textContent())!);
  expect(mapping).toEqual({ schemaVersion: 3, purpose: "fieldwork-audio-audition", fallbackCuePalettes: productionCuePalettes, cuePalettes: { move: "soft-objects", correct: "tabletop" } });
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download", exact: true }).click();
  expect((await downloadEvent).suggestedFilename()).toBe("fieldwork-audio-picks.json");
});

test("approved browser picks and the original retry choice survive catalog updates", async ({ page }) => {
  const approved = {
    move: "soft-objects", capture: "soft-objects", castle: "soft-objects", promotion: "soft-objects", mate: "soft-objects",
    check: "tabletop", correct: "tabletop", complete: "tabletop",
  };
  const picks = { ...approved, retry: "retry-soft-error" };
  await page.addInitScript(({ key, picks }) => localStorage.setItem(key, JSON.stringify(picks)), { key: studioStorageKey, picks });
  await page.goto("/");
  await expect(page.locator('.audio-studio-cue-option input:checked')).toHaveCount(9);
  await expect(page.getByRole("radio", { name: "Choose Soft error for Try again", exact: true })).toBeChecked();
  await expect(page.getByRole("button", { name: "Review", exact: true })).toHaveCount(0);
  for (const rating of ["brilliant", "great", "miss", "mistake", "blunder"]) {
    await expect(page.locator(`.audio-studio-cue-row[data-cue="${rating}"]`)).toHaveCount(0);
  }
  await page.getByText("View cue mapping", { exact: true }).click();
  const mapping = JSON.parse((await page.getByLabel("Cue mapping JSON").textContent())!);
  expect(mapping.cuePalettes).toEqual(picks);
  expect(mapping.fallbackCuePalettes).toEqual({ ...approved, retry: null });
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), studioStorageKey)).toEqual(picks);
});

test("My picks uses per-cue production defaults and keeps unapproved retry silent", async ({ page }) => {
  const soundRequests: string[] = [];
  page.on("request", request => {
    if (request.url().endsWith(".wav")) soundRequests.push(request.url());
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Play scenario", exact: true }).click();
  await expect(page.locator('[data-event-type="started"][data-cue="capture"]')).toContainText("Soft objects");
  await expect(page.locator('[data-event-type="started"][data-cue="check"]')).toContainText("Tabletop");
  await page.getByRole("combobox", { name: "Scenario", exact: true }).selectOption("retry");
  const requestCount = soundRequests.length;
  await page.getByRole("button", { name: "Play scenario", exact: true }).click();
  await expect(page.locator(".audio-studio-now")).toHaveText("No sound is selected for this scenario.");
  await expect(page.locator('[data-event-type="started"][data-cue="retry"]')).toHaveCount(0);
  expect(soundRequests).toHaveLength(requestCount);
  for (const palette of fullPaletteCatalog) {
    await page.getByRole("combobox", { name: "Sound palette", exact: true }).selectOption(palette.id);
    await page.getByRole("button", { name: "Play scenario", exact: true }).click();
    await expect(page.locator(".audio-studio-now")).toHaveText("No sound is selected for this scenario.");
  }
  expect(soundRequests).toHaveLength(requestCount);
  await page.getByRole("combobox", { name: "Sound palette", exact: true }).selectOption("picks");
  await page.getByRole("radio", { name: "Choose Recorded chess for Capture", exact: true }).check();
  await page.getByRole("combobox", { name: "Scenario", exact: true }).selectOption("capture-check");
  await page.getByRole("button", { name: "Play scenario", exact: true }).click();
  await expect(page.locator('[data-event-type="started"][data-cue="capture"]').first()).toContainText("Recorded chess");
});

test("each candidate exposes its source, actual license and modifications", async ({ page }) => {
  await page.goto("/");
  expect(recordedSources.schemaVersion).toBe(1);
  expect(recordedSources.assets).toHaveLength(candidateCount);
  expect(new Set(recordedSources.assets.map(source => `${source.palette}:${source.cue}`)).size)
    .toBe(candidateCount);
  await expect(page.locator(".audio-studio-source")).toHaveCount(recordedSources.assets.length);
  for (const source of recordedSources.assets) {
    if (source.cue === "retry" && source.palette !== "retry-soft-error") expect(source.license).toBe("CC0-1.0");
    const disclosure = page.locator(`.audio-studio-cue-row[data-cue="${source.cue}"] [data-palette="${source.palette}"] .audio-studio-source`);
    await expect(disclosure).not.toHaveAttribute("open");
    await expect(disclosure.locator(".source-line")).toContainText(`${source.title} — ${source.author}`);
    await expect(disclosure.locator(".source-line")).toContainText(source.modifications);
    await expect(disclosure.locator('a').filter({ hasText: "View source" })).toHaveAttribute("href", source.sourceUrl);
    const license = recordedSources.licenses[source.license as keyof typeof recordedSources.licenses];
    expect(license).toBeDefined();
    await expect(disclosure.locator('a').filter({ hasText: license.label })).toHaveAttribute("href", license.url);
  }
  const firstSource = recordedSources.assets.find(source => source.palette === "recorded-chess" && source.cue === "move")!;
  const first = page.locator('.audio-studio-cue-row[data-cue="move"] [data-palette="recorded-chess"] .audio-studio-source');
  await first.locator("summary").click();
  await expect(first.getByRole("link", { name: "View source", exact: true })).toHaveAttribute("href", firstSource.sourceUrl);
  const firstLicense = recordedSources.licenses[firstSource.license as keyof typeof recordedSources.licenses];
  await expect(first.getByRole("link", { name: firstLicense.label, exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("retry offers six described candidates in a responsive grid without changing the other cue choices", async ({ page }, info) => {
  await page.goto("/");
  if (info.project.name === "mobile") await page.setViewportSize({ width: 320, height: 780 });
  const retry = page.locator('.audio-studio-cue-row[data-cue="retry"]');
  const candidates = palettesForCue("retry");
  expect(candidates.map(candidate => candidate.id)).toEqual([
    "retry-relay-buzzer", "retry-real-buzzer", "retry-piano-slip", "retry-muted-brass",
    "retry-whistle-fall", "retry-soft-error",
  ]);
  await expect(retry.locator(".audio-studio-cue-option")).toHaveCount(candidates.length);
  for (const candidate of candidates) {
    const option = retry.locator(`.audio-studio-cue-option[data-palette="${candidate.id}"]`);
    await expect(option.getByRole("heading", { name: candidate.label, exact: true })).toBeVisible();
    await expect(option.locator(".audio-studio-candidate-description")).toBeVisible();
    await expect(option.locator(".audio-studio-candidate-description")).toHaveText(candidate.description);
  }
  for (const cue of cueCatalog.filter(cue => cue.id !== "retry")) {
    expect(palettesForCue(cue.id).map(palette => palette.id)).toEqual(["recorded-chess", "tabletop", "soft-objects"]);
    await expect(page.locator(`.audio-studio-cue-row[data-cue="${cue.id}"] .audio-studio-cue-option`)).toHaveCount(3);
  }
  await expect(page.getByRole("combobox", { name: "Sound palette", exact: true }).locator("option")).toHaveCount(4);
  const cells = await retry.locator(".audio-studio-cue-option").evaluateAll(elements => elements.map(element => {
    const { x, y, width, height } = element.getBoundingClientRect();
    return { x, y, width, height };
  }));
  const columns = info.project.name === "mobile" ? 2 : 3;
  expect(cells).toHaveLength(candidates.length);
  expect(cells.every(cell => cell.width > 70)).toBe(true);
  for (const [index, cell] of cells.entries()) {
    const column = index % columns;
    expect(Math.abs(cell.y - cells[index - column].y)).toBeLessThan(1);
    expect(Math.abs(cell.x - cells[column].x)).toBeLessThan(1);
    if (column > 0) expect(cell.x).toBeGreaterThanOrEqual(cells[index - 1].x + cells[index - 1].width);
    if (index >= columns) {
      const above = cells[index - columns];
      expect(cell.y).toBeGreaterThanOrEqual(above.y + above.height);
    }
  }
  const controls = await retry.locator("button, summary, .audio-studio-pick").evaluateAll(elements => elements.map(element => element.getBoundingClientRect().height));
  if (info.project.name === "mobile") expect(controls.every(height => height >= 44)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("retry-candidates.png"), fullPage: true });
});

test("rejected retry picks are dropped while approved picks and new retry choices persist", async ({ page }) => {
  const approved = {
    move: "soft-objects", capture: "soft-objects", castle: "soft-objects", promotion: "soft-objects", mate: "soft-objects",
    check: "tabletop", correct: "tabletop", complete: "tabletop",
  };
  await page.goto("/");
  for (const rejected of [
    ...fullPaletteCatalog.map(palette => palette.id),
    "retry-pop", "retry-paper", "retry-zip", "retry-guitar", "retry-kalimba", "retry-conga",
    "retry-downturn", "retry-oops",
    "retry-soft-warm", "retry-soft-short", "retry-soft-gentle",
    "retry-pitch-lift", "retry-pitch-octave", "retry-pitch-bright", "retry-pitch-high", "retry-pitch-highest",
    "retry-double-tap", "retry-double-drop", "retry-double-steep", "retry-triple-step", "retry-stutter",
    "retry-peep-pair", "retry-peep-fall", "retry-peep-triple", "retry-bell-drop", "retry-question", "retry-short-high",
  ]) {
    await page.evaluate(({ key, picks }) => localStorage.setItem(key, JSON.stringify(picks)), {
      key: studioStorageKey, picks: { ...approved, retry: rejected },
    });
    await page.reload();
    await expect(page.locator('.audio-studio-cue-option input:checked')).toHaveCount(8);
    await expect(page.locator('.audio-studio-cue-row[data-cue="retry"] input:checked')).toHaveCount(0);
  }
  await page.getByRole("radio", { name: "Choose Soft error for Try again", exact: true }).check();
  await page.reload();
  await expect(page.getByRole("radio", { name: "Choose Soft error for Try again", exact: true })).toBeChecked();
  await expect(page.locator('.audio-studio-cue-option input:checked')).toHaveCount(9);
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), studioStorageKey)).toEqual({ ...approved, retry: "retry-soft-error" });
  await page.getByRole("combobox", { name: "Scenario", exact: true }).selectOption("retry");
  await page.getByRole("button", { name: "Play scenario", exact: true }).click();
  await expect(page.locator('[data-event-type="started"][data-cue="retry"]')).toContainText("Soft error");
  await page.evaluate(key => localStorage.setItem(key, JSON.stringify({ move: "retry-soft-error", retry: "retry-relay-buzzer" })), studioStorageKey);
  await page.reload();
  await expect(page.locator('.audio-studio-cue-row[data-cue="move"] input:checked')).toHaveCount(0);
  await expect(page.getByRole("radio", { name: "Choose Mechanical buzzer for Try again", exact: true })).toBeChecked();
});

test("rejected synthetic picks are never carried over to recorded candidates", async ({ page }) => {
  await page.addInitScript(key => {
    localStorage.setItem("fieldwork.audio-studio.picks.v1", JSON.stringify({ move: "warm-wood", correct: "clean-minimal", brilliant: "soft-digital" }));
    localStorage.setItem(key, JSON.stringify({ move: "warm-wood", correct: "clean-minimal", brilliant: "soft-digital", unknownCue: "tabletop" }));
  }, studioStorageKey);
  await page.goto("/");
  await expect(page.locator('.audio-studio-cue-option input:checked')).toHaveCount(0);
  await expect(page.locator(".audio-studio-count")).toHaveText(`0 / ${cueCatalog.length} picked`);
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
  await expect(page.locator('[data-event-type="cancelled"][data-cue="complete"][data-reason="scope-cancelled"]')).toHaveCount(1);
  await expect(page.locator('[data-event-type="started"][data-cue="move"]')).toHaveCount(2);

  await page.getByRole("combobox", { name: "Scenario", exact: true }).selectOption("game-finish");
  await page.getByRole("button", { name: "Play scenario", exact: true }).click();
  await expect(page.locator('[data-event-type="started"][data-cue="mate"]')).toHaveCount(1);
  await page.getByRole("button", { name: "Stop all", exact: true }).click();
  await expect(page.locator('[data-event-type="cancelled"][data-cue="complete"][data-reason="stopped"]')).toHaveCount(1);
  await expect(page.locator('[data-event-type="started"][data-cue="complete"]')).toHaveCount(0);

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
