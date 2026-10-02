import {expect, test, type Page} from "@playwright/test";
import path from "node:path";
import type {AudioPreferences} from "../src/audio/model";
import {defaultAudioPreferences} from "../src/audio/model";
import {viteFsPath} from "../studio-tests/helpers/viteFsPath";

type Harness = {changePosition: () => void; stalePlay: () => void; unmount: () => void; starts: () => number};
type HarnessWindow = Window & {providerHarness: Harness};

async function mountProvider(page: Page) {
  let preferences: AudioPreferences = {...defaultAudioPreferences, voice: "manual"};
  await page.route("**/api/preferences/audio", route => {
    if (route.request().method() === "PUT") preferences = route.request().postDataJSON();
    return route.fulfill({json: preferences});
  });
  await page.goto("/");
  await page.evaluate(async root => {
    const {React, createRoot} = await import(`${root}/studio-tests/fixtures/runtime.ts`);
    const {AudioProvider, useAudioPreferences, useScopedSpeech, useCurrentSpeechPlayback, AudioSettings} = await import(`${root}/audio-tests/fixtures/speechRuntime.ts`);
    const {makeIntent, claim} = await import(`${root}/src/dialogue/model.ts`);
    const {renderNeutral} = await import(`${root}/src/dialogue/neutral.ts`);
    const {default: url} = await import(`${root}/src/audio/speech/recordings/walter-contrasts-v1/walter/sound-sacrifice.opus?url`);
    const utterance = {...renderNeutral(makeIntent("provider-test", "good", "game", "good", [claim("good")])), coachId: "classic"};
    const container = document.createElement("div");
    container.id = "speech-provider-harness";
    container.style.cssText = "position:fixed;inset:10px;background:#fff;color:#000;z-index:9999";
    document.body.append(container);
    const mounted = createRoot(container);
    let position = "first", sequence = 0, starts = 0;
    let stalePlay: (() => void) | undefined;
    const originalStart = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args) { starts++; return originalStart.apply(this, args); };
    function Player({name}: {name: string}) {
      const voice = useScopedSpeech(`${name}:${position}`);
      const state = useAudioPreferences();
      React.useEffect(() => {
        if (name === "left" && position === "first" && !stalePlay) stalePlay = () => voice.play({url, utterance, eventId: `stale:${++sequence}`});
      }, [voice.play]);
      return React.createElement("section", {"aria-label": name},
        React.createElement("output", {"data-testid": `${name}-state`}, `${position}:${state.ready ? "ready" : "loading"}:${voice.playback?.eventId ?? "silent"}`),
        React.createElement("button", {disabled: !state.ready, onClick: async () => {
          await voice.unlock(); voice.play({url, utterance, eventId: `${name}:${++sequence}`});
        }}, `Speak ${name}`),
        React.createElement("button", {onClick: voice.cancel}, `Stop ${name}`),
        name === "left" && React.createElement("button", {onClick: () => void state.save({...state.preferences, voice: "off"})}, "Voice off"));
    }
    function Portrait() {
      const speech = useCurrentSpeechPlayback();
      return React.createElement("output", {"data-testid": "portrait-speech"}, speech?.eventId ?? "silent");
    }
    const render = () => mounted.render(React.createElement(AudioProvider, null,
      React.createElement(Player, {name: "left"}), React.createElement(Player, {name: "right"}),
      React.createElement(AudioSettings), React.createElement(Portrait)));
    (window as unknown as HarnessWindow).providerHarness = {
      changePosition: () => {position = position === "first" ? "second" : "first"; render();},
      stalePlay: () => stalePlay?.(),
      unmount: () => {mounted.unmount(); container.remove();},
      starts: () => starts,
    };
    render();
  }, viteFsPath(path.resolve(".")));
  await expect(page.getByTestId("left-state")).toHaveText("first:ready:silent");
}

test("shared provider publishes speech only to its owning scope and voice Off clears playback", async ({page}) => {
  await mountProvider(page);
  await page.getByRole("button", {name: "Speak left", exact: true}).click();
  await expect(page.getByTestId("left-state")).toHaveText("first:ready:left:1");
  await expect(page.getByTestId("right-state")).toHaveText("first:ready:silent");
  await expect(page.getByTestId("portrait-speech")).toHaveText("left:1");
  await page.getByRole("button", {name: "Voice off", exact: true}).click();
  await expect(page.getByTestId("left-state")).toHaveText("first:ready:silent");
  await expect(page.getByTestId("portrait-speech")).toHaveText("silent");
  const starts = await page.evaluate(() => (window as unknown as HarnessWindow).providerHarness.starts());
  await page.getByRole("button", {name: "Speak right", exact: true}).click();
  expect(await page.evaluate(() => (window as unknown as HarnessWindow).providerHarness.starts())).toBe(starts);
});

test("changing position cancels a voice and retained scope callbacks cannot restart it", async ({page}) => {
  await mountProvider(page);
  await page.getByRole("button", {name: "Speak left", exact: true}).click();
  await expect(page.getByTestId("left-state")).toHaveText("first:ready:left:1");
  await page.evaluate(() => (window as unknown as HarnessWindow).providerHarness.changePosition());
  await expect(page.getByTestId("left-state")).toHaveText("second:ready:silent");
  await page.evaluate(() => (window as unknown as HarnessWindow).providerHarness.stalePlay());
  expect(await page.evaluate(() => (window as unknown as HarnessWindow).providerHarness.starts())).toBe(1);
  await page.evaluate(() => (window as unknown as HarnessWindow).providerHarness.changePosition());
  await expect(page.getByTestId("left-state")).toHaveText("first:ready:silent");
  await page.evaluate(() => (window as unknown as HarnessWindow).providerHarness.stalePlay());
  expect(await page.evaluate(() => (window as unknown as HarnessWindow).providerHarness.starts())).toBe(1);
  await page.getByRole("button", {name: "Speak right", exact: true}).click();
  await expect(page.getByTestId("right-state")).toHaveText("first:ready:right:4");
  await page.evaluate(() => (window as unknown as HarnessWindow).providerHarness.unmount());
  await page.evaluate(() => (window as unknown as HarnessWindow).providerHarness.stalePlay());
  expect(await page.evaluate(() => (window as unknown as HarnessWindow).providerHarness.starts())).toBe(2);
});

test("voice settings save the selected policy and preserve independent sound controls", async ({page}) => {
  await mountProvider(page);
  const settings = page.getByRole("region", {name: "Sound", exact: true});
  const voice = settings.getByRole("combobox", {name: "Coach voice", exact: true});
  await expect(voice).toHaveValue("manual");
  const saved = page.waitForResponse(response => response.url().endsWith("/api/preferences/audio") && response.request().method() === "PUT");
  await voice.selectOption("automatic");
  expect(await (await saved).json()).toEqual({...defaultAudioPreferences, voice: "automatic"});
  await expect(voice).toBeEnabled();
  await expect(voice).toHaveValue("automatic");
  const disabled = page.waitForResponse(response => response.url().endsWith("/api/preferences/audio") && response.request().method() === "PUT");
  await settings.getByRole("checkbox", {name: "Enable sound", exact: true}).uncheck();
  await expect(voice).toBeDisabled();
  await expect(settings.locator(".preference-status")).toHaveAttribute("data-state", "saved");
  await expect(settings.getByRole("checkbox", {name: /^Board moves/})).toBeChecked();
  await expect(settings.getByRole("checkbox", {name: /^Practice feedback/})).toBeChecked();
  const stored = await (await disabled).json();
  expect(stored).toEqual({...defaultAudioPreferences, enabled: false, voice: "automatic"});
});
