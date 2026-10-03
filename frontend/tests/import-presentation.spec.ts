import {expect, test, type Locator, type Page} from '@playwright/test';
import type {Job, Schema} from '../src/api';

type Motion = Schema['MotionPreferences']['motion'];
type LayoutTrace = {starts: number; ends: number; transitions: Animation[]};

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

async function watchLayout(page: Page) {
  await page.addInitScript(() => {
    const trace: LayoutTrace = {starts: 0, ends: 0, transitions: []};
    Object.assign(window, {importLayoutMotion: trace});
    document.addEventListener('transitionrun', event => {
      if (event.propertyName !== 'grid-template-rows' || !(event.target instanceof HTMLElement) ||
        !event.target.matches('.import-form')) return;
      trace.starts++;
      const transition = event.target.getAnimations().find(value =>
        value instanceof CSSTransition && value.transitionProperty === event.propertyName)!;
      trace.transitions.push(transition);
      transition.pause();
    }, true);
    document.addEventListener('transitionend', event => {
      if (event.propertyName === 'grid-template-rows' && event.target instanceof HTMLElement &&
        event.target.matches('.import-form')) trace.ends++;
    }, true);
  });
}

const layoutTrace = (page: Page) => page.evaluate(() => {
  const trace = (window as unknown as {importLayoutMotion: LayoutTrace}).importLayoutMotion;
  return {starts: trace.starts, ends: trace.ends, states: trace.transitions.map(value => value.playState)};
});

async function pausedLayout(page: Page, starts: number) {
  await expect.poll(async () => (await layoutTrace(page)).starts).toBe(starts);
  await page.evaluate(async () => {
    await (window as unknown as {importLayoutMotion: LayoutTrace}).importLayoutMotion.transitions.at(-1)!.ready;
  });
  expect((await layoutTrace(page)).states.at(-1)).toBe('paused');
}

async function seekLayout(page: Page, progress: number) {
  await page.evaluate(fraction => {
    const transition = (window as unknown as {importLayoutMotion: LayoutTrace}).importLayoutMotion.transitions.at(-1)!;
    transition.currentTime = Number(transition.effect!.getTiming().duration) * fraction;
  }, progress);
}

async function finishLayout(page: Page) {
  const ends = await page.evaluate(() => {
    const trace = (window as unknown as {importLayoutMotion: LayoutTrace}).importLayoutMotion;
    trace.transitions.at(-1)!.finish();
    return trace.ends;
  });
  await expect.poll(async () => (await layoutTrace(page)).ends).toBe(ends + 1);
}

const layout = (page: Page) => page.evaluate(() => ({
  height: document.querySelector('.import-form')!.getBoundingClientRect().height,
  activity: document.querySelector('#settings-activity')!.getBoundingClientRect().top + scrollY,
}));

async function expectClosed(page: Page) {
  const wrapper = page.locator('.import-form');
  await expect(wrapper).toHaveCount(1);
  await expect(wrapper.locator('.import-form-body')).toHaveCount(0);
  await expect(wrapper).toHaveAttribute('aria-hidden', 'true');
  await expect(wrapper).toHaveAttribute('inert', '');
  await expect(wrapper).not.toHaveAttribute('tabindex');
  await expect(wrapper).not.toHaveAttribute('data-open');
  expect((await layout(page)).height).toBeCloseTo(0, 0);
}

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

