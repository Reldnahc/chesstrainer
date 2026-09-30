import {test, expect, type Page} from '@playwright/test';
import type {Job, Schema} from '../src/api';

const sections = (page: Page) => page.getByRole('navigation', {name: 'Settings sections'});
const connection = (page: Page, name: string) => page.getByRole('region', {name: `Recent ${name} games`, exact: true});

function syncStatus(provider: string, username = ''): Schema['SyncStatus'] {
  return {provider, username, status: 'not_started', checked_at: null, imported: 0, job_id: null, error: null};
}

test.beforeEach(async ({page}) => {
  // Keep settings navigation and source choices independent of prior imports.
  await page.route('**/api/jobs', route => route.fulfill({json: []}));
  await page.route('**/api/providers/*/sync', route => {
    const provider = new URL(route.request().url()).pathname.split('/')[3];
    return route.fulfill({json: syncStatus(provider)});
  });
});

test('settings sections mount only their controls and restore through Back, Forward and reload', async ({page}, info) => {
  const documents: string[] = [];
  page.on('request', request => { if (request.isNavigationRequest()) documents.push(request.url()); });
  await page.goto('/settings');
  await expect(sections(page).getByRole('link')).toHaveText(['Games & imports', 'Coach & sound', 'Advanced']);
  await expect(sections(page).getByRole('link', {name: 'Games & imports', exact: true})).toHaveAttribute('aria-current', 'page');
  await expect(connection(page, 'Chess.com')).toBeVisible();
  await expect(connection(page, 'Lichess')).toBeVisible();
  await expect(page.getByRole('button', {name: 'Import PGN', exact: true})).toBeVisible();
  await expect(page.getByLabel('Chess.com username', {exact: true})).toHaveCount(0);
  await expect(page.getByLabel('PGN', {exact: true})).toHaveCount(0);
  await expect(page.getByRole('radio')).toHaveCount(0);
  await expect(page.getByRole('region', {name: 'Animations', exact: true})).toHaveCount(0);
  await expect(page.getByRole('region', {name: 'Account', exact: true})).toHaveCount(0);
  await expect(page.getByRole('button', {name: 'Classify saved games', exact: true})).toHaveCount(0);
  await expect(connection(page, 'Lichess').getByLabel('Remembered Lichess username')).toBeEnabled();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({path: `test-results/settings-imports-${info.project.name}.png`, fullPage: true});
  const initialHistory = await page.evaluate(() => history.length);
  await sections(page).getByRole('link', {name: 'Games & imports', exact: true}).click();
  expect(await page.evaluate(() => history.length)).toBe(initialHistory);

  await sections(page).getByRole('link', {name: 'Coach & sound', exact: true}).click();
  await expect(page).toHaveURL('/settings?section=coach');
  await expect(page.getByRole('radio')).toHaveCount(30);
  await expect(page.getByRole('region', {name: 'Animations', exact: true})).toBeVisible();
  await expect(connection(page, 'Chess.com')).toHaveCount(0);
  await expect(page.getByRole('button', {name: 'Classify saved games', exact: true})).toHaveCount(0);
  await page.screenshot({path: `test-results/settings-coaches-${info.project.name}.png`, fullPage: true});
  await sections(page).getByRole('link', {name: 'Advanced', exact: true}).click();
  await expect(page).toHaveURL('/settings?section=advanced');
  await expect(page.getByRole('button', {name: 'Classify saved games', exact: true})).toBeVisible();
  await expect(page.getByRole('button', {name: 'Deepen unclear positions', exact: true})).toBeEnabled();
  await expect(page.getByRole('radio')).toHaveCount(0);
  await expect(connection(page, 'Chess.com')).toHaveCount(0);
  expect(await page.evaluate(() => history.length)).toBe(initialHistory + 2);
  await page.goBack();
  await expect(page).toHaveURL('/settings?section=coach');
  await expect(page.getByRole('radio')).toHaveCount(30);
  await page.goBack();
  await expect(page).toHaveURL('/settings');
  await expect(connection(page, 'Chess.com')).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL('/settings?section=coach');
  expect(documents).toHaveLength(1);
  await page.reload();
  await expect(sections(page).getByRole('link', {name: 'Coach & sound', exact: true})).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('radio')).toHaveCount(30);
});

test('local account links fall back to imports and settings fit narrow viewports', async ({page}) => {
  await page.goto('/settings?section=account');
  await expect(sections(page).getByRole('link', {name: 'Account', exact: true})).toHaveCount(0);
  await expect(sections(page).getByRole('link', {name: 'Games & imports', exact: true})).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('button', {name: 'Sign out', exact: true})).toHaveCount(0);
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({width, height: 700});
    for (const name of ['Games & imports', 'Coach & sound', 'Advanced']) {
      await sections(page).getByRole('link', {name, exact: true}).click();
      await expect(sections(page).getByRole('link', {name, exact: true})).toBeInViewport();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  }
});

