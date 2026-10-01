import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import type { CoachExpression } from '../src/coach/model';
import { speechMouthPoses, type SpeechMouthShape } from '../src/coach/speechMouth';
import { viteFsPath } from '../studio-tests/helpers/viteFsPath';

// Walter keeps his dedicated rig; the other nine humans share one mouth placed on
// his face coordinates. He is mounted beside them so every sheet compares the two.
const humanIds = ['man-host', 'man-expert', 'man-partner', 'woman-captain', 'woman-analyst',
  'woman-spark', 'woman-blonde', 'human-boy', 'human-girl'] as const;
const coachIds = ['classic', ...humanIds] as const;
const bearded = ['man-host', 'man-expert', 'man-partner'] as const;
const sizes = [92.8, 52.5];
const sheetSelector = '#human-mouth-rig-sheet';
const avatarsSelector = `${sheetSelector} .coach-avatar`;
const humansSelector = `${avatarsSelector}:not([data-coach="classic"])`;

async function mountCast(page: Page, expressions: CoachExpression[] = ['neutral']) {
  await page.goto('/');
  await page.evaluate(async ({ root, ids, sizes, expressions }) => {
    const { React, createRoot } = await import(`${root}/studio-tests/fixtures/runtime.ts`);
    const { getCoach } = await import(`${root}/src/coach/registry.ts`);
    await import(`${root}/src/coach/coach.css`);
    const sheet = document.createElement('section');
    sheet.id = 'human-mouth-rig-sheet';
    sheet.style.cssText = 'position:absolute;inset:0 auto auto 0;z-index:9999;background:#151718;color:#eee;padding:20px;display:grid;grid-template-columns:repeat(10,110px);gap:14px;font:11px sans-serif';
    document.body.append(sheet);
    // Render the registered production artwork without an audio source or idle
    // clock. The following samples use the same controls as speech playback.
    createRoot(sheet).render(React.createElement(React.Fragment, null,
      ...expressions.flatMap(expression => sizes.flatMap(size => ids.map(id => {
        const coach = getCoach(id);
        return React.createElement('figure', {
          key: `${id}-${size}-${expression}`, style: { margin: 0, display: 'grid', justifyItems: 'center', gap: 5 },
        }, React.createElement('div', {
          className: 'coach-avatar', 'data-coach': id, 'data-family': coach.defaultFamily, 'data-size': size,
          'data-expression': expression, 'data-motion': 'still', 'data-phase': 'rest',
          'data-speaking': 'false', 'data-articulation': 'aligned',
          style: { width: `${size}px`, height: `${size * 1.25}px` },
        }, React.createElement(coach.Artwork, { expression, family: coach.defaultFamily })),
        React.createElement('figcaption', null, `${coach.name} · ${size} · ${expression}`));
      }))),
    ));
  }, { root: viteFsPath(path.resolve('.')), ids: coachIds, sizes, expressions });
  await expect(page.locator(`${avatarsSelector} .speech-mouth-live`)).toHaveCount(humanIds.length * sizes.length * expressions.length);
  await expect(page.locator(`${avatarsSelector}[data-coach="classic"] .walter-aligned-mouth`)).toHaveCount(sizes.length * expressions.length);
}

async function pose(page: Page, shape: SpeechMouthShape, speaking = true, motion = 'natural') {
  await page.locator(avatarsSelector).evaluateAll((nodes, input) => {
    for (const node of nodes) {
      const avatar = node as HTMLElement;
      avatar.dataset.speaking = String(input.speaking);
      avatar.dataset.motion = input.motion;
      for (const [part, value] of Object.entries(input.values)) {
        avatar.style.setProperty(`--speech-${part}`, String(value));
      }
    }
  }, { values: speechMouthPoses[shape], speaking, motion });
}

async function layerStates(page: Page) {
  return page.locator(humansSelector).evaluateAll(nodes => nodes.map(node => {
    const authored = node.querySelector<SVGGElement>('.speech-mouth-authored')!;
    const live = node.querySelector<SVGGElement>('.speech-mouth-live')!;
    const bounds = authored.getBoundingClientRect();
    return {
      key: `${node.getAttribute('data-coach')}-${node.getAttribute('data-size')}-${node.getAttribute('data-expression')}`,
      markup: authored.innerHTML,
      bounds: [bounds.x, bounds.y, bounds.width, bounds.height],
      authoredDisplay: getComputedStyle(authored).display,
      liveDisplay: getComputedStyle(live).display,
      jaw: [...node.querySelectorAll('.human-speech-jaw')].map(group => getComputedStyle(group).transform),
    };
  }));
}

