import { expect, test } from '@playwright/test';

test.beforeEach(async ({page}) => {
  await page.route('**/api/jobs', route => route.fulfill({json: []}));
  await page.route('**/api/providers/*/sync', route => route.fulfill({json: {
    provider: new URL(route.request().url()).pathname.split('/')[3], username: '',
    job_id: null, status: 'not_started', checked_at: null, imported: 0, error: null,
  }}));
});

test('PGN import keeps its submitted options and editable draft while showing the upload busy action', async ({page}) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const uploads: string[] = [];
  await page.route('**/api/imports', async route => {
    uploads.push(route.request().postDataBuffer()!.toString());
    await gate;
    await route.fulfill({json: {imported: 1, duplicates: 0, errors: [], job_id: null}});
  });
  try {
    await page.goto('/settings?import=pgn');
    await page.getByRole('button', {name: 'Paste PGN text', exact: true}).click();
    const pgn = '[Event "Shared import controls"]\n[White "Learner"]\n\n1. e4 e5 *';
    await page.getByRole('textbox', {name: 'PGN', exact: true}).fill(pgn);
    await page.getByLabel('Your username(s)').fill('Learner, Alias');
    await page.getByRole('combobox', {name: 'Learner side', exact: true}).selectOption('white');
    const analyze = page.getByRole('checkbox', {name: 'Also analyze these games for training', exact: true});
    await expect(analyze).not.toBeChecked();
    await analyze.check();
    const submit = page.getByRole('button', {name: 'Import & analyze games', exact: true});
    await expect(submit).toHaveAttribute('type', 'submit');
    await submit.click();
    const busy = page.getByRole('button', {name: 'Importing…', exact: true});
    await expect(busy).toBeDisabled();
    await expect(analyze).toBeEnabled();
    await analyze.uncheck();
    await expect(busy).toBeDisabled();
    await expect.poll(() => uploads.length).toBe(1);
    expect(uploads[0]).toContain(pgn);
    expect(uploads[0]).toMatch(/name="usernames"\r?\n\r?\nLearner, Alias/);
    expect(uploads[0]).toMatch(/name="side"\r?\n\r?\nwhite/);
    expect(uploads[0]).toMatch(/name="analyze"\r?\n\r?\ntrue/);
    release();
    await expect(page.locator('.import-form').getByRole('status')).toContainText('1 imported');
    await expect(page.getByRole('button', {name: 'Import games', exact: true})).toBeEnabled();
    await expect(page.getByRole('textbox', {name: 'PGN', exact: true})).toHaveValue(pgn);
    await expect(page.getByLabel('Your username(s)')).toHaveValue('Learner, Alias');
    await expect(page.getByRole('combobox', {name: 'Learner side', exact: true})).toHaveValue('white');
  } finally {
    release();
    await page.unrouteAll({behavior: 'wait'});
  }
});

test('provider import keeps date and time filters while showing its queue busy action', async ({page}) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const requests: Record<string, unknown>[] = [];
  await page.route('**/api/imports/provider/lichess', async route => {
    requests.push(route.request().postDataJSON());
    await gate;
    await route.fulfill({status: 202, json: {job_id: 'import-controls', status: 'queued'}});
  });
  try {
    await page.goto('/settings?import=lichess');
    const username = page.getByLabel('Lichess username', {exact: true});
    await expect(username).toBeEnabled();
    await username.fill('Mixed_Name-7');
    await page.getByLabel('Time control', {exact: true}).selectOption('blitz');
    await page.getByLabel('Look back', {exact: true}).selectOption('6');
    await page.getByLabel('Maximum new games', {exact: true}).fill('25');
    await page.locator('summary').filter({hasText: /^Custom date range/}).click();
    await page.getByLabel('From date', {exact: true}).fill('2026-08-01');
    await page.getByLabel('To date', {exact: true}).fill('2026-08-31');
    const analyze = page.getByRole('checkbox', {name: 'Also analyze these games for training', exact: true});
    await expect(analyze).not.toBeChecked();
    const submit = page.getByRole('button', {name: 'Import games', exact: true});
    await expect(submit).toHaveAttribute('type', 'submit');
    await submit.click();
    const busy = page.getByRole('button', {name: 'Queuing import…', exact: true});
    await expect(busy).toBeDisabled();
    await expect(username).toBeEnabled();
    await expect(analyze).toBeEnabled();
    await analyze.check();
    await expect(busy).toBeDisabled();
    await expect.poll(() => requests.length).toBe(1);
    expect(requests[0]).toEqual({username: 'Mixed_Name-7', time_class: 'blitz', analyze: false,
      months: 6, max_games: 25, start_date: '2026-08-01', end_date: '2026-08-31'});
    release();
    await expect(page.locator('.import-form').getByRole('status')).toContainText('Import queued for Mixed_Name-7');
    await expect(page.getByRole('button', {name: 'Import & analyze games', exact: true})).toBeEnabled();
    await expect(page.getByLabel('Time control', {exact: true})).toHaveValue('blitz');
    await expect(page.getByLabel('Look back', {exact: true})).toHaveValue('6');
    await expect(page.getByLabel('Look back', {exact: true})).toBeDisabled();
    await expect(page.getByLabel('Maximum new games', {exact: true})).toHaveValue('25');
    await expect(page.getByLabel('From date', {exact: true})).toHaveValue('2026-08-01');
    await expect(page.getByLabel('To date', {exact: true})).toHaveValue('2026-08-31');
  } finally {
    release();
    await page.unrouteAll({behavior: 'wait'});
  }
});
