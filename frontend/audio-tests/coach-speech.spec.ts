import {expect, test, type Page} from "@playwright/test";
import path from "node:path";
import {defaultAudioPreferences, type AudioPreferences} from "../src/audio/model";
import type {Game} from "../src/gameReview/types";
import type {SpeechHarness, Selection} from "./fixtures/coachSpeechRuntime";
import type {FakeSpeechAudio} from "./fixtures/fakeSpeechAudio";
import {viteFsPath} from "../studio-tests/helpers/viteFsPath";
import {semanticFixtures} from "../tests/semantic-fixtures";
import walterManifest from "../src/audio/speech/bank/manifest.json" with {type: "json"};

type SpeechWindow = Window & {coachSpeechHarness: SpeechHarness; fakeSpeechAudio: FakeSpeechAudio};
type State = {ready: boolean; mode: string; coach: string; available: boolean; playing: boolean;
  active: string | null; observed: string | null; observedCoach: string | null; portrait: string | null;
  track: {duration: number; cues: number} | null; selection: Selection};
const FIRST = "tactic-fork-played", SECOND = "tactic-pin-played";

async function mount(page: Page, options: {selection?: Partial<Selection>; voice?: AudioPreferences["voice"];
  deferPreferences?: boolean; game?: Game; failFirstAsset?: boolean} = {}) {
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.emulateMedia({reducedMotion: "no-preference"});
  let preferences = {...defaultAudioPreferences, voice: options.voice ?? "automatic"};
  let coach = {coach_id: "classic", motion: "natural"};
  let release!: () => void;
  const gate = new Promise<void>(resolve => {release = resolve;});
  const assets: string[] = [];
  await page.route("**/api/preferences/audio", async route => {
    if (route.request().method() === "PUT") preferences = route.request().postDataJSON();
    else if (options.deferPreferences) await gate;
    await route.fulfill({json: preferences});
  });
  await page.route("**/api/preferences/coach", async route => {
    // The coach controls save only their changed field.
    if (route.request().method() === "PATCH") coach = {...coach, ...route.request().postDataJSON()};
    else if (options.deferPreferences) await gate;
    await route.fulfill({json: coach});
  });
  await page.route(/\.opus(?:\?.*)?$/, async route => {
    // Vite also requests asset URL modules as scripts; those are not recordings.
    if (route.request().resourceType() !== "fetch") return route.fallback();
    assets.push(route.request().url());
    await route.fulfill(options.failFirstAsset && assets.length === 1
      ? {status: 404, body: "Missing test recording"}
      : {contentType: "audio/mpeg", body: Buffer.from([1, 2, 3, 4])});
  });
  await page.goto("/");
  await page.evaluate(async ({root, selection, game}) => {
    const {installFakeSpeechAudio} = await import(`${root}/audio-tests/fixtures/fakeSpeechAudio.ts`);
    const {mountCoachSpeech} = await import(`${root}/audio-tests/fixtures/coachSpeechRuntime.ts`);
    const target = window as unknown as SpeechWindow;
    target.fakeSpeechAudio = installFakeSpeechAudio();
    target.coachSpeechHarness = mountCoachSpeech(selection, game);
  }, {root: viteFsPath(path.resolve(".")), selection: options.selection, game: options.game});
  await expect(page.getByTestId("speech-state")).toBeVisible();
  if (!options.deferPreferences) await expect.poll(() => state(page).then(value => value.ready)).toBe(true);
  return {assets, hydrate: async () => {release(); await expect.poll(() => state(page).then(value => value.ready)).toBe(true);}};
}
async function state(page: Page): Promise<State> {return JSON.parse((await page.getByTestId("speech-state").textContent())!);}
async function update(page: Page, patch: Partial<Selection>) {
  await page.evaluate(patch => (window as unknown as SpeechWindow).coachSpeechHarness.update(patch), patch);
  await expect.poll(async () => {
    const current = (await state(page)).selection;
    return Object.fromEntries(Object.keys(patch).map(key => [key, current[key as keyof Selection]]));
  }).toEqual(patch);
}
async function starts(page: Page) {return page.evaluate(() => (window as unknown as SpeechWindow).fakeSpeechAudio.starts());}
async function tick(page: Page, ms: number) {
  // Permit React commits between scheduled navigation and mouth-frame callbacks.
  for (let remaining = ms; remaining > 0; remaining -= 50) await page.clock.runFor(Math.min(remaining, 50));
}
async function voiceMode(page: Page, voice: AudioPreferences["voice"]) {
  await page.evaluate(voice => (window as unknown as SpeechWindow).coachSpeechHarness.audio({voice}), voice);
  await expect.poll(() => state(page).then(value => value.mode)).toBe(voice);
}
const controls = (page: Page) => page.getByRole("region", {name: "Main coach controls"});
async function speak(page: Page) {await controls(page).getByRole("button", {name: "Listen to coach", exact: true}).click();}
async function speaking(page: Page, id = FIRST, count = 1) {
  await expect.poll(() => starts(page)).toBe(count);
  await expect.poll(() => state(page).then(value => value.observed)).toBe(id);
}

