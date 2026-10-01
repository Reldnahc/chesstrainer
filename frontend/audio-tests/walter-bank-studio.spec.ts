import { openWalterStudio } from "./fixtures/openAudioFixture";
import { expect, test, type Page } from "@playwright/test";
import { walterBankCollection, walterBankScripts } from "../src/audio/speech/walterBankAudition";
import manifest from "../src/audio/speech/bank/manifest.json" with { type: "json" };

const panel = (page: Page) => page.getByRole("region", { name: "Find Walter’s voice", exact: true });
const play = (page: Page) => panel(page).getByRole("button", { name: "Play voice", exact: true });
const example = (page: Page) => panel(page).getByRole("combobox", { name: "Speech example", exact: true });
const starts = (page: Page) => page.locator('[data-bus="speech"][data-event-type="started"]');

async function openBank(page: Page) {
  await openWalterStudio(page);
  await panel(page).getByRole("button", { name: walterBankCollection.label, exact: true }).click();
}

test("the bank catalogue covers every approved recording exactly once without silent or lesson entries", () => {
  expect(walterBankScripts).toHaveLength(181);
  expect(new Set(walterBankScripts.map(script => script.id)).size).toBe(181);
  expect(walterBankScripts.map(script => script.recordingId)).toEqual(manifest.recordings.map(record => record.id));
  expect(walterBankCollection.scriptIds).toEqual(walterBankScripts.map(script => script.id));
  for (const script of walterBankScripts) {
    expect(manifest.silentIds).not.toContain(script.recordingId);
    expect(script.category).toBeTruthy();
    expect(script.spokenText).toBe(manifest.recordings.find(record => record.id === script.recordingId)?.text);
  }
});

test("all bank families use one compact selector and play local aligned Walter recordings", async ({ page }, info) => {
  const requests: string[] = [];
  const errors: string[] = [];
  page.on("request", request => requests.push(request.url()));
  page.on("pageerror", error => errors.push(error.message));
  await openBank(page);
  if (info.project.name === "mobile") await page.setViewportSize({ width: 320, height: 780 });
  await expect(example(page).locator("option")).toHaveCount(181);
  await expect(example(page).locator("optgroup")).toHaveCount(5);
  await expect(panel(page).getByRole("group", { name: "Voice candidate", exact: true }).getByRole("button"))
    .toHaveText(["Walter · Older teacher"]);
  await expect(play(page)).toBeEnabled();
  expect(requests.filter(url => /\.mp3$/.test(url))).toEqual([]);
  await expect(starts(page)).toHaveCount(0);

  const categories = [...new Set(walterBankScripts.map(script => script.category))];
  for (const [index, category] of categories.entries()) {
    const script = walterBankScripts.find(item => item.category === category)!;
    await example(page).selectOption(script.id);
    await expect(play(page)).toBeEnabled();
    await expect(panel(page).getByLabel("Coach explanation", { exact: true })).toHaveText(script.spokenText);
    await play(page).click();
    await expect(panel(page)).toHaveAttribute("data-playback", "playing");
    await expect(starts(page)).toHaveCount(index + 1);
    await expect(panel(page).locator('[data-coach="classic"]')).toHaveAttribute("data-articulation", "aligned");
    await page.getByRole("button", { name: "Stop all", exact: true }).click();
    await expect(panel(page)).toHaveAttribute("data-playback", "idle");
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const origin = new URL(page.url()).origin;
  expect(requests.filter(url => new URL(url).origin !== origin || new URL(url).pathname.startsWith("/api/"))).toEqual([]);
  expect(errors).toEqual([]);
  await panel(page).screenshot({ path: info.outputPath("walter-complete-bank.png") });
});

test("changing bank examples cancels a loading recording and keeps the next track identity", async ({ page }) => {
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  let requested!: () => void;
  const requesting = new Promise<void>(resolve => { requested = resolve; });
  await page.route(/tactic-fork-played\.mp3$/, async route => {
    requested();
    await held;
    await route.continue();
  }, { times: 1 });
  try {
    await openBank(page);
    await expect(play(page)).toBeEnabled();
    await play(page).click();
    await requesting;
    await expect(panel(page)).toHaveAttribute("data-playback", "loading");
    await example(page).selectOption("bank-opening-recall-revealed");
    await expect(panel(page)).toHaveAttribute("data-playback", "idle");
    await expect(play(page)).toBeEnabled();
    await expect(starts(page)).toHaveCount(0);
    release();
    await page.unrouteAll({ behavior: "wait" });
    await play(page).click();
    await expect(starts(page)).toHaveCount(1);
    await expect(panel(page)).toHaveAttribute("data-playback", "playing");
    await expect(panel(page).getByLabel("Coach explanation", { exact: true })).toHaveText("Here are the moves from the opening line you're studying.");
    await expect(panel(page).locator('[data-coach="classic"]')).toHaveAttribute("data-articulation", "aligned");
    await page.getByRole("button", { name: "Stop all", exact: true }).click();
    await expect(panel(page)).toHaveAttribute("data-playback", "idle");
  } finally {
    release();
    await page.unrouteAll({ behavior: "wait" });
  }
});
