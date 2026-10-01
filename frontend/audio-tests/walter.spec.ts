import { expect, test, type Page } from "@playwright/test";
import { walterClips, walterCollections, walterScripts, walterVoices } from "../src/audio/speech/walterPilot";

// Vite's ?import&url requests are tiny JavaScript URL modules, not audio loads.
const recordingPattern = /\.mp3$/;
const panel = (page: Page) => page.getByRole("region", { name: "Find Walter’s voice", exact: true });
const voiceChoices = (page: Page) => panel(page).getByRole("group", { name: "Voice candidate", exact: true });
const collectionChoices = (page: Page) => panel(page).getByRole("group", { name: "Voice collection", exact: true });
const scriptSelect = (page: Page) => panel(page).getByRole("combobox", { name: "Speech example", exact: true });
const playVoice = (page: Page) => panel(page).getByRole("button", { name: "Play voice", exact: true });
const speechEvents = (page: Page, type: string) => page.locator(`[data-bus="speech"][data-event-type="${type}"]`);

async function captureNativeStarts(page: Page) {
  await page.addInitScript(() => {
    const starts: number[] = [];
    const peaks: number[] = [];
    Object.assign(window, { __walterSourceStarts: starts, __walterSourcePeaks: peaks });
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (when?, offset?, duration?) {
      if (duration === undefined) start.call(this, when ?? 0, offset ?? 0);
      else start.call(this, when ?? 0, offset ?? 0, duration);
      starts.push(this.buffer?.duration ?? 0);
      const samples = this.buffer?.getChannelData(0);
      let peak = 0;
      if (samples) {
        const stride = Math.max(1, Math.floor(samples.length / 8000));
        for (let index = 0; index < samples.length; index += stride) peak = Math.max(peak, Math.abs(samples[index]));
      }
      peaks.push(peak);
    };
  });
}

async function nativeStarts(page: Page) {
  return page.evaluate(() => [...(window as unknown as { __walterSourceStarts: number[] }).__walterSourceStarts]);
}

