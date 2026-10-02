import { expect, test, type Page } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { SpeechMouthTrack } from "../src/coach/speechMouth";
import {mockCastingApi} from "./fixtures/castingApi";

test.beforeEach(async ({page}) => { await mockCastingApi(page); });

const root = resolve("src/audio/speech/cast-auditions");
type PlannedCoach = {coachId: string; name: string; group: string; text: string; directions: {id: string; label: string; prompt: string}[]};
const plan = JSON.parse(readFileSync(resolve(root, "design-plan.json"), "utf8")) as {
  coaches: PlannedCoach[]; deferredCoaches?: PlannedCoach[];
};
const panel = (page: Page) => page.getByRole("region", {name: "Cast voice auditions", exact: true});
const portrait = (page: Page) => panel(page).locator(".coach-avatar");
const play = (page: Page) => panel(page).getByRole("button", {name: "Play candidate", exact: true});
const coach = (page: Page) => panel(page).getByRole("combobox", {name: "Cast coach", exact: true});
const direction = (page: Page) => panel(page).getByRole("combobox", {name: "Candidate direction", exact: true});
const speechEvents = (page: Page, type: string) => page.locator(`[data-bus="speech"][data-event-type="${type}"]`);

test("every approved coach has three complete aligned directions, with any deferred coaches explicitly unrecorded", () => {
  const manifest = JSON.parse(readFileSync(resolve(root, "manifest.json"), "utf8")) as {
    recordings: {id: string; coachId: string; directionId: string; text: string; audioPath: string; durationSeconds: number}[];
  };
  const tracks = JSON.parse(readFileSync(resolve(root, "tracks.json"), "utf8")) as Record<string, SpeechMouthTrack>;
  const deferred = plan.deferredCoaches ?? [];
  expect([...plan.coaches, ...deferred]).toHaveLength(29);
  expect(new Set([...plan.coaches, ...deferred].map(item => item.coachId)).size).toBe(29);
  expect(manifest.recordings).toHaveLength(plan.coaches.length * 3);
  expect(new Set(manifest.recordings.map(item => item.id)).size).toBe(plan.coaches.length * 3);
  expect(Object.keys(tracks).sort()).toEqual(manifest.recordings.map(item => item.id).sort());
  for (const candidate of deferred) {
    expect(manifest.recordings.some(item => item.coachId === candidate.coachId)).toBe(false);
    expect(existsSync(resolve(root, "recordings", candidate.coachId))).toBe(false);
  }
  for (const candidate of plan.coaches) {
    expect(candidate.coachId).not.toBe("classic");
    expect(candidate.directions).toHaveLength(3);
    expect(new Set(candidate.directions.map(item => item.prompt)).size).toBe(3);
    for (const direction of candidate.directions) {
      const recording = manifest.recordings.find(item => item.coachId === candidate.coachId && item.directionId === direction.id)!;
      expect(recording, `${candidate.coachId}/${direction.id}`).toBeTruthy();
      expect(recording.id).toBe(`${candidate.coachId}:${direction.id}`);
      expect(recording.text).toBe(candidate.text);
      expect(recording.audioPath).toBe(`recordings/${candidate.coachId}/${direction.id}.opus`);
      expect(existsSync(resolve(root, recording.audioPath))).toBe(true);
      expect(recording.durationSeconds).toBeGreaterThan(0);
      const track = tracks[recording.id];
      expect(track.durationSeconds).toBeCloseTo(recording.durationSeconds, 1);
      expect(track.cues.length).toBeGreaterThan(10);
      expect(new Set(track.cues.map(cue => cue.shape)).size).toBeGreaterThan(3);
      for (const [index, cue] of track.cues.entries()) {
        expect(cue.end).toBeGreaterThan(cue.start);
        expect(cue.start).toBeGreaterThanOrEqual(index ? track.cues[index - 1].end - .001 : 0);
        expect(cue.end).toBeLessThanOrEqual(track.durationSeconds + .001);
      }
    }
  }
});

