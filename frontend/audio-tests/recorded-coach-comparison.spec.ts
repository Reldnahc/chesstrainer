import {expect, test, type Page} from "@playwright/test";
import path from "node:path";
import {openAudioFixturePage} from "./fixtures/openAudioFixture";
import {viteFsPath} from "../studio-tests/helpers/viteFsPath";
import type {ComparisonHarness, ComparisonHarnessOptions} from "./fixtures/RecordedCoachComparisonHarness";

type HarnessWindow = Window & {comparisonHarness: ComparisonHarness};
const entry = "book-opening-entry-1";
const follow = "book-opening-follow-1";
const panel = (page: Page) => page.getByRole("region", {name: "Recorded coach comparison", exact: true});
const meaning = (page: Page) => panel(page).getByRole("combobox", {name: "Spoken meaning", exact: true});
const coach = (page: Page, name: "Walter" | "Rivet") =>
  panel(page).getByRole("group", {name: "Recorded coach", exact: true}).getByRole("button", {name, exact: true});
const collection = (page: Page, name: string) =>
  panel(page).getByRole("group", {name: "Recording collection", exact: true}).getByRole("button", {name, exact: true});
const play = (page: Page) => panel(page).getByRole("button", {name: /^Play (Walter|Rivet) recording$/});
const portrait = (page: Page) => panel(page).locator(".coach-avatar");
const message = (page: Page) => panel(page).getByLabel("Coach explanation", {exact: true});
const state = (page: Page) => page.evaluate(() => (window as unknown as HarnessWindow).comparisonHarness.state());

async function mount(page: Page, options: ComparisonHarnessOptions = {}) {
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  const audio: string[] = [];
  const requests: {url: string; method: string}[] = [];
  page.on("request", request => requests.push({url: request.url(), method: request.method()}));
  await page.route(url => url.pathname.startsWith("/__recorded-comparison-fixture/"), route => {
    audio.push(new URL(route.request().url()).pathname);
    return route.fulfill({contentType: "audio/mpeg", body: Buffer.from([1, 2, 3, 4])});
  });
  await openAudioFixturePage(page);
  await page.evaluate(async ({root, options}) => {
    const {mountRecordedCoachComparison} = await import(`${root}/audio-tests/fixtures/RecordedCoachComparisonHarness.tsx`);
    (window as unknown as HarnessWindow).comparisonHarness = mountRecordedCoachComparison(options);
  }, {root: viteFsPath(path.resolve(".")), options});
  await expect(panel(page)).toBeVisible();
  return {audio, requests};
}

async function tick(page: Page, duration = 160) {
  for (let remaining = duration; remaining > 0; remaining -= 40) await page.clock.runFor(Math.min(40, remaining));
}

