import { expect, test, type Page } from "@playwright/test";
import { pauseAfterLoad } from "./fixtures/clock";
import { cueCatalog, paletteCatalog, productionCuePalettes } from "../src/audio/catalog";
import recordedSources from "../src/audio/assets/sources.json" with { type: "json" };
import { retryContexts } from "../src/audio/studio/scenarios";

const paletteLabel = (cue: (typeof cueCatalog)[number]["id"]) => paletteCatalog.find(palette => palette.id === productionCuePalettes[cue])!.label;
const moveButton = (page: Page) => page.getByRole("button", { name: `Play Move · ${paletteLabel("move")}`, exact: true });
const contextButton = (page: Page) => page.getByRole("button", { name: "Hear Try again in context", exact: true });
const startedEvents = (page: Page) => page.locator('[data-event-type="started"]');
async function openWithClock(page: Page) {
  await page.clock.install({ time: new Date("2026-01-01T12:00:00Z") });
  await page.goto("/");
  await pauseAfterLoad(page);
}
async function setVisibility(page: Page, state: "hidden" | "visible") {
  await page.evaluate(value => {
    Object.defineProperty(document, "visibilityState", { value, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  }, state);
}

test("studio stays silent on entry and previews all nine approved sounds", async ({ page }) => {
  const requests: string[] = [];
  const errors: string[] = [];
  page.on("request", request => requests.push(request.url()));
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "A little sound. A clearer game." })).toBeVisible();
  await expect(page.locator(".audio-studio-cue-row")).toHaveCount(9);
  await expect(page.getByRole("radio")).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "Sound palette", exact: true })).toHaveCount(0);
  expect(requests.filter(url => url.endsWith(".wav"))).toEqual([]);
  for (const cue of cueCatalog) {
    const palette = productionCuePalettes[cue.id];
    await page.getByRole("button", { name: `Play ${cue.label} · ${paletteLabel(cue.id)}`, exact: true }).click();
    await expect(startedEvents(page).first()).toHaveAttribute("data-cue", cue.id);
    await expect(startedEvents(page).first()).toHaveAttribute("data-palette", palette!);
  }
  expect(new Set(requests.filter(url => url.endsWith(".wav"))).size).toBe(9);
  expect(requests.filter(url => new URL(url).pathname.startsWith("/api/"))).toEqual([]);
  expect(errors).toEqual([]);
});

test("legacy audition picks are ignored and preview controls never change browser preferences", async ({ page }) => {
  const storage = {
    "fieldwork.audio-studio.picks.v1": JSON.stringify({ move: "warm-wood" }),
    "fieldwork.audio-studio.picks.v2": JSON.stringify({ move: "recorded-chess", retry: "retry-fret-catch" }),
    "unrelated-setting": "keep-me",
  };
  await page.addInitScript(items => {
    for (const [key, value] of Object.entries(items)) localStorage.setItem(key, value);
    const getItem = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key) {
      if (key.startsWith("fieldwork.audio-studio.picks.")) throw new Error("Retired audition picks must not be read");
      return getItem.call(this, key);
    };
  }, storage);
  await page.goto("/");
  await page.getByRole("button", { name: "Practice", exact: true }).click();
  await expect(page.locator(".audio-studio-cue-row")).toHaveCount(3);
  await page.getByRole("button", { name: "Play Try again · Muted tongue drum", exact: true }).click();
  await expect(startedEvents(page).first()).toHaveAttribute("data-palette", "retry-muted-tongue");
  await page.getByRole("button", { name: "Board", exact: true }).click();
  await expect(page.locator(".audio-studio-cue-row")).toHaveCount(6);
  await moveButton(page).click();
  await expect(startedEvents(page).first()).toHaveAttribute("data-palette", productionCuePalettes.move!);
  await page.getByRole("button", { name: "Mute audio", exact: true }).click();
  await page.getByRole("slider", { name: "Volume", exact: true }).press("Home");
  expect(await page.evaluate(() => ({ ...localStorage }))).toEqual(storage);
  await page.reload();
  await expect(page.locator(".audio-studio-cue-row")).toHaveCount(9);
  await expect(page.getByRole("slider", { name: "Volume", exact: true })).toHaveValue("35");
  expect(await page.evaluate(() => ({ ...localStorage }))).toEqual(storage);
});

