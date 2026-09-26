import { test, expect } from '@playwright/test';

test('account signup, engine-free sync, second-device login and private library', async ({page, browser}, info) => {
  const username = `friend-${info.project.name}`;
  await page.goto('/');
  await page.getByRole('button', {name: 'New here? Create an account'}).click();
  await page.getByLabel('Username', {exact: true}).fill(username);
  await page.getByLabel('Password', {exact: true}).fill('test-only-password');
  await page.getByRole('button', {name: 'Create account', exact: true}).click();
  await page.getByRole('button', {name: 'Games', exact: true}).click();
  await page.getByLabel('Remembered Chess.com username').fill(username);
  await page.getByRole('button', {name: 'Save username', exact: true}).click();
  await expect(page.locator('.game-library-item')).toHaveCount(1, {timeout: 30000});
  await expect(page.locator('.game-library-item')).toContainText(username);
  const jobs = await (await page.request.get('/api/jobs')).json();
  expect(jobs).toHaveLength(1);
  expect(jobs[0].kind).toBe('sync');
  expect(jobs[0].positions_triaged).toBe(0);
  await page.screenshot({path: `test-results/accounts-${info.project.name}.png`, fullPage: true});
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  const second = await browser.newContext({baseURL: 'http://127.0.0.1:8766'});
  try {
    const device = await second.newPage();
    await device.goto('/');
    await device.getByLabel('Username', {exact: true}).fill(username);
    await device.getByLabel('Password', {exact: true}).fill('test-only-password');
    await device.getByRole('button', {name: 'Sign in', exact: true}).click();
    await device.getByRole('button', {name: 'Games', exact: true}).click();
    await expect(device.getByLabel('Remembered Chess.com username')).toHaveValue(username);
    await expect(device.locator('.game-library-item')).toHaveCount(1);
    await device.getByRole('button', {name: 'Sign out', exact: true}).click();
    await page.reload();
    await expect(page.getByText(`Signed in as ${username}`)).toBeVisible();
    await device.getByRole('button', {name: 'New here? Create an account'}).click();
    await device.getByLabel('Username', {exact: true}).fill(`${username}-other`);
    await device.getByLabel('Password', {exact: true}).fill('test-only-password');
    await device.getByRole('button', {name: 'Create account', exact: true}).click();
    await device.getByRole('button', {name: 'Games', exact: true}).click();
    await expect(device.locator('.game-library-item')).toHaveCount(0);
    await expect(device.getByLabel('Remembered Chess.com username')).toHaveValue('');
  } finally { await second.close(); }
});
