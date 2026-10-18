import { expect, test, type Page } from "../tests/helpers/browserTest";
import path from "node:path";
import { defaultAudioPreferences, type AudioPreferences } from "../src/audio/model";
import type { SpeechHarness, Selection } from "./fixtures/coachSpeechRuntime";
import type { FakeSpeechAudio } from "./fixtures/fakeSpeechAudio";
import { viteFsPath } from "../studio-tests/helpers/viteFsPath";

type SpeechWindow = Window & {
  coachSpeechHarness: SpeechHarness;
  fakeSpeechAudio: FakeSpeechAudio;
};
type State = {
  ready: boolean;
  mode: string;
  coach: string;
  available: boolean;
  playing: boolean;
  observed: string | null;
  observedCoach: string | null;
  portrait: string | null;
  track: { duration: number; cues: number } | null;
  selection: Selection;
};
const FIRST = "tactic-fork-played",
  SECOND = "tactic-pin-played";

async function mount(
  page: Page,
  options: {
    selection?: Partial<Selection>;
    voice?: AudioPreferences["voice"];
    deferPreferences?: boolean;
  } = {},
) {
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.emulateMedia({ reducedMotion: "no-preference" });
  let preferences = { ...defaultAudioPreferences, voice: options.voice ?? "automatic" };
  let coach = { coach_id: "classic", motion: "natural" };
  let release!: () => void;
  const gate = new Promise<void>(resolve => {
    release = resolve;
  });
  const assets: string[] = [];
  await page.route("**/api/preferences/audio", async route => {
    if (route.request().method() === "PUT") preferences = route.request().postDataJSON();
    else if (options.deferPreferences) await gate;
    await route.fulfill({ json: preferences });
  });
  await page.route("**/api/preferences/coach", async route => {
    // The coach controls save only their changed field.
    if (route.request().method() === "PATCH")
      coach = { ...coach, ...route.request().postDataJSON() };
    else if (options.deferPreferences) await gate;
    await route.fulfill({ json: coach });
  });
  await page.route(/\.opus(?:\?.*)?$/, async route => {
    // Vite also requests asset URL modules as scripts; those are not recordings.
    if (route.request().resourceType() !== "fetch") return route.fallback();
    assets.push(route.request().url());
    await route.fulfill({ contentType: "audio/mpeg", body: Buffer.from([1, 2, 3, 4]) });
  });
  await page.goto("/");
  await page.evaluate(
    async ({ root, selection }) => {
      const { installFakeSpeechAudio } = await import(
        `${root}/audio-tests/fixtures/fakeSpeechAudio.ts`
      );
      const { mountCoachSpeech } = await import(
        `${root}/audio-tests/fixtures/coachSpeechRuntime.ts`
      );
      const target = window as unknown as SpeechWindow;
      target.fakeSpeechAudio = installFakeSpeechAudio();
      target.coachSpeechHarness = mountCoachSpeech(selection);
    },
    { root: viteFsPath(path.resolve(".")), selection: options.selection },
  );
  await expect(page.getByTestId("speech-state")).toBeVisible();
  if (!options.deferPreferences)
    await expect.poll(() => state(page).then(value => value.ready)).toBe(true);
  return {
    assets,
    hydrate: async () => {
      release();
      await expect.poll(() => state(page).then(value => value.ready)).toBe(true);
    },
  };
}
async function state(page: Page): Promise<State> {
  return JSON.parse((await page.getByTestId("speech-state").textContent())!);
}
async function update(page: Page, patch: Partial<Selection>) {
  await page.evaluate(
    patch => (window as unknown as SpeechWindow).coachSpeechHarness.update(patch),
    patch,
  );
  await expect
    .poll(async () => {
      const current = (await state(page)).selection;
      return Object.fromEntries(
        Object.keys(patch).map(key => [key, current[key as keyof Selection]]),
      );
    })
    .toEqual(patch);
}
async function starts(page: Page) {
  return page.evaluate(() => (window as unknown as SpeechWindow).fakeSpeechAudio.starts());
}
async function tick(page: Page, ms: number) {
  // Permit React commits between scheduled navigation and mouth-frame callbacks.
  for (let remaining = ms; remaining > 0; remaining -= 50)
    await page.clock.runFor(Math.min(remaining, 50));
}
async function voiceMode(page: Page, voice: AudioPreferences["voice"]) {
  await page.evaluate(
    voice => (window as unknown as SpeechWindow).coachSpeechHarness.audio({ voice }),
    voice,
  );
  await expect.poll(() => state(page).then(value => value.mode)).toBe(voice);
}
const controls = (page: Page) => page.getByRole("region", { name: "Main coach controls" });
async function speak(page: Page) {
  await controls(page).getByRole("button", { name: "Listen to coach", exact: true }).click();
}
async function speaking(page: Page, id = FIRST, count = 1) {
  await expect.poll(() => starts(page)).toBe(count);
  await expect.poll(() => state(page).then(value => value.observed)).toBe(id);
}

