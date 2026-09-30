import {expect, test, type Page} from '@playwright/test';
import type {Evidence, Schema} from '../src/api';

const categories = (page: Page) => page.getByRole('navigation', {name: 'Weakness categories'});
const card = (page: Page, title: string) => page.getByRole('article', {name: title, exact: true});

function skill(overrides: Partial<Schema['SkillPriority']>): Schema['SkillPriority'] {
  return {
    skill_id: 'pin', title: 'Pinned defender', kind: 'mechanism', cue: 'Check what the pinned piece protects.',
    decision_ids: ['pin-one', 'pin-two'], evidence_ids: ['evidence-one', 'evidence-two'],
    unique_positions: 3, independent_games: 2, reviews: 4, failures: 1, occurrences: 3,
    focused_attempts: 4, focused_failures: 1, lesson_attempts: 0, lesson_failures: 0,
    practice_positions: 3, priority: 1, provisional: false, retention: 'needs_practice',
    ...overrides,
  };
}

function weaknesses(skills = [
  skill({}),
  skill({skill_id: 'missed_tactical_capture', title: 'Missed tactical capture', cue: 'Look for loose pieces before moving.',
    independent_games: 1, unique_positions: 1, provisional: true, practice_positions: 0,
    focused_attempts: 0, focused_failures: 0, decision_ids: ['capture-one']}),
  skill({skill_id: 'material_loss', title: 'Material loss', kind: 'outcome', cue: 'Check what can be captured next.',
    practice_positions: 2, decision_ids: ['material-one', 'material-two']}),
  skill({skill_id: 'allowed_mate', title: 'Allowed mate', kind: 'outcome', cue: 'Check forcing threats to your king.',
    independent_games: 1, provisional: true, practice_positions: 1, decision_ids: ['mate-one']}),
]): Schema['Weaknesses'] {
  return {classification_available: true, unclassified: 0, skills, coverage: {
    total: 8, labeled: 8, mechanisms: 4, outcomes: 4, outcome_only: 4,
    pending: 0, unclassified: 0, abstention_reasons: {},
  }};
}

test.beforeEach(async ({page}) => {
  await page.route('**/api/preferences/motion', route => route.fulfill({json: {motion: 'still'}}));
});

test('category destinations support history and reload while reusing the loaded weaknesses', async ({page}) => {
  let requests = 0;
  const documents: string[] = [];
  await page.route('**/api/weaknesses', route => {
    requests++;
    return route.fulfill({json: weaknesses()});
  });
  page.on('request', request => { if (request.isNavigationRequest()) documents.push(request.url()); });
  await page.goto('/weaknesses');
  const navigation = categories(page);
  await expect(navigation.getByRole('link')).toHaveText(['Tactical patterns', 'Material & mate']);
  const patterns = navigation.getByRole('link', {name: 'Tactical patterns', exact: true});
  const outcomes = navigation.getByRole('link', {name: 'Material & mate', exact: true});
  await expect(patterns).toHaveAttribute('href', '/weaknesses');
  await expect(outcomes).toHaveAttribute('href', '/weaknesses?category=outcomes');
  await expect(patterns).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('heading', {name: 'Pinned defender', exact: true})).toBeVisible();
  await expect(page.getByRole('heading', {name: 'Material loss', exact: true})).toHaveCount(0);
  await outcomes.click();
  await expect(page).toHaveURL('/weaknesses?category=outcomes');
  await expect(outcomes).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('heading', {name: 'Material loss', exact: true})).toBeVisible();
  await expect(page.getByRole('heading', {name: 'Pinned defender', exact: true})).toHaveCount(0);
  await page.goBack();
  await expect(patterns).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('heading', {name: 'Pinned defender', exact: true})).toBeVisible();
  await page.goForward();
  await expect(outcomes).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('heading', {name: 'Allowed mate', exact: true})).toBeVisible();
  expect(requests).toBe(1);
  expect(documents).toHaveLength(1);
  await page.reload();
  await expect(outcomes).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('heading', {name: 'Material loss', exact: true})).toBeVisible();
  expect(requests).toBe(2);
  await page.goto('/weaknesses?category=unknown');
  await expect(patterns).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('heading', {name: 'Pinned defender', exact: true})).toBeVisible();
  await expect(page.getByRole('heading', {name: 'Material loss', exact: true})).toHaveCount(0);
});