test("Walter's complete manifest resolves local URLs and aligned mouth tracks", async ({page}) => {
  await mount(page);
  const bank = await page.evaluate(async () => {
    const harness = (window as unknown as SpeechWindow).coachSpeechHarness;
    return Promise.all(harness.bank().map(async record => ({...record, track: await harness.track(record.id)})));
  });
  expect(bank.map(record => record.id)).toEqual(walterManifest.recordings.map(record => record.id));
  expect(new Set(bank.map(record => record.id)).size).toBe(walterManifest.recordings.length);
  for (const record of bank) {
    expect(new URL(record.url, page.url()).origin).toBe(new URL(page.url()).origin);
    expect(record.url).toMatch(/\.opus(?:\?|$)/);
    expect(record.text.trim().length).toBeGreaterThan(0);
    expect(record.track?.durationSeconds, record.id).toBeGreaterThan(0);
    expect(record.track?.cues.length, record.id).toBeGreaterThan(0);
  }
  expect(await starts(page)).toBe(0);
});

test("restored positions, preference hydration, settings changes and refinement never autoplay", async ({page}) => {
  const fixture = await mount(page, {deferPreferences: true, selection: {ready: false}});
  await page.getByRole("button", {name: "Unlock audio", exact: true}).click();
  await update(page, {automaticEventId: "navigation-before-preferences"});
  await fixture.hydrate();
  await update(page, {ready: true});
  await tick(page, 1000);
  await voiceMode(page, "manual");
  await voiceMode(page, "automatic");
  await page.evaluate(() => (window as unknown as SpeechWindow).coachSpeechHarness.audio({volume: .7}));
  await update(page, {recordingId: SECOND, utteranceId: "refined:1"});
  await tick(page, 1000);
  expect(await starts(page)).toBe(0);
  expect(fixture.assets).toEqual([]);
  await speak(page);
  await speaking(page, SECOND);
});

test("a fresh navigation waits for its own report then speaks once after the dwell", async ({page}) => {
  await mount(page);
  await page.getByRole("button", {name: "Unlock audio", exact: true}).click();
  await update(page, {scopeKey: "game:one:2", automaticEventId: "navigate:2", ready: false});
  await tick(page, 1000);
  expect(await starts(page)).toBe(0);
  await update(page, {ready: true});
  await tick(page, 249);
  expect(await starts(page)).toBe(0);
  await tick(page, 1);
  await speaking(page);
  const played = await state(page);
  expect(played.track?.cues).toBeGreaterThan(0);
  expect(played.portrait).toBe(FIRST);
  await page.evaluate(() => (window as unknown as SpeechWindow).fakeSpeechAudio.finish());
  await expect.poll(() => state(page).then(value => value.observed)).toBe(null);
  await tick(page, 1000);
  expect(await starts(page)).toBe(1);
  await update(page, {utteranceId: "same-position-refined"});
  await tick(page, 1000);
  expect(await starts(page)).toBe(1);
  expect((await state(page)).playing).toBe(false);
});