test('import actions and deep links select their form without reloading settings', async ({page}) => {
  const documents: string[] = [];
  page.on('request', request => { if (request.isNavigationRequest()) documents.push(request.url()); });
  await page.goto('/settings?import=chesscom');
  await expect(page.getByRole('heading', {name: 'Import from Chess.com', exact: true})).toBeVisible();
  await expect(page.getByRole('checkbox', {name: 'Also analyze these games for training'})).not.toBeChecked();
  await expect(page.getByRole('button', {name: 'Import games', exact: true})).toBeVisible();
  await connection(page, 'Lichess').getByRole('button', {name: 'Import older games', exact: true}).click();
  await expect(page).toHaveURL('/settings?import=lichess');
  await expect(page.getByRole('heading', {name: 'Import from Lichess', exact: true})).toBeVisible();
  await expect(page.getByLabel('Chess.com username', {exact: true})).toHaveCount(0);
  await page.getByRole('button', {name: 'Import PGN', exact: true}).click();
  await expect(page).toHaveURL('/settings?import=pgn');
  await expect(page.getByRole('heading', {name: 'Import PGN', exact: true})).toBeVisible();
  await expect(page.getByLabel('Lichess username', {exact: true})).toHaveCount(0);
  await page.goBack();
  await expect(page.getByRole('heading', {name: 'Import from Lichess', exact: true})).toBeVisible();
  await page.goForward();
  await expect(page.getByRole('heading', {name: 'Import PGN', exact: true})).toBeVisible();
  expect(documents).toHaveLength(1);
  await page.reload();
  await expect(page.getByRole('heading', {name: 'Import PGN', exact: true})).toBeVisible();
  await page.getByRole('button', {name: 'Close import form', exact: true}).click();
  await expect(page).toHaveURL('/settings');
  await expect(page.locator('.import-form-body')).toHaveCount(0);
});

test('Back restores the saved scroll instead of repeating activity and import-form jumps', async ({page}) => {
  await page.setViewportSize({width: 390, height: 600});
  await page.goto('/settings?section=advanced');
  await page.getByRole('link', {name: 'View import & analysis activity', exact: true}).click();
  await expect(page).toHaveURL('/settings#settings-activity');
  await expect(page.getByRole('region', {name: 'Import & analysis activity', exact: true})).toBeInViewport();
  await page.evaluate(() => scrollTo(0, 0));
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  await sections(page).getByRole('link', {name: 'Coach & sound', exact: true}).click();
  await expect(page).toHaveURL('/settings?section=coach');
  await page.goBack();
  await expect(page).toHaveURL('/settings#settings-activity');
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);

  await connection(page, 'Chess.com').getByRole('button', {name: 'Import older games', exact: true}).click();
  await expect(page).toHaveURL('/settings?import=chesscom');
  await page.locator('.import-form').evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished)));
  await expect(page.getByLabel('Chess.com username', {exact: true})).toBeInViewport();
  await page.evaluate(() => scrollTo(0, 0));
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  await sections(page).getByRole('link', {name: 'Coach & sound', exact: true}).click();
  await page.goBack();
  await expect(page).toHaveURL('/settings?import=chesscom');
  await expect(page.getByLabel('Chess.com username', {exact: true})).toBeEnabled();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
});

test('pointer interaction stops following an activity anchor as connection details expand', async ({page}) => {
  await page.route('**/api/providers/chesscom/sync', route => route.fulfill({json: syncStatus('chesscom', 'saved-player')}));
  await page.setViewportSize({width: 390, height: 700});
  await page.goto('/settings?section=advanced');
  await page.getByRole('link', {name: 'View import & analysis activity', exact: true}).click();
  await expect(connection(page, 'Chess.com').locator('.connection-username')).toHaveText('saved-player');
  await expect(page.locator('#settings-activity')).toBeInViewport();
  await page.evaluate(() => scrollTo(0, 0));
  const card = connection(page, 'Chess.com');
  await card.locator('summary').click();
  await expect(card.locator('details')).toHaveAttribute('open', '');
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect(card.getByLabel('Remembered Chess.com username')).toBeInViewport();
});

