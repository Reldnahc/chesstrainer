import { test as base, expect, type Page } from "./helpers/browserTest";
import type { AudioPreferences } from "../src/audio/model";
import { audioCues, captureAudio, clearAudio } from "./helpers/audio";

const preferencePath = "/api/preferences/audio";
const defaults: AudioPreferences = {
  enabled: true,
  volume: 0.35,
  board: true,
  practice: true,
  voice: "automatic",
};
const test = base.extend<{ restoreAudio: void }>({
  restoreAudio: [
    async ({ page }, use) => {
      const original = await (await page.request.get(preferencePath)).json();
      expect((await page.request.put(preferencePath, { data: defaults })).ok()).toBe(true);
      await captureAudio(page);
      try {
        await use();
      } finally {
        expect((await page.request.put(preferencePath, { data: original })).ok()).toBe(true);
      }
    },
    { auto: true },
  ],
});

function soundSettings(page: Page) {
  return page.getByRole("region", { name: "Sound", exact: true });
}
function volumeControl(page: Page) {
  return soundSettings(page).getByRole("slider", { name: /^Volume/ });
}
async function savedChange(page: Page, action: () => Promise<unknown>) {
  const response = page.waitForResponse(
    result =>
      new URL(result.url()).pathname === preferencePath && result.request().method() === "PUT",
  );
  await action();
  expect((await response).ok()).toBe(true);
  await expect(soundSettings(page).locator(".preference-status")).toHaveAttribute(
    "data-state",
    "saved",
  );
}