async function setVisibility(page: Page, value: "hidden" | "visible") {
  await page.evaluate(state => {
    Object.defineProperty(document, "visibilityState", { value: state, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  }, value);
}

async function observeNextDecode(page: Page) {
  await page.evaluate(() => {
    let finished!: (error?: string) => void;
    const decoded = new Promise<string | undefined>(resolve => { finished = resolve; });
    Object.assign(window, { __walterDecoded: decoded });
    const decode = BaseAudioContext.prototype.decodeAudioData;
    BaseAudioContext.prototype.decodeAudioData = function (bytes, success, failure) {
      const result = decode.call(this, bytes, success, failure);
      void result.then(() => finished(), error => finished(String(error)));
      return result;
    };
  });
}

async function waitForNativeDecode(page: Page) {
  const error = await page.evaluate(async () => {
    const result = await (window as unknown as { __walterDecoded: Promise<string | undefined> }).__walterDecoded;
    await Promise.resolve();
    await Promise.resolve();
    return result;
  });
  expect(error).toBeUndefined();
}

test("Walter starts neutral and silent with complete local recordings for every collection", async ({ page }) => {
  const requests: string[] = [];
  const errors: string[] = [];
  page.on("request", request => requests.push(request.url()));
  page.on("pageerror", error => errors.push(error.message));
  await captureNativeStarts(page);
  await page.goto("/");
  await expect(panel(page)).toBeVisible();
  await expect(panel(page).locator('[data-coach="classic"]')).toHaveAttribute("data-requested", "neutral");
  await expect(panel(page)).toHaveAttribute("data-playback", "idle");
  expect(walterVoices.map(voice => voice.id)).toEqual(expect.arrayContaining(["custom-1", "custom-2", "custom-3", "a", "b", "c"]));
  expect(walterScripts.map(script => script.id)).toEqual(expect.arrayContaining(["voice-design-preview", "only-defense", "abandoned-defender", "allowed-mate", "fork"]));
  expect(walterClips.map(clip => `${clip.voiceId}:${clip.scriptId}`).sort())
    .toEqual(walterCollections.flatMap(collection => collection.voiceIds.flatMap(voiceId => collection.scriptIds.map(scriptId => `${voiceId}:${scriptId}`))).sort());
  expect(walterCollections[0].label).toBe("Walter refinements");
  expect(walterCollections[0].voiceIds).toEqual(["warm-1", "warm-2", "warm-3", "playful-1", "playful-2", "playful-3"]);
  expect(walterCollections[0].scriptIds).toEqual(["short-defense"]);
  expect(walterScripts[0].spokenText).toHaveLength(140);
  await expect(collectionChoices(page).getByRole("button", { name: walterCollections[0].label, exact: true })).toHaveAttribute("aria-pressed", "true");
  expect(requests.filter(url => recordingPattern.test(url) || url.endsWith(".wav"))).toEqual([]);
  expect(await nativeStarts(page)).toEqual([]);

  let played = 0;
  await panel(page).locator(".walter-audition-source summary").click();
  for (const collection of walterCollections) {
    await collectionChoices(page).getByRole("button", { name: collection.label, exact: true }).click();
    for (const voiceId of collection.voiceIds) {
      const voice = walterVoices.find(item => item.id === voiceId)!;
      await voiceChoices(page).getByRole("button", { name: voice.name, exact: true }).click();
      await expect(panel(page).locator(".walter-audition-source")).toContainText(`${voice.sourceName} · Model ${voice.modelId ?? "provider-selected (Voice Remix)"}`);
      for (const scriptId of collection.scriptIds) {
        const script = walterScripts.find(item => item.id === scriptId)!;
        if (collection.scriptIds.length > 1) await scriptSelect(page).selectOption(script.id);
        else await expect(scriptSelect(page)).toHaveCount(0);
        await expect(panel(page).getByLabel("Coach explanation", { exact: true })).toHaveText(script.writtenText);
        if (script.spokenText === script.writtenText) {
          await expect(panel(page).getByText(script.spokenText, { exact: true })).toHaveCount(1);
          await expect(panel(page).locator(".walter-audition-transcript")).toHaveCount(0);
        } else {
          await expect(panel(page).locator(".walter-audition-transcript p")).toHaveText(script.spokenText);
        }
        await playVoice(page).click();
        await expect(panel(page)).toHaveAttribute("data-playback", "playing");
        await expect(panel(page).locator('[data-coach="classic"]')).toHaveAttribute("data-requested", script.reaction);
        await expect.poll(() => nativeStarts(page)).toHaveLength(++played);
        await page.getByRole("button", { name: "Stop all", exact: true }).click();
        await expect(panel(page)).toHaveAttribute("data-playback", "idle");
        await expect(panel(page).locator('[data-coach="classic"]')).toHaveAttribute("data-requested", "neutral");
      }
    }
  }
  expect(new Set(requests.filter(url => recordingPattern.test(url))).size).toBe(walterClips.length);
  expect((await nativeStarts(page)).every(duration => Number.isFinite(duration) && duration > 0)).toBe(true);
  expect(await page.evaluate(() => (window as unknown as { __walterSourcePeaks: number[] }).__walterSourcePeaks.every(peak => Number.isFinite(peak) && peak > 0))).toBe(true);
  const origin = new URL(page.url()).origin;
  expect(requests.filter(url => new URL(url).origin !== origin || new URL(url).pathname.startsWith("/api/"))).toEqual([]);
  expect(errors).toEqual([]);
});

test("voice controls leave all browser preferences unchanged", async ({ page }) => {
  const stored = {
    "fieldwork.audio-studio.picks.v2": JSON.stringify({ retry: "retry-muted-tongue" }),
    "owner-preference": "keep-me",
  };
  await page.addInitScript(values => {
    for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value);
  }, stored);
  await page.goto("/");
  await voiceChoices(page).getByRole("button", { name: walterVoices[1].name, exact: true }).click();
  await collectionChoices(page).getByRole("button", { name: "Original voices", exact: true }).click();
  await scriptSelect(page).selectOption("fork");
  await playVoice(page).click();
  await expect(panel(page)).toHaveAttribute("data-playback", "playing");
  await page.getByRole("button", { name: "Mute audio", exact: true }).click();
  await page.getByRole("slider", { name: "Volume", exact: true }).press("Home");
  expect(await page.evaluate(() => ({ ...localStorage }))).toEqual(stored);
  await page.reload();
  await expect(voiceChoices(page).getByRole("button", { name: walterVoices[0].name, exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(scriptSelect(page)).toHaveCount(0);
  await expect(panel(page).getByLabel("Coach explanation", { exact: true })).toHaveText(walterScripts[0].writtenText);
  await expect(panel(page)).toHaveAttribute("data-playback", "idle");
  expect(await page.evaluate(() => ({ ...localStorage }))).toEqual(stored);
});

test("In context plays the approved move before speech and waits 350 milliseconds", async ({ page }) => {
  const recordings: string[] = [];
  page.on("request", request => { if (recordingPattern.test(request.url())) recordings.push(request.url()); });
  await captureNativeStarts(page);
  await page.clock.install({ time: new Date("2026-01-01T12:00:00Z") });
  await page.goto("/");
  await page.clock.pauseAt(new Date("2026-01-01T12:00:01Z"));
  await panel(page).getByRole("button", { name: "In context", exact: true }).click();
  await expect(page.locator('[data-event-type="started"][data-cue="move"]')).toHaveCount(1);
  await expect(speechEvents(page, "started")).toHaveCount(0);
  await page.clock.runFor(349);
  expect(recordings).toEqual([]);
  await expect(speechEvents(page, "started")).toHaveCount(0);
  await page.clock.runFor(1);
  await expect(speechEvents(page, "started")).toHaveCount(1);
  expect(await page.locator('[data-event-type="started"]').evaluateAll(events => events.map(event => event.getAttribute("data-bus")).reverse()))
    .toEqual(["effects", "speech"]);
  expect(await nativeStarts(page)).toHaveLength(2);
});

for (const outcome of ["played", "cancelled", "failed"] as const) {
  test(`cached speech waits for a cold move that is ${outcome}`, async ({ page }) => {
    let release!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    let requested!: () => void;
    const moveRequested = new Promise<void>(resolve => { requested = resolve; });
    await page.route(/\/move(?:-[\w-]+)?\.wav$/, async route => {
      requested();
      await held;
      if (outcome === "failed") await route.fulfill({ status: 503, body: "Recording unavailable" });
      else await route.continue();
    }, { times: 1 });
    await captureNativeStarts(page);
    await page.clock.install({ time: new Date("2026-01-01T12:00:00Z") });
    try {
      await page.goto("/");
      await page.clock.pauseAt(new Date("2026-01-01T12:00:01Z"));
      await playVoice(page).click();
      await expect(speechEvents(page, "started")).toHaveCount(1);
      await page.getByRole("button", { name: "Stop all", exact: true }).click();
      await observeNextDecode(page);
      await panel(page).getByRole("button", { name: "In context", exact: true }).click();
      await moveRequested;
      await page.clock.runFor(1000);
      await expect(speechEvents(page, "started")).toHaveCount(1);
      expect(await nativeStarts(page)).toHaveLength(1);
      if (outcome === "cancelled") await page.getByRole("button", { name: "Stop all", exact: true }).click();
      release();
      if (outcome === "failed") {
        await expect(page.locator('[data-event-type="error"][data-cue="move"]')).toHaveCount(1);
        await expect(page.getByRole("alert")).toContainText("This sound could not play");
      } else await waitForNativeDecode(page);
      if (outcome === "played") {
        await expect(page.locator('[data-event-type="started"][data-cue="move"]')).toHaveCount(1);
        await page.clock.runFor(349);
        await expect(speechEvents(page, "started")).toHaveCount(1);
        await page.clock.runFor(1);
        await expect(speechEvents(page, "started")).toHaveCount(2);
        expect(await nativeStarts(page)).toHaveLength(3);
      } else {
        await page.clock.runFor(1000);
        await expect(speechEvents(page, "started")).toHaveCount(1);
        await expect(panel(page)).toHaveAttribute("data-playback", "idle");
        expect(await nativeStarts(page)).toHaveLength(1);
      }
    } finally {
      release();
      await page.unrouteAll({ behavior: "wait" });
    }
  });
}

test("a suppressed context move never queues Walter's speech", async ({ page }) => {
  await captureNativeStarts(page);
  await page.clock.install({ time: new Date("2026-01-01T12:00:00Z") });
  await page.goto("/");
  await page.clock.pauseAt(new Date("2026-01-01T12:00:01Z"));
  await page.getByRole("button", { name: "Mute audio", exact: true }).click();
  await panel(page).getByRole("button", { name: "In context", exact: true }).click();
  await expect(page.locator('[data-event-type="suppressed"][data-cue="move"][data-reason="muted"]')).toHaveCount(1);
  await page.getByRole("button", { name: "Unmute audio", exact: true }).click();
  await page.clock.runFor(1000);
  await expect(speechEvents(page, "started")).toHaveCount(0);
  await expect(panel(page)).toHaveAttribute("data-playback", "idle");
  expect(await nativeStarts(page)).toEqual([]);
});

for (const interruption of ["voice", "collection", "script", "stop", "mute", "hidden", "zero-volume"] as const) {
  test(`${interruption} cancels a voice recording still loading without stale playback`, async ({ page }) => {
    let release!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    let requested!: () => void;
    const requestedRecording = new Promise<void>(resolve => { requested = resolve; });
    await page.route(recordingPattern, async route => {
      requested();
      await held;
      await route.continue();
    }, { times: 1 });
    await captureNativeStarts(page);
    try {
      await page.goto("/");
      if (interruption === "script") await collectionChoices(page).getByRole("button", { name: "Original voices", exact: true }).click();
      // Match the application tests: wait for the native decoder, not just HTTP
      // completion, before proving that cancelled speech cannot start late.
      await observeNextDecode(page);
      await playVoice(page).click();
      await requestedRecording;
      await expect(panel(page)).toHaveAttribute("data-playback", "loading");
      if (interruption === "voice") await voiceChoices(page).getByRole("button", { name: walterVoices[1].name, exact: true }).click();
      if (interruption === "collection") await collectionChoices(page).getByRole("button", { name: "Original voices", exact: true }).click();
      if (interruption === "script") await scriptSelect(page).selectOption("fork");
      if (interruption === "stop") await page.getByRole("button", { name: "Stop all", exact: true }).click();
      if (interruption === "mute") await page.getByRole("button", { name: "Mute audio", exact: true }).click();
      if (interruption === "hidden") await setVisibility(page, "hidden");
      if (interruption === "zero-volume") await page.getByRole("slider", { name: "Volume", exact: true }).press("Home");
      const reason = interruption === "mute" ? "muted" : interruption === "hidden" ? "hidden" : "stopped";
      await expect(speechEvents(page, "cancelled")).toHaveAttribute("data-reason", reason);
      await expect(panel(page)).toHaveAttribute("data-playback", "idle");
      if (interruption === "mute") await page.getByRole("button", { name: "Unmute audio", exact: true }).click();
      if (interruption === "hidden") await setVisibility(page, "visible");
      if (interruption === "zero-volume") await page.getByRole("slider", { name: "Volume", exact: true }).press("End");
      release();
      await waitForNativeDecode(page);
      expect(await nativeStarts(page)).toEqual([]);
      await expect(speechEvents(page, "started")).toHaveCount(0);
      await expect(panel(page).locator('[data-coach="classic"]')).toHaveAttribute("data-requested", "neutral");
      // A fresh explicit request still works after the old one was dropped.
      await playVoice(page).click();
      await expect(panel(page)).toHaveAttribute("data-playback", "playing");
      await expect.poll(() => nativeStarts(page)).toHaveLength(1);
    } finally {
      release();
      await page.unrouteAll({ behavior: "wait" });
    }
  });
}

test("changing voices cancels active speech and does not auto-play the next candidate", async ({ page }) => {
  await captureNativeStarts(page);
  await page.goto("/");
  await playVoice(page).click();
  await expect(panel(page)).toHaveAttribute("data-playback", "playing");
  await voiceChoices(page).getByRole("button", { name: walterVoices[1].name, exact: true }).click();
  await expect(speechEvents(page, "cancelled")).toHaveAttribute("data-reason", "stopped");
  await expect(panel(page)).toHaveAttribute("data-playback", "idle");
  expect(await nativeStarts(page)).toHaveLength(1);
  await playVoice(page).click();
  await expect(panel(page)).toHaveAttribute("data-playback", "playing");
  await expect.poll(() => nativeStarts(page)).toHaveLength(2);
});

test("collection changes cancel speech and select only valid voice and script pairs", async ({ page }) => {
  await captureNativeStarts(page);
  await page.goto("/");
  await voiceChoices(page).getByRole("button", { name: walterVoices[1].name, exact: true }).click();
  await playVoice(page).click();
  await expect(panel(page)).toHaveAttribute("data-playback", "playing");
  await collectionChoices(page).getByRole("button", { name: "Original voices", exact: true }).click();
  await expect(speechEvents(page, "cancelled")).toHaveCount(1);
  await expect(panel(page)).toHaveAttribute("data-playback", "idle");
  await expect(voiceChoices(page).getByRole("button", { name: "A · Bill", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(scriptSelect(page)).toHaveValue("only-defense");
  await expect(scriptSelect(page).locator("option")).toHaveCount(4);
  expect(await nativeStarts(page)).toHaveLength(1);
  await scriptSelect(page).selectOption("fork");
  await playVoice(page).click();
  await expect(panel(page)).toHaveAttribute("data-playback", "playing");
  await collectionChoices(page).getByRole("button", { name: "Custom Walter", exact: true }).click();
  await expect(speechEvents(page, "cancelled")).toHaveCount(2);
  await expect(panel(page)).toHaveAttribute("data-playback", "idle");
  await expect(voiceChoices(page).getByRole("button", { name: "Preview 1", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(voiceChoices(page).getByRole("button")).toHaveText(["Preview 1", "Preview 2", "Preview 3"]);
  await expect(scriptSelect(page)).toHaveCount(0);
  await expect(panel(page).getByLabel("Coach explanation", { exact: true })).toHaveText(walterScripts.find(script => script.id === "voice-design-preview")!.writtenText);
  expect(await nativeStarts(page)).toHaveLength(2);
});

test("Walter's selectors and preview fit a 320-pixel phone without changing shared controls", async ({ page }, info) => {
  await page.goto("/");
  if (info.project.name === "mobile") await page.setViewportSize({ width: 320, height: 780 });
  await expect(panel(page)).toBeVisible();
  await expect(panel(page).getByRole("img", { name: "Walter, voice preview", exact: true })).toBeVisible();
  await expect(playVoice(page)).toBeEnabled();
  await panel(page).locator(".walter-audition-source summary").click();
  await expect(panel(page).locator(".walter-audition-source")).toContainText(`Model ${walterVoices[0].modelId ?? "provider-selected (Voice Remix)"}`);
  await expect(panel(page).getByRole("link", { name: "Voice provider", exact: true })).toHaveAttribute("href", "https://elevenlabs.io/text-to-speech");
  await panel(page).locator(".walter-audition-source summary").click();
  await collectionChoices(page).getByRole("button", { name: "Custom Walter", exact: true }).click();
  const message = panel(page).getByLabel("Coach explanation", { exact: true });
  const scrolled = await message.evaluate(element => {
    element.scrollTop = element.scrollHeight;
    return { top: element.scrollTop, height: element.clientHeight, content: element.scrollHeight };
  });
  expect(scrolled.top).toBeGreaterThan(0);
  expect(scrolled.top + scrolled.height).toBeGreaterThanOrEqual(scrolled.content - 1);
  await expect(message).toContainText("Follow the line and watch for the moment those attacks come together.");
  await message.evaluate(element => { element.scrollTop = 0; });
  await collectionChoices(page).getByRole("button", { name: walterCollections[0].label, exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (info.project.name === "mobile") {
    const heights = await panel(page).locator("button, select").evaluateAll(controls => controls.map(control => control.getBoundingClientRect().height));
    expect(heights.every(height => height >= 44)).toBe(true);
  }
  await page.screenshot({ path: info.outputPath("walter-audition.png"), fullPage: true });
  await panel(page).screenshot({ path: info.outputPath("walter-panel.png") });
});