test('PGN source choices are exclusive and analysis is an explicit opt-in', async ({page}) => {
  const uploads: string[] = [];
  await page.route('**/api/imports', route => {
    uploads.push(route.request().postDataBuffer()!.toString());
    return route.fulfill({json: {imported: 1, duplicates: 0, errors: [], job_id: null}});
  });
  await page.goto('/settings?import=pgn');
  const file = page.getByLabel('PGN file', {exact: true});
  const text = page.getByLabel('PGN', {exact: true});
  const analyze = page.getByRole('checkbox', {name: 'Also analyze these games for training'});
  await expect(file).toHaveCount(1);
  await expect(text).toHaveCount(0);
  await expect(analyze).not.toBeChecked();
  await file.setInputFiles({name: 'file-games.pgn', mimeType: 'text/plain', buffer: Buffer.from('[Event "File source"]\n\n1. d4 d5 *')});
  await page.getByRole('button', {name: 'Paste PGN text', exact: true}).click();
  await expect(file).toHaveCount(0);
  await expect(text).toBeVisible();
  await text.fill('[Event "Pasted source"]\n[White "Learner"]\n\n1. e4 e5 *');
  await page.getByLabel('Your username(s)').fill('Learner');
  await page.getByRole('button', {name: 'Import games', exact: true}).click();
  await expect(page.locator('.import-form').getByRole('status')).toContainText('1 imported');
  expect(uploads).toHaveLength(1);
  expect(uploads[0]).toContain('Pasted source');
  expect(uploads[0]).not.toContain('File source');
  expect(uploads[0]).toMatch(/name="analyze"\r?\n\r?\nfalse/);
  await analyze.check();
  await expect(page.getByRole('button', {name: 'Import & analyze games', exact: true})).toBeVisible();
  await page.getByRole('button', {name: 'Choose a file', exact: true}).click();
  await expect(text).toHaveCount(0);
  await file.setInputFiles({name: 'chosen-games.pgn', mimeType: 'text/plain', buffer: Buffer.from('[Event "Chosen file source"]\n\n1. d4 d5 *')});
  await page.getByRole('button', {name: 'Import & analyze games', exact: true}).click();
  await expect.poll(() => uploads.length).toBe(2);
  expect(uploads[1]).toContain('Chosen file source');
  expect(uploads[1]).not.toContain('Pasted source');
  expect(uploads[1]).toMatch(/name="analyze"\r?\n\r?\ntrue/);
});

test('saved usernames reach older imports without overwriting a manual or blank draft', async ({page}) => {
  let username = '';
  await page.route('**/api/providers/chesscom/sync', route => route.fulfill({json: syncStatus('chesscom', username)}));
  await page.route('**/api/providers/chesscom/connection', route => {
    username = route.request().postDataJSON().username;
    return route.fulfill({json: syncStatus('chesscom', username)});
  });
  await page.goto('/settings');
  const card = connection(page, 'Chess.com');
  const remembered = card.getByLabel('Remembered Chess.com username');
  const imported = page.getByLabel('Chess.com username', {exact: true});
  async function save(value: string) {
    const details = card.locator('details');
    if (await details.count() && !(await details.evaluate(element => (element as HTMLDetailsElement).open))) await card.locator('summary').click();
    await remembered.fill(value);
    await card.getByRole('button', {name: 'Save username', exact: true}).click();
    await expect(card.locator('.connection-username')).toHaveText(value);
    if (!(await details.evaluate(element => (element as HTMLDetailsElement).open))) await card.locator('summary').click();
    await expect(remembered).toBeEnabled();
  }
  await save('first-saved');
  await card.getByRole('button', {name: 'Import older games', exact: true}).click();
  await expect(imported).toHaveValue('first-saved');
  await save('second-saved');
  await expect(imported).toHaveValue('second-saved');
  await imported.fill('manual-draft');
  await save('third-saved');
  await expect(imported).toHaveValue('manual-draft');
  await imported.fill('');
  await save('fourth-saved');
  await expect(imported).toHaveValue('');
  await page.getByRole('button', {name: 'Close import form', exact: true}).click();
  await expect(page.locator('.import-form-body')).toHaveCount(0);
  await card.getByRole('button', {name: 'Import older games', exact: true}).click();
  await expect(imported).toHaveValue('fourth-saved');
});

