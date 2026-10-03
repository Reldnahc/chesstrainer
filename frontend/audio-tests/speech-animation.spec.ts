import { openAudioFixturePage } from "./fixtures/openAudioFixture";
import { expect, test } from "@playwright/test";
import path from "node:path";
import type { CoachDefinition } from "../src/coach/model";
import { viteFsPath } from "../studio-tests/helpers/viteFsPath";

test('speech artwork is an explicit capability with a safe static fallback', async ({ page }) => {
  await openAudioFixturePage(page);
  const capabilities = await page.evaluate(async root => {
    const { getCoach, selectableCoaches } = await import(`${root}/src/coach/registry.ts`);
    const { supportsSpeech } = await import(`${root}/src/coach/model.ts`);
    const walter: CoachDefinition = getCoach('classic');
    return {
      enabled: selectableCoaches.filter((coach: CoachDefinition) => supportsSpeech(coach)).map((coach: CoachDefinition) => coach.id).sort(),
      disabled: selectableCoaches.filter((coach: CoachDefinition) => !supportsSpeech(coach)).map((coach: CoachDefinition) => coach.id).sort(),
      fallback: supportsSpeech({ ...walter, families: [], capabilities: { ...walter.capabilities, speech: undefined } }),
      optIn: supportsSpeech({ ...walter, families: [], capabilities: { ...walter.capabilities, speech: true } }),
      familyOverride: supportsSpeech({ ...walter, families: walter.families.map(family => ({ ...family, speech: false })),
        capabilities: { ...walter.capabilities, speech: true } }),
    };
  }, viteFsPath(path.resolve('.')));
  expect(capabilities).toEqual({
    enabled: ['classic', 'man-host', 'man-expert', 'man-partner', 'woman-captain', 'woman-analyst',
      'woman-spark', 'woman-blonde', 'human-boy', 'human-girl', 'dog-gentle', 'dog-corgi', 'dog-collie', 'dog-puppy',
      'cat-tuxedo', 'cat-black', 'cat-kitten', 'gorilla', 'raccoon', 'frog', 'capybara',
      'unicorn', 'wizard', 'dragon', 'ghost', 'alien', 'robot', 'slime', 'mushroom', 'living-pawn'].sort(),
    // Every selectable coach now has a speaking rig; the opt-in/fallback rules
    // below still protect a future character that has not implemented one.
    disabled: [],
    fallback: false, optIn: true, familyOverride: false,
  });
});
