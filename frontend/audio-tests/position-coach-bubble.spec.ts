import {expect, test, type Page} from "@playwright/test";
import path from "node:path";
import {defaultAudioPreferences, type AudioPreferences} from "../src/audio/model";
import type {Game} from "../src/gameReview/types";
import arjun from "../src/audio/speech/banks/arjun/manifest.json" with {type: "json"};
import alfie from "../src/audio/speech/banks/alfie/scripts.json" with {type: "json"};
import {viteFsPath} from "../studio-tests/helpers/viteFsPath";
import {semanticFixtures} from "../tests/semantic-fixtures";
import {openAudioFixturePage} from "./fixtures/openAudioFixture";
import type {PositionCoachSpeechHarness, PositionCoachSpeechState} from "./fixtures/positionCoachSpeechRuntime";

// The bubble shows what the coach says (owner decision): the coach's own
// spoken line for the selected meaning, with the real moves on a line beneath.
type HarnessWindow = Window & {positionCoachSpeech: PositionCoachSpeechHarness};
const games = semanticFixtures<Record<string, Game>>("review_speech_combination_fixtures.py");
const region = (page: Page) => page.getByRole("region", {name: "Chess coach", exact: true});
const bubble = (page: Page) => region(page).getByLabel("Coach explanation", {exact: true}).locator("[data-utterance]");
const movesLine = (page: Page) => region(page).locator(".coach-moves-line");
// The visible line, without the moves announced alongside it for screen readers.
const shown = (page: Page) => bubble(page).evaluate(element => element.firstChild?.textContent);
const line = (rows: {id: string; text: string}[], id: string) =>
  id.split("+").map(part => rows.find(row => row.id === part)!.text).join(" ");

async function state(page: Page): Promise<PositionCoachSpeechState> {
  return JSON.parse((await page.getByTestId("position-coach-speech-state").textContent())!);
}

async function mount(page: Page, coachId: string, game: Game, audio: Partial<AudioPreferences> = {}) {
  await page.route("**/api/preferences/audio", route => route.fulfill({json: {...defaultAudioPreferences, ...audio}}));
  await page.route("**/api/preferences/coach", route => route.fulfill({json: {coach_id: coachId, motion: "natural"}}));
  await openAudioFixturePage(page);
  await page.evaluate(async ({root, game}) => {
    const {mountPositionCoachSpeech} = await import(`${root}/audio-tests/fixtures/positionCoachSpeechRuntime.tsx`);
    (window as unknown as HarnessWindow).positionCoachSpeech = mountPositionCoachSpeech(game);
  }, {root: viteFsPath(path.resolve(".")), game});
  await expect.poll(() => state(page).then(value => value.ready && value.coachId)).toBe(coachId);
}

test("a recorded coach's bubble shows its recorded line, and Maia's popup keeps the written sentence", async ({page}) => {
  await mount(page, "man-partner", games["cause-abandoned_defender-white"]);
  const current = await state(page);
  await expect(bubble(page)).toHaveAttribute("data-spoken", /^cause-abandoned-defender(?:\+[a-z0-9-]+)?$/);
  const spoken = (await bubble(page).getAttribute("data-spoken"))!;
  await expect.poll(() => shown(page)).toBe(line(arjun.recordings, spoken));
  // Selection still validates the written utterance; only the displayed text changes.
  await expect(bubble(page)).toHaveAttribute("data-utterance", current.utteranceId);
  expect(current.utteranceText).not.toBe(line(arjun.recordings, spoken));
  await expect(movesLine(page)).toHaveText("Black’s strongest reply: Qxa1+");
  await expect(movesLine(page).locator("strong")).toHaveText("Qxa1+");
  // The written Maia sentence left the bubble but stays one tap away.
  expect(current.humanText).toBeTruthy();
  await expect(bubble(page)).not.toContainText(current.humanText);
  await region(page).getByRole("button", {name: "Maia: Natural mistake", exact: true}).click();
  const dialog = page.getByRole("dialog", {name: "Maia insight", exact: true});
  await expect(dialog.locator("[data-utterance]")).toHaveText(current.humanText);
  await expect(dialog.locator("[data-utterance]")).toHaveAttribute("data-utterance", current.humanUtteranceId);
});

test("a text-only coach's bubble shows its script line for the same meaning, with voice off", async ({page}) => {
  await mount(page, "dog-gentle", games["allowed-mate-natural"], {voice: "off"});
  // The book claim's recognition joins the mate line as the coach's second sentence.
  await expect(bubble(page)).toHaveAttribute("data-spoken", /^allowed-mate(?:\+[a-z0-9-]+)?$/);
  const spoken = (await bubble(page).getAttribute("data-spoken"))!;
  await expect.poll(() => shown(page)).toBe(line(alfie.records, spoken));
  await expect(region(page).getByRole("button", {name: /^Listen/})).toHaveCount(0);
  // The mate claim proves the qualifier; the opening has no name, so no opening appears.
  await expect(movesLine(page)).toHaveText("Black’s strongest reply: Qh4#, forced mate");
  await expect(movesLine(page).locator("strong")).toHaveText("Qh4#");
});