test('a stale connection poll started during a save cannot replace the newly saved name', async ({page}) => {
  let username = 'original-name', saving = false, heldPoll = false;
  let releaseSave!: () => void, releasePoll!: () => void, startedPoll!: () => void;
  const saveGate = new Promise<void>(resolve => { releaseSave = resolve; });
  const pollGate = new Promise<void>(resolve => { releasePoll = resolve; });
  const pollStarted = new Promise<void>(resolve => { startedPoll = resolve; });
  await page.route('**/api/providers/chesscom/sync', async route => {
    const value = syncStatus('chesscom', username);
    if (route.request().method() === 'GET' && saving && !heldPoll) {
      heldPoll = true;
      startedPoll();
      await pollGate;
    }
    await route.fulfill({json: value});
  });
  await page.route('**/api/providers/chesscom/connection', async route => {
    saving = true;
    await saveGate;
    username = route.request().postDataJSON().username;
    await route.fulfill({json: syncStatus('chesscom', username)});
  });
  try {
    await page.goto('/settings?import=chesscom');
    const imported = page.getByLabel('Chess.com username', {exact: true});
    await expect(imported).toHaveValue('original-name');
    await expect(connection(page, 'Lichess').getByLabel('Remembered Lichess username')).toBeEnabled();
    const card = connection(page, 'Chess.com');
    if (!(await card.locator('details').evaluate(element => (element as HTMLDetailsElement).open))) await card.locator('summary').click();
    await card.getByLabel('Remembered Chess.com username').fill('newly-saved');
    const savingRequest = page.waitForRequest(request => request.url().endsWith('/api/providers/chesscom/connection'));
    await card.getByRole('button', {name: 'Save username', exact: true}).click();
    await savingRequest;
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await pollStarted;
    releaseSave();
    await expect(card.locator('.connection-username')).toHaveText('newly-saved');
    await expect(imported).toHaveValue('newly-saved');
    const staleResponse = page.waitForResponse(response => response.url().endsWith('/api/providers/chesscom/sync') && response.request().method() === 'GET');
    releasePoll();
    await (await staleResponse).finished();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await expect(card.locator('.connection-username')).toHaveText('newly-saved');
    await expect(imported).toHaveValue('newly-saved');
  } finally {
    releaseSave();
    releasePoll();
    await page.unrouteAll({behavior: 'wait'});
  }
});

test('activity stays compact when empty and bounds completed history without hiding active work', async ({page}) => {
  await page.goto('/settings');
  const activity = page.getByRole('region', {name: 'Import & analysis activity', exact: true});
  await expect(activity).toBeVisible();
  await expect(activity.locator('.job')).toHaveCount(0);
  expect((await activity.boundingBox())!.height).toBeLessThan(240);
  const job = (id: string, status: string): Job => ({
    id, status, kind: 'training', user_id: 'settings-fixture', created_at: '2026-09-29T10:00:00Z',
    activity: null, cancel_requested: false, chesscom: null, classifications_completed: 1, deep_completed: 1,
    error: null, games_processed: status === 'completed' ? 1 : 0, games_total: 1, import_id: null,
    mistakes_identified: 1, positions_triaged: 2, probe_total: null, provider_import: null,
  });
  const jobs = [...Array.from({length: 8}, (_, index) => job(`done-${index}`, 'completed')), job('running', 'running'), job('queued', 'queued')];
  await page.route('**/api/jobs', route => route.fulfill({json: jobs}));
  await page.reload();
  await expect(activity.locator('.job-history')).toHaveCount(3);
  await expect(activity.locator('.job:not(.job-history)')).toHaveCount(2);
  await expect(activity.getByRole('button', {name: 'Cancel', exact: true})).toHaveCount(2);
  const completed = activity.locator('.job-history').first();
  await expect(completed.locator('details')).not.toHaveAttribute('open');
  await expect(completed.getByRole('progressbar')).toHaveCount(0);
  await completed.locator('summary').click();
  await expect(completed.getByRole('progressbar', {name: 'Analysis progress'})).toBeVisible();
  await activity.getByRole('button', {name: 'Show older activity (5)', exact: true}).click();
  await expect(activity.locator('.job-history')).toHaveCount(8);
  await activity.getByRole('button', {name: 'Show recent activity', exact: true}).click();
  await expect(activity.locator('.job-history')).toHaveCount(3);
  await expect(activity.getByRole('button', {name: 'Cancel', exact: true})).toHaveCount(2);
});

test('leaving imports discards a late activity loading error', async ({page}) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/jobs', async route => {
    await gate;
    await route.fulfill({status: 503, json: {detail: 'Activity error from the previous section'}});
  });
  try {
    const loading = page.waitForRequest(request => new URL(request.url()).pathname === '/api/jobs');
    await page.goto('/settings');
    await loading;
    await sections(page).getByRole('link', {name: 'Coach & sound', exact: true}).click();
    await expect(page).toHaveURL('/settings?section=coach');
    await expect(page.getByRole('region', {name: 'Animations', exact: true})).toBeVisible();
    const delivered = page.waitForResponse(response => new URL(response.url()).pathname === '/api/jobs');
    release();
    await (await delivered).finished();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await expect(page.getByText('Activity error from the previous section', {exact: true})).toHaveCount(0);
    await expect(page.getByRole('region', {name: 'Import & analysis activity', exact: true})).toHaveCount(0);
  } finally {
    release();
    await page.unrouteAll({behavior: 'wait'});
  }
});