test('import motion expands and collapses the actual layout according to device and account preferences', async ({page}) => {
  const state = await fixtures(page);
  await watchLayout(page);
  for (const [device, preference, animated] of [
    ['reduce', 'system', false], ['reduce', 'natural', true],
    ['no-preference', 'still', false], ['no-preference', 'system', true],
  ] as const) {
    state.motion = preference;
    await page.emulateMedia({reducedMotion: device});
    for (const source of ['chesscom', 'pgn'] as const) {
      await page.goto('/settings');
      await expect(page.locator('html')).toHaveAttribute('data-interface-motion', animated ? 'natural' : 'still');
      await expect(page.getByLabel('Remembered Lichess username')).toBeEnabled();
      await page.evaluate(() => document.fonts.ready);
      const closed = await layout(page);
      expect(closed.height).toBeCloseTo(0, 0);
      const form = await openImport(page, source);
      const original = await form.elementHandle();
      const wrapper = page.locator('.import-form');
      if (animated) {
        await pausedLayout(page, 1);
        await seekLayout(page, 0);
        const start = await layout(page);
        await seekLayout(page, 0.5);
        const middle = await layout(page);
        await finishLayout(page);
        const full = await layout(page);
        expect(start.height).toBeCloseTo(0, 0);
        expect(middle.height).toBeGreaterThan(start.height + 1);
        expect(middle.height).toBeLessThan(full.height - 1);
        expect(middle.activity).toBeGreaterThan(start.activity);
        expect(middle.activity).toBeLessThan(full.activity);
        expect(middle.activity - start.activity).toBeCloseTo(middle.height - start.height, 0);
        expect(full.activity - closed.activity).toBeCloseTo(full.height, 0);
        await page.getByRole('button', {name: 'Close import form', exact: true}).click();
        await pausedLayout(page, 2);
        await seekLayout(page, 0.5);
        const collapsing = await layout(page);
        expect(collapsing.height).toBeGreaterThan(1);
        expect(collapsing.height).toBeLessThan(full.height - 1);
        expect(full.activity - collapsing.activity).toBeCloseTo(full.height - collapsing.height, 0);
        await expect(wrapper).toHaveAttribute('inert', '');
        await expect(wrapper).toHaveAttribute('data-closing', 'true');
        await expect(page).toHaveURL(`/settings?import=${source}`);
        expect(await original!.evaluate(element => element.isConnected)).toBe(true);
        expect(await wrapper.evaluate(element => element.contains(document.activeElement))).toBe(false);
        await finishLayout(page);
      } else {
        await expect(wrapper).toHaveCSS('transition-duration', '0s');
        expect((await layout(page)).height).toBeGreaterThan(0);
        expect((await layoutTrace(page)).starts).toBe(0);
        await page.getByRole('button', {name: 'Close import form', exact: true}).click();
        expect(await wrapper.locator('.import-form-body').count()).toBe(0);
      }
      await expectClosed(page);
      await expect(page).toHaveURL('/settings');
      expect(await original!.evaluate(element => element.isConnected)).toBe(false);
      expect((await layout(page)).activity).toBeCloseTo(closed.activity, 0);
    }
  }
});

test('editing, polling and switching an open source preserve the shell without replaying expansion', async ({page}) => {
  const state = await fixtures(page);
  state.motion = 'natural';
  await watchLayout(page);
  const job = (games: number): Job => ({
    id: 'import-presentation-history', status: 'completed', kind: 'training', user_id: 'presentation-fixture',
    created_at: '2026-09-29T10:00:00Z', activity: null, cancel_requested: false,
    chesscom: null, classifications_completed: games, priority: 0, puzzles_found: 0, deep_completed: games, error: null,
    games_processed: games, games_total: games, import_id: null, mistakes_identified: games,
    positions_triaged: games * 2, probe_total: null, provider_import: null,
  });
  for (const source of ['chesscom', 'pgn'] as const) {
    state.jobs = [job(1)];
    await page.goto('/settings');
    await expect(page.locator('html')).toHaveAttribute('data-interface-motion', 'natural');
    const wrapper = await page.locator('.import-form').elementHandle();
    const form = await openImport(page, source);
    await pausedLayout(page, 1);
    await finishLayout(page);
    const original = await form.elementHandle();
    if (source === 'pgn') await form.getByRole('button', {name: 'Paste PGN text', exact: true}).click();
    const draft = source === 'pgn' ? form.getByRole('textbox', {name: 'PGN', exact: true})
      : form.getByLabel('Chess.com username', {exact: true});
    await expect(draft).toBeEnabled();
    const value = source === 'pgn' ? '[White "Draft"]\n\n1. d4 d5 *' : 'Unfinished_Draft';
    await draft.fill(value);
    await draft.focus();
    state.jobs = [job(2)];
    await expect(page.locator('.job-history summary')).toContainText('2 / 2 games · 4 decisions');
    expect(await original!.evaluate(element => element === document.querySelector('.import-form form'))).toBe(true);
    await expect(draft).toHaveValue(value);
    await expect(draft).toBeFocused();
    expect(await layoutTrace(page)).toMatchObject({starts: 1, ends: 1});
    const other = source === 'pgn' ? 'chesscom' : 'pgn';
    await openImport(page, other);
    // Flush the new source's style and transition events without a timed sleep.
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    expect(await wrapper!.evaluate(element => element === document.querySelector('.import-form'))).toBe(true);
    expect(await original!.evaluate(element => element.isConnected)).toBe(false);
    expect(await layoutTrace(page)).toMatchObject({starts: 1, ends: 1});
    await page.getByRole('button', {name: 'Close import form', exact: true}).click();
    await pausedLayout(page, 2);
    await finishLayout(page);
    await expectClosed(page);
    await openImport(page, other);
    await pausedLayout(page, 3);
    await finishLayout(page);
    expect(await wrapper!.evaluate(element => element === document.querySelector('.import-form'))).toBe(true);
  }
});