test('human speech restores every authored mouth expression exactly when silent or Still', async ({ page }) => {
  // These five expressions exercise smile, grin, ponder, concern and surprise.
  await mountCast(page, ['neutral', 'brilliant', 'thinking', 'mistake', 'blunder']);
  const before = await layerStates(page);
  for (const state of before) {
    expect(state.authoredDisplay, state.key).not.toBe('none');
    expect(state.liveDisplay, state.key).toBe('none');
    expect(state.markup, state.key).not.toBe('');
    expect(state.markup, state.key).toContain('class="coach-mouth"');
    for (const jaw of state.jaw) expect(jaw, state.key).toBe('none');
  }
  for (const shape of ['open', 'round', 'closed', 'rest'] as const) {
    await pose(page, shape);
    const speaking = await layerStates(page);
    for (const [index, state] of speaking.entries()) {
      expect(state.authoredDisplay, state.key).toBe('none');
      expect(state.liveDisplay, state.key).not.toBe('none');
      expect(state.markup, state.key).toBe(before[index].markup);
    }
    await pose(page, shape, false);
    expect(await layerStates(page)).toEqual(before);
  }
  // Still wins even if the last active speech controls have not been cleared.
  await pose(page, 'open', true, 'still');
  expect(await layerStates(page)).toEqual(before);
  const animationCount = await page.locator(`${avatarsSelector} .organic-speech-aperture`)
    .evaluateAll(paths => paths.flatMap(path => path.getAnimations()).length);
  expect(animationCount).toBe(0);
});

type Aperture = { id: string; size: number; x: number; y: number; width: number; height: number; path: string };

async function apertures(page: Page): Promise<Aperture[]> {
  return page.locator(avatarsSelector).evaluateAll(nodes => nodes.map(node => {
    const aperture = node.querySelector<SVGPathElement>(
      '.organic-speech-opening > .organic-speech-aperture, .walter-aligned-opening > .walter-aligned-aperture')!;
    const bounds = aperture.getBoundingClientRect();
    return {
      id: node.getAttribute('data-coach')!, size: Number(node.getAttribute('data-size')),
      x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height, path: getComputedStyle(aperture).d,
    };
  }));
}

test('the nine human mouths open, round, pucker and close in step with Walter at portrait sizes', async ({ page }, info) => {
  await mountCast(page);
  const samples = new Map<SpeechMouthShape, Aperture[]>();
  for (const shape of Object.keys(speechMouthPoses) as SpeechMouthShape[]) {
    await pose(page, shape);
    samples.set(shape, await apertures(page));
    await page.locator(sheetSelector).screenshot({ path: info.outputPath(`human-mouth-${shape}.png`), animations: 'allow' });
  }
  const states = await page.locator(humansSelector).evaluateAll(nodes => nodes.map(node => ({
    id: node.getAttribute('data-coach')!, size: Number(node.getAttribute('data-size')),
    opening: getComputedStyle(node.querySelector('.organic-speech-opening')!).opacity,
    closed: getComputedStyle(node.querySelector('.organic-speech-closed')!).opacity,
    pressure: getComputedStyle(node.querySelector('.organic-speech-pressure')!).opacity,
  })));
  // The sheet ends on the resting shape, so these opacities describe rest.
  for (const state of states) {
    expect(state.opening, `${state.id} rest`).toBe('0');
    expect(state.closed).toBe('1');
    expect(state.pressure).toBe('0');
  }
  const target = (shape: SpeechMouthShape, id: string, size: number) =>
    samples.get(shape)!.find(sample => sample.id === id && sample.size === size)!;
  for (const size of sizes) {
    const walter = (shape: SpeechMouthShape) => target(shape, 'classic', size);
    for (const id of humanIds) {
      const open = target('open', id, size);
      const round = target('round', id, size);
      const pucker = target('pucker', id, size);
      const wide = target('wide', id, size);
      expect(round.width / round.height, `${id} ${size} rounded aspect`).toBeGreaterThan(.9);
      expect(round.width / round.height).toBeLessThan(1.4);
      expect(pucker.width / pucker.height, `${id} ${size} puckered aspect`).toBeGreaterThan(.65);
      expect(pucker.width / pucker.height).toBeLessThan(1.1);
      expect(pucker.width).toBeLessThan(round.width * .8);
      expect(pucker.height).toBeLessThan(round.height);
      expect(open.width).toBeGreaterThan(round.width * 1.7);
      expect(wide.height).toBeGreaterThan(open.height * 1.3);
      expect(open.path).not.toBe(round.path);
      for (const shape of ['closed', 'rest'] as const) expect(target(shape, id, size).height, `${id} ${size} ${shape}`).toBe(0);
      // The same portrait-relative mouth as Walter's, within a pixel: same upper
      // lip, same reach into the jaw and the same width for open sounds. The shared
      // contour's corners bulge a little more than his, hence the width allowance.
      for (const shape of ['open', 'wide', 'consonant', 'tongue', 'lip-bite'] as const) {
        const human = target(shape, id, size);
        const reference = walter(shape);
        const portrait = human.y - (await page.locator(`${avatarsSelector}[data-coach="${id}"][data-size="${size}"]`).boundingBox())!.y;
        const walterPortrait = reference.y - (await page.locator(`${avatarsSelector}[data-coach="classic"][data-size="${size}"]`).boundingBox())!.y;
        expect(Math.abs(portrait - walterPortrait), `${id} ${size} ${shape} lip`).toBeLessThan(.6);
        expect(Math.abs(human.height - reference.height), `${id} ${size} ${shape} height`).toBeLessThan(.6);
        expect(Math.abs(human.width - reference.width), `${id} ${size} ${shape} width`).toBeLessThan(1);
      }
      expect(Math.abs(round.height - walter('round').height), `${id} ${size} round height`).toBeLessThan(.6);
    }
  }
});