test("sound choices save independently, survive reload and keep a usable narrow layout", async ({
  page,
}, info) => {
  await page.goto("/settings?section=sound");
  const sound = soundSettings(page);
  const volume = volumeControl(page);
  await expect(
    page
      .getByRole("navigation", { name: "Settings sections" })
      .getByRole("link", { name: "Sound", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(sound.getByRole("checkbox", { name: "Enable sound", exact: true })).toBeChecked();
  await expect(volume).toBeEnabled();
  await expect(volume).toHaveValue("35");
  await expect(sound.getByRole("checkbox", { name: /^Board moves/ })).toBeChecked();
  await expect(sound.getByRole("checkbox", { name: /^Practice feedback/ })).toBeChecked();
  await expect(sound.getByRole("checkbox", { name: /^Review accents/ })).toHaveCount(0);
  await expect(sound.getByRole("checkbox")).toHaveCount(3);
  await expect(sound.getByRole("combobox", { name: "Coach voice", exact: true })).toHaveValue(
    "automatic",
  );
  await expect(sound.locator("#coach-voice-help")).toContainText(
    "Recorded voices: Walter, Femi, Jun, Arjun, Tamar, Marisol, Réka, Ingrid, Mateo, Tala, Alfie, Waffles, Scout, Biscuit, Felix, Juniper, Pickle, Monty, Bandit, Fergus, Winston, Celeste, Orin, Ember, Wisp, Ziggy, Rivet, Pip, Button, and Percy.",
  );
  await savedChange(page, () =>
    sound.getByRole("combobox", { name: "Coach voice", exact: true }).selectOption("manual"),
  );
  await savedChange(page, () => sound.getByRole("checkbox", { name: /^Board moves/ }).uncheck());
  await savedChange(page, () => volume.press("End"));
  const expected = { ...defaults, board: false, volume: 1, voice: "manual" };
  expect(await (await page.request.get(preferencePath)).json()).toEqual(expected);
  await page.reload();
  await expect(volume).toHaveValue("100");
  await expect(sound.getByRole("combobox", { name: "Coach voice", exact: true })).toHaveValue(
    "manual",
  );
  await expect(sound.getByRole("checkbox", { name: /^Board moves/ })).not.toBeChecked();
  await expect(sound.getByRole("checkbox", { name: /^Practice feedback/ })).toBeChecked();
  await expect(sound.getByRole("checkbox", { name: /^Review accents/ })).toHaveCount(0);
  await savedChange(page, () =>
    sound.getByRole("checkbox", { name: "Enable sound", exact: true }).uncheck(),
  );
  await expect(volume).toBeDisabled();
  await expect(sound.getByRole("combobox", { name: "Coach voice", exact: true })).toBeDisabled();
  for (const name of [/^Board moves/, /^Practice feedback/])
    await expect(sound.getByRole("checkbox", { name })).toBeDisabled();
  await expect(sound.getByRole("button", { name: "Test sound", exact: true })).toBeDisabled();
  expect(await (await page.request.get(preferencePath)).json()).toEqual({
    ...expected,
    enabled: false,
  });
  await page.reload();
  await expect(
    sound.getByRole("checkbox", { name: "Enable sound", exact: true }),
  ).not.toBeChecked();
  await expect(volume).toHaveValue("100");
  if (info.project.name === "mobile") await page.setViewportSize({ width: 320, height: 700 });
  await sound.screenshot({ path: `test-results/audio-settings-${info.project.name}.png` });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("a pointer volume change survives blur during a pending save", async ({ page }) => {
  const writes: AudioPreferences[] = [];
  let release!: () => void;
  const pending = new Promise<void>(resolve => {
    release = resolve;
  });
  await page.route(`**${preferencePath}`, async route => {
    if (route.request().method() === "PUT") {
      writes.push(route.request().postDataJSON());
      await pending;
    }
    await route.continue();
  });
  try {
    await page.goto("/settings?section=sound");
    const sound = soundSettings(page);
    const volume = volumeControl(page);
    await expect(volume).toBeEnabled();
    await volume.scrollIntoViewIfNeeded();
    const box = (await volume.boundingBox())!;
    await volume.click({ position: { x: box.width * 0.8, y: box.height / 2 } });
    await expect.poll(() => writes.length).toBe(1);
    const expected = String(Math.round(writes[0].volume * 100));
    expect(Number(expected)).toBeGreaterThan(35);
    // The slider stays usable (and focused) while the change saves; the controls are marked busy.
    await expect(volume).toBeEnabled();
    await expect(sound.locator(".audio-settings-controls")).toHaveAttribute("aria-busy", "true");
    await expect(sound.locator(".preference-status")).toHaveAttribute("data-state", "saving");
    await sound.getByRole("heading", { name: "Sound", exact: true }).click();
    await expect(volume).toHaveValue(expected);
    expect(writes).toHaveLength(1);
    release();
    await expect(sound.locator(".preference-status")).toHaveAttribute("data-state", "saved");
    await expect(volume).toHaveValue(expected);
    expect(writes).toHaveLength(1);
    await page.reload();
    await expect(volume).toHaveValue(expected);
  } finally {
    release();
  }
});

test("quick mute persists only on this device and never writes account preferences", async ({
  page,
}, info) => {
  const { id } = await (
    await page.request.post(`/__test/game-review-fixture/audio-mute-${info.project.name}`)
  ).json();
  const writes: string[] = [];
  page.on("request", request => {
    if (new URL(request.url()).pathname === preferencePath && request.method() === "PUT")
      writes.push(request.postData() ?? "");
  });
  await page.goto(`/games/${id}?ply=1`);
  const mute = page.getByRole("button", { name: "Mute sound on this device", exact: true });
  await expect(mute).toBeEnabled();
  expect(await audioCues(page)).toEqual([]);
  await page.getByRole("button", { name: "Next move", exact: true }).click();
  await expect.poll(() => audioCues(page)).toEqual(["move"]);
  await clearAudio(page);
  await mute.click();
  const unmute = page.getByRole("button", { name: "Unmute sound on this device", exact: true });
  await expect(unmute).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Next move", exact: true }).click();
  await expect(
    page.locator(".game-move-list").getByRole("button", { name: /^2\. g4(?:, .+)?$/ }),
  ).toHaveAttribute("aria-current", "step");
  expect(await audioCues(page)).toEqual([]);
  await page.reload();
  await expect(unmute).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Previous move", exact: true }).click();
  await expect(
    page.locator(".game-move-list").getByRole("button", { name: /^1… e5(?:, .+)?$/ }),
  ).toHaveAttribute("aria-current", "step");
  expect(await audioCues(page)).toEqual([]);
  expect(await (await page.request.get(preferencePath)).json()).toEqual(defaults);
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await page
    .getByRole("navigation", { name: "Settings sections" })
    .getByRole("link", { name: "Sound", exact: true })
    .click();
  const sound = soundSettings(page);
  await expect(sound.getByRole("button", { name: "Test sound", exact: true })).toBeDisabled();
  await expect(sound.locator(".preference-status")).toContainText("Muted on this device");
  await sound.getByRole("button", { name: "Unmute this device", exact: true }).click();
  await sound.getByRole("button", { name: "Test sound", exact: true }).click();
  await expect.poll(() => audioCues(page)).toEqual(["move"]);
  await page.reload();
  await expect(sound.getByRole("button", { name: "Test sound", exact: true })).toBeEnabled();
  await expect(sound.getByRole("button", { name: "Unmute this device", exact: true })).toHaveCount(
    0,
  );
  expect(writes).toEqual([]);
});
