import { test, expect } from '@playwright/test';

test.afterEach(async ({request}) => {
  for (const provider of ['chesscom', 'lichess']) {
    expect((await request.put(`/api/providers/${provider}/connection`, {data: {username: ''}})).ok()).toBe(true);
  }
});

test('Lichess import uses shared filters, fetch-only jobs and deduplication', async ({page}, info) => {
  const username = `lichess-import-${info.project.name}`;
  await page.goto('/settings');
  await page.getByRole('button', {name: 'Lichess username', exact: true}).click();
  await expect(page.getByRole('heading', {name: 'Import from Lichess'})).toBeVisible();
  await page.getByLabel('Lichess username', {exact: true}).fill(username);
  await page.getByLabel('Time control', {exact: true}).selectOption('blitz');
  await expect(page.getByLabel('Time control').locator('option[value="classical"]')).toHaveCount(1);
  await expect(page.getByLabel('Time control').locator('option[value="daily"]')).toHaveCount(0);
  const queued = page.waitForResponse(r => r.url().endsWith('/api/imports/provider/lichess') && r.request().method() === 'POST');
  await page.getByRole('button', {name: 'Fetch games', exact: true}).click();
  const response = await queued;
  expect(response.status()).toBe(202);
  expect(response.request().postDataJSON()).toMatchObject({username, analyze: false, time_class: 'blitz'});
  const job = page.locator('.job').filter({hasText: `Lichess · ${username}`}).first();
  await expect(job.locator('.badge')).toHaveText('completed');
  await expect(job).toContainText('1 imported');
  await expect(job.getByRole('progressbar', {name: 'Analysis progress'})).toHaveCount(0);
  await page.getByRole('button', {name: 'Fetch games', exact: true}).click();
  await expect(job).toContainText('0 imported · 1 duplicates');
  await expect(job.locator('.badge')).toHaveText('completed');
  const jobs = await (await page.request.get('/api/jobs')).json();
  const saved = jobs.filter((value: {provider_import?: {username: string}}) => value.provider_import?.username === username);
  expect(saved).toHaveLength(2);
  expect(saved.every((value: {positions_triaged: number; kind: string}) => value.positions_triaged === 0 && value.kind === 'provider_fetch')).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({path: `test-results/lichess-import-${info.project.name}.png`, fullPage: true});
});

test('local saved connections refresh both providers and survive reload', async ({page}, info) => {
  const lichess = `lichess-sync-${info.project.name}`;
  const chesscom = `chesscom-sync-${info.project.name}`;
  await page.goto('/settings');
  for (const [name, username] of [['Chess.com', chesscom], ['Lichess', lichess]]) {
    const region = page.getByRole('region', {name: `Recent ${name} games`, exact: true});
    const summary = region.locator('summary');
    if (!(await region.locator('details').evaluate(el => (el as HTMLDetailsElement).open))) await summary.click();
    await region.getByLabel(`Remembered ${name} username`).fill(username);
    await region.getByRole('button', {name: 'Save username', exact: true}).click();
    await expect(region.locator('summary')).toHaveText(`Change ${name} connection`);
  }
  await expect(page.getByRole('region', {name: 'Recent Lichess games', exact: true}).getByRole('status')).toContainText('Last sync:', {timeout: 20000});
  await page.reload();
  for (const [name, username] of [['Chess.com', chesscom], ['Lichess', lichess]]) {
    const region = page.getByRole('region', {name: `Recent ${name} games`, exact: true});
    await region.locator('summary').click();
    await expect(region.getByLabel(`Remembered ${name} username`)).toHaveValue(username);
  }
  await page.getByRole('link', {name: 'Games', exact: true}).click();
  const chessResponse = page.waitForResponse(r => r.url().endsWith('/api/providers/chesscom/sync') && r.request().method() === 'POST');
  const lichessResponse = page.waitForResponse(r => r.url().endsWith('/api/providers/lichess/sync') && r.request().method() === 'POST');
  await page.getByRole('button', {name: 'Update games', exact: true}).click();
  expect((await chessResponse).ok()).toBe(true);
  expect((await lichessResponse).ok()).toBe(true);
  await expect(page.locator('.game-library-item').filter({hasText: lichess})).toHaveCount(1);
  await expect(page.locator('.game-library-item').filter({hasText: chesscom})).toHaveCount(1);
  // Leave the shared local test workspace disconnected for the other UI tests.
  for (const provider of ['chesscom', 'lichess']) {
    expect((await page.request.put(`/api/providers/${provider}/connection`, {data: {username: ''}})).ok()).toBe(true);
  }
});


test('saved-name hydration cannot merge with an in-progress manual username', async ({page}) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/providers/chesscom/sync', async route => {
    await gate;
    if (route.request().method() !== 'GET') return route.continue();
    await route.fulfill({json: {provider: 'chesscom', username: 'saved-name', job_id: null, status: 'not_started', checked_at: null, imported: 0, error: null}});
  });
  try {
    await page.goto('/settings');
    const field = page.getByLabel('Chess.com username', {exact: true});
    await expect(field).toBeDisabled();
    release();
    await expect(field).toBeEnabled();
    await expect(field).toHaveValue('saved-name');
    await field.fill('replacement');
    await expect(field).toHaveValue('replacement');
  } finally {
    release();
    await page.unrouteAll({behavior: 'wait'});
  }
});

test('Lichess opt-in analysis runs the existing native training pipeline', async ({page}, info) => {
  const username = `lichess-training-${info.project.name}`;
  await page.goto('/settings');
  await page.getByRole('button', {name: 'Lichess username', exact: true}).click();
  await page.getByLabel('Lichess username', {exact: true}).fill(username);
  await page.getByLabel('Time control', {exact: true}).selectOption('blitz');
  await page.getByRole('checkbox', {name: 'Also analyze these games for training'}).check();
  await page.getByRole('button', {name: 'Fetch & analyze games'}).click();
  const job = page.locator('.job').filter({hasText: `Lichess · ${username}`}).first();
  await expect(job.locator('.badge')).toHaveText('completed', {timeout: 30000});
  await expect(job).toContainText('1 imported');
  await expect(job).toContainText('2 decisions');
});