test('reversing a collapse preserves the draft and focus, while source and motion changes cancel cleanly', async ({page}) => {
  const state = await fixtures(page);
  state.motion = 'system';
  await watchLayout(page);
  for (const source of ['chesscom', 'pgn'] as const) {
    await page.emulateMedia({reducedMotion: 'no-preference'});
    await page.goto('/settings');
    await expect(page.locator('html')).toHaveAttribute('data-interface-motion', 'natural');
    const form = await openImport(page, source);
    await pausedLayout(page, 1);
    await finishLayout(page);
    const original = await form.elementHandle();
    if (source === 'pgn') await form.getByRole('button', {name: 'Paste PGN text', exact: true}).click();
    const draft = source === 'pgn' ? form.getByRole('textbox', {name: 'PGN', exact: true})
      : form.getByLabel('Chess.com username', {exact: true});
    await expect(draft).toBeEnabled();
    const value = source === 'pgn' ? '[White "Retained"]\n\n1. e4 e5 *' : 'Retained_Draft';
    await draft.fill(value);
    await page.getByRole('button', {name: 'Close import form', exact: true}).click();
    await pausedLayout(page, 2);
    await seekLayout(page, 0.5);
    await openImport(page, source);
    await pausedLayout(page, 3);
    await seekLayout(page, 0.5);
    const wrapper = page.locator('.import-form');
    await expect(wrapper).not.toHaveAttribute('inert');
    await expect(wrapper).not.toHaveAttribute('data-closing');
    await expect(wrapper).toBeFocused();
    await expect(draft).toHaveValue(value);
    expect(await original!.evaluate(element => element === document.querySelector('.import-form form'))).toBe(true);
    expect((await layoutTrace(page)).states[1]).toBe('idle');

    // Close before re-expansion finishes, then select a different source.
    await page.getByRole('button', {name: 'Close import form', exact: true}).click();
    await pausedLayout(page, 4);
    await seekLayout(page, 0.5);
    expect((await layoutTrace(page)).states[2]).toBe('idle');
    const other = source === 'pgn' ? 'chesscom' : 'pgn';
    await openImport(page, other);
    await pausedLayout(page, 5);
    await finishLayout(page);
    await expect(wrapper).not.toHaveAttribute('data-closing');
    await expect(wrapper).toBeFocused();
    expect((await layoutTrace(page)).states[3]).toBe('idle');
    expect(await original!.evaluate(element => element.isConnected)).toBe(false);
    await expect(page).toHaveURL(`/settings?import=${other}`);

    await page.getByRole('button', {name: 'Close import form', exact: true}).click();
    await pausedLayout(page, 6);
    await seekLayout(page, 0.5);
    const completed = (await layoutTrace(page)).ends;
    await page.emulateMedia({reducedMotion: 'reduce'});
    await expect(page.locator('html')).toHaveAttribute('data-interface-motion', 'still');
    await expectClosed(page);
    await expect(page).toHaveURL('/settings');
    expect((await layoutTrace(page)).ends).toBe(completed);
    expect((await layoutTrace(page)).states.at(-1)).toBe('idle');
  }
});