test('human mouth interiors share their moving aperture clip with no independent animation clock', async ({ page }) => {
  await mountCast(page);
  await pose(page, 'open');
  const samples = await page.locator(humansSelector).evaluateAll(nodes => nodes.map(node => {
    const avatar = node as HTMLElement;
    const mouth = avatar.querySelector<SVGGElement>('.organic-speech-mouth')!;
    const interior = mouth.querySelector<SVGGElement>('.organic-speech-opening > g[clip-path]')!;
    const clipId = interior.getAttribute('clip-path')!.match(/^url\(#(.+)\)$/)![1];
    const clip = document.getElementById(clipId)!;
    const apertures = [...mouth.querySelectorAll<SVGPathElement>('.organic-speech-aperture')];
    const states = [0, .25, .5, .75, 1].map(round => {
      avatar.style.setProperty('--speech-round', String(round));
      return {
        contours: apertures.map(path => getComputedStyle(path).d),
        transforms: apertures.map(path => getComputedStyle(path).transform),
        animations: apertures.flatMap(path => path.getAnimations().map(animation => animation.playState)),
      };
    });
    const details = ['.organic-speech-teeth', '.organic-speech-tongue-floor', '.organic-speech-tongue-tip', '.organic-speech-lip-bite']
      .map(selector => mouth.querySelector(selector));
    avatar.dataset.speaking = 'false';
    return {
      id: avatar.dataset.coach, clipId,
      localClip: mouth.contains(clip), clipUnits: clip.getAttribute('clipPathUnits'),
      detailCount: details.filter(Boolean).length,
      clippedDetails: details.every(detail => detail && interior.contains(detail)),
      apertureCount: apertures.length, states,
      silentAnimationCount: apertures.flatMap(path => path.getAnimations()).length,
    };
  }));
  expect(new Set(samples.map(sample => sample.clipId)).size).toBe(samples.length);
  for (const sample of samples) {
    expect(sample.localClip, sample.id).toBe(true);
    expect(sample.clipUnits).toBe('userSpaceOnUse');
    // Every human speaks with teeth, an L tongue and an F/V lower lip, like Walter.
    expect(sample.detailCount).toBe(4);
    expect(sample.clippedDetails).toBe(true);
    expect(sample.apertureCount).toBe(3);
    expect(new Set(sample.states.map(state => state.contours[0])).size).toBe(5);
    for (const state of sample.states) {
      expect(new Set(state.contours).size).toBe(1);
      expect(new Set(state.transforms).size).toBe(1);
      expect(state.animations).toEqual(['paused', 'paused', 'paused']);
    }
    expect(sample.silentAnimationCount).toBe(0);
  }
});

test('human mouths keep Walter\'s placement, each coach\'s own colors and moving beards', async ({ page }) => {
  await mountCast(page);
  await pose(page, 'open');
  const profiles = await page.locator(`${humansSelector}[data-size="92.8"]`).evaluateAll(nodes => nodes.map(node => {
    const mouth = node.querySelector<SVGGElement>('.organic-speech-mouth')!;
    const matrix = mouth.transform.baseVal.consolidate()!.matrix;
    const jaws = [...node.querySelectorAll<SVGGElement>('.human-speech-jaw')];
    const beard = jaws.flatMap(jaw => [...jaw.querySelectorAll('path')]);
    return {
      id: node.getAttribute('data-coach')!,
      placement: { x: matrix.e, y: matrix.f, width: matrix.a * 20, height: matrix.d * 10 },
      cavity: mouth.querySelector('.organic-speech-opening > .organic-speech-aperture')!.getAttribute('fill'),
      outline: mouth.querySelector('.organic-speech-lip-line')!.getAttribute('stroke'),
      lip: mouth.querySelector('.organic-speech-lip-bite')!.getAttribute('fill'),
      tongue: mouth.querySelector('.organic-speech-tongue-tip')!.getAttribute('fill'),
      teeth: mouth.querySelector('.organic-speech-teeth')!.getAttribute('fill'),
      authoredMouth: node.querySelector('.speech-mouth-authored .coach-mouth > path')!.getAttribute('fill'),
      jawCount: jaws.length,
      jawTransforms: jaws.map(jaw => getComputedStyle(jaw).transform),
      // Beards move below the mouth; moustaches stay on the upper lip, outside both
      // the jaw group and the speech layer.
      beardBelowLip: beard.every(path => path.getBBox().y + path.getBBox().height > 66),
      jawHoldsSpeech: jaws.some(jaw => jaw.querySelector('.speech-mouth-layer')),
      moustache: [...node.querySelectorAll('path')].filter(path => /^M29 5[45]q/.test(path.getAttribute('d') ?? ''))
        .map(path => ({ inJaw: Boolean(path.closest('.human-speech-jaw')), inSpeech: Boolean(path.closest('.speech-mouth-layer')) })),
    };
  }));
  const expectedJaw = `matrix(1, 0, 0, 1, 0, ${(speechMouthPoses.open.jaw * 1.25).toFixed(4).replace(/0+$/, '')})`;
  for (const profile of profiles) {
    expect(profile.placement.x, profile.id).toBe(40);
    expect(profile.placement.y, profile.id).toBe(58.5);
    expect(profile.placement.width, profile.id).toBeCloseTo(14, 5);
    expect(profile.placement.height, profile.id).toBeCloseTo(8, 5);
    expect(profile.outline, profile.id).toBe(profile.authoredMouth);
    expect(profile.teeth).toBe('#fff3dc');
    expect(profile.jawHoldsSpeech).toBe(false);
    if ((bearded as readonly string[]).includes(profile.id)) {
      expect(profile.jawCount, profile.id).toBe(1);
      expect(profile.beardBelowLip, profile.id).toBe(true);
      expect(profile.jawTransforms[0], profile.id).toBe(expectedJaw);
    } else {
      expect(profile.jawCount, profile.id).toBe(0);
    }
    if (profile.id !== 'man-expert') expect(profile.moustache.length, profile.id).toBe(profile.id.startsWith('man-') ? 1 : 0);
    for (const moustache of profile.moustache) expect(moustache).toEqual({ inJaw: false, inSpeech: false });
  }
  expect(profiles.map(profile => [profile.id, profile.cavity, profile.outline, profile.lip, profile.tongue])).toEqual([
    ['man-host', '#3b211d', '#512f29', '#a86f58', '#b86f68'],
    ['man-expert', '#653c36', '#75473e', '#c08a76', '#ce9182'],
    ['man-partner', '#55322d', '#694039', '#b57c63', '#c4847b'],
    ['woman-captain', '#653c36', '#75473e', '#c58874', '#ce9182'],
    ['woman-analyst', '#593430', '#75473e', '#a06856', '#bf7f76'],
    ['woman-spark', '#653c36', '#75473e', '#d2917f', '#d3958a'],
    ['woman-blonde', '#653c36', '#75473e', '#d09682', '#d3958a'],
    ['human-boy', '#532e26', '#65392f', '#c2866a', '#cf8f84'],
    ['human-girl', '#532e26', '#65392f', '#a26a52', '#c27f78'],
  ]);
  await pose(page, 'rest', false);
  const restingJaws = await page.locator(`${humansSelector} .human-speech-jaw`).evaluateAll(jaws => jaws.map(jaw => getComputedStyle(jaw).transform));
  expect(restingJaws).toHaveLength(bearded.length * sizes.length);
  for (const jaw of restingJaws) expect(jaw).toBe('none');
});
