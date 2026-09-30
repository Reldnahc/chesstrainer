import {expect, test, type Locator, type Page} from '@playwright/test';
import type {Job, Schema} from '../src/api';

type Motion = Schema['MotionPreferences']['motion'];
type MotionTrace = {starts: number; ends: number; opacities: number[]; elapsed: number};

async function fixtures(page: Page) {
  const state: {motion: Motion; jobs: Job[]} = {motion: 'still', jobs: []};
  const providers: Schema['GameProvider'][] = [
    {id: 'chesscom', name: 'Chess.com', time_classes: ['all', 'bullet', 'blitz', 'rapid', 'daily']},
    {id: 'lichess', name: 'Lichess', time_classes: ['all', 'bullet', 'blitz', 'rapid', 'classical']},
  ];
  await page.route('**/api/game-providers', route => route.fulfill({json: providers}));
  await page.route('**/api/providers/*/sync', route => route.fulfill({json: {
    provider: new URL(route.request().url()).pathname.split('/')[3], username: '',
    job_id: null, status: 'not_started', checked_at: null, imported: 0, error: null,
  }}));
  await page.route('**/api/jobs', route => route.fulfill({json: state.jobs}));
  await page.route('**/api/preferences/motion', route => route.fulfill({json: {motion: state.motion}}));
  await page.route('**/api/health', route => route.fulfill({json: {
    classification_available: true, database: 'presentation-fixture', engine_available: true,
    engine_error: null, engine_status: 'ready', engine_version: 'presentation-fixture',
  }}));
  return state;
}

async function watchEntrance(page: Page) {
  await page.addInitScript(() => {
    const trace = {starts: 0, ends: 0, opacities: [] as number[], elapsed: 0};
    Object.assign(window, {importPresentationMotion: trace});
    document.addEventListener('animationstart', event => {
      if (event.animationName !== 'import-form-enter' || !(event.target instanceof HTMLElement) ||
        !event.target.matches('.import-form > .form-panel')) return;
      trace.starts++;
      const animation = event.target.getAnimations().find(value =>
        value instanceof CSSAnimation && value.animationName === event.animationName);
      const effect = animation?.effect;
      trace.opacities = effect instanceof KeyframeEffect ? effect.getKeyframes().map(frame => Number(frame.opacity)) : [];
    });
    document.addEventListener('animationend', event => {
      if (event.animationName !== 'import-form-enter' || !(event.target instanceof HTMLElement) ||
        !event.target.matches('.import-form > .form-panel')) return;
      trace.ends++;
      trace.elapsed = event.elapsedTime;
    });
  });
}

const motionTrace = (page: Page) => page.evaluate(() =>
  (window as unknown as {importPresentationMotion: MotionTrace}).importPresentationMotion);

async function openImport(page: Page, source: 'chesscom' | 'pgn') {
  if (source === 'pgn') await page.getByRole('button', {name: 'Import PGN', exact: true}).click();
  else await page.getByRole('region', {name: 'Recent Chess.com games', exact: true})
    .getByRole('button', {name: 'Import older games', exact: true}).click();
  const form = page.getByRole('form', {name: source === 'pgn' ? 'Import PGN' : 'Import from Chess.com', exact: true});
  await expect(form).toBeVisible();
  return form;
}

async function fieldRow(first: Locator, second: Locator, stacked: boolean) {
  const left = (await first.boundingBox())!;
  const right = (await second.boundingBox())!;
  expect(left.width).toBeGreaterThan(0);
  expect(right.width).toBeCloseTo(left.width, 0);
  if (stacked) {
    expect(right.x).toBeCloseTo(left.x, 0);
    expect(right.y).toBeGreaterThanOrEqual(left.y + left.height);
  } else {
    expect(right.y).toBeCloseTo(left.y, 0);
    expect(right.x).toBeGreaterThan(left.x + left.width);
  }
}

