import { openAudioFixturePage } from "./fixtures/openAudioFixture";
import {expect, test, type Locator, type Page} from '@playwright/test';
import path from 'node:path';
import type {SpeechPlayback} from '../src/audio/model';
import type {CoachMotion} from '../src/coach/model';
import {speechMouthPoses, type SpeechMouthShape} from '../src/coach/speechMouth';
import {viteFsPath} from '../studio-tests/helpers/viteFsPath';

type Options = {coach: string; motion: CoachMotion; preview: SpeechMouthShape | null; speech: boolean; feedCoach: string; elapsed: number};
type Snapshot = {reads: number; requestedFrames: number; pendingFrames: number};
type Harness = {
  update: (patch: Partial<Options>) => void;
  snapshot: () => Snapshot;
  unmount: () => void;
  detached: () => {speaking?: string; preview?: string; articulation?: string; shape?: string; styles: string[]};
};
type HarnessWindow = Window & {speechPreviewHarness: Harness};

async function mountPreview(page: Page, options: Partial<Options> = {}) {
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await openAudioFixturePage(page);
  await page.evaluate(async ({root, options}) => {
    const {React, createRoot} = await import(`${root}/studio-tests/fixtures/runtime.ts`);
    const {CoachCharacter} = await import(`${root}/src/coach/CoachAvatar.tsx`);
    const {getCoach} = await import(`${root}/src/coach/registry.ts`);
    // Every selectable coach now has a speaking rig, so "unsupported" is the man-expert
    // with speech switched off, standing in for a future rig without a mouth.
    const coachFor = (id: string) => {
      if (id !== 'unsupported') return getCoach(id);
      const base = getCoach('man-expert');
      return {...base, families: base.families.map((family: object) => ({...family, speech: false})),
        capabilities: {...base.capabilities, speech: false}};
    };
    let current: Options = {coach: 'classic', motion: 'still', preview: 'round', speech: false, feedCoach: 'classic', elapsed: .1, ...options};
    let reads = 0, requestedFrames = 0;
    const pendingFrames = new Set<number>();
    const request = window.requestAnimationFrame.bind(window), cancel = window.cancelAnimationFrame.bind(window);
    window.requestAnimationFrame = callback => {
      requestedFrames++;
      const id = request(time => { pendingFrames.delete(id); callback(time); });
      pendingFrames.add(id);
      return id;
    };
    window.cancelAnimationFrame = id => { pendingFrames.delete(id); cancel(id); };
    const feeds = new Map<string, SpeechPlayback>();
    const feed = (coachId: string) => {
      if (!feeds.has(coachId)) feeds.set(coachId, {scope: 'preview-lifecycle', coachId,
        eventId: coachId, utteranceId: coachId,
        read: () => { reads++; return {elapsedSeconds: current.elapsed, energy: .8, brightness: .3}; }});
      return feeds.get(coachId);
    };
    const track = {durationSeconds: 1, cues: [
      {start: 0, end: .5, shape: 'open'}, {start: .5, end: 1, shape: 'tongue'},
    ]};
    const container = document.createElement('div');
    container.id = 'speech-preview-lifecycle';
    container.style.cssText = 'position:fixed;inset:12px auto auto 12px;width:150px;height:190px;z-index:9999';
    document.body.append(container);
    const mounted = createRoot(container);
    let detached: HTMLElement | null = null;
    const render = () => mounted.render(React.createElement(CoachCharacter, {
      coach: coachFor(current.coach), reaction: {state: 'neutral', key: 'preview-lifecycle'},
      idle: false, motion: current.motion, previewSpeechShape: current.preview ?? undefined,
      speech: current.speech ? feed(current.feedCoach) : undefined, speechTrack: track,
    }));
    (window as unknown as HarnessWindow).speechPreviewHarness = {
      update: patch => { current = {...current, ...patch}; render(); },
      snapshot: () => ({reads, requestedFrames, pendingFrames: pendingFrames.size}),
      unmount: () => { detached = container.querySelector('.coach-avatar'); mounted.unmount(); container.remove(); },
      detached: () => ({speaking: detached?.dataset.speaking, preview: detached?.dataset.speechPreview,
        articulation: detached?.dataset.articulation, shape: detached?.dataset.mouthShape,
        styles: Array.from(detached?.style ?? []).filter(name => name.startsWith('--speech-'))}),
    };
    render();
  }, {root: viteFsPath(path.resolve('.')), options});
  const portrait = page.locator('#speech-preview-lifecycle .coach-avatar');
  await expect(portrait).toBeVisible();
  return portrait;
}

const update = (page: Page, patch: Partial<Options>) => page.evaluate(
  patch => (window as unknown as HarnessWindow).speechPreviewHarness.update(patch), patch);
const snapshot = (page: Page) => page.evaluate(() => (window as unknown as HarnessWindow).speechPreviewHarness.snapshot());

async function expectReset(portrait: Locator) {
  await expect(portrait).toHaveAttribute('data-speaking', 'false');
  for (const attribute of ['data-speech-preview', 'data-articulation', 'data-mouth-shape'])
    expect(await portrait.getAttribute(attribute)).toBeNull();
  expect(await portrait.evaluate(node => Array.from((node as HTMLElement).style)
    .filter(name => name.startsWith('--speech-')))).toEqual([]);
}