test("the compact cast selector starts silent, exposes every direction, and stays local on phones and desktops", async ({page}, info) => {
  const requests: string[] = [];
  const errors: string[] = [];
  page.on("request", request => requests.push(request.url()));
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  if (info.project.name === "mobile") await page.setViewportSize({width: 320, height: 780});
  await expect(coach(page).locator("option")).toHaveCount(plan.coaches.length);
  await expect(panel(page)).toHaveAttribute("data-playback", "idle");
  for (const candidate of plan.coaches) {
    await coach(page).selectOption(candidate.coachId);
    await expect(portrait(page)).toHaveAttribute("data-coach", candidate.coachId);
    await expect(direction(page).locator("option")).toHaveText(candidate.directions.map(item => item.label));
    await expect(panel(page).getByLabel("Coach explanation", {exact: true})).toHaveText(candidate.text);
    for (const item of candidate.directions) {
      await direction(page).selectOption(item.id);
      await expect(play(page)).toBeEnabled();
    }
  }
  await expect(speechEvents(page, "started")).toHaveCount(0);
  expect(requests.filter(url => {
    const request = new URL(url);
    return request.pathname.endsWith(".opus") && !request.searchParams.has("import");
  })).toEqual([]);
  const origin = new URL(page.url()).origin;
  expect(requests.filter(url => new URL(url).origin !== origin || new URL(url).pathname.startsWith("/api/"))).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
  await panel(page).screenshot({path: info.outputPath("cast-auditions.png")});
});

test("every audition uses its real portrait's aligned mouth and restores the authored face when stopped", async ({page}) => {
  test.setTimeout(90000);
  await page.goto("/");
  await panel(page).getByRole("combobox", {name: "Candidate motion", exact: true}).selectOption("natural");
  for (const candidate of plan.coaches) {
    await coach(page).selectOption(candidate.coachId);
    await expect(play(page)).toBeEnabled();
    await play(page).click();
    await expect(panel(page)).toHaveAttribute("data-playback", "playing");
    await expect(portrait(page)).toHaveAttribute("data-articulation", "aligned");
    await expect(portrait(page)).toHaveAttribute("data-speaking", "true");
    await expect(portrait(page).locator(".speech-mouth-live")).toBeVisible();
    await expect(portrait(page).locator(".speech-mouth-authored")).toBeHidden();
    await page.getByRole("button", {name: "Stop all", exact: true}).click();
    await expect(panel(page)).toHaveAttribute("data-playback", "idle");
    await expect(portrait(page)).toHaveAttribute("data-speaking", "false");
    await expect(portrait(page).locator(".speech-mouth-authored")).toBeVisible();
    await expect(portrait(page).locator(".speech-mouth-live")).toBeHidden();
    expect(await portrait(page).evaluate(node => (node as HTMLElement).style.getPropertyValue("--speech-open"))).toBe("");
  }
});

test("switching directions follows each selected recording's actual cue timing", async ({page}) => {
  const tracks = JSON.parse(readFileSync(resolve(root, "tracks.json"), "utf8")) as Record<string, SpeechMouthTrack>;
  await page.addInitScript(() => {
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function(when?, offset?, duration?) {
      Object.assign(window, {castSource: {context: this.context, startedAt: when ?? this.context.currentTime}});
      if (duration === undefined) start.call(this, when ?? 0, offset ?? 0);
      else start.call(this, when ?? 0, offset ?? 0, duration);
    };
  });
  await page.goto("/");
  const candidate = plan.coaches.find(item => item.coachId === "robot")!;
  await coach(page).selectOption(candidate.coachId);
  await panel(page).getByRole("combobox", {name: "Candidate motion", exact: true}).selectOption("natural");
  for (const choice of candidate.directions.slice(0, 2)) {
    await direction(page).selectOption(choice.id);
    const expected = tracks[`${candidate.coachId}:${choice.id}`];
    await portrait(page).evaluate((node, track) => {
      type Scope = Window & {castSource?: {context: BaseAudioContext; startedAt: number};
        castFrames: {actual: string; expected: string}[]; castObserver?: MutationObserver};
      const scope = window as unknown as Scope;
      scope.castObserver?.disconnect();
      scope.castFrames = [];
      scope.castObserver = new MutationObserver(() => {
        const avatar = node as HTMLElement;
        if (!scope.castSource || avatar.dataset.speaking !== "true") return;
        const seconds = scope.castSource.context.currentTime - scope.castSource.startedAt;
        const cue = track.cues.find(cue => seconds >= cue.start && seconds < cue.end);
        // Sample inside a cue, away from native audio quanta and RAF boundaries.
        if (cue && seconds - cue.start > .04 && cue.end - seconds > .04)
          scope.castFrames.push({actual: avatar.dataset.mouthShape ?? "", expected: cue.shape});
      });
      scope.castObserver.observe(node, {attributes: true, attributeFilter: ["style"]});
    }, expected);
    try {
      await expect(play(page)).toBeEnabled();
      await play(page).click();
      await expect.poll(() => page.evaluate(() => {
        const frames = (window as unknown as {castFrames: {actual: string}[]}).castFrames;
        return new Set(frames.map(frame => frame.actual)).size;
      })).toBeGreaterThanOrEqual(3);
      const frames = await page.evaluate(() => (window as unknown as {castFrames: {actual: string; expected: string}[]}).castFrames);
      expect(frames.length).toBeGreaterThan(3);
      expect(frames.filter(frame => frame.actual !== frame.expected)).toEqual([]);
    } finally {
      await page.evaluate(() => (window as unknown as {castObserver?: MutationObserver}).castObserver?.disconnect());
      await page.getByRole("button", {name: "Stop all", exact: true}).click();
    }
  }
});