test("restored positions, preference hydration, settings changes and refinement never autoplay", async ({
  page,
}) => {
  const fixture = await mount(page, { deferPreferences: true, selection: { ready: false } });
  await page.getByRole("button", { name: "Unlock audio", exact: true }).click();
  await update(page, { automaticEventId: "navigation-before-preferences" });
  await fixture.hydrate();
  await update(page, { ready: true });
  await tick(page, 1000);
  await voiceMode(page, "manual");
  await voiceMode(page, "automatic");
  await page.evaluate(() =>
    (window as unknown as SpeechWindow).coachSpeechHarness.audio({ volume: 0.7 }),
  );
  await update(page, { recordingId: SECOND, utteranceId: "refined:1" });
  await tick(page, 1000);
  expect(await starts(page)).toBe(0);
  expect(fixture.assets).toEqual([]);
  await speak(page);
  await speaking(page, SECOND);
});

test("a fresh navigation waits for its own report then speaks once after the dwell", async ({
  page,
}) => {
  await mount(page);
  await page.getByRole("button", { name: "Unlock audio", exact: true }).click();
  await update(page, { scopeKey: "game:one:2", automaticEventId: "navigate:2", ready: false });
  await tick(page, 1000);
  expect(await starts(page)).toBe(0);
  await update(page, { ready: true });
  await tick(page, 249);
  expect(await starts(page)).toBe(0);
  await tick(page, 1);
  await speaking(page);
  // Mouth timing joins the playback when it arrives; it never delays the line.
  await expect.poll(() => state(page).then(value => value.track?.cues ?? 0)).toBeGreaterThan(0);
  expect((await state(page)).portrait).toBe(FIRST);
  await page.evaluate(() => (window as unknown as SpeechWindow).fakeSpeechAudio.finish());
  await expect.poll(() => state(page).then(value => value.observed)).toBe(null);
  await tick(page, 1000);
  expect(await starts(page)).toBe(1);
  await update(page, { utteranceId: "same-position-refined" });
  await tick(page, 1000);
  expect(await starts(page)).toBe(1);
  expect((await state(page)).playing).toBe(false);
});

test("rapid navigation replaces pending narration and immediately cancels an active old position", async ({
  page,
}) => {
  const fixture = await mount(page);
  await page.getByRole("button", { name: "Unlock audio", exact: true }).click();
  await update(page, { automaticEventId: "navigate:2" });
  await tick(page, 100);
  await update(page, {
    scopeKey: "game:one:3",
    automaticEventId: "navigate:3",
    recordingId: SECOND,
  });
  await tick(page, 249);
  expect(await starts(page)).toBe(0);
  await tick(page, 1);
  await speaking(page, SECOND);
  expect(fixture.assets).toHaveLength(1);
  expect(fixture.assets[0]).toContain(SECOND);
  await update(page, {
    scopeKey: "game:one:4",
    automaticEventId: "navigate:4",
    recordingId: FIRST,
  });
  await expect.poll(() => state(page).then(value => value.observed)).toBe(null);
  expect(
    await page.evaluate(() => (window as unknown as SpeechWindow).fakeSpeechAudio.stops()),
  ).toBeGreaterThan(0);
  await tick(page, 250);
  await speaking(page, FIRST, 2);
});

test("manual Listen and Stop consume the pending automatic dwell instead of restarting speech", async ({
  page,
}) => {
  await mount(page);
  await update(page, { automaticEventId: "navigate:2" });
  await tick(page, 100);
  await speak(page);
  await speaking(page);
  await tick(page, 500);
  expect(await starts(page)).toBe(1);
  await update(page, { automaticEventId: "navigate:3", scopeKey: "game:one:3" });
  await tick(page, 100);
  await speak(page);
  await speaking(page, FIRST, 2);
  await controls(page).getByRole("button", { name: "Stop coach voice", exact: true }).click();
  await tick(page, 500);
  expect(await starts(page)).toBe(2);
  expect((await state(page)).observed).toBe(null);
});

test("blocked automatic playback is consumed instead of replaying after an unrelated unlock", async ({
  page,
}) => {
  await mount(page);
  await update(page, { automaticEventId: "navigate:locked" });
  await tick(page, 250);
  await page.evaluate(
    id => (window as unknown as SpeechWindow).coachSpeechHarness.track(id),
    FIRST,
  );
  expect(await starts(page)).toBe(0);
  await page.getByRole("button", { name: "Unlock audio", exact: true }).click();
  await tick(page, 1000);
  expect(await starts(page)).toBe(0);
  await update(page, { automaticEventId: "navigate:unlocked" });
  await tick(page, 250);
  await speaking(page);
});

