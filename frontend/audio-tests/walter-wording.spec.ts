import {expect, test, type Page} from "@playwright/test";
import path from "node:path";
import {openAudioFixturePage} from "./fixtures/openAudioFixture";
import {viteFsPath} from "../studio-tests/helpers/viteFsPath";
import type {WordingHarness, WordingHarnessOptions} from "./fixtures/WalterWordingHarness";

type HarnessWindow = Window & {wordingHarness: WordingHarness};
const panel = (page: Page) => page.getByRole("region", {name: "Walter wording", exact: true});
const example = (page: Page) => panel(page).getByRole("combobox", {name: "Wording example", exact: true});
const version = (page: Page, name: "Original" | "Revised") =>
  panel(page).getByRole("group", {name: "Wording version", exact: true}).getByRole("button", {name, exact: true});
const play = (page: Page) => panel(page).getByRole("button", {name: /^Play (original|revised) Walter wording$/});
const portrait = (page: Page) => panel(page).locator(".coach-avatar");
const message = (page: Page) => panel(page).getByLabel("Coach explanation", {exact: true});
const state = (page: Page) => page.evaluate(() => (window as unknown as HarnessWindow).wordingHarness.state());

async function mount(page: Page, options: WordingHarnessOptions = {}) {
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  const audioRequests: string[] = [];
  await page.route(url => url.pathname.startsWith("/__wording-fixture/"), route => {
    audioRequests.push(new URL(route.request().url()).pathname);
    return route.fulfill({contentType: "audio/mpeg", body: Buffer.from([1, 2, 3, 4])});
  });
  await openAudioFixturePage(page);
  await page.evaluate(async ({root, options}) => {
    const {mountWalterWording} = await import(`${root}/audio-tests/fixtures/WalterWordingHarness.tsx`);
    (window as unknown as HarnessWindow).wordingHarness = mountWalterWording(options);
  }, {root: viteFsPath(path.resolve(".")), options});
  await expect(panel(page)).toBeVisible();
  return audioRequests;
}

async function tick(page: Page, duration = 160) {
  for (let remaining = duration; remaining > 0; remaining -= 40) await page.clock.runFor(Math.min(40, remaining));
}