test("rapid navigation replaces pending narration and immediately cancels an active old position", async ({page}) => {
  const fixture = await mount(page);
  await page.getByRole("button", {name: "Unlock audio", exact: true}).click();
  await update(page, {automaticEventId: "navigate:2"});
  await tick(page, 100);
  await update(page, {scopeKey: "game:one:3", automaticEventId: "navigate:3", recordingId: SECOND});
  await tick(page, 249);
  expect(await starts(page)).toBe(0);
  await tick(page, 1);
  await speaking(page, SECOND);
  expect(fixture.assets).toHaveLength(1);
  expect(fixture.assets[0]).toContain(SECOND);
  await update(page, {scopeKey: "game:one:4", automaticEventId: "navigate:4", recordingId: FIRST});
  await expect.poll(() => state(page).then(value => value.observed)).toBe(null);
  expect(await page.evaluate(() => (window as unknown as SpeechWindow).fakeSpeechAudio.stops())).toBeGreaterThan(0);
  await tick(page, 250);
  await speaking(page, FIRST, 2);
});

test("a new review scope cannot inherit pending narration from an old navigation token", async ({page}) => {
  await mount(page);
  await page.getByRole("button", {name: "Unlock audio", exact: true}).click();
  await update(page, {automaticEventId: "navigate:2", ready: false});
  await update(page, {scopeKey: "another-game:1"});
  await update(page, {ready: true});
  await tick(page, 1000);
  expect(await starts(page)).toBe(0);
  await update(page, {automaticEventId: "another-game:navigate:1"});
  await tick(page, 250);
  await speaking(page);
});

test("hiding discards pending narration instead of reviving it on return or a later unlock", async ({page}) => {
  await mount(page);
  await page.getByRole("button", {name: "Unlock audio", exact: true}).click();
  await update(page, {automaticEventId: "navigate:2", ready: false});
  await page.evaluate(() => (window as unknown as SpeechWindow).coachSpeechHarness.hidden(true));
  await tick(page, 1000);
  await page.evaluate(() => (window as unknown as SpeechWindow).coachSpeechHarness.hidden(false));
  await update(page, {ready: true});
  await page.getByRole("button", {name: "Unlock audio", exact: true}).click();
  await tick(page, 1000);
  expect(await starts(page)).toBe(0);
  await update(page, {automaticEventId: "navigate:3"});
  await tick(page, 250);
  await speaking(page);
  await page.evaluate(() => (window as unknown as SpeechWindow).coachSpeechHarness.hidden(true));
  await expect.poll(() => state(page).then(value => value.observed)).toBe(null);
});

test("manual Listen and Stop consume the pending automatic dwell instead of restarting speech", async ({page}) => {
  await mount(page);
  await update(page, {automaticEventId: "navigate:2"});
  await tick(page, 100);
  await speak(page);
  await speaking(page);
  await tick(page, 500);
  expect(await starts(page)).toBe(1);
  await update(page, {automaticEventId: "navigate:3", scopeKey: "game:one:3"});
  await tick(page, 100);
  await speak(page);
  await speaking(page, FIRST, 2);
  await controls(page).getByRole("button", {name: "Stop coach voice", exact: true}).click();
  await tick(page, 500);
  expect(await starts(page)).toBe(2);
  expect((await state(page)).observed).toBe(null);
});

test("blocked automatic playback is consumed instead of replaying after an unrelated unlock", async ({page}) => {
  await mount(page);
  await update(page, {automaticEventId: "navigate:locked"});
  await tick(page, 250);
  await page.evaluate(id => (window as unknown as SpeechWindow).coachSpeechHarness.track(id), FIRST);
  expect(await starts(page)).toBe(0);
  await page.getByRole("button", {name: "Unlock audio", exact: true}).click();
  await tick(page, 1000);
  expect(await starts(page)).toBe(0);
  await update(page, {automaticEventId: "navigate:unlocked"});
  await tick(page, 250);
  await speaking(page);
});