async function formGeometry(page: Page, form: Locator) {
  await expect(form.locator('.panel')).toHaveCount(0);
  const geometry = await form.evaluate(element => {
    const wrapper = element.closest('.import-form')!;
    const bounds = (value: Element) => {
      const {x, y, width, height} = value.getBoundingClientRect();
      return {x, y, width, height};
    };
    const heading = wrapper.querySelector('.import-form-heading')!;
    const style = getComputedStyle(element);
    return {
      form: bounds(element), wrapper: bounds(wrapper), heading: bounds(heading),
      title: bounds(heading.querySelector('h3')!), close: bounds(heading.querySelector('button')!),
      cards: bounds(document.querySelector('.provider-connections')!),
      launcher: bounds(document.querySelector('.pgn-import-launcher')!),
      padding: parseFloat(style.paddingLeft) + parseFloat(style.paddingRight),
      border: parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth),
    };
  });
  for (const box of [geometry.wrapper, geometry.heading, geometry.cards, geometry.launcher]) {
    expect(box.x).toBeCloseTo(geometry.form.x, 0);
    expect(box.width).toBeCloseTo(geometry.form.width, 0);
  }
  expect(geometry.padding).toBe(0);
  expect(geometry.border).toBe(0);
  expect(geometry.title.y + geometry.title.height / 2).toBeCloseTo(geometry.close.y + geometry.close.height / 2, 0);
  expect(geometry.title.x + geometry.title.width).toBeLessThan(geometry.close.x);
  expect(geometry.close.x + geometry.close.width).toBeCloseTo(geometry.heading.x + geometry.heading.width, 0);
  expect(geometry.close.height).toBeGreaterThanOrEqual(page.viewportSize()!.width <= 760 ? 44 : 42);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

test('provider and PGN forms align with their launchers and keep logical field rows on desktop and narrow phones', async ({page}, info) => {
  await fixtures(page);
  const widths = info.project.name === 'mobile' ? [320, 390] : [1440];
  for (const width of widths) {
    await page.setViewportSize({width, height: 900});
    await page.goto('/settings');
    await expect(page.locator('html')).toHaveAttribute('data-interface-motion', 'still');
    await page.evaluate(() => document.fonts.ready);
    const provider = await openImport(page, 'chesscom');
    await expect(provider.getByLabel('Chess.com username', {exact: true})).toBeEnabled();
    await formGeometry(page, provider);
    await fieldRow(provider.getByLabel('Chess.com username', {exact: true}), provider.getByLabel('Time control', {exact: true}), width <= 760);
    await fieldRow(provider.getByLabel('Look back', {exact: true}), provider.getByLabel('Maximum new games', {exact: true}), width <= 760);
    await page.locator('.import-form').screenshot({path: `test-results/import-presentation-provider-${info.project.name}.png`});
    await provider.locator('summary').filter({hasText: /^Custom date range/}).click();
    await provider.getByLabel('From date', {exact: true}).fill('2026-08-01');
    await provider.getByLabel('To date', {exact: true}).fill('2026-08-31');
    await fieldRow(provider.getByLabel('From date', {exact: true}), provider.getByLabel('To date', {exact: true}), width <= 760);
    await expect(provider.getByLabel('Look back', {exact: true})).toBeDisabled();
    await formGeometry(page, provider);
    const pgn = await openImport(page, 'pgn');
    await formGeometry(page, pgn);
    await fieldRow(pgn.getByLabel('Your username(s)'), pgn.getByRole('combobox', {name: 'Learner side', exact: true}), width <= 760);
    await page.locator('.import-form').screenshot({path: `test-results/import-presentation-pgn-${info.project.name}.png`});
    await pgn.getByRole('button', {name: 'Paste PGN text', exact: true}).click();
    await pgn.getByRole('textbox', {name: 'PGN', exact: true}).fill('[White "Learner"]\n\n1. e4 e5 *');
    await formGeometry(page, pgn);
  }
});