test("wording choices start silent, display each version, and preserve volume without provider or choice requests", async ({page}, info) => {
  const requests: {url: string; method: string}[] = [];
  page.on("request", request => requests.push({url: request.url(), method: request.method()}));
  const audio = await mount(page);
  if (info.project.name === "mobile") await page.setViewportSize({width: 320, height: 780});
  await expect(version(page, "Revised")).toHaveAttribute("aria-pressed", "true");
  await expect(example(page)).toHaveValue("fork");
  await expect(example(page).locator("option")).toHaveCount(2);
  await expect(message(page)).toHaveText("Revised fork explanation.");
  await page.getByRole("slider", {name: "Volume", exact: true}).press("End");
  await version(page, "Original").click();
  await expect(message(page)).toHaveText("Original fork explanation.");
  await panel(page).getByRole("button", {name: "All revised clips", exact: true}).click();
  await expect(example(page).locator("option")).toHaveCount(3);
  await example(page).selectOption("pause");
  await version(page, "Revised").click();
  await expect(message(page)).toHaveText("Revised pause explanation.");
  await expect(play(page)).toBeEnabled();
  await expect(page.getByRole("slider", {name: "Volume", exact: true})).toHaveValue("100");
  await expect(panel(page).getByRole("button", {name: /Choose this voice|Keep looking|Clear choice/})).toHaveCount(0);
  expect((await state(page)).starts).toBe(0);
  expect(audio).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await panel(page).screenshot({path: info.outputPath("walter-wording.png")});
  await play(page).click();
  await expect(panel(page)).toHaveAttribute("data-playback", "playing");
  const origin = new URL(page.url()).origin;
  expect(requests.filter(request => request.method !== "GET" || new URL(request.url).origin !== origin ||
    /^\/(?:api|__fieldwork)\//.test(new URL(request.url).pathname))).toEqual([]);
});

test("original and revised recordings use their own URL, identity and visible mouth cues", async ({page}) => {
  const audio = await mount(page);
  await panel(page).getByRole("combobox", {name: "Walter motion", exact: true}).selectOption("natural");
  for (const [choice, shape, id] of [["Original", "round", "fork:original"], ["Revised", "tongue", "fork:revised"]] as const) {
    await version(page, choice).click();
    await play(page).click();
    await expect(panel(page)).toHaveAttribute("data-playback", "playing");
    await portrait(page).scrollIntoViewIfNeeded();
    await tick(page);
    await expect(portrait(page)).toHaveAttribute("data-mouth-shape", shape);
    await expect(portrait(page).locator(".walter-aligned-mouth")).toBeVisible();
    expect((await state(page)).recordingId).toBe(id);
  }
  expect(audio).toEqual(["/__wording-fixture/fork/original.mp3", "/__wording-fixture/fork/revised.mp3"]);
  expect((await state(page)).starts).toBe(2);
  expect((await state(page)).stops).toBe(1);
  await page.getByRole("button", {name: "Stop all", exact: true}).click();
  await expect(portrait(page)).toHaveAttribute("data-speaking", "false");
  await expect(portrait(page).locator(".walter-authored-mouth")).toBeVisible();
});

for (const playback of ["playing", "loading"] as const) for (const change of ["version", "example"] as const) {
  test(`${change} changes cancel ${playback} wording without autoplay or a late restart`, async ({page}) => {
    await mount(page);
    await expect(play(page)).toBeEnabled();
    if (playback === "loading") await page.evaluate(() => (window as unknown as HarnessWindow).wordingHarness.audio.deferDecode());
    await play(page).click();
    await expect(panel(page)).toHaveAttribute("data-playback", playback);
    await expect.poll(() => state(page).then(value => value.decodes)).toBe(1);
    if (change === "version") await version(page, "Original").click();
    else await example(page).selectOption("defender");
    await expect(panel(page)).toHaveAttribute("data-playback", "idle");
    await expect(portrait(page)).toHaveAttribute("data-speaking", "false");
    expect(await state(page)).toMatchObject({playback: "idle", stops: playback === "playing" ? 1 : 0});
    await page.evaluate(() => (window as unknown as HarnessWindow).wordingHarness.audio.releaseDecode());
    await tick(page);
    expect((await state(page)).starts).toBe(playback === "playing" ? 1 : 0);
    await play(page).click();
    await expect(panel(page)).toHaveAttribute("data-playback", "playing");
    expect((await state(page)).starts).toBe(playback === "playing" ? 2 : 1);
    expect((await state(page)).recordingId).toBe(change === "version" ? "fork:original" : "defender:revised");
  });
}

test("late original clip details cannot replace revised text or mouth timing", async ({page}) => {
  const audio = await mount(page);
  await expect(play(page)).toBeEnabled();
  await page.evaluate(() => (window as unknown as HarnessWindow).wordingHarness.deferClip("fork:original"));
  await version(page, "Original").click();
  await expect(play(page)).toBeDisabled();
  await version(page, "Revised").click();
  await expect(play(page)).toBeEnabled();
  await page.evaluate(() => (window as unknown as HarnessWindow).wordingHarness.releaseClip("fork:original"));
  await tick(page);
  await expect(message(page)).toHaveText("Revised fork explanation.");
  await panel(page).getByRole("combobox", {name: "Walter motion", exact: true}).selectOption("natural");
  await play(page).click();
  await portrait(page).scrollIntoViewIfNeeded();
  await tick(page);
  await expect(portrait(page)).toHaveAttribute("data-mouth-shape", "tongue");
  expect((await state(page)).recordingId).toBe("fork:revised");
  expect(audio).toEqual(["/__wording-fixture/fork/revised.mp3"]);
});

test("an unavailable version stays disabled while the available counterpart can still play", async ({page}) => {
  const audio = await mount(page, {unavailable: ["fork:revised"]});
  await expect(panel(page)).toContainText("This recording and its mouth timing are still being prepared.");
  await expect(play(page)).toBeDisabled();
  await expect(panel(page).getByRole("button", {name: "Walter wording in context", exact: true})).toBeDisabled();
  await version(page, "Original").click();
  await expect(play(page)).toBeEnabled();
  expect(audio).toEqual([]);
  await play(page).click();
  await expect(panel(page)).toHaveAttribute("data-playback", "playing");
  expect((await state(page)).recordingId).toBe("fork:original");
});

test("motion preferences and another preview share the same playback and preserve the transport", async ({page}) => {
  await page.emulateMedia({reducedMotion: "reduce"});
  await mount(page);
  await page.getByRole("slider", {name: "Volume", exact: true}).press("End");
  await play(page).click();
  await expect(panel(page)).toHaveAttribute("data-playback", "playing");
  await tick(page);
  await expect(portrait(page)).toHaveAttribute("data-speaking", "false");
  const motion = panel(page).getByRole("combobox", {name: "Walter motion", exact: true});
  await motion.selectOption("natural");
  await portrait(page).scrollIntoViewIfNeeded();
  await tick(page);
  await expect(portrait(page)).toHaveAttribute("data-speaking", "true");
  await motion.selectOption("still");
  await expect(portrait(page)).toHaveAttribute("data-speaking", "false");
  expect((await state(page)).starts).toBe(1);
  await page.getByRole("button", {name: "Play another preview", exact: true}).click();
  await expect(panel(page)).toHaveAttribute("data-playback", "idle");
  await expect.poll(() => state(page).then(value => value.recordingId)).toBe("other:revised");
  await play(page).click();
  await expect(panel(page)).toHaveAttribute("data-playback", "playing");
  expect((await state(page)).recordingId).toBe("fork:revised");
  expect((await state(page)).starts).toBe(3);
  expect((await state(page)).stops).toBe(2);
  await expect(page.getByRole("slider", {name: "Volume", exact: true})).toHaveValue("100");
});
