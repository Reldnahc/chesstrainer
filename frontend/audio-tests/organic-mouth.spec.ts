import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import { viteFsPath } from '../studio-tests/helpers/viteFsPath';

async function mountMouths(page: Page) {
  await page.goto('/');
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  await page.evaluate(async root => {
    const { default: React } = await import(`${root}/node_modules/.vite-audio/deps/react.js`);
    const { default: ReactDOM } = await import(`${root}/node_modules/.vite-audio/deps/react-dom_client.js`);
    const { SpeechMouthLayer, OrganicSpeechMouth } = await import(`${root}/src/coach/SpeechMouthLayer.tsx`);
    const { speechMouthPoses } = await import(`${root}/src/coach/speechMouth.ts`);
    const sheet = document.createElement('section');
    sheet.id = 'organic-mouth-fixture';
    sheet.style.cssText = 'position:absolute;inset:0 auto auto 0;z-index:9999;background:#24272a;color:#eee;display:grid;grid-template-columns:repeat(9,95px);gap:8px;padding:15px;font:12px sans-serif';
    document.body.append(sheet);
    ReactDOM.createRoot(sheet).render(React.createElement(React.Fragment, null,
      ...[[20, 10], [38, 8], [12, 8]].flatMap(([width, height]) => Object.entries(speechMouthPoses).map(([shape, pose]) =>
        React.createElement('figure', { key: `${width}-${shape}`, style: { margin: 0 }, 'data-shape': shape, 'data-width': width },
          React.createElement('div', { className: 'coach-avatar', 'data-motion': 'natural', 'data-speaking': 'true',
            style: Object.fromEntries(Object.entries(pose as Record<string, number>).map(([part, value]) => [`--speech-${part}`, value])) },
            React.createElement('svg', { width: 92.8, height: 80, viewBox: '0 35 100 65' },
              React.createElement('ellipse', { cx: 50, cy: 60, rx: 46, ry: 27, fill: '#b8a48a' }),
              React.createElement(SpeechMouthLayer, { authored: React.createElement('path', {
                'data-original': 'mouth', d: 'M35 60Q50 68 65 60', fill: 'none', stroke: '#46342e', strokeWidth: 1.5,
              }) }, React.createElement(OrganicSpeechMouth, {
                x: 50, y: 60, width, height, mood: width === 38 ? 'concern' : 'smile',
                palette: { cavity: '#493632', outline: '#574039', tongue: '#bc8b80', teeth: '#eee5cf' },
                teeth: width !== 12, fangs: width === 12,
              })),
            )),
          React.createElement('figcaption', null, `${width} × ${height} / ${shape}`),
        ),
      )),
    ));
  }, viteFsPath(path.resolve('.')));
  const sheet = page.locator('#organic-mouth-fixture');
  await expect(sheet.locator('.speech-mouth-layer')).toHaveCount(27);
  return sheet;
}

test('shared organic mouths preserve O/oo geometry across wide and small species and share one aperture clip', async ({ page }, info) => {
  const sheet = await mountMouths(page);
  const targets = await sheet.locator('figure').evaluateAll(figures => figures.map(figure => {
    const mouth = figure.querySelector<SVGPathElement>('.organic-speech-opening > .organic-speech-aperture')!;
    const bounds = mouth.getBoundingClientRect();
    return { shape: (figure as HTMLElement).dataset.shape!, nominal: (figure as HTMLElement).dataset.width!,
      width: bounds.width, height: bounds.height,
      opening: getComputedStyle(figure.querySelector('.organic-speech-opening')!).opacity,
      paths: [...figure.querySelectorAll('.organic-speech-aperture')].map(node => getComputedStyle(node).d),
      teeth: figure.querySelector('.organic-speech-teeth')?.children.length,
    };
  }));
  for (const nominal of ['20', '38', '12']) {
    const byShape = Object.fromEntries(targets.filter(item => item.nominal === nominal).map(item => [item.shape, item]));
    for (const item of Object.values(byShape)) {
      expect(new Set(item.paths).size).toBe(1);
      expect(item.teeth).toBe(1); // The narrow species has two fangs, without a tooth band.
    }
    expect(byShape.round.width / byShape.round.height).toBeGreaterThan(1);
    expect(byShape.round.width / byShape.round.height).toBeLessThan(1.3);
    expect(byShape.pucker.width / byShape.pucker.height).toBeGreaterThan(.8);
    expect(byShape.pucker.width / byShape.pucker.height).toBeLessThan(1.1);
    expect(byShape.pucker.width).toBeLessThan(byShape.round.width);
    expect(byShape.round.width).toBeLessThan(byShape.open.width);
    expect(byShape.round.height).toBeLessThan(byShape.open.height);
    expect(byShape.open.height).toBeLessThan(byShape.wide.height);
    expect(byShape.closed.opening).toBe('0');
    expect(byShape.rest.opening).toBe('0');
  }
  const maskIds = await sheet.locator('clipPath').evaluateAll(nodes => nodes.map(node => node.id));
  expect(new Set(maskIds).size).toBe(27);
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  await sheet.screenshot({ path: info.outputPath('organic-speech-shapes.png'), animations: 'allow' });
});

