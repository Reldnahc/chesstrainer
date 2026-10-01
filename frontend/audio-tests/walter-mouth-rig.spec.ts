import { expect, test } from '@playwright/test';
import path from 'node:path';
import { viteFsPath } from '../studio-tests/helpers/viteFsPath';

test('Walter distinguishes rounded O and puckered oo at real portrait sizes', async ({ page }, info) => {
  await page.goto('/');
  await page.evaluate(async root => {
    const { default: React } = await import(`${root}/node_modules/.vite-audio/deps/react.js`);
    const { default: ReactDOM } = await import(`${root}/node_modules/.vite-audio/deps/react-dom_client.js`);
    const { CoachCharacter } = await import(`${root}/src/coach/CoachAvatar.tsx`);
    const { getCoach } = await import(`${root}/src/coach/registry.ts`);
    const sheet = document.createElement('section');
    sheet.id = 'mouth-rig-sheet';
    sheet.style.cssText = 'position:absolute;inset:0 auto auto 0;z-index:9999;background:#151718;color:#eee;padding:20px;display:grid;grid-template-columns:repeat(5,125px);gap:12px;font:14px sans-serif';
    document.body.append(sheet);
    const mounted = ReactDOM.createRoot(sheet);
    const shapes = ['rest', 'open', 'round', 'pucker', 'wide'];
    mounted.render(React.createElement(React.Fragment, null,
      ...[92.8, 52.5].flatMap(size => ['neutral', 'mistake', 'thinking'].flatMap(expression => shapes.map(shape =>
        React.createElement('figure', { key: `${size}-${expression}-${shape}`, 'data-shape': shape,
          'data-size': size, 'data-expression': expression, style: { margin: 0, display: 'grid', justifyItems: 'center', gap: 5 } },
        React.createElement(CoachCharacter, { coach: getCoach('classic'), reaction: { state: expression, key: expression }, motion: 'still', idle: false }),
        React.createElement('figcaption', { style: { fontSize: 11 } }, `${shape} · ${expression} · ${size}`),
      )))),
    ));
  }, viteFsPath(path.resolve('.')));
  const sheet = page.locator('#mouth-rig-sheet');
  await expect(sheet.locator('.coach-avatar')).toHaveCount(30);
  const geometry = await sheet.evaluate(async (sheet, root) => {
    const { speechMouthPoses } = await import(`${root}/src/coach/speechMouth.ts`);
    return [...sheet.querySelectorAll<HTMLElement>('figure')].map(figure => {
      const node = figure.querySelector<HTMLElement>('.coach-avatar')!;
      node.style.width = `${figure.dataset.size}px`;
      node.style.height = `${Number(figure.dataset.size) * 1.25}px`;
      node.dataset.speaking = 'true';
      node.dataset.articulation = 'aligned';
      node.dataset.motion = 'natural';
      for (const [part, value] of Object.entries(speechMouthPoses[figure.dataset.shape!])) {
        node.style.setProperty(`--speech-${part}`, String(value));
      }
      const aperture = node.querySelector<SVGPathElement>('.walter-aligned-opening > .walter-aligned-aperture')!;
      const bounds = aperture.getBoundingClientRect();
      return { shape: figure.dataset.shape!, size: figure.dataset.size!, expression: figure.dataset.expression!,
        width: bounds.width, height: bounds.height, path: getComputedStyle(aperture).d };
    });
  }, viteFsPath(path.resolve('.')));
  await sheet.screenshot({ path: info.outputPath('walter-mouth-targets.png'), animations: 'allow' });
  for (const size of ['92.8', '52.5']) for (const expression of ['neutral', 'mistake', 'thinking']) {
    const targets = Object.fromEntries(geometry.filter(target => target.size === size && target.expression === expression)
      .map(target => [target.shape, target]));
    expect(targets.round.width / targets.round.height).toBeGreaterThan(.9);
    expect(targets.round.width / targets.round.height).toBeLessThan(1.4);
    expect(targets.pucker.width / targets.pucker.height).toBeGreaterThan(.65);
    expect(targets.pucker.width / targets.pucker.height).toBeLessThan(1.1);
    expect(targets.pucker.width).toBeLessThan(targets.round.width * .8);
    expect(targets.pucker.height).toBeLessThan(targets.round.height);
    expect(targets.round.path).not.toBe(targets.open.path);
  }

  const samples = await sheet.locator('figure[data-size="92.8"][data-expression="neutral"][data-shape="round"] .coach-avatar')
    .evaluate(node => {
      const avatar = node as HTMLElement;
      const apertures = [...avatar.querySelectorAll<SVGPathElement>('.walter-aligned-aperture')];
      const opening = apertures[1];
      const states = [0, .25, .5, .75, 1].map(round => {
        avatar.style.setProperty('--speech-round', String(round));
        const points = [0, .25, .5, .75].map(fraction => {
          const point = opening.getPointAtLength(opening.getTotalLength() * fraction);
          return [point.x, point.y];
        });
        return { round, points, contours: apertures.map(path => getComputedStyle(path).d),
          animationStates: apertures.flatMap(path => path.getAnimations().map(animation => animation.playState)) };
      });
      avatar.dataset.speaking = 'false';
      return { states, silentAnimationCount: apertures.flatMap(path => path.getAnimations()).length };
    });
  expect(new Set(samples.states.map(state => state.contours[0])).size).toBe(5);
  for (const state of samples.states) {
    // The rendered fill/outline and teeth mask must morph together, with no
    // independent clock advancing a mouth while its audio control stays still.
    expect(new Set(state.contours).size).toBe(1);
    expect(state.animationStates).toEqual(['paused', 'paused', 'paused']);
    expect(state.points.flat().every(Number.isFinite)).toBe(true);
  }
  expect(samples.silentAnimationCount).toBe(0);
  const top = samples.states.map(state => state.points[0][1]);
  expect(top).toEqual([...top].sort((a, b) => a - b));
  expect(top.at(-1)! - top[0]).toBeGreaterThan(3);
});
