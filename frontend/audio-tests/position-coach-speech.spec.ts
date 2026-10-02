import {expect, test, type Page} from "@playwright/test";
import path from "node:path";
import {defaultAudioPreferences} from "../src/audio/model";
import type {Game} from "../src/gameReview/types";
import {viteFsPath} from "../studio-tests/helpers/viteFsPath";
import {semanticFixtures} from "../tests/semantic-fixtures";
import catalogue from "../src/audio/speech/meanings.json" with {type: "json"};
import {openAudioFixturePage} from "./fixtures/openAudioFixture";
import type {FakeSpeechAudio} from "./fixtures/fakeSpeechAudio";
import type {PositionCoachSpeechHarness, PositionCoachSpeechSelection, PositionCoachSpeechState} from "./fixtures/positionCoachSpeechRuntime";

type HarnessWindow = Window & {positionCoachSpeech: PositionCoachSpeechHarness; fakeSpeechAudio: FakeSpeechAudio};
const games = semanticFixtures<Record<string, Game>>("review_speech_combination_fixtures.py");
const enrichedGame = games["cause-abandoned_defender-white"];
const BASE = "cause-abandoned-defender";
const region = (page: Page) => page.getByRole("region", {name: "Chess coach", exact: true});
const chip = (page: Page) => region(page).getByRole("button", {name: "Maia: Natural mistake", exact: true});
const bubble = (page: Page) => region(page).getByLabel("Coach explanation", {exact: true}).locator("[data-utterance]");

function combinedRecordingId(): string {
  const meaning = catalogue.meanings.find(item => "primary" in item && "secondary" in item
    && item.primary === BASE && item.secondary === "human-natural-error");
  expect(meaning, "the authored cause + Maia meaning must be registered").toBeDefined();
  return meaning!.id;
}

function withoutHuman(game: Game): Game {
  const current = structuredClone(game), report = current.frames[1].report!;
  report.human = null;
  report.practical = null;
  if (report.intelligence) report.intelligence.events = report.intelligence.events.filter(event => event.kind !== "human_contrast");
  // The harness derives both PositionCoach.report and PositionCoach.frame from
  // this same game frame, so a late update cannot leave either source stale.
  return current;
}

async function state(page: Page): Promise<PositionCoachSpeechState> {
  return JSON.parse((await page.getByTestId("position-coach-speech-state").textContent())!);
}
async function update(page: Page, patch: Partial<PositionCoachSpeechSelection>) {
  await page.evaluate(patch => (window as unknown as HarnessWindow).positionCoachSpeech.update(patch), patch);
  if (patch.speechEventId) await expect.poll(() => state(page).then(value => value.speechEventId)).toBe(patch.speechEventId);
}
async function counts(page: Page) {
  return page.evaluate(() => {
    const audio = (window as unknown as HarnessWindow).fakeSpeechAudio;
    return {starts: audio.starts(), stops: audio.stops()};
  });
}
async function tick(page: Page, duration: number) {
  for (let remaining = duration; remaining > 0; remaining -= 50) await page.clock.runFor(Math.min(remaining, 50));
}

async function inspectPreparedInsight(page: Page) {
  const current = await state(page);
  await chip(page).click();
  const dialog = page.getByRole("dialog", {name: "Maia insight", exact: true});
  const explanation = dialog.locator("[data-utterance]");
  await expect(explanation).toHaveAttribute("data-intent", current.humanIntentId);
  await expect(explanation).toHaveAttribute("data-utterance", current.humanUtteranceId);
  await expect(explanation).toHaveAttribute("data-dialogue-coach", current.coachId);
  await expect(explanation).toHaveText(current.humanText);
  await dialog.getByRole("button", {name: "Close insight", exact: true}).click();
}

async function recordingUrl(page: Page, coachId: string, recordingId: string) {
  const url = await page.evaluate(async ({root, coachId, recordingId}) => {
    const {coachRecording} = await import(`${root}/src/audio/speech/voiceBank.ts`);
    return coachRecording(coachId, recordingId)?.url;
  }, {root: viteFsPath(path.resolve(".")), coachId, recordingId});
  expect(url, "the selected coach must provide this exact recording").toBeTruthy();
  return new URL(url!, page.url()).href;
}

async function mount(page: Page, coachId: "classic" | "robot", game: Game) {
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  const assets: string[] = [], writes: string[] = [];
  page.on("request", request => {if (request.method() !== "GET") writes.push(request.url());});
  await page.route("**/api/preferences/audio", route => route.fulfill({json: {...defaultAudioPreferences, voice: "automatic"}}));
  await page.route("**/api/preferences/coach", route => route.fulfill({json: {coach_id: coachId, motion: "natural"}}));
  await page.route(/\.opus(?:\?.*)?$/, route => {
    if (route.request().resourceType() !== "fetch") return route.fallback();
    assets.push(route.request().url());
    return route.fulfill({contentType: "audio/mpeg", body: Buffer.from([1, 2, 3, 4])});
  });
  await openAudioFixturePage(page);
  await page.evaluate(async ({root, game}) => {
    const {installFakeSpeechAudio} = await import(`${root}/audio-tests/fixtures/fakeSpeechAudio.ts`);
    const {mountPositionCoachSpeech} = await import(`${root}/audio-tests/fixtures/positionCoachSpeechRuntime.tsx`);
    const target = window as unknown as HarnessWindow;
    target.fakeSpeechAudio = installFakeSpeechAudio();
    target.positionCoachSpeech = mountPositionCoachSpeech(game);
  }, {root: viteFsPath(path.resolve(".")), game});
  await expect(region(page)).toBeVisible();
  await expect.poll(() => state(page).then(value => value.ready)).toBe(true);
  await expect.poll(() => state(page).then(value => value.coachId)).toBe(coachId);
  await expect(bubble(page)).toHaveAttribute("data-utterance", (await state(page)).utteranceId);
  await page.getByRole("button", {name: "Unlock audio", exact: true}).click();
  return {assets, writes};
}

