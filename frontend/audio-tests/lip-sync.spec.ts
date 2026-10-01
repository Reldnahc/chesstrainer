import { expect, test, type Locator, type Page } from '@playwright/test';
import path from 'node:path';
import { speechMouthAt, type SpeechMouthTrack } from '../src/coach/speechMouth';
import { rhubarbTrack, walterAlignment, walterAlignmentPreviews } from '../src/audio/speech/alignment/previewTracks';
import { viteFsPath } from '../studio-tests/helpers/viteFsPath';

const track: SpeechMouthTrack = { durationSeconds: 1, cues: [
  { start: .1, end: .2, shape: 'closed' },
  { start: .2, end: .4, shape: 'round' },
  { start: .6, end: .8, shape: 'tongue' },
] };

test('mouth timing uses half-open cue boundaries and rests in gaps or outside the recording', () => {
  const cases = [
    [0, 'rest'], [.1, 'closed'], [.199, 'closed'], [.2, 'round'], [.399, 'round'],
    [.4, 'rest'], [.599, 'rest'], [.6, 'tongue'], [.8, 'rest'], [.999, 'rest'],
    [1, 'rest'], [2, 'rest'], [-1, 'rest'], [NaN, 'rest'], [Infinity, 'rest'],
  ] as const;
  for (const [seconds, shape] of cases) expect(speechMouthAt(track, seconds)).toBe(shape);
  expect(speechMouthAt({ durationSeconds: 1, cues: [] }, .5)).toBe('rest');
});

test('mouth timing is independent of previous samples after a seek or skipped frames', () => {
  for (const seconds of [.7, .15, .45, .25, 1, .25, .7, 0, .15]) {
    const expected = track.cues.find(cue => cue.start <= seconds && seconds < cue.end)?.shape ?? 'rest';
    expect(speechMouthAt(track, seconds)).toBe(expected);
  }
});

test('the alignment adapter translates all raw cue IDs and rejects malformed timing or unknown shapes', () => {
  const ids = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'X'];
  const input = { metadata: { duration: 9 }, mouthCues: ids.map((value, index) => ({ start: index, end: index + 1, value })) };
  expect(rhubarbTrack(input)?.cues.map(cue => cue.shape))
    .toEqual(['closed', 'consonant', 'open', 'wide', 'round', 'pucker', 'lip-bite', 'tongue', 'rest']);
  for (const duration of [0, -1, NaN, Infinity]) {
    expect(rhubarbTrack({ ...input, metadata: { duration } })).toBeNull();
  }
  for (const cue of [
    { start: -1, end: 1, value: 'A' }, { start: 0, end: 0, value: 'A' },
    { start: 1, end: .5, value: 'A' }, { start: 0, end: 10, value: 'A' },
    { start: NaN, end: 1, value: 'A' }, { start: 0, end: Infinity, value: 'A' },
    { start: 0, end: 1, value: 'unknown' }, { start: 0, end: 1, value: 'constructor' },
  ]) expect(rhubarbTrack({ ...input, mouthCues: [cue] }), JSON.stringify(cue)).toBeNull();
  expect(rhubarbTrack({ ...input, mouthCues: [] })).toBeNull();
  expect(rhubarbTrack({ ...input, mouthCues: [
    { start: 0, end: 2, value: 'A' }, { start: 1, end: 3, value: 'B' },
  ] })).toBeNull();
});

test('comparison tracks are available only for their exact recording identities', () => {
  expect(walterAlignmentPreviews.map(item => item.scriptId).sort())
    .toEqual(['contrast-allowed-mate', 'contrast-sound-sacrifice']);
  for (const preview of walterAlignmentPreviews) {
    expect(preview.track).not.toBeNull();
    expect(walterAlignment(preview.voiceId, preview.scriptId)).toBe(preview.track);
    expect(walterAlignment('other-voice', preview.scriptId)).toBeUndefined();
  }
  expect(walterAlignment('walter', 'contrast-recovery')).toBeUndefined();
});

const panel = (page: Page) => page.locator('.walter-audition');
const pair = (page: Page) => page.getByRole('region', { name: 'Walter mouth comparison', exact: true });
const portraits = (page: Page) => pair(page).locator('.coach-avatar');
const aligned = (page: Page) => page.getByRole('img', { name: 'Walter, automatic lip sync', exact: true });
const baseline = (page: Page) => page.getByRole('img', { name: 'Walter, audio-driven mouth', exact: true });
const play = (page: Page) => page.getByRole('button', { name: 'Play voice', exact: true });
const motion = (page: Page) => page.getByRole('combobox', { name: 'Coach motion', exact: true });
const sample = (page: Page) => page.getByRole('combobox', { name: 'Speech example', exact: true });

type NativeStart = { duration: number; stopped: boolean };
type LipSyncWindow = Window & { lipSyncStarts: NativeStart[]; lipSyncShapes: string[] };