test('actual import entrance motion follows device and account preferences for both sources', async ({page}) => {
  const state = await fixtures(page);
  await watchEntrance(page);
  for (const [device, preference, animated] of [
    ['reduce', 'system', false], ['reduce', 'natural', true],
    ['no-preference', 'still', false], ['no-preference', 'system', true],
  ] as const) {
    state.motion = preference;
    await page.emulateMedia({reducedMotion: device});
    await page.goto('/settings');
    await expect(page.locator('html')).toHaveAttribute('data-interface-motion', animated ? 'natural' : 'still');
    for (const [index, source] of (['chesscom', 'pgn'] as const).entries()) {
      const form = await openImport(page, source);
      if (animated) {
        await expect.poll(async () => (await motionTrace(page)).ends).toBe(index + 1);
        const trace = await motionTrace(page);
        expect(trace.starts).toBe(index + 1);
        expect(trace.elapsed).toBeGreaterThan(0);
        expect(trace.opacities.some(value => value < 1)).toBe(true);
        expect(trace.opacities.at(-1)).toBe(1);
      } else {
        await expect(form).toHaveCSS('animation-name', 'none');
        expect(await form.evaluate(element => element.getAnimations().length)).toBe(0);
        expect(await motionTrace(page)).toMatchObject({starts: 0, ends: 0});
      }
      await expect(form).toHaveCSS('opacity', '1');
      await expect(form).toHaveCSS('transform', 'none');
    }
  }
});

test('editing and activity refresh preserve form identity and drafts without replaying its entrance', async ({page}) => {
  const state = await fixtures(page);
  state.motion = 'natural';
  await watchEntrance(page);
  const job = (games: number): Job => ({
    id: 'import-presentation-history', status: 'completed', kind: 'training', user_id: 'presentation-fixture',
    created_at: '2026-09-29T10:00:00Z', activity: null, cancel_requested: false,
    chesscom: null, classifications_completed: games, deep_completed: games, error: null,
    games_processed: games, games_total: games, import_id: null, mistakes_identified: games,
    positions_triaged: games * 2, probe_total: null, provider_import: null,
  });
  for (const source of ['chesscom', 'pgn'] as const) {
    state.jobs = [job(1)];
    await page.goto('/settings');
    await expect(page.locator('html')).toHaveAttribute('data-interface-motion', 'natural');
    const form = await openImport(page, source);
    await expect.poll(async () => (await motionTrace(page)).ends).toBe(1);
    const original = await form.elementHandle();
    if (source === 'pgn') await form.getByRole('button', {name: 'Paste PGN text', exact: true}).click();
    const draft = source === 'pgn' ? form.getByRole('textbox', {name: 'PGN', exact: true})
      : form.getByLabel('Chess.com username', {exact: true});
    await expect(draft).toBeEnabled();
    const value = source === 'pgn' ? '[White "Draft"]\n\n1. d4 d5 *' : 'Unfinished_Draft';
    await draft.fill(value);
    const analyze = form.getByRole('checkbox', {name: 'Also analyze these games for training', exact: true});
    await analyze.check();
    await draft.focus();
    state.jobs = [job(2)];
    await expect(page.locator('.job-history summary')).toContainText('2 / 2 games · 4 decisions');
    expect(await original!.evaluate(element => element === document.querySelector('.import-form > form'))).toBe(true);
    await expect(draft).toHaveValue(value);
    await expect(draft).toBeFocused();
    await expect(analyze).toBeChecked();
    expect(await motionTrace(page)).toMatchObject({starts: 1, ends: 1});
    await page.getByRole('button', {name: 'Close import form', exact: true}).click();
    await expect(page.locator('.import-form')).toHaveCount(0);
    expect(await original!.evaluate(element => element.isConnected)).toBe(false);
    await openImport(page, source);
    await expect.poll(async () => (await motionTrace(page)).ends).toBe(2);
    expect((await motionTrace(page)).starts).toBe(2);
  }
});
