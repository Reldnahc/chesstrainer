import { expect, test, type Page } from "../tests/helpers/browserTest";
import path from "node:path";
import { defaultAudioPreferences } from "../src/audio/model";
import type { Game } from "../src/gameReview/types";
import { viteFsPath } from "../studio-tests/helpers/viteFsPath";
import { semanticFixtures } from "../tests/semantic-fixtures";
import { openAudioFixturePage } from "./fixtures/openAudioFixture";
import type {
  PositionCoachSpeechHarness,
  PositionCoachSpeechState,
} from "./fixtures/positionCoachSpeechRuntime";

// The bubble shows what the coach says (owner decision): the coach's own
// spoken line for the selected meaning. The footer keeps the opening name and the
// engine's strongest reply sits under Best beside the portrait.
type HarnessWindow = Window & { positionCoachSpeech: PositionCoachSpeechHarness };
const games = semanticFixtures<Record<string, Game>>("review_speech_combination_fixtures.py");
const region = (page: Page) => page.getByRole("region", { name: "Chess coach", exact: true });
const bubble = (page: Page) =>
  region(page).getByLabel("Coach explanation", { exact: true }).locator("[data-utterance]");
const movesLine = (page: Page) => region(page).locator(".coach-moves-line");
const reply = (page: Page) => region(page).locator(".coach-best-reply");

async function state(page: Page): Promise<PositionCoachSpeechState> {
  return JSON.parse((await page.getByTestId("position-coach-speech-state").textContent())!);
}

async function mount(page: Page, coachId: string, game: Game) {
  await page.route("**/api/preferences/audio", route =>
    route.fulfill({ json: defaultAudioPreferences }),
  );
  await page.route("**/api/preferences/coach", route =>
    route.fulfill({ json: { coach_id: coachId, motion: "natural" } }),
  );
  await openAudioFixturePage(page);
  await page.evaluate(
    async ({ root, game }) => {
      const { mountPositionCoachSpeech } = await import(
        `${root}/audio-tests/fixtures/positionCoachSpeechRuntime.tsx`
      );
      (window as unknown as HarnessWindow).positionCoachSpeech = mountPositionCoachSpeech(game);
    },
    { root: viteFsPath(path.resolve(".")), game },
  );
  await expect.poll(() => state(page).then(value => value.ready && value.coachId)).toBe(coachId);
}

test("without a spoken meaning the bubble keeps its written text and shows no moves line", async ({
  page,
}) => {
  // A legacy report without review semantics has no spoken line.
  const legacy = structuredClone(games["human-without-objective"]);
  legacy.frames[1].report!.intelligence = null;
  await mount(page, "man-partner", legacy);
  const current = await state(page);
  await expect(bubble(page)).toHaveText(current.utteranceText);
  await expect(bubble(page)).not.toHaveAttribute("data-spoken", /./);
  await expect(movesLine(page)).toHaveCount(0);
});

test("the reply under Best names the engine's strongest reply, never the move actually played next", async ({
  page,
}) => {
  const game = structuredClone(games["allowed-mate-natural"]);
  // The game went on with a different move than the engine's mating reply.
  game.frames.push({
    ...game.frames[1],
    san: "Nc6",
    uci: "b8c6",
    actor: "black",
    turn: "white",
    report: null,
  });
  await mount(page, "man-partner", game);
  await expect(reply(page)).toHaveAttribute("title", "Black’s strongest reply: Qh4#");
  await expect(reply(page).locator("strong")).toHaveText("Qh4#");
  await expect(reply(page)).not.toContainText(/\breplie[sd]\b|\bplayed\b|Nc6/);
  // Supplementary text: the bubble's line is the one announcement for this move.
  await expect(
    region(page).locator(".coach-best-reply[aria-live], .coach-best-reply [aria-live]"),
  ).toHaveCount(0);
  await expect(region(page).locator(".coach-message [aria-live=polite]")).toHaveCount(1);
  // Screen reader users hear the concrete reply once, inside that announcement.
  await expect(region(page).locator(".coach-message [aria-live=polite] .sr-only")).toHaveText(
    " Black’s strongest reply: Qh4#, forced mate.",
  );
});