async function captureNativeStarts(page: Page) {
  await page.addInitScript(() => {
    const starts: NativeStart[] = [];
    Object.assign(window, { lipSyncStarts: starts, lipSyncShapes: [] });
    const start = AudioBufferSourceNode.prototype.start;
    const stop = AudioBufferSourceNode.prototype.stop;
    const records = new WeakMap<AudioBufferSourceNode, NativeStart>();
    AudioBufferSourceNode.prototype.start = function (when?, offset?, duration?) {
      if (duration === undefined) start.call(this, when ?? 0, offset ?? 0);
      else start.call(this, when ?? 0, offset ?? 0, duration);
      const record = { duration: this.buffer?.duration ?? 0, stopped: false };
      records.set(this, record);
      starts.push(record);
    };
    AudioBufferSourceNode.prototype.stop = function (when?) {
      stop.call(this, when ?? 0);
      const record = records.get(this);
      if (record) record.stopped = true;
    };
  });
}

const nativeStarts = (page: Page) => page.evaluate(() => (window as unknown as LipSyncWindow).lipSyncStarts);

async function openComparison(page: Page, animated = true) {
  await captureNativeStarts(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Compare lip sync', exact: true }).click();
  if (animated) await motion(page).selectOption('natural');
  await expect(portraits(page)).toHaveCount(2);
}

async function expectResting(portrait: Locator) {
  await expect(portrait).toHaveAttribute('data-speaking', 'false');
  expect(await portrait.getAttribute('data-articulation')).toBeNull();
  expect(await portrait.getAttribute('data-mouth-shape')).toBeNull();
  expect(await portrait.evaluate(node => Array.from((node as HTMLElement).style)
    .filter(name => name.startsWith('--speech-')))).toEqual([]);
  await expect(portrait.locator('.walter-authored-mouth')).toBeVisible();
  await expect(portrait.locator('.walter-aligned-mouth')).toBeHidden();
}

test('rendered vowel and tongue targets preserve Rhubarb aperture ordering', async ({ page }) => {
  await openComparison(page);
  const targets = await aligned(page).evaluate(async (element, root) => {
    const { speechMouthPoses } = await import(`${root}/src/coach/speechMouth.ts`);
    const node = element as HTMLElement;
    node.dataset.speaking = 'true';
    node.dataset.articulation = 'aligned';
    const aperture = node.querySelector('.walter-aligned-opening > .walter-aligned-aperture')!;
    const jaw = node.querySelector('.walter-speech-jaw')!;
    // Set the actual rig's settled targets: this includes the CSS rounding
    // multiplier, which can reverse shape sizes despite ordered numeric inputs.
    return Object.fromEntries(['round', 'open', 'tongue', 'wide'].map(shape => {
      for (const [part, value] of Object.entries(speechMouthPoses[shape])) {
        node.style.setProperty(`--speech-${part}`, String(value));
      }
      const mouthMatrix = new DOMMatrixReadOnly(getComputedStyle(aperture).transform);
      const jawMatrix = new DOMMatrixReadOnly(getComputedStyle(jaw).transform);
      return [shape, { height: mouthMatrix.d, width: mouthMatrix.a, jaw: jawMatrix.m42 }];
    }));
  }, viteFsPath(path.resolve('.')));
  // E is rounded but opens no farther than C; H is at least C and below D.
  expect(targets.round.height).toBeGreaterThan(0);
  expect(targets.round.height).toBeLessThanOrEqual(targets.open.height);
  expect(targets.tongue.height).toBeGreaterThanOrEqual(targets.open.height);
  expect(targets.tongue.height).toBeLessThan(targets.wide.height);
  expect(targets.round.width).toBeLessThan(targets.open.width);
  expect(targets.round.jaw).toBeLessThanOrEqual(targets.open.jaw);
  expect(targets.tongue.jaw).toBeGreaterThanOrEqual(targets.open.jaw);
  expect(targets.tongue.jaw).toBeLessThan(targets.wide.jaw);
});

for (const scriptId of ['contrast-sound-sacrifice', 'contrast-allowed-mate']) {
  test(`${scriptId} drives both portraits with one recording and changes aligned mouth shapes`, async ({ page }, info) => {
    await openComparison(page);
    expect(await sample(page).locator('option').evaluateAll(options => options.map(option => (option as HTMLOptionElement).value)).then(ids => ids.sort()))
      .toEqual(['contrast-allowed-mate', 'contrast-sound-sacrifice']);
    await sample(page).selectOption(scriptId);
    await aligned(page).evaluate(node => {
      const shapes = (window as unknown as LipSyncWindow).lipSyncShapes;
      new MutationObserver(() => {
        const shape = (node as HTMLElement).dataset.mouthShape;
        if (shape && shapes.at(-1) !== shape) shapes.push(shape);
      }).observe(node, { attributes: true, attributeFilter: ['data-mouth-shape'] });
    });
    await play(page).click();
    await aligned(page).scrollIntoViewIfNeeded();
    await expect(aligned(page)).toHaveAttribute('data-articulation', 'aligned');
    await expect(baseline(page)).toHaveAttribute('data-speaking', 'true');
    expect(await baseline(page).getAttribute('data-articulation')).toBeNull();
    await expect(aligned(page).locator('.walter-aligned-mouth')).toBeVisible();
    await expect(aligned(page).locator('.walter-speech-mouth')).toBeHidden();
    await expect(baseline(page).locator('.walter-speech-mouth')).toBeVisible();
    await expect(baseline(page).locator('.walter-aligned-mouth')).toBeHidden();
    const starts = await nativeStarts(page);
    expect(starts).toHaveLength(1);
    expect(Math.abs(starts[0].duration - walterAlignment('walter', scriptId)!.durationSeconds)).toBeLessThan(.06);
    await expect.poll(() => page.evaluate(() => new Set((window as unknown as LipSyncWindow).lipSyncShapes).size)).toBeGreaterThan(4);
    if (scriptId === 'contrast-allowed-mate') await pair(page).screenshot({ path: info.outputPath('lip-sync-comparison.png'), animations: 'allow' });
    await expect(panel(page)).toHaveAttribute('data-playback', 'idle', { timeout: 15000 });
    await expectResting(aligned(page));
    await expectResting(baseline(page));
    expect(await nativeStarts(page)).toHaveLength(1);
  });
}

test('stop, replay, example changes and leaving comparison clear both mouths and stop their shared source', async ({ page }) => {
  await openComparison(page);
  await play(page).click();
  await expect(aligned(page)).toHaveAttribute('data-speaking', 'true');
  await page.getByRole('button', { name: 'Stop all', exact: true }).click();
  await expect(panel(page)).toHaveAttribute('data-playback', 'idle');
  await expectResting(aligned(page));
  await expectResting(baseline(page));
  expect((await nativeStarts(page))[0].stopped).toBe(true);
  await play(page).click();
  await expect(aligned(page)).toHaveAttribute('data-speaking', 'true');
  expect(await nativeStarts(page)).toHaveLength(2);
  await sample(page).selectOption('contrast-allowed-mate');
  await expectResting(aligned(page));
  await expectResting(baseline(page));
  expect((await nativeStarts(page))[1].stopped).toBe(true);
  await play(page).click();
  await expect(aligned(page)).toHaveAttribute('data-speaking', 'true');
  await page.getByRole('button', { name: 'Voice audition', exact: true }).click();
  await expect(pair(page)).toHaveCount(0);
  await expect(panel(page).locator('.coach-avatar')).toHaveCount(1);
  await expectResting(panel(page).locator('.coach-avatar'));
  expect((await nativeStarts(page))[2].stopped).toBe(true);
  await page.getByRole('button', { name: 'Compare lip sync', exact: true }).click();
  await expectResting(aligned(page));
  await expectResting(baseline(page));
  expect(await nativeStarts(page)).toHaveLength(3);
});

test('device reduced motion and Still keep both portraits static while explicit Animated uses the same playback', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openComparison(page, false);
  await play(page).click();
  await expect(panel(page)).toHaveAttribute('data-playback', 'playing');
  for (const portrait of [aligned(page), baseline(page)]) {
    await expect(portrait).toHaveAttribute('data-motion', 'still');
    await expectResting(portrait);
  }
  await motion(page).selectOption('natural');
  await aligned(page).scrollIntoViewIfNeeded();
  await expect(aligned(page)).toHaveAttribute('data-articulation', 'aligned');
  await expect(baseline(page)).toHaveAttribute('data-speaking', 'true');
  await motion(page).selectOption('still');
  await expectResting(aligned(page));
  await expectResting(baseline(page));
  await expect(panel(page)).toHaveAttribute('data-playback', 'playing');
  expect(await nativeStarts(page)).toHaveLength(1);
  await page.getByRole('button', { name: 'Stop all', exact: true }).click();
});

test('comparison keeps two readable portraits side by side without horizontal overflow', async ({ page }) => {
  await openComparison(page);
  await pair(page).scrollIntoViewIfNeeded();
  const boxes = await portraits(page).evaluateAll(nodes => nodes.map(node => {
    const rect = node.getBoundingClientRect();
    return { x: rect.x, y: rect.y, right: rect.right, width: rect.width, height: rect.height };
  }));
  expect(Math.abs(boxes[0].y - boxes[1].y)).toBeLessThan(1);
  expect(boxes[0].right).toBeLessThanOrEqual(boxes[1].x);
  for (const box of boxes) {
    expect(box.width).toBeGreaterThan(75);
    expect(box.height).toBeGreaterThan(100);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.right).toBeLessThanOrEqual(page.viewportSize()!.width);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