test('held shapes set all eight controls in Still without sampling audio or requesting animation frames', async ({page}) => {
  const portrait = await mountPreview(page, {speech: true});
  for (const shape of Object.keys(speechMouthPoses) as SpeechMouthShape[]) {
    await update(page, {preview: shape});
    await expect(portrait).toHaveAttribute('data-mouth-shape', shape);
    await expect(portrait).toHaveAttribute('data-speech-preview', 'true');
    await expect(portrait).toHaveAttribute('data-articulation', 'aligned');
    await expect(portrait).toHaveAttribute('data-motion', 'still');
    expect(await portrait.evaluate(node => Object.fromEntries(Array.from((node as HTMLElement).style)
      .filter(name => name.startsWith('--speech-'))
      .map(name => [name.slice('--speech-'.length), Number((node as HTMLElement).style.getPropertyValue(name))]))))
      .toEqual(speechMouthPoses[shape]);
    await page.clock.runFor(64);
  }
  await expect(portrait.locator('.walter-authored-mouth')).toBeHidden();
  await expect(portrait.locator('.walter-aligned-mouth')).toBeVisible();
  expect(await snapshot(page)).toEqual({reads: 0, requestedFrames: 0, pendingFrames: 0});
});

test('held rounded artwork has the same contour in Still and Animated', async ({page}) => {
  const portrait = await mountPreview(page);
  await expect(portrait).toHaveAttribute('data-mouth-shape', 'round');
  const aperture = portrait.locator('.walter-aligned-opening > .walter-aligned-aperture').first();
  const stillContour = await aperture.evaluate(node => getComputedStyle(node).getPropertyValue('d'));
  await update(page, {motion: 'natural'});
  await expect(portrait).toHaveAttribute('data-motion', 'natural');
  const animatedContour = await aperture.evaluate(node => getComputedStyle(node).getPropertyValue('d'));
  expect(stillContour).toBe(animatedContour);
  expect(await snapshot(page)).toEqual({reads: 0, requestedFrames: 0, pendingFrames: 0});
});

test('clearing, switching to an unsupported coach and unmounting remove every held-preview override', async ({page}) => {
  const portrait = await mountPreview(page);
  await expect(portrait).toHaveAttribute('data-speech-preview', 'true');
  await update(page, {preview: null});
  await expectReset(portrait);
  await expect(portrait.locator('.walter-authored-mouth')).toBeVisible();
  await update(page, {preview: 'tongue'});
  await expect(portrait).toHaveAttribute('data-mouth-shape', 'tongue');
  await update(page, {coach: 'unsupported'});
  await expect(portrait).toHaveAttribute('data-coach', 'man-expert');
  await expectReset(portrait);
  await update(page, {coach: 'classic'});
  await expect(portrait).toHaveAttribute('data-mouth-shape', 'tongue');
  await page.evaluate(() => (window as unknown as HarnessWindow).speechPreviewHarness.unmount());
  await expect(portrait).toHaveCount(0);
  await page.clock.runFor(160);
  expect(await snapshot(page)).toEqual({reads: 0, requestedFrames: 0, pendingFrames: 0});
  expect(await page.evaluate(() => (window as unknown as HarnessWindow).speechPreviewHarness.detached()))
    .toEqual({speaking: 'false', styles: []});
});

test('holding a shape cancels live sampling and clearing it resumes at the current recording time', async ({page}) => {
  const portrait = await mountPreview(page, {preview: null, motion: 'natural', speech: true});
  await page.clock.runFor(160);
  await expect(portrait).toHaveAttribute('data-mouth-shape', 'open');
  expect((await snapshot(page)).reads).toBeGreaterThan(0);
  await update(page, {preview: 'pucker'});
  await expect(portrait).toHaveAttribute('data-mouth-shape', 'pucker');
  const held = await snapshot(page);
  expect(held.pendingFrames).toBe(0);
  await page.clock.runFor(160);
  expect(await snapshot(page)).toEqual(held);
  await update(page, {elapsed: .7, preview: null});
  await expect(portrait).not.toHaveAttribute('data-speech-preview');
  await page.clock.runFor(64);
  await expect(portrait).toHaveAttribute('data-mouth-shape', 'tongue');
  expect((await snapshot(page)).reads).toBeGreaterThan(held.reads);
  await update(page, {speech: false});
  await expectReset(portrait);
  const stopped = await snapshot(page);
  expect(stopped.pendingFrames).toBe(0);
  await page.clock.runFor(160);
  expect(await snapshot(page)).toEqual(stopped);
});

for (const gate of ['Still', 'device reduced motion', 'hidden page', 'different coach identity'] as const) {
  test(`clearing a held pose does not bypass the live speech gate: ${gate}`, async ({page}) => {
    const portrait = await mountPreview(page, {motion: 'natural', speech: true});
    await expect(portrait).toHaveAttribute('data-speech-preview', 'true');
    if (gate === 'device reduced motion') {
      await page.emulateMedia({reducedMotion: 'reduce'});
      await update(page, {motion: 'system'});
      await expect(portrait).toHaveAttribute('data-motion', 'still');
    }
    if (gate === 'Still') {
      await update(page, {motion: 'still'});
      await expect(portrait).toHaveAttribute('data-motion', 'still');
    }
    if (gate === 'hidden page') await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', {value: true, configurable: true});
      document.dispatchEvent(new Event('visibilitychange'));
    });
    if (gate === 'different coach identity') await update(page, {feedCoach: 'man-expert'});
    await update(page, {preview: null});
    await expectReset(portrait);
    await page.clock.runFor(160);
    expect(await snapshot(page)).toEqual({reads: 0, requestedFrames: 0, pendingFrames: 0});
  });
}
