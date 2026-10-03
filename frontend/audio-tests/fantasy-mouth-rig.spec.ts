import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import type { CoachExpression } from '../src/coach/model';
import { speechMouthPoses, type SpeechMouthShape } from '../src/coach/speechMouth';
import { viteFsPath } from '../studio-tests/helpers/viteFsPath';

const coachIds = ['unicorn', 'wizard', 'dragon', 'ghost', 'slime', 'mushroom'] as const;
const sizes = [92.8, 52.5];
const sheetSelector = '#fantasy-mouth-rig-sheet';
const avatarsSelector = `${sheetSelector} .coach-avatar`;

async function mountCast(page: Page, expressions: CoachExpression[] = ['neutral']) {
  await page.goto('/');
  await page.evaluate(async ({ root, ids, sizes, expressions }) => {
    const { React, createRoot } = await import(`${root}/studio-tests/fixtures/runtime.ts`);
    const { getCoach } = await import(`${root}/src/coach/registry.ts`);
    await import(`${root}/src/coach/coach.css`);
    const sheet = document.createElement('section');
    sheet.id = 'fantasy-mouth-rig-sheet';
    sheet.style.cssText = 'position:absolute;inset:0 auto auto 0;z-index:9999;background:#151718;color:#eee;padding:20px;display:grid;grid-template-columns:repeat(6,110px);gap:14px;font:11px sans-serif';
    document.body.append(sheet);
    // Render the registered production artwork without an audio source or idle
    // clock. The following samples use the same controls as speech playback.
    createRoot(sheet).render(React.createElement(React.Fragment, null,
      ...expressions.flatMap(expression => sizes.flatMap(size => ids.map(id => {
        const coach = getCoach(id);
        return React.createElement('figure', {
          key: `${id}-${size}-${expression}`, style: { margin: 0, display: 'grid', justifyItems: 'center', gap: 5 },
        }, React.createElement('div', {
          className: 'coach-avatar', 'data-coach': id, 'data-size': size,
          'data-expression': expression, 'data-motion': 'still', 'data-phase': 'rest',
          'data-speaking': 'false', 'data-articulation': 'aligned',
          style: { width: `${size}px`, height: `${size * 1.25}px` },
        }, React.createElement(coach.Artwork, { expression, family: 'storyteller' })),
        React.createElement('figcaption', null, `${coach.name} · ${size} · ${expression}`));
      }))),
    ));
  }, { root: viteFsPath(path.resolve('.')), ids: coachIds, sizes, expressions });
  await expect(page.locator(`${avatarsSelector} .speech-mouth-live`)).toHaveCount(coachIds.length * sizes.length * expressions.length);
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
  return page.locator(avatarsSelector).evaluateAll(nodes => nodes.map(node => {
    const authored = node.querySelector<SVGGElement>('.speech-mouth-authored')!;
    const live = node.querySelector<SVGGElement>('.speech-mouth-live')!;
    const bounds = authored.getBoundingClientRect();
    return {
      key: `${node.getAttribute('data-coach')}-${node.getAttribute('data-size')}-${node.getAttribute('data-expression')}`,
      markup: authored.innerHTML,
      bounds: [bounds.x, bounds.y, bounds.width, bounds.height],
      authoredVisibility: (authored.getAnimations().forEach(fade => fade.finish()), getComputedStyle(authored).visibility),
      liveVisibility: (live.getAnimations().forEach(fade => fade.finish()), getComputedStyle(live).visibility),
    };
  }));
}

