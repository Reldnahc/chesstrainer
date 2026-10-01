import { expect, test, type Page } from "@playwright/test";
import path from "node:path";
import type { CoachDefinition } from "../src/coach/model";
import { viteFsPath } from "../studio-tests/helpers/viteFsPath";

const portrait = (page: Page) => page.locator('.walter-audition .coach-avatar');
const panel = (page: Page) => page.locator('.walter-audition');
const play = (page: Page) => page.getByRole('button', { name: 'Play voice', exact: true });
const motion = (page: Page) => page.getByRole('combobox', { name: 'Coach motion', exact: true });
const sample = (page: Page) => page.getByRole('combobox', { name: 'Speech example', exact: true });
const openness = (page: Page) => portrait(page).evaluate(node => Number((node as HTMLElement).style.getPropertyValue('--speech-open')));

test('speech artwork is an explicit capability with a safe static fallback', async ({ page }) => {
  await page.goto('/');
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
    enabled: ['classic', 'dog-gentle', 'dog-corgi', 'dog-collie', 'dog-puppy',
      'cat-tuxedo', 'cat-black', 'cat-kitten', 'gorilla', 'raccoon', 'frog', 'capybara',
      'unicorn', 'wizard', 'dragon', 'ghost', 'alien', 'robot', 'slime', 'mushroom', 'living-pawn'].sort(),
    disabled: ['man-host', 'man-expert', 'man-partner', 'woman-captain', 'woman-analyst',
      'woman-spark', 'woman-blonde', 'human-boy', 'human-girl'].sort(),
    fallback: false, optIn: true, familyOverride: false,
  });
});

test('the real recording articulates, closes in pauses and restores the authored face at its end', async ({ page }, info) => {
  await page.goto('/');
  await motion(page).selectOption('natural');
  await play(page).scrollIntoViewIfNeeded();
  await portrait(page).evaluate(node => {
    const samples: { speaking: boolean; open: number; round: number; aperture: string }[] = [];
    const observer = new MutationObserver(() => {
      const el = node as HTMLElement;
      const aperture = node.querySelector('.walter-speech-opening > .walter-speech-aperture');
      samples.push({ speaking: el.dataset.speaking === 'true', open: Number(el.style.getPropertyValue('--speech-open')),
        round: Number(el.style.getPropertyValue('--speech-round')), aperture: aperture ? getComputedStyle(aperture).transform : '' });
    });
    observer.observe(node, { attributes: true, attributeFilter: ['style', 'data-speaking'] });
    Object.assign(window, { speechFrames: samples, speechObserver: observer });
  });
  await expect(portrait(page)).toHaveAttribute('data-speaking', 'false');
  await play(page).click();
  await expect(portrait(page)).toHaveAttribute('data-speaking', 'true');
  await expect.poll(() => openness(page)).toBeGreaterThan(.3);
  await panel(page).screenshot({ path: info.outputPath('walter-speaking.png'), animations: 'allow' });
  await expect(panel(page)).toHaveAttribute('data-playback', 'idle', { timeout: 20000 });
  await expect(portrait(page)).toHaveAttribute('data-speaking', 'false');
  await expect(portrait(page).locator('.walter-authored-mouth')).toBeVisible();
  await expect(portrait(page).locator('.walter-speech-mouth')).toBeHidden();
  expect(await portrait(page).evaluate(node => (node as HTMLElement).style.getPropertyValue('--speech-open'))).toBe('');
  const frames = await page.evaluate(() => {
    const scope = window as unknown as { speechFrames: { speaking: boolean; open: number; round: number; aperture: string }[]; speechObserver: MutationObserver };
    scope.speechObserver.disconnect();
    return scope.speechFrames.filter(frame => frame.speaking);
  });
  expect(frames.length).toBeGreaterThan(40);
  expect(Math.max(...frames.map(frame => frame.open))).toBeGreaterThan(.6);
  const firstSound = frames.findIndex(frame => frame.open > .3);
  expect(frames.slice(firstSound + 1).some(frame => frame.open === 0)).toBe(true);
  expect(new Set(frames.map(frame => frame.aperture)).size).toBeGreaterThan(10);
  expect(Math.max(...frames.map(frame => frame.round)) - Math.min(...frames.map(frame => frame.round))).toBeGreaterThan(.1);
});