test("manual, Off and automatic policies keep settings changes silent and stop disallowed playback", async ({page}) => {
  await mount(page, {voice: "manual"});
  await update(page, {automaticEventId: "navigate:manual"});
  await tick(page, 500);
  expect(await starts(page)).toBe(0);
  await speak(page);
  await speaking(page);
  await voiceMode(page, "off");
  await expect(controls(page).getByRole("button")).toHaveCount(0);
  await expect.poll(() => state(page).then(value => value.observed)).toBe(null);
  await page.evaluate(() => (window as unknown as SpeechWindow).coachSpeechHarness.play());
  await update(page, {automaticEventId: "navigate:off"});
  await voiceMode(page, "automatic");
  await tick(page, 500);
  expect(await starts(page)).toBe(1);
  await update(page, {automaticEventId: "navigate:auto"});
  await tick(page, 250);
  await speaking(page, FIRST, 2);
});

test("unvoiced coaches and mismatched utterances never borrow another coach's bank", async ({page}) => {
  await mount(page);
  await page.evaluate(() => (window as unknown as SpeechWindow).coachSpeechHarness.coach({coach_id: "cat-black"}));
  await expect.poll(() => state(page).then(value => value.coach)).toBe("cat-black");
  await update(page, {automaticEventId: "navigate:cat"});
  await page.evaluate(() => (window as unknown as SpeechWindow).coachSpeechHarness.play());
  await tick(page, 500);
  expect((await state(page)).available).toBe(false);
  await page.evaluate(() => (window as unknown as SpeechWindow).coachSpeechHarness.coach({coach_id: "classic"}));
  await update(page, {utteranceCoach: "cat-black"});
  await page.evaluate(() => (window as unknown as SpeechWindow).coachSpeechHarness.play());
  await tick(page, 500);
  expect(await starts(page)).toBe(0);
  await update(page, {utteranceCoach: "classic"});
  await tick(page, 500);
  expect(await starts(page)).toBe(0);
  await speak(page);
  await speaking(page);
});

test("an utterance marked unsuitable for automatic speech still allows an explicit Listen", async ({page}) => {
  await mount(page, {selection: {autoSpeakSuitable: false}});
  await page.getByRole("button", {name: "Unlock audio", exact: true}).click();
  await update(page, {automaticEventId: "navigate:unsuitable"});
  await tick(page, 1000);
  expect(await starts(page)).toBe(0);
  await speak(page);
  await speaking(page);
});

test("missing recording bytes leave feedback usable and an explicit retry can recover", async ({page}) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const fixture = await mount(page, {failFirstAsset: true});
  const copy = await page.getByTestId("written-feedback").textContent();
  const failed = page.waitForResponse(response => response.url().includes(`${FIRST}.opus`) && response.status() === 404);
  await speak(page);
  await (await failed).finished();
  await expect.poll(() => fixture.assets.length).toBe(1);
  await expect(controls(page).getByRole("button", {name: "Listen to coach", exact: true})).toBeVisible();
  expect(await starts(page)).toBe(0);
  expect(await page.getByTestId("written-feedback").textContent()).toBe(copy);
  await speak(page);
  await speaking(page);
  expect(fixture.assets).toHaveLength(2);
  expect(errors).toEqual([]);
});

test("a late audio decode cannot speak after navigation or unmount", async ({page}) => {
  await mount(page);
  await page.evaluate(() => (window as unknown as SpeechWindow).fakeSpeechAudio.deferDecode());
  await speak(page);
  await expect.poll(() => page.evaluate(() => (window as unknown as SpeechWindow).fakeSpeechAudio.decodes())).toBe(1);
  await update(page, {scopeKey: "game:two:1", recordingId: SECOND});
  await page.evaluate(() => (window as unknown as SpeechWindow).fakeSpeechAudio.releaseDecode());
  await tick(page, 1000);
  expect(await starts(page)).toBe(0);
  await page.evaluate(() => (window as unknown as SpeechWindow).fakeSpeechAudio.deferDecode());
  await speak(page);
  await expect.poll(() => page.evaluate(() => (window as unknown as SpeechWindow).fakeSpeechAudio.decodes())).toBe(2);
  await page.evaluate(() => (window as unknown as SpeechWindow).coachSpeechHarness.unmount());
  await page.evaluate(() => (window as unknown as SpeechWindow).fakeSpeechAudio.releaseDecode());
  await tick(page, 1000);
  expect(await starts(page)).toBe(0);
});