test('fantasy speech restores every authored mouth expression exactly when silent or Still', async ({ page }) => {
  // These five expressions exercise smile, grin, ponder, concern and surprise.
  await mountCast(page, ['neutral', 'brilliant', 'thinking', 'mistake', 'blunder']);
  const before = await layerStates(page);
  for (const state of before) {
    expect(state.authoredVisibility, state.key).toBe('visible');
    expect(state.liveVisibility, state.key).toBe('hidden');
    expect(state.markup, state.key).not.toBe('');
  }
  for (const shape of ['open', 'round', 'closed', 'rest'] as const) {
    await pose(page, shape);
    const speaking = await layerStates(page);
    for (const [index, state] of speaking.entries()) {
      expect(state.authoredVisibility, state.key).toBe('hidden');
      expect(state.liveVisibility, state.key).toBe('visible');
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

test('fantasy open, rounded, closed and resting mouths remain readable at application portrait sizes', async ({ page }, info) => {
  await mountCast(page);
  const samples: { shape: SpeechMouthShape; geometry: {
    id: string; size: number; width: number; height: number; path: string;
    opening: string; closed: string; pressure: string;
  }[] }[] = [];
  for (const shape of ['open', 'round', 'closed', 'rest'] as const) {
    await pose(page, shape);
    const geometry = await page.locator(avatarsSelector).evaluateAll(nodes => nodes.map(node => {
      const opening = node.querySelector<SVGGElement>('.organic-speech-opening')!;
      const aperture = opening.querySelector<SVGPathElement>(':scope > .organic-speech-aperture')!;
      const bounds = aperture.getBoundingClientRect();
      return {
        id: node.getAttribute('data-coach')!, size: Number(node.getAttribute('data-size')),
        width: bounds.width, height: bounds.height, path: getComputedStyle(aperture).d,
        opening: getComputedStyle(opening).opacity,
        closed: getComputedStyle(node.querySelector('.organic-speech-closed')!).opacity,
        pressure: getComputedStyle(node.querySelector('.organic-speech-pressure')!).opacity,
      };
    }));
    samples.push({ shape, geometry });
    await page.locator(sheetSelector).screenshot({ path: info.outputPath(`fantasy-mouth-${shape}.png`), animations: 'allow' });
  }
  for (const id of coachIds) for (const size of sizes) {
    const target = (shape: string) => samples.find(sample => sample.shape === shape)!.geometry
      .find(sample => sample.id === id && sample.size === size)!;
    const open = target('open');
    const round = target('round');
    expect(open.opening, `${id} ${size} open`).toBe('1');
    expect(open.closed).toBe('0');
    expect(round.opening).toBe('1');
    expect(round.width / round.height, `${id} ${size} rounded aspect`).toBeGreaterThan(.9);
    expect(round.width / round.height).toBeLessThan(1.4);
    expect(round.width).toBeGreaterThan(1);
    expect(round.height).toBeGreaterThan(1);
    expect(open.width).toBeGreaterThan(round.width * 1.7);
    expect(open.path).not.toBe(round.path);
    for (const shape of ['closed', 'rest']) {
      expect(target(shape).opening).toBe('0');
      expect(target(shape).closed).toBe('1');
      expect(target(shape).height).toBe(0);
    }
    expect(target('closed').pressure).toBe('1');
    expect(target('rest').pressure).toBe('0');
  }
});

test('fantasy mouth interiors share their moving aperture clip with no independent animation clock', async ({ page }) => {
  await mountCast(page);
  await pose(page, 'open');
  const samples = await page.locator(avatarsSelector).evaluateAll(nodes => nodes.map(node => {
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
        points: apertures.flatMap(path => [0, .25, .5, .75].flatMap(fraction => {
          const point = path.getPointAtLength(path.getTotalLength() * fraction);
          return [point.x, point.y];
        })),
      };
    });
    const clippedDetails = [...mouth.querySelectorAll('.organic-speech-teeth, .organic-speech-tongue-floor, .organic-speech-tongue-tip, .organic-speech-lip-bite')];
    avatar.dataset.speaking = 'false';
    return {
      id: avatar.dataset.coach, clipId,
      localClip: mouth.contains(clip), clipUnits: clip.getAttribute('clipPathUnits'),
      clippedDetails: clippedDetails.every(detail => interior.contains(detail)),
      apertureCount: apertures.length, states,
      silentAnimationCount: apertures.flatMap(path => path.getAnimations()).length,
    };
  }));
  expect(new Set(samples.map(sample => sample.clipId)).size).toBe(samples.length);
  for (const sample of samples) {
    expect(sample.localClip, sample.id).toBe(true);
    expect(sample.clipUnits).toBe('userSpaceOnUse');
    expect(sample.clippedDetails).toBe(true);
    expect(sample.apertureCount).toBe(3);
    expect(new Set(sample.states.map(state => state.contours[0])).size).toBe(5);
    for (const state of sample.states) {
      expect(new Set(state.contours).size).toBe(1);
      expect(new Set(state.transforms).size).toBe(1);
      expect(state.animations).toEqual(['paused', 'paused', 'paused']);
      expect(state.points.every(Number.isFinite)).toBe(true);
    }
    expect(sample.silentAnimationCount).toBe(0);
  }
});

test('fantasy mouths retain their species proportions, palettes and face placement', async ({ page }) => {
  await mountCast(page);
  await pose(page, 'open');
  for (const size of sizes) {
    const avatar = (id: string) => page.locator(`${avatarsSelector}[data-coach="${id}"][data-size="${size}"]`);
    const unicorn = avatar('unicorn');
    await expect(unicorn.locator('.speech-mouth-live .organic-speech-teeth, .speech-mouth-live [class*="organic-speech-tongue"]')).toHaveCount(0);
    const unicornPlacement = await unicorn.locator('.organic-speech-mouth').evaluate(node => {
      const matrix = (node as SVGGElement).transform.baseVal.consolidate()!.matrix;
      return { x: matrix.e, y: matrix.f, width: matrix.a * 20, height: matrix.d * 10 };
    });
    expect(unicornPlacement.x).toBe(50);
    expect(unicornPlacement.y).toBeGreaterThanOrEqual(67);
    expect(unicornPlacement.y + unicornPlacement.height).toBeLessThan(75);
    expect(unicornPlacement.width).toBeLessThanOrEqual(16);
    expect(unicornPlacement.height).toBeLessThan(5);

    const wizardStructure = await avatar('wizard').evaluate(node => {
      const eyes = node.querySelector('.animal-eyes')!;
      const mouth = node.querySelector('.organic-speech-mouth')!;
      const muzzle = mouth.closest('.study-muzzle')!;
      const moustache = [...node.querySelectorAll('path')].find(path => path.getAttribute('d') === 'M50 70q-11-6-16 5 10 3 16-3 6 6 16 3-5-11-16-5Z')!;
      return {
        eyeTransform: eyes.parentElement!.getAttribute('transform'),
        mouthInsideEyeTranslation: eyes.parentElement!.contains(mouth),
        moustacheAfterMuzzle: Boolean(muzzle.compareDocumentPosition(moustache) & Node.DOCUMENT_POSITION_FOLLOWING),
        moustacheOutsideSpeech: !moustache.closest('.speech-mouth-layer'),
        mouthY: (mouth as SVGGElement).transform.baseVal.consolidate()!.matrix.f,
      };
    });
    expect(wizardStructure).toEqual({ eyeTransform: 'translate(0 14)', mouthInsideEyeTranslation: false,
      moustacheAfterMuzzle: true, moustacheOutsideSpeech: true, mouthY: 77 });

    const dragon = avatar('dragon');
    const authoredFangs = dragon.locator('path[d="m36 69 4 6 2-4m16 0 2 4 4-6"]');
    await expect(authoredFangs).toHaveCount(1);
    await expect(authoredFangs).not.toBeVisible();
    const liveFangs = dragon.locator('.speech-mouth-live .organic-speech-teeth');
    await expect(liveFangs).toBeVisible();
    await expect(liveFangs.locator('path')).toHaveCount(1);
    expect(await liveFangs.evaluate(node => Boolean(node.closest('g[clip-path]')))).toBe(true);
    const proportions = await Promise.all(['ghost', 'slime', 'mushroom'].map(id => avatar(id).locator('.organic-speech-mouth').evaluate(node => {
      const matrix = (node as SVGGElement).transform.baseVal.consolidate()!.matrix;
      return {
        aspect: (matrix.a * 20) / (matrix.d * 10),
        cavity: node.querySelector('.organic-speech-opening > .organic-speech-aperture')!.getAttribute('fill'),
        tongue: node.querySelector('.organic-speech-tongue-floor')?.getAttribute('fill') ?? null,
      };
    })));
    expect(proportions[0].aspect).toBeLessThan(proportions[2].aspect);
    expect(proportions[2].aspect).toBeLessThan(proportions[1].aspect);
    expect(proportions.map(profile => profile.cavity)).toEqual(['#405267', '#244c42', '#665340']);
    expect(proportions.map(profile => profile.tongue)).toEqual([null, '#a4ddae', '#d59c7a']);
    for (const id of ['ghost', 'slime', 'mushroom']) await expect(avatar(id).locator('.speech-mouth-live .organic-speech-teeth')).toHaveCount(0);
    const mushroomFace = avatar('mushroom').locator('g[transform="translate(10 38) scale(.8)"]');
    await expect(mushroomFace.locator('.animal-eyes')).toHaveCount(1);
    await expect(mushroomFace.locator('.organic-speech-mouth')).toHaveCount(1);
  }
  await pose(page, 'rest', false);
  for (const dragon of await page.locator(`${avatarsSelector}[data-coach="dragon"]`).all()) {
    await expect(dragon.locator('path[d="m36 69 4 6 2-4m16 0 2 4 4-6"]')).toBeVisible();
    await expect(dragon.locator('.speech-mouth-live')).not.toBeVisible();
  }
});