test('device reduced motion and Still stop the mouth; explicit Animated resumes without replaying audio', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await play(page).click();
  await expect(panel(page)).toHaveAttribute('data-playback', 'playing');
  await expect(portrait(page)).toHaveAttribute('data-motion', 'still');
  await expect(portrait(page)).toHaveAttribute('data-speaking', 'false');
  await motion(page).selectOption('natural');
  await play(page).scrollIntoViewIfNeeded();
  await expect(portrait(page)).toHaveAttribute('data-speaking', 'true');
  await motion(page).selectOption('still');
  await expect(portrait(page)).toHaveAttribute('data-speaking', 'false');
  await expect(panel(page)).toHaveAttribute('data-playback', 'playing');
  await motion(page).selectOption('natural');
  await play(page).scrollIntoViewIfNeeded();
  await expect(portrait(page)).toHaveAttribute('data-speaking', 'true');
  await expect(page.locator('[data-bus="speech"][data-event-type="started"]')).toHaveCount(1);
  await page.getByRole('button', { name: 'Stop all', exact: true }).click();
});

for (const action of ['stop', 'mute', 'zero volume', 'hidden', 'change example'] as const) {
  test(`${action} cancels the speaking mouth with its audio`, async ({ page }) => {
    await page.goto('/');
    await motion(page).selectOption('natural');
    await play(page).click();
    await expect(portrait(page)).toHaveAttribute('data-speaking', 'true');
    if (action === 'stop') await page.getByRole('button', { name: 'Stop all', exact: true }).click();
    if (action === 'mute') await page.getByRole('button', { name: 'Mute audio', exact: true }).click();
    if (action === 'zero volume') await page.getByRole('slider', { name: 'Volume', exact: true }).press('Home');
    if (action === 'change example') await sample(page).selectOption('contrast-sound-sacrifice');
    if (action === 'hidden') await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect(panel(page)).toHaveAttribute('data-playback', 'idle');
    await expect(portrait(page)).toHaveAttribute('data-speaking', 'false');
    expect(await portrait(page).evaluate(node => (node as HTMLElement).style.getPropertyValue('--speech-open'))).toBe('');
    if (action === 'hidden') await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect(portrait(page)).toHaveAttribute('data-speaking', 'false');
  });
}

test('offscreen portraits pause while speech continues and resume without a new recording', async ({ page }) => {
  await page.goto('/');
  await motion(page).selectOption('natural');
  await play(page).click();
  await expect(portrait(page)).toHaveAttribute('data-speaking', 'true');
  await page.locator('.audio-studio-footer').scrollIntoViewIfNeeded();
  await expect(portrait(page)).toHaveAttribute('data-speaking', 'false');
  await expect(panel(page)).toHaveAttribute('data-playback', 'playing');
  await portrait(page).scrollIntoViewIfNeeded();
  await expect(portrait(page)).toHaveAttribute('data-speaking', 'true');
  await expect(page.locator('[data-bus="speech"][data-event-type="started"]')).toHaveCount(1);
  await page.getByRole('button', { name: 'Stop all', exact: true }).click();
});

test('brilliant articulation uses its own mouth without restarting reaction or idle animation each syllable', async ({ page }) => {
  await page.goto('/');
  await motion(page).selectOption('natural');
  await sample(page).selectOption('contrast-sound-sacrifice');
  await play(page).click();
  await expect(portrait(page)).toHaveAttribute('data-expression', 'brilliant');
  await expect(portrait(page)).toHaveAttribute('data-phase', 'reaction');
  await expect(portrait(page)).toHaveAttribute('data-phase', 'rest');
  const take = await portrait(page).getAttribute('data-take');
  const svg = await portrait(page).locator('svg.coach-artwork').elementHandle();
  await expect.poll(() => openness(page)).toBeGreaterThan(.3);
  expect(await portrait(page).locator('.walter-speech-mouth').evaluate(node => getComputedStyle(node).animationName)).toBe('none');
  expect(await svg!.evaluate(node => node.isConnected)).toBe(true);
  await expect(portrait(page)).toHaveAttribute('data-take', take!);
  await page.getByRole('button', { name: 'Stop all', exact: true }).click();
});