test("without a spoken meaning the bubble keeps its written text and shows no moves line", async ({page}) => {
  // A bubble whose only claim is a Maia reading has no spoken line.
  await mount(page, "man-partner", games["human-without-objective"]);
  const current = await state(page);
  await expect(bubble(page)).toHaveText(current.utteranceText);
  await expect(bubble(page)).not.toHaveAttribute("data-spoken", /./);
  await expect(movesLine(page)).toHaveCount(0);
});

test("a long moves line wraps inside the bubble beside the Maia chip, never squeezing the line below two lines", async ({page}) => {
  const game = structuredClone(games["cause-abandoned_defender-white"]);
  // One of the longest catalogue names.
  game.frames[1].report!.opening = {version: "layout-fixture", eco: "D49",
    name: "Queen's Gambit Declined: Semi-Slav Defense, Meran Variation, Blumenfeld Variation, Rabinovich Variation"};
  await mount(page, "man-partner", game);
  await expect(bubble(page)).toHaveAttribute("data-spoken", /./);
  await expect(movesLine(page)).toHaveText(`${game.frames[1].report!.opening!.name} · Black’s strongest reply: Qxa1+`);
  const layout = await region(page).evaluate(element => {
    const box = (selector: string) => element.querySelector(selector)!.getBoundingClientRect();
    const moves = element.querySelector(".coach-moves-line")!, style = getComputedStyle(moves);
    const message = element.querySelector(".coach-message")!;
    return {speech: box(".coach-speech"), message: box(".coach-message"), moves: box(".coach-moves-line"),
      messageLine: parseFloat(getComputedStyle(message.querySelector("p")!).lineHeight),
      chip: box(".human-insight-trigger"), lineHeight: parseFloat(style.lineHeight),
      overflow: moves.scrollWidth - moves.clientWidth, ellipsis: style.textOverflow, whiteSpace: style.whiteSpace};
  });
  // Wrapped at phone width, never clipped or ellipsized, and outside the scrolling message.
  if (test.info().project.name === "mobile") expect(layout.moves.height).toBeGreaterThan(layout.lineHeight * 1.5);
  expect(layout.overflow).toBeLessThanOrEqual(0);
  expect(layout.ellipsis).not.toBe("ellipsis");
  expect(layout.whiteSpace).not.toBe("nowrap");
  expect(layout.moves.top).toBeGreaterThanOrEqual(layout.message.bottom - 0.5);
  expect(layout.message.height).toBeGreaterThanOrEqual(layout.messageLine * 2 - 0.5);
  for (const item of [layout.moves, layout.chip]) {
    expect(item.left).toBeGreaterThanOrEqual(layout.speech.left);
    expect(item.right).toBeLessThanOrEqual(layout.speech.right + 0.5);
    expect(item.bottom).toBeLessThanOrEqual(layout.speech.bottom + 0.5);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await region(page).screenshot({path: `audio-test-results/coach-moves-line-${test.info().project.name}.png`});
});

test("the moves line names the engine's strongest reply, never the move actually played next", async ({page}) => {
  const game = structuredClone(games["allowed-mate-natural"]);
  // The game went on with a different move than the engine's mating reply.
  game.frames.push({...game.frames[1], san: "Nc6", uci: "b8c6", actor: "black", turn: "white", report: null});
  await mount(page, "man-partner", game);
  await expect(movesLine(page)).toHaveText("Black’s strongest reply: Qh4#, forced mate");
  await expect(movesLine(page)).not.toContainText(/\breplie[sd]\b|\bplayed\b|Nc6/);
  // Supplementary text: the bubble's line is the one announcement for this move.
  await expect(movesLine(page)).not.toHaveAttribute("aria-live", /polite|assertive/);
  await expect(region(page).locator(".coach-moves-line[aria-live], .coach-moves-line [aria-live]")).toHaveCount(0);
  await expect(region(page).locator(".coach-message [aria-live=polite]")).toHaveCount(1);
  // Screen reader users hear the concrete reply once, inside that announcement.
  await expect(movesLine(page)).toHaveAttribute("aria-hidden", "true");
  await expect(region(page).locator(".coach-message [aria-live=polite] .sr-only"))
    .toHaveText(" Black’s strongest reply: Qh4#, forced mate.");
});

test("the bubble grows to show a joined spoken line and its footer without inner scrolling, up to its cap", async ({page}) => {
  // Arjun's joined pair plus the moves line and Maia chip: the shared minimum height scrolls it.
  await mount(page, "man-partner", games["cause-abandoned_defender-white"]);
  await expect(bubble(page)).toHaveAttribute("data-spoken", /\+/);
  const layout = await region(page).evaluate(element => {
    const speech = element.querySelector<HTMLElement>(".coach-speech")!, message = element.querySelector<HTMLElement>(".coach-message")!;
    const style = getComputedStyle(speech);
    return {height: speech.offsetHeight, min: parseFloat(style.minHeight), max: parseFloat(style.maxHeight),
      overflow: message.scrollHeight - message.clientHeight};
  });
  const desktop = test.info().project.name === "desktop";
  expect(layout.min).toBe(desktop ? 136 : 156);
  expect(layout.max).toBe(desktop ? 240 : 256);
  // The wide desktop harness fits it at the minimum; a phone needs the extra height.
  if (desktop) expect(layout.height).toBeGreaterThanOrEqual(layout.min);
  else expect(layout.height).toBeGreaterThan(layout.min);
  expect(layout.height).toBeLessThanOrEqual(layout.max);
  expect(layout.overflow).toBeLessThanOrEqual(1);
});