test("each approved sound credits its recording sources, licenses and exact modifications", async ({ page }) => {
  await page.goto("/");
  expect(recordedSources.schemaVersion).toBe(1);
  expect(recordedSources.assets).toHaveLength(9);
  expect(recordedSources.assets.map(asset => `${asset.palette}:${asset.cue}`).sort())
    .toEqual(cueCatalog.map(cue => `${productionCuePalettes[cue.id]}:${cue.id}`).sort());
  expect(recordedSources.sources.map(source => source.id).sort())
    .toEqual([...new Set(recordedSources.assets.flatMap(asset => asset.takes.map(take => take.source)))].sort());
  await expect(page.locator(".audio-studio-source")).toHaveCount(9);
  for (const asset of recordedSources.assets) {
    const disclosure = page.locator(`.audio-studio-cue-row[data-cue="${asset.cue}"][data-palette="${asset.palette}"] .audio-studio-source`);
    await expect(disclosure).not.toHaveAttribute("open");
    await disclosure.locator("summary").click();
    const sourceIds = [...new Set(asset.takes.map(take => take.source))];
    const lines = disclosure.locator(".source-line:not(.audio-studio-source-modifications)");
    await expect(lines).toHaveCount(sourceIds.length);
    for (const [index, id] of sourceIds.entries()) {
      const source = recordedSources.sources.find(record => record.id === id)!;
      const line = lines.nth(index);
      await expect(line).toContainText(`${source.title} — ${source.author}`);
      await expect(line.getByRole("link", { name: "View source", exact: true })).toHaveAttribute("href", source.sourceUrl);
      const license = recordedSources.licenses[source.license as keyof typeof recordedSources.licenses];
      await expect(line.getByRole("link", { name: license.label, exact: true })).toHaveAttribute("href", license.url);
    }
    await expect(disclosure.locator(".audio-studio-source-modifications")).toHaveText(asset.modifications);
    await expect(lines.first()).toBeVisible();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

for (const context of retryContexts) {
  test(`${context.label} uses production choices at the documented timings`, async ({ page }) => {
    await openWithClock(page);
    await page.getByRole("button", { name: context.label, exact: true }).click();
    await contextButton(page).click();
    let elapsed = 0;
    for (const [index, step] of context.steps.entries()) {
      if (step.delayMs > elapsed) {
        await page.clock.runFor(step.delayMs - elapsed - 1);
        await expect(startedEvents(page)).toHaveCount(index);
        await page.clock.runFor(1);
      }
      await expect(startedEvents(page)).toHaveCount(index + 1);
      await expect(startedEvents(page).first()).toHaveAttribute("data-cue", step.cue);
      await expect(startedEvents(page).first()).toHaveAttribute("data-palette", productionCuePalettes[step.cue]!);
      elapsed = step.delayMs;
    }
  });
}

for (const interruption of ["stop", "replace", "mute", "hidden", "zero-volume"] as const) {
  test(`context playback cancels stale steps on ${interruption}`, async ({ page }) => {
    await openWithClock(page);
    await page.getByRole("button", { name: "One retry", exact: true }).click();
    await contextButton(page).click();
    await expect(startedEvents(page)).toHaveCount(1);
    await page.clock.runFor(100);
    if (interruption === "stop") await page.getByRole("button", { name: "Stop all", exact: true }).click();
    if (interruption === "replace") await moveButton(page).click();
    if (interruption === "mute") await page.getByRole("button", { name: "Mute audio", exact: true }).click();
    if (interruption === "hidden") await setVisibility(page, "hidden");
    if (interruption === "zero-volume") await page.getByRole("slider", { name: "Volume", exact: true }).press("Home");
    const reason = interruption === "mute" ? "muted" : interruption === "hidden" ? "hidden" : "stopped";
    await expect(page.locator(`[data-event-type="cancelled"][data-cue="retry"][data-reason="${reason}"]`)).toHaveCount(1);
    if (interruption === "mute") await page.getByRole("button", { name: "Unmute audio", exact: true }).click();
    if (interruption === "hidden") await setVisibility(page, "visible");
    if (interruption === "zero-volume") await page.getByRole("slider", { name: "Volume", exact: true }).press("End");
    await page.clock.runFor(2500);
    await expect(startedEvents(page)).toHaveCount(interruption === "replace" ? 2 : 1);
    await expect(page.locator('[data-event-type="started"][data-cue="retry"]')).toHaveCount(0);
    await expect(page.locator('[data-event-type="started"][data-cue="correct"]')).toHaveCount(0);
  });
}

test("changing context cancels the old sequence and waits for another Play", async ({ page }) => {
  await openWithClock(page);
  await expect(page.getByRole("button", { name: "Repeated attempts", exact: true })).toHaveAttribute("aria-pressed", "true");
  await contextButton(page).click();
  await expect(startedEvents(page)).toHaveCount(1);
  await page.clock.runFor(159);
  await page.getByRole("button", { name: "Full sound mix", exact: true }).click();
  await expect(page.locator('[data-event-type="cancelled"][data-cue="retry"][data-reason="stopped"]')).toHaveCount(3);
  await page.clock.runFor(10000);
  await expect(startedEvents(page)).toHaveCount(1);
});

test("scenarios use production choices and skipping cancels feedback from the previous position", async ({ page }) => {
  await openWithClock(page);
  await page.getByRole("button", { name: "Play scenario", exact: true }).click();
  await expect(startedEvents(page)).toHaveCount(1);
  await expect(startedEvents(page).first()).toHaveAttribute("data-palette", productionCuePalettes.capture!);
  await page.clock.runFor(900);
  await expect(startedEvents(page)).toHaveCount(2);
  await expect(startedEvents(page).first()).toHaveAttribute("data-palette", productionCuePalettes.check!);
  await page.getByRole("combobox", { name: "Scenario", exact: true }).selectOption("skipped-playback");
  await page.getByRole("button", { name: "Play scenario", exact: true }).click();
  await expect(startedEvents(page)).toHaveCount(3);
  await page.clock.runFor(180);
  await expect(page.locator('[data-event-type="cancelled"][data-cue="check"][data-reason="scope-cancelled"]')).toHaveCount(1);
  await expect(page.locator('[data-event-type="cancelled"][data-cue="complete"][data-reason="scope-cancelled"]')).toHaveCount(1);
  await expect(startedEvents(page)).toHaveCount(4);
  await page.clock.runFor(1500);
  await expect(startedEvents(page)).toHaveCount(4);
});

for (const mode of ["mute", "hidden"] as const) {
  test(`${mode} clears the studio skip timer without playback resuming`, async ({ page }) => {
    await openWithClock(page);
    await page.getByRole("combobox", { name: "Scenario", exact: true }).selectOption("skipped-playback");
    await page.getByRole("button", { name: "Play scenario", exact: true }).click();
    await expect(startedEvents(page)).toHaveCount(1);
    if (mode === "mute") {
      await page.getByRole("button", { name: "Mute audio", exact: true }).click();
      await page.getByRole("button", { name: "Unmute audio", exact: true }).click();
    } else {
      await setVisibility(page, "hidden");
      await setVisibility(page, "visible");
    }
    await page.clock.runFor(1500);
    await expect(startedEvents(page)).toHaveCount(1);
    await expect(page.locator(".audio-studio-now")).not.toContainText("Jumped ahead");
  });
}

test("muted previews are suppressed and blocked audio has clear feedback", async ({ page }) => {
  await openWithClock(page);
  await page.getByRole("button", { name: "Mute audio", exact: true }).click();
  await contextButton(page).click();
  await expect(page.locator('[data-event-type="suppressed"][data-reason="muted"]')).toHaveCount(9);
  await page.getByRole("button", { name: "Unmute audio", exact: true }).click();
  await page.clock.runFor(10000);
  await expect(startedEvents(page)).toHaveCount(0);
  await page.addInitScript(() => {
    Object.defineProperty(window, "AudioContext", { value: undefined, configurable: true });
    Object.defineProperty(window, "webkitAudioContext", { value: undefined, configurable: true });
  });
  await page.reload();
  await moveButton(page).click();
  await expect(page.getByRole("alert")).toContainText("Audio is unavailable or blocked by the browser");
});

test("preview controls fit narrow phones with accessible targets", async ({ page }, info) => {
  await page.goto("/");
  if (info.project.name === "mobile") await page.setViewportSize({ width: 320, height: 780 });
  await expect(page.locator(".audio-studio-cue-preview")).toHaveCount(9);
  if (info.project.name === "mobile") {
    const controls = await page.locator("button, select, summary").evaluateAll(elements => elements.map(element => element.getBoundingClientRect().height));
    expect(controls.every(height => height >= 44)).toBe(true);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("audio-studio.png"), fullPage: true });
});