for (const coachId of ["classic", "robot"] as const) {
  test(`${coachId}: a visible Maia chip joins the real PositionCoach response as one whole recording`, async ({page}) => {
    const combined = combinedRecordingId();
    const fixture = await mount(page, coachId, enrichedGame);
    const initial = await state(page);
    expect(initial.intentCodes).toContain("human_natural_error");
    expect(initial.renderedCodes).toContain("cause_abandoned_defender");
    expect(initial.renderedCodes.some(code => code.startsWith("human_"))).toBe(false);
    await expect(chip(page)).toBeVisible();
    await inspectPreparedInsight(page);
    expect(await counts(page)).toEqual({starts: 0, stops: 0});

    await update(page, {speechEventId: "position-coach:arrival"});
    await tick(page, 250);
    await expect.poll(() => state(page).then(value => [value.observedCoach, value.observed])).toEqual([coachId, combined]);
    await tick(page, 1000);
    expect(await counts(page)).toEqual({starts: 1, stops: 0});
    expect(fixture.assets).toHaveLength(1);
    expect(fixture.assets[0]).toBe(await recordingUrl(page, coachId, combined));
    expect(fixture.writes).toEqual([]);
  });

  test(`${coachId}: late Maia preserves the current objective recording and explicit replay uses the combined response`, async ({page}) => {
    const combined = combinedRecordingId();
    const fixture = await mount(page, coachId, withoutHuman(enrichedGame));
    await expect(chip(page)).toHaveCount(0);
    await update(page, {speechEventId: "position-coach:before-human"});
    await tick(page, 250);
    // The plain bubble's recorded sentences play back to back as one playback.
    await expect.poll(() => state(page).then(value => value.observed ?? "")).toMatch(new RegExp(`^${BASE}([+]|$)`));
    const plain = (await state(page)).observed!, parts = plain.split("+");
    expect((await state(page)).observedCoach).toBe(coachId);
    expect(await counts(page)).toEqual({starts: 1, stops: 0});

    await update(page, {game: enrichedGame});
    await expect(chip(page)).toBeVisible();
    await expect(bubble(page)).toHaveAttribute("data-utterance", (await state(page)).utteranceId);
    expect((await state(page)).renderedCodes.some(code => code.startsWith("human_"))).toBe(false);
    await inspectPreparedInsight(page);
    await tick(page, 1000);
    expect(await counts(page)).toEqual({starts: 1, stops: 0});
    expect((await state(page)).observed).toBe(plain);
    expect(fixture.assets).toHaveLength(parts.length);

    await page.evaluate(() => (window as unknown as HarnessWindow).fakeSpeechAudio.finish());
    await expect.poll(() => state(page).then(value => value.observed)).toBe(null);
    await region(page).getByRole("button", {name: "Listen to coach", exact: true}).click();
    await expect.poll(() => state(page).then(value => [value.observedCoach, value.observed])).toEqual([coachId, combined]);
    await tick(page, 500);
    expect((await counts(page)).starts).toBe(2);
    expect(fixture.assets).toHaveLength(parts.length + 1);
    expect(fixture.assets[0]).toBe(await recordingUrl(page, coachId, BASE));
    expect(fixture.assets.at(-1)).toBe(await recordingUrl(page, coachId, combined));
    expect(fixture.writes).toEqual([]);
  });
}

for (const coachId of ["classic", "robot"] as const) {
  for (const [reading, game] of [["with Maia", enrichedGame], ["without Maia", withoutHuman(enrichedGame)]] as const)
    test(`${coachId}: one move shows one Listen control ${reading}`, async ({page}) => {
      await mount(page, coachId, game);
      expect((await state(page)).renderedCodes).toEqual(["cause_abandoned_defender", expect.any(String)]);
      await expect(chip(page)).toHaveCount(reading === "with Maia" ? 1 : 0);
      await expect(region(page).getByRole("button", {name: /^Listen/})).toHaveCount(1);
      await expect(region(page).getByRole("button", {name: "Listen to additional explanation"})).toHaveCount(0);
    });
}

test("classic: two recorded sentences play back to back as one playback behind one Stop", async ({page}) => {
  const fixture = await mount(page, "classic", withoutHuman(enrichedGame));
  const listen = region(page).getByRole("button", {name: /^Listen/});
  await expect(listen).toHaveCount(1);
  await listen.click();
  await expect.poll(() => state(page).then(value => value.observed)).toMatch(/^cause-abandoned-defender\+/);
  const [first, second] = (await state(page)).observed!.split("+");
  await tick(page, 500);
  expect(await counts(page)).toEqual({starts: 1, stops: 0});
  expect(fixture.assets.sort()).toEqual([await recordingUrl(page, "classic", first),
    await recordingUrl(page, "classic", second)].sort());
  await region(page).getByRole("button", {name: "Stop coach voice", exact: true}).click();
  await tick(page, 500);
  expect(await counts(page)).toEqual({starts: 1, stops: 1});
  await expect(region(page).getByRole("button", {name: /^Listen/})).toHaveCount(1);
});