test("the silent filters preserve a meaning across coaches and fit a narrow phone without writes", async ({page}, info) => {
  const {audio, requests} = await mount(page);
  if (info.project.name === "mobile") await page.setViewportSize({width: 320, height: 780});
  await expect(coach(page, "Walter")).toHaveAttribute("aria-pressed", "true");
  await expect(collection(page, "Opening run")).toHaveAttribute("aria-pressed", "true");
  await expect(meaning(page)).toHaveValue(entry);
  await expect(meaning(page).locator("option")).toHaveText(["Enter the opening", "Develop a piece", "Continue development"]);
  await meaning(page).selectOption(follow);
  await coach(page, "Rivet").click();
  await expect(meaning(page)).toHaveValue(follow);
  await expect(message(page)).toHaveText("Rivet: Develop a piece.");
  await collection(page, "All lines").click();
  await expect(meaning(page)).toHaveValue(follow);
  await expect(meaning(page).locator("option")).toHaveCount(6);
  await meaning(page).selectOption("fork-with-maia");
  await collection(page, "With Maia").click();
  await expect(meaning(page).locator("option")).toHaveText(["A fork with Maia"]);
  await expect(meaning(page)).toHaveValue("fork-with-maia");
  await collection(page, "All lines").click();
  await expect(meaning(page)).toHaveValue("fork-with-maia");
  await expect(play(page)).toBeEnabled();
  await expect(panel(page).getByRole("button", {name: /Choose this voice|Keep looking|Clear choice/})).toHaveCount(0);
  expect((await state(page)).starts).toBe(0);
  expect(audio).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await panel(page).screenshot({path: info.outputPath("recorded-coach-comparison.png")});
  await play(page).click();
  await expect(panel(page)).toHaveAttribute("data-playback", "playing");
  const origin = new URL(page.url()).origin;
  expect(requests.filter(request => request.method !== "GET" || new URL(request.url).origin !== origin ||
    /^\/(?:api|__fieldwork)\//.test(new URL(request.url).pathname))).toEqual([]);
});

test("the same recording ID uses each coach's own audio, portrait and exact mouth track", async ({page}) => {
  const {audio} = await mount(page);
  await panel(page).getByRole("combobox", {name: "Comparison motion", exact: true}).selectOption("natural");
  for (const [name, id, shape, liveMouth] of [
    ["Walter", "classic", "round", ".walter-aligned-mouth"], ["Rivet", "robot", "tongue", ".speech-mouth-live"],
  ] as const) {
    await coach(page, name).click();
    await expect(meaning(page)).toHaveValue(entry);
    await expect(portrait(page)).toHaveAttribute("data-coach", id);
    await expect(message(page)).toHaveText(`${name}: Enter the opening.`);
    await play(page).click();
    await expect(panel(page)).toHaveAttribute("data-playback", "playing");
    await portrait(page).scrollIntoViewIfNeeded();
    await tick(page);
    await expect(portrait(page)).toHaveAttribute("data-mouth-shape", shape);
    await expect(portrait(page).locator(liveMouth)).toBeVisible();
    if (id === "robot") {
      await expect(portrait(page).locator(".speech-mouth-authored")).toBeHidden();
      expect(await portrait(page).locator(".robot-speech-center").evaluate(node => Number(getComputedStyle(node).opacity))).toBeGreaterThan(.95);
    }
    expect(await state(page)).toMatchObject({coachId: id, recordingId: entry});
  }
  expect(audio).toEqual([`/__recorded-comparison-fixture/classic/${entry}.opus`, `/__recorded-comparison-fixture/robot/${entry}.opus`]);
  expect(await state(page)).toMatchObject({starts: 2, stops: 1});
  await page.getByRole("button", {name: "Stop all", exact: true}).click();
  await expect(portrait(page)).toHaveAttribute("data-speaking", "false");
  await expect(portrait(page).locator(".speech-mouth-authored")).toBeVisible();
});

for (const playback of ["playing", "loading"] as const) for (const change of ["coach", "meaning"] as const) {
  test(`${change} changes stop ${playback} audio before replay and prevent a late start`, async ({page}) => {
    await mount(page);
    await expect(play(page)).toBeEnabled();
    if (playback === "loading") await page.evaluate(() => (window as unknown as HarnessWindow).comparisonHarness.audio.deferDecode());
    await play(page).click();
    await expect(panel(page)).toHaveAttribute("data-playback", playback);
    await expect.poll(() => state(page).then(value => value.decodes)).toBe(1);
    if (change === "coach") await coach(page, "Rivet").click();
    else await meaning(page).selectOption(follow);
    await expect(panel(page)).toHaveAttribute("data-playback", "idle");
    await expect(portrait(page)).toHaveAttribute("data-speaking", "false");
    expect(await state(page)).toMatchObject({playback: "idle", stops: playback === "playing" ? 1 : 0});
    await page.evaluate(() => (window as unknown as HarnessWindow).comparisonHarness.audio.releaseDecode());
    await tick(page);
    expect((await state(page)).starts).toBe(playback === "playing" ? 1 : 0);
    await play(page).click();
    await expect(panel(page)).toHaveAttribute("data-playback", "playing");
    expect(await state(page)).toMatchObject({starts: playback === "playing" ? 2 : 1,
      coachId: change === "coach" ? "robot" : "classic", recordingId: change === "coach" ? entry : follow});
  });
}

test("a combined meaning plays one whole recording and changing collection cancels it", async ({page}) => {
  const {audio} = await mount(page);
  await collection(page, "With Maia").click();
  await expect(meaning(page)).toHaveValue("fork-with-maia");
  await expect(message(page)).toHaveText("Walter: A fork with Maia.");
  await play(page).click();
  await expect(panel(page)).toHaveAttribute("data-playback", "playing");
  expect((await state(page)).starts).toBe(1);
  expect(audio).toEqual(["/__recorded-comparison-fixture/classic/fork-with-maia.opus"]);
  await page.evaluate(() => (window as unknown as HarnessWindow).comparisonHarness.audio.finish());
  await page.clock.runFor(11_000);
  expect((await state(page)).starts).toBe(1);
  expect(audio).toHaveLength(1);
  await play(page).click();
  await expect(panel(page)).toHaveAttribute("data-playback", "playing");
  await collection(page, "Opening run").click();
  await expect(meaning(page)).toHaveValue(entry);
  expect(await state(page)).toMatchObject({playback: "idle", starts: 2, stops: 1});
});

test("an old audio request completing after Rivet starts cannot reclaim the same meaning", async ({page}) => {
  await mount(page);
  let requested = false;
  let fulfilled = false;
  let releaseOld!: () => void;
  const held = new Promise<void>(resolve => {releaseOld = resolve;});
  await page.route(url => url.pathname === `/__recorded-comparison-fixture/classic/${entry}.opus`, async route => {
    requested = true;
    await held;
    await route.fulfill({contentType: "audio/mpeg", body: Buffer.from([1, 2, 3, 4])});
    fulfilled = true;
  });
  await panel(page).getByRole("combobox", {name: "Comparison motion", exact: true}).selectOption("natural");
  try {
    await play(page).click();
    await expect.poll(() => requested).toBe(true);
    await expect(panel(page)).toHaveAttribute("data-playback", "loading");
    await coach(page, "Rivet").click();
    expect(await state(page)).toMatchObject({playback: "idle", starts: 0});
    await play(page).click();
    await expect(panel(page)).toHaveAttribute("data-playback", "playing");
    expect(await state(page)).toMatchObject({coachId: "robot", recordingId: entry, starts: 1});
    releaseOld();
    await expect.poll(() => fulfilled).toBe(true);
    await portrait(page).scrollIntoViewIfNeeded();
    await tick(page);
    expect(await state(page)).toMatchObject({playback: "playing", coachId: "robot", recordingId: entry, starts: 1, stops: 0});
    await expect(portrait(page)).toHaveAttribute("data-mouth-shape", "tongue");
  } finally {releaseOld();}
});

test("late Walter track loading cannot replace Rivet's track for the same meaning", async ({page}) => {
  const {audio} = await mount(page);
  await expect(play(page)).toBeEnabled();
  await page.evaluate(key => (window as unknown as HarnessWindow).comparisonHarness.deferTrack(key), `classic:${follow}`);
  await meaning(page).selectOption(follow);
  await expect(play(page)).toBeDisabled();
  await coach(page, "Rivet").click();
  await expect(play(page)).toBeEnabled();
  await page.evaluate(key => (window as unknown as HarnessWindow).comparisonHarness.releaseTrack(key), `classic:${follow}`);
  await tick(page);
  await expect(message(page)).toHaveText("Rivet: Develop a piece.");
  await panel(page).getByRole("combobox", {name: "Comparison motion", exact: true}).selectOption("natural");
  await play(page).click();
  await portrait(page).scrollIntoViewIfNeeded();
  await tick(page);
  await expect(portrait(page)).toHaveAttribute("data-mouth-shape", "tongue");
  expect(await state(page)).toMatchObject({coachId: "robot", recordingId: follow});
  expect(audio).toEqual([`/__recorded-comparison-fixture/robot/${follow}.opus`]);
});

test("missing recordings or mouth tracks disable only the selected coach and meaning", async ({page}) => {
  const {audio} = await mount(page, {missingRecordings: [`robot:${entry}`], missingTracks: [`classic:${follow}`]});
  await expect(play(page)).toBeEnabled();
  await coach(page, "Rivet").click();
  await expect(meaning(page)).toHaveValue(entry);
  await expect(play(page)).toBeDisabled();
  await coach(page, "Walter").click();
  await expect(play(page)).toBeEnabled();
  await meaning(page).selectOption(follow);
  await expect(play(page)).toBeDisabled();
  await coach(page, "Rivet").click();
  await expect(meaning(page)).toHaveValue(follow);
  await expect(play(page)).toBeEnabled();
  expect(audio).toEqual([]);
  await play(page).click();
  await expect(panel(page)).toHaveAttribute("data-playback", "playing");
  expect(await state(page)).toMatchObject({coachId: "robot", recordingId: follow});
});

test("motion choices and another preview use the same player and preserve volume", async ({page}) => {
  await page.emulateMedia({reducedMotion: "reduce"});
  await mount(page);
  await page.getByRole("slider", {name: "Volume", exact: true}).press("End");
  await play(page).click();
  await expect(panel(page)).toHaveAttribute("data-playback", "playing");
  await tick(page);
  await expect(portrait(page)).toHaveAttribute("data-speaking", "false");
  const motion = panel(page).getByRole("combobox", {name: "Comparison motion", exact: true});
  await motion.selectOption("natural");
  await portrait(page).scrollIntoViewIfNeeded();
  await tick(page);
  await expect(portrait(page)).toHaveAttribute("data-speaking", "true");
  await motion.selectOption("still");
  await expect(portrait(page)).toHaveAttribute("data-speaking", "false");
  expect((await state(page)).starts).toBe(1);
  await page.getByRole("button", {name: "Play another preview", exact: true}).click();
  await expect(panel(page)).toHaveAttribute("data-playback", "idle");
  await expect.poll(() => state(page).then(value => value.recordingId)).toBe("other");
  await play(page).click();
  await expect(panel(page)).toHaveAttribute("data-playback", "playing");
  expect(await state(page)).toMatchObject({recordingId: entry, starts: 3, stops: 2});
  await expect(page.getByRole("slider", {name: "Volume", exact: true})).toHaveValue("100");
});