test("a delayed mouth-track import is discarded when a newer selection replaces it", async ({page}) => {
  let captured!: () => void, release!: () => void;
  const requested = new Promise<void>(resolve => {captured = resolve;});
  const gate = new Promise<void>(resolve => {release = resolve;});
  await page.route(/\/speech\/bank\/tracks\.json(?:\?.*)?$/, async route => {
    captured(); await gate; await route.fallback();
  });
  await mount(page);
  await speak(page);
  await requested;
  await update(page, {scopeKey: "game:one:2", recordingId: SECOND});
  release();
  await page.evaluate(id => (window as unknown as SpeechWindow).coachSpeechHarness.track(id), SECOND);
  await tick(page, 500);
  expect(await starts(page)).toBe(0);
  expect((await state(page)).active).toBe(null);
  await speak(page);
  await speaking(page, SECOND);
});

test("secondary-only recordings have no empty primary control and reject unrelated IDs", async ({page}) => {
  await mount(page, {selection: {recordingId: null, manualRecordingIds: [SECOND]}});
  expect((await state(page)).available).toBe(true);
  await expect(controls(page).getByRole("button", {name: "Listen to coach", exact: true})).toHaveCount(0);
  await page.evaluate(id => (window as unknown as SpeechWindow).coachSpeechHarness.play(id), FIRST);
  await page.evaluate(() => (window as unknown as SpeechWindow).coachSpeechHarness.play("not-in-bank"));
  expect(await starts(page)).toBe(0);
  await page.evaluate(id => (window as unknown as SpeechWindow).coachSpeechHarness.play(id), SECOND);
  await speaking(page, SECOND);
});

test("a manual control for a not-yet-recorded piece variant plays its generic clip and offers Stop", async ({page}) => {
  const variant = `${SECOND}-knight|${SECOND}`;
  await mount(page, {selection: {recordingId: null, manualRecordingIds: [variant]}});
  await controls(page).getByRole("button", {name: `Listen to ${variant}`, exact: true}).click();
  await speaking(page, SECOND);
  await controls(page).getByRole("button", {name: "Stop coach voice", exact: true}).click();
  await expect.poll(() => state(page).then(value => value.observed)).toBe(null);
  expect(await starts(page)).toBe(1);
});

test("late human enrichment keeps a still-supported recording without replaying or cutting it off", async ({page}) => {
  await mount(page);
  await page.getByRole("button", {name: "Unlock audio", exact: true}).click();
  await update(page, {automaticEventId: "navigate:enrichment"});
  await tick(page, 250);
  await speaking(page);
  await update(page, {utteranceId: "position:with-new-human-facts"});
  await tick(page, 500);
  await speaking(page);
  expect((await state(page)).playing).toBe(true);
  // The new preferred response may be a composite; the original objective
  // recording remains supported by the refreshed visible claims.
  await update(page, {recordingId: SECOND, manualRecordingIds: [FIRST]});
  await tick(page, 500);
  await speaking(page);
  await update(page, {manualRecordingIds: []});
  await expect.poll(() => state(page).then(value => value.observed)).toBe(null);
  await tick(page, 500);
  expect(await starts(page)).toBe(1);
});