test('authored mouths restore unchanged and explicit Still inspection stays static', async ({ page }) => {
  const sheet = await mountMouths(page);
  const avatar = sheet.locator('figure[data-width="20"][data-shape="round"] .coach-avatar');
  const authored = avatar.locator('.speech-mouth-authored');
  const live = avatar.locator('.speech-mouth-live');
  const geometry = await authored.innerHTML();
  await expect(live).toBeVisible();
  await expect(authored).toBeHidden();
  await avatar.evaluate(node => { (node as HTMLElement).dataset.motion = 'still'; });
  await expect(authored).toBeVisible();
  await expect(live).toBeHidden();
  await avatar.evaluate(node => { (node as HTMLElement).dataset.speechPreview = 'true'; });
  await expect(live).toBeVisible();
  await expect(authored).toBeHidden();
  const interpolation = await avatar.evaluate(node => {
    const element = node as HTMLElement;
    const paths = [...node.querySelectorAll<SVGPathElement>('.organic-speech-aperture')];
    return [0, .25, .5, .75, 1].map(mix => {
      element.style.setProperty('--speech-round', String(.15 + mix * .7));
      return { paths: paths.map(path => getComputedStyle(path).d),
        states: paths.flatMap(path => path.getAnimations().map(animation => animation.playState)) };
    });
  });
  expect(new Set(interpolation.map(state => state.paths[0])).size).toBe(5);
  for (const state of interpolation) {
    expect(new Set(state.paths).size).toBe(1);
    expect(state.states).toEqual(['paused', 'paused', 'paused']);
  }
  await avatar.evaluate(node => { delete (node as HTMLElement).dataset.speechPreview; });
  await expect(live).toBeHidden();
  await expect(authored).toBeVisible();
  await avatar.evaluate(node => {
    const element = node as HTMLElement;
    element.dataset.speaking = 'false';
    element.dataset.motion = 'natural';
  });
  expect(await authored.innerHTML()).toBe(geometry);
  expect(await avatar.evaluate(node => node.getAnimations({ subtree: true }).length)).toBe(0);
});

test('energy-only playback uses shared controls without requiring aligned cue properties', async ({ page }) => {
  const sheet = await mountMouths(page);
  const avatar = sheet.locator('figure[data-width="20"][data-shape="round"] .coach-avatar');
  const heights = await avatar.evaluate(node => {
    const element = node as HTMLElement;
    for (const name of [...element.style]) if (name.startsWith('--speech-')) element.style.removeProperty(name);
    element.style.setProperty('--speech-round', '.4');
    const path = node.querySelector<SVGPathElement>('.organic-speech-opening > .organic-speech-aperture')!;
    return [0, .2, .7].map(open => {
      element.style.setProperty('--speech-open', String(open));
      return path.getBoundingClientRect().height;
    });
  });
  expect(heights[0]).toBe(0);
  expect(heights[1]).toBeGreaterThan(0);
  expect(heights[2]).toBeGreaterThan(heights[1]);
});