test("manual, Off and automatic policies keep settings changes silent and stop disallowed playback", async ({
  page,
}) => {
  await mount(page, { voice: "manual" });
  await update(page, { automaticEventId: "navigate:manual" });
  await tick(page, 500);
  expect(await starts(page)).toBe(0);
  await speak(page);
  await speaking(page);
  await voiceMode(page, "off");
  await expect(controls(page).getByRole("button")).toHaveCount(0);
  await expect.poll(() => state(page).then(value => value.observed)).toBe(null);
  await page.evaluate(() => (window as unknown as SpeechWindow).coachSpeechHarness.play());
  await update(page, { automaticEventId: "navigate:off" });
  await voiceMode(page, "automatic");
  await tick(page, 500);
  expect(await starts(page)).toBe(1);
  await update(page, { automaticEventId: "navigate:auto" });
  await tick(page, 250);
  await speaking(page, FIRST, 2);
});

test("unvoiced coaches and mismatched utterances never borrow another coach's bank", async ({
  page,
}) => {
  await mount(page);
  await page.evaluate(() =>
    (window as unknown as SpeechWindow).coachSpeechHarness.coach({ coach_id: "cat-black" }),
  );
  await expect.poll(() => state(page).then(value => value.coach)).toBe("cat-black");
  await update(page, { automaticEventId: "navigate:cat" });
  await page.evaluate(() => (window as unknown as SpeechWindow).coachSpeechHarness.play());
  await tick(page, 500);
  expect((await state(page)).available).toBe(false);
  await page.evaluate(() =>
    (window as unknown as SpeechWindow).coachSpeechHarness.coach({ coach_id: "classic" }),
  );
  await update(page, { utteranceCoach: "cat-black" });
  await page.evaluate(() => (window as unknown as SpeechWindow).coachSpeechHarness.play());
  await tick(page, 500);
  expect(await starts(page)).toBe(0);
  await update(page, { utteranceCoach: "classic" });
  await tick(page, 500);
  expect(await starts(page)).toBe(0);
  await speak(page);
  await speaking(page);
});

test("a delayed mouth-track load never holds back the line and only joins its own playback", async ({
  page,
}) => {
  let captured!: () => void, release!: () => void;
  const requested = new Promise<void>(resolve => {
    captured = resolve;
  });
  const gate = new Promise<void>(resolve => {
    release = resolve;
  });
  // The fetched mouth timing, not the module that only exports its URL.
  await page.route(/\/speech\/bank\/tracks\.json$/, async route => {
    captured();
    await gate;
    await route.fallback();
  });
  await mount(page);
  await requested;
  await speak(page);
  await speaking(page);
  expect((await state(page)).track).toBe(null);
  await update(page, { scopeKey: "game:one:2", recordingId: SECOND });
  await expect.poll(() => state(page).then(value => value.playing)).toBe(false);
  release();
  await page.evaluate(
    id => (window as unknown as SpeechWindow).coachSpeechHarness.track(id),
    SECOND,
  );
  await tick(page, 500);
  expect(await starts(page)).toBe(1);
  expect((await state(page)).track).toBe(null);
  await speak(page);
  await speaking(page, SECOND, 2);
  await expect.poll(() => state(page).then(value => value.track?.cues ?? 0)).toBeGreaterThan(0);
});

test("switching between Walter and Rivet stops the old voice and uses the selected coach's own recording", async ({
  page,
}) => {
  const fixture = await mount(page);
  await speak(page);
  await speaking(page);
  expect((await state(page)).observedCoach).toBe("classic");
  const rivet = await page.evaluate(() =>
    (window as unknown as SpeechWindow).coachSpeechHarness.bank("robot"),
  );
  expect(rivet.length).toBeGreaterThan(0);
  const recording = rivet.find(record => record.id === FIRST) ?? rivet[0];
  await page.evaluate(() =>
    (window as unknown as SpeechWindow).coachSpeechHarness.coach({ coach_id: "robot" }),
  );
  await expect.poll(() => state(page).then(value => value.observed)).toBe(null);
  await expect(
    controls(page).getByRole("button", { name: "Listen to coach", exact: true }),
  ).toHaveCount(0);
  await update(page, { utteranceCoach: "robot", recordingId: recording.id });
  await tick(page, 500);
  expect(await starts(page)).toBe(1);
  await speak(page);
  await speaking(page, recording.id, 2);
  expect((await state(page)).observedCoach).toBe("robot");
  expect((await state(page)).portrait).toBe(recording.id);
  expect(fixture.assets.at(-1)).toBe(new URL(recording.url, page.url()).href);
  await update(page, { recordingId: "not-in-bank" });
  await expect.poll(() => state(page).then(value => value.observed)).toBe(null);
  await expect(
    controls(page).getByRole("button", { name: "Listen to coach", exact: true }),
  ).toHaveCount(0);
  await page.evaluate(id => (window as unknown as SpeechWindow).coachSpeechHarness.play(id), FIRST);
  expect(await starts(page)).toBe(2);
});
