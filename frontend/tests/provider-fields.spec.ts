import { expect, test } from '@playwright/test';
import type { Schema } from '../src/api';

const providers: Schema['GameProvider'][] = [
  {id: 'chesscom', name: 'Chess.com', time_classes: ['rapid']},
  {id: 'lichess', name: 'Lichess', time_classes: ['rapid']},
];
const syncStatus = (provider: string): Schema['SyncStatus'] => ({
  provider, username: '', job_id: null, status: 'not_started', checked_at: null, imported: 0, error: null,
});

test.beforeEach(async ({page}) => {
  await page.route('**/api/game-providers', route => route.fulfill({json: providers}));
  await page.route('**/api/providers/*/sync', route => route.fulfill({json: syncStatus(new URL(route.request().url()).pathname.split('/')[3])}));
  await page.route('**/api/jobs', route => route.fulfill({json: []}));
});

test('provider fields share valid username rules while imports require a name and connections allow clearing', async ({page}) => {
  await page.goto('/settings?import=chesscom');
  const connection = page.getByLabel('Remembered Chess.com username', {exact: true});
  const imported = page.getByLabel('Chess.com username', {exact: true});
  await expect(connection).toBeEnabled();
  await expect(imported).toBeEnabled();
  await expect(imported).toHaveAccessibleDescription('Your side is identified separately in every game.');
  expect(await connection.getAttribute('id')).not.toBe(await imported.getAttribute('id'));
  for (const field of [connection, imported]) {
    await expect(field).toHaveAttribute('autocomplete', 'off');
    await field.fill('Mixed_Name-7');
    await expect(field).toHaveValue('Mixed_Name-7');
    expect(await field.evaluate(input => (input as HTMLInputElement).checkValidity())).toBe(true);
    for (const invalid of ['name.with.dot', 'name with space']) {
      await field.fill(invalid);
      expect(await field.evaluate(input => (input as HTMLInputElement).validity.patternMismatch)).toBe(true);
    }
    await field.fill('x'.repeat(50));
    await field.press('End');
    await field.press('y');
    await expect(field).toHaveValue('x'.repeat(50));
    await field.fill('');
  }
  expect(await connection.evaluate(input => (input as HTMLInputElement).checkValidity())).toBe(true);
  expect(await imported.evaluate(input => (input as HTMLInputElement).validity.valueMissing)).toBe(true);
  await expect(page.getByRole('button', {name: 'Import games', exact: true})).toBeDisabled();
  await expect(page.getByRole('region', {name: 'Recent Chess.com games', exact: true}).getByRole('button', {name: 'Save username', exact: true})).toBeEnabled();
});

test('onboarding keeps provider usernames optional and disables both fields during its save', async ({page}) => {
  const identity: Schema['Identity'] = {enabled: true, user: {
    id: 'provider-field-account', username: 'FieldFixture', admin: false,
    chesscom_username: '', onboarding_completed: false,
  }};
  await page.route('**/api/auth/me', route => route.fulfill({json: identity}));
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const saved: {provider: string; username: string}[] = [];
  await page.route('**/api/providers/*/connection', async route => {
    const provider = new URL(route.request().url()).pathname.split('/')[3];
    const {username} = route.request().postDataJSON();
    saved.push({provider, username});
    await gate;
    await route.fulfill({json: {...syncStatus(provider), username}});
  });
  try {
    await page.goto('/');
    const chesscom = page.getByLabel('Chess.com username (optional)', {exact: true});
    const lichess = page.getByLabel('Lichess username (optional)', {exact: true});
    await expect(chesscom).toBeEnabled();
    await expect(lichess).toBeEnabled();
    for (const field of [chesscom, lichess]) {
      await expect(field).toHaveValue('');
      expect(await field.evaluate(input => (input as HTMLInputElement).checkValidity())).toBe(true);
    }
    await chesscom.fill('Mixed_Name-7');
    await page.getByRole('button', {name: 'Continue', exact: true}).click();
    await expect(chesscom).toBeDisabled();
    await expect(lichess).toBeDisabled();
    release();
    await expect(page.getByRole('heading', {name: 'Bring in your first games', exact: true})).toBeVisible();
    expect(saved).toEqual([{provider: 'chesscom', username: 'Mixed_Name-7'}, {provider: 'lichess', username: ''}]);
  } finally {
    release();
    await page.unrouteAll({behavior: 'wait'});
  }
});