test('skill evidence, targeted practice and disabled positions remain usable on narrow phones', async ({page}, info) => {
  await page.route('**/api/weaknesses', route => route.fulfill({json: weaknesses()}));
  const evidenceRequests: string[] = [];
  await page.route('**/api/evidence/*', route => {
    const id = new URL(route.request().url()).pathname.split('/').at(-1)!;
    evidenceRequests.push(id);
    const evidence: Evidence = {
      id, fen: '4k3/8/8/8/8/8/6P1/4K3 w - - 0 1', played_san: 'g3', ply: 1,
      loss_cp: 100, allows_mate: false, mate_lost: false, facts: {},
      candidates: [{uci: 'g2g4', san: 'g4', pv: ['g2g4'], score: {kind: 'cp', value: 100, mate_given: false}, depth: 1}],
      classifications: [],
    };
    return route.fulfill({json: evidence});
  });
  if (info.project.name === 'mobile') await page.setViewportSize({width: 320, height: 800});
  await page.goto('/weaknesses');
  const supported = card(page, 'Pinned defender');
  const early = card(page, 'Missed tactical capture');
  await expect(supported).toContainText(/across several games/i);
  await expect(early).toContainText(/early evidence/i);
  await expect(supported).toContainText('Check what the pinned piece protects.');
  await expect(supported.getByRole('term')).toHaveText(['Positions', 'Games', 'Scheduled reviews']);
  await expect(supported.getByRole('definition')).toHaveText(['3', '2', '4']);
  await expect(supported).toContainText(/3\s*\/\s*4\s+clean solves in recent focused practice/);
  await expect(supported.getByRole('link', {name: 'Practice 3 positions', exact: true})).toHaveAttribute('href', '/study/due?focus=pin');
  await expect(early.getByRole('button', {name: 'No active positions', exact: true})).toBeDisabled();
  const summary = supported.locator('summary');
  await expect(summary).toContainText(/supporting positions \(2\)/i);
  await summary.focus();
  await summary.press('Enter');
  const example = supported.getByRole('button', {name: 'Example 2', exact: true});
  await example.click();
  const dialog = page.getByRole('dialog', {name: 'Decision evidence', exact: true});
  await expect(dialog.getByRole('heading', {name: 'You played g3', exact: true})).toBeVisible();
  await expect(dialog.getByRole('heading', {name: 'Engine candidates', exact: true})).toBeVisible();
  expect(evidenceRequests).toEqual(['pin-two']);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(example).toBeFocused();
  await expect(page).toHaveURL('/weaknesses');
  await categories(page).getByRole('link', {name: 'Material & mate', exact: true}).click();
  await expect(card(page, 'Material loss').getByRole('link', {name: 'Practice 2 positions', exact: true}))
    .toHaveAttribute('href', '/study/due?focus=material_loss');
  await expect(card(page, 'Allowed mate')).toContainText(/early evidence/i);
  await expect(card(page, 'Allowed mate').getByRole('link', {name: 'Practice 1 position', exact: true}))
    .toHaveAttribute('href', '/study/due?focus=allowed_mate');
  for (const link of await categories(page).getByRole('link').all()) {
    expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('an empty selected category stays distinct from having no supported weaknesses', async ({page}) => {
  let data = weaknesses(weaknesses().skills.filter(value => value.kind === 'outcome'));
  let requests = 0;
  await page.route('**/api/weaknesses', route => { requests++; return route.fulfill({json: data}); });
  await page.goto('/weaknesses');
  await expect(categories(page).getByRole('link', {name: 'Tactical patterns', exact: true})).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('heading', {name: /no.*patterns/i})).toBeVisible();
  await expect(page.getByRole('heading', {name: 'No supported weaknesses yet.', exact: true})).toHaveCount(0);
  await categories(page).getByRole('link', {name: 'Material & mate', exact: true}).click();
  await expect(page.getByRole('heading', {name: 'Material loss', exact: true})).toBeVisible();
  expect(requests).toBe(1);
  data = weaknesses([]);
  await page.reload();
  await expect(categories(page).getByRole('link', {name: 'Material & mate', exact: true})).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('heading', {name: 'No supported weaknesses yet.', exact: true})).toBeVisible();
  await expect(page.getByRole('heading', {name: 'Material loss', exact: true})).toHaveCount(0);
});

test('loading and retry preserve the chosen category without duplicate requests', async ({page}) => {
  let releaseFirst!: () => void;
  let releaseRetry!: () => void;
  const first = new Promise<void>(resolve => { releaseFirst = resolve; });
  const retry = new Promise<void>(resolve => { releaseRetry = resolve; });
  let requests = 0;
  await page.route('**/api/weaknesses', async route => {
    const attempt = ++requests;
    await (attempt === 1 ? first : retry);
    await route.fulfill(attempt === 1 ? {status: 503, json: {detail: 'Weakness evidence temporarily unavailable'}} : {json: weaknesses()});
  });
  try {
    await page.goto('/weaknesses');
    await expect(page.getByRole('status')).toContainText(/loading/i);
    await expect.poll(() => requests).toBe(1);
    await categories(page).getByRole('link', {name: 'Material & mate', exact: true}).click();
    expect(requests).toBe(1);
    releaseFirst();
    await expect(page.getByRole('alert')).toContainText('Couldn’t load your weaknesses. Please try again.');
    await page.getByRole('button', {name: 'Try again', exact: true}).click();
    await expect(page.getByRole('status')).toContainText(/loading/i);
    await expect.poll(() => requests).toBe(2);
    releaseRetry();
    await expect(page.getByRole('heading', {name: 'Material loss', exact: true})).toBeVisible();
    await expect(categories(page).getByRole('link', {name: 'Material & mate', exact: true})).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByRole('status')).toHaveCount(0);
  } finally {
    releaseFirst(); releaseRetry();
    await page.unrouteAll({behavior: 'wait'});
  }
});

test('leaving Weaknesses ignores a late failed response', async ({page}) => {
  let release!: () => void;
  let settled!: () => void;
  let started!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const handled = new Promise<void>(resolve => { settled = resolve; });
  const requested = new Promise<void>(resolve => { started = resolve; });
  await page.route('**/api/weaknesses', async route => {
    started();
    await gate;
    try { await route.fulfill({status: 503, json: {detail: 'Obsolete weaknesses response'}}); }
    finally { settled(); }
  });
  await page.route('**/api/jobs', route => route.fulfill({json: []}));
  await page.route('**/api/game-providers', route => route.fulfill({json: []}));
  try {
    await page.goto('/weaknesses');
    await expect(page.getByRole('status')).toContainText(/loading/i);
    await requested;
    await page.getByRole('navigation', {name: 'Main navigation'}).getByRole('link', {name: 'Settings', exact: true}).click();
    await expect(page.getByRole('heading', {name: 'Settings', exact: true})).toBeVisible();
    release();
    await handled;
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await expect(page.getByText('Obsolete weaknesses response', {exact: true})).toHaveCount(0);
    await expect(page).toHaveURL('/settings');
  } finally {
    release();
    await page.unrouteAll({behavior: 'wait'});
  }
});