test("cast auditions and game sounds share one player and changing a candidate cancels without autoplay", async ({page}) => {
  await page.goto("/");
  await expect(page.getByRole("region", {name: "Find Walter’s voice", exact: true})).toHaveCount(0);
  await expect(play(page)).toBeEnabled();
  await play(page).click();
  await expect(panel(page)).toHaveAttribute("data-playback", "playing");
  await page.getByRole("button", {name: "Play Move · Soft objects", exact: true}).click();
  await expect(panel(page)).toHaveAttribute("data-playback", "idle");
  await expect(page.locator('[data-bus="effects"][data-event-type="started"]')).toHaveCount(1);
  await play(page).click();
  await expect(panel(page)).toHaveAttribute("data-playback", "playing");
  await direction(page).selectOption(plan.coaches[0].directions[1].id);
  await expect(panel(page)).toHaveAttribute("data-playback", "idle");
  await expect(speechEvents(page, "started")).toHaveCount(2);
  await expect(speechEvents(page, "cancelled")).toHaveCount(2);
  await play(page).click();
  await expect(speechEvents(page, "started")).toHaveCount(3);
  await coach(page).selectOption(plan.coaches[1].coachId);
  await expect(panel(page)).toHaveAttribute("data-playback", "idle");
  await expect(speechEvents(page, "cancelled")).toHaveCount(3);
});

test("cast motion follows device reduction and explicit Still while sound remains independently playable", async ({page}) => {
  await page.emulateMedia({reducedMotion: "reduce"});
  await page.goto("/");
  await expect(play(page)).toBeEnabled();
  await play(page).click();
  await expect(panel(page)).toHaveAttribute("data-playback", "playing");
  await expect(portrait(page)).toHaveAttribute("data-speaking", "false");
  const motion = panel(page).getByRole("combobox", {name: "Candidate motion", exact: true});
  await motion.selectOption("natural");
  await play(page).scrollIntoViewIfNeeded();
  await expect(portrait(page)).toHaveAttribute("data-speaking", "true");
  await motion.selectOption("still");
  await expect(portrait(page)).toHaveAttribute("data-speaking", "false");
  await expect(panel(page)).toHaveAttribute("data-playback", "playing");
  await expect(speechEvents(page, "started")).toHaveCount(1);
  await page.getByRole("button", {name: "Stop all", exact: true}).click();
});

test("a recording without an aligned track still plays through the energy-driven mouth", async ({page}) => {
  const tracks = JSON.parse(readFileSync(resolve(root, "tracks.json"), "utf8")) as Record<string, SpeechMouthTrack>;
  const candidate = plan.coaches.find(item => item.coachId === "robot")!;
  const missing = `${candidate.coachId}:${candidate.directions[0].id}`;
  const remaining = Object.fromEntries(Object.entries(tracks).filter(([id]) => id !== missing));
  await page.route(url => url.pathname.endsWith("/cast-auditions/tracks.json"), route => route.fulfill({
    contentType: "text/javascript", body: `export default ${JSON.stringify(remaining)};`}));
  await page.goto("/");
  await coach(page).selectOption(candidate.coachId);
  await direction(page).selectOption(candidate.directions[0].id);
  await expect(panel(page)).toContainText("Mouth timing is unavailable; the mouth follows the audio instead");
  await expect(play(page)).toBeEnabled();
  await play(page).click();
  await expect(panel(page)).toHaveAttribute("data-playback", "playing");
  await expect(speechEvents(page, "started")).toHaveCount(1);
  await direction(page).selectOption(candidate.directions[1].id);
  await expect(panel(page)).toContainText("Automatically aligned mouth timing");
});