test("a stale insight callback cannot consume the next move's narration", async ({page}) => {
  await mount(page);
  await page.getByRole("button", {name: "Unlock audio", exact: true}).click();
  await update(page, {automaticEventId: "navigate:next", scopeKey: "game:one:next"});
  await page.evaluate(() => (window as unknown as SpeechWindow).coachSpeechHarness.consumeAutomatic("navigate:previous"));
  await tick(page, 250);
  await speaking(page);
});

test("opening an insight alone stays silent and does not consume the main response", async ({page}) => {
  const games = semanticFixtures<Record<string, Game>>("review_human_fixtures.py");
  const game = Object.values(games).find(value => value.frames[1].report?.practical?.interpretations?.includes("natural_best"))!;
  await mount(page, {game});
  await update(page, {automaticEventId: "navigate:inspect"});
  await tick(page, 100);
  await page.locator(".human-insight-trigger").click();
  await expect(page.getByRole("dialog").getByRole("button", {name: /listen|stop/i})).toHaveCount(0);
  await tick(page, 150);
  await speaking(page);
});

test("switching to On request invalidates an automatic response already decoding", async ({page}) => {
  await mount(page);
  await page.getByRole("button", {name: "Unlock audio", exact: true}).click();
  await page.evaluate(() => (window as unknown as SpeechWindow).fakeSpeechAudio.deferDecode());
  await update(page, {automaticEventId: "navigate:decoding-settings"});
  await tick(page, 250);
  await expect.poll(() => page.evaluate(() => (window as unknown as SpeechWindow).fakeSpeechAudio.decodes())).toBe(1);
  await voiceMode(page, "manual");
  await page.evaluate(() => (window as unknown as SpeechWindow).fakeSpeechAudio.releaseDecode());
  await tick(page, 500);
  expect(await starts(page)).toBe(0);
  await speak(page);
  await speaking(page);
});

test("a missing secondary recording has no unusable Listen button beside a supported primary", async ({page}) => {
  await mount(page, {selection: {manualRecordingIds: [SECOND, "not-in-bank"]}});
  await expect(controls(page).getByRole("button", {name: "Listen to coach", exact: true})).toBeVisible();
  await expect(controls(page).getByRole("button", {name: `Listen to ${SECOND}`, exact: true})).toBeVisible();
  await expect(controls(page).getByRole("button", {name: "Listen to not-in-bank", exact: true})).toHaveCount(0);
  await controls(page).getByRole("button", {name: `Listen to ${SECOND}`, exact: true}).click();
  await speaking(page, SECOND);
});

test("switching between Walter and Rivet stops the old voice and uses the selected coach's own recording", async ({page}) => {
  const fixture = await mount(page);
  await speak(page);
  await speaking(page);
  expect((await state(page)).observedCoach).toBe("classic");
  const rivet = await page.evaluate(() => (window as unknown as SpeechWindow).coachSpeechHarness.bank("robot"));
  expect(rivet.length).toBeGreaterThan(0);
  const recording = rivet.find(record => record.id === FIRST) ?? rivet[0];
  await page.evaluate(() => (window as unknown as SpeechWindow).coachSpeechHarness.coach({coach_id: "robot"}));
  await expect.poll(() => state(page).then(value => value.observed)).toBe(null);
  await expect(controls(page).getByRole("button", {name: "Listen to coach", exact: true})).toHaveCount(0);
  await update(page, {utteranceCoach: "robot", recordingId: recording.id});
  await tick(page, 500);
  expect(await starts(page)).toBe(1);
  await speak(page);
  await speaking(page, recording.id, 2);
  expect((await state(page)).observedCoach).toBe("robot");
  expect((await state(page)).portrait).toBe(recording.id);
  expect(fixture.assets.at(-1)).toBe(new URL(recording.url, page.url()).href);
  await update(page, {recordingId: "not-in-bank"});
  await expect.poll(() => state(page).then(value => value.observed)).toBe(null);
  await expect(controls(page).getByRole("button", {name: "Listen to coach", exact: true})).toHaveCount(0);
  await page.evaluate(id => (window as unknown as SpeechWindow).coachSpeechHarness.play(id), FIRST);
  expect(await starts(page)).toBe(2);
});
