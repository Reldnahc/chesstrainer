import {test, expect, type Page} from '@playwright/test';
import type {Schema} from '../src/api';

const sections = (page: Page) => page.getByRole('navigation', {name: 'Settings sections'});
const section = (page: Page) => page.getByRole('region', {name: 'Accounts', exact: true});
const row = (page: Page, name: string) => section(page).locator('.settings-tool-row').filter({has: page.getByRole('heading', {name})});

function account(id: string, username: string, admin = false): Schema['ManagedAccount'] {
  return {id, username, admin, disabled: false, created: '2026-10-02T12:00:00Z'};
}

async function signedIn(page: Page, admin: boolean) {
  const user: Schema['Account'] = {id: 'keeper-id', username: 'keeper', admin, chesscom_username: '', onboarding_completed: true};
  await page.route('**/api/auth/me', route => route.fulfill({json: {enabled: true, user, csrf: 'test-csrf'} satisfies Schema['Identity']}));
  await page.route('**/api/jobs', route => route.fulfill({json: []}));
}

test('members never see account administration', async ({page}) => {
  await signedIn(page, false);
  await page.goto('/settings?section=account');
  await expect(page.getByRole('region', {name: 'Account', exact: true})).toBeVisible();
  await expect(section(page)).toHaveCount(0);
});

test('administrators reset, disable, promote and delete other accounts', async ({page}, info) => {
  await signedIn(page, true);
  const accounts = [account('keeper-id', 'keeper', true), account('friend-id', 'friend'), account('cousin-id', 'cousin')];
  const calls: string[] = [];
  await page.route('**/api/auth/accounts**', async route => {
    const request = route.request();
    const [, , , , id, action] = new URL(request.url()).pathname.split('/');
    if (request.method() === 'GET') return route.fulfill({json: {accounts} satisfies Schema['ManagedAccounts']});
    calls.push(`${request.method()} ${id}${action ? ' ' + action : ''} ${request.postData() ?? ''}`.trim());
    const target = accounts.findIndex(item => item.id === id);
    if (request.method() === 'DELETE') accounts.splice(target, 1);
    else if (action === 'admin') accounts[target].admin = true;
    else if (action === 'access') accounts[target].disabled = request.postDataJSON().disabled;
    return route.fulfill({json: {ok: true} satisfies Schema['Ok']});
  });
  await page.goto('/settings');
  // Administration sits under the signed-in account rather than adding another tab.
  await sections(page).getByRole('link', {name: 'Account', exact: true}).click();
  await expect(page).toHaveURL('/settings?section=account');
  await expect(page.getByRole('region', {name: 'Account', exact: true})).toBeVisible();
  await expect(section(page).getByRole('heading', {level: 3})).toHaveText(['keeper (you)', 'friend', 'cousin']);
  // An administrator cannot change their own account here.
  await expect(row(page, 'keeper (you)').getByRole('button')).toHaveCount(0);
  await expect(row(page, 'friend').getByRole('button')).toHaveText(['Reset password', 'Make administrator', 'Disable', 'Delete']);
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({path: `test-results/settings-accounts-${info.project.name}.png`, fullPage: true});

  await row(page, 'friend').getByRole('button', {name: 'Reset password'}).click();
  const field = section(page).getByLabel('New password for friend');
  await expect(field).toBeFocused();
  await field.fill('a-new-password');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({path: `test-results/settings-accounts-password-${info.project.name}.png`, fullPage: true});
  await row(page, 'friend').getByRole('button', {name: 'Set password'}).click();
  await expect(section(page).getByRole('status')).toHaveText('Set a new password for friend and signed them out everywhere.');
  await expect(field).toHaveCount(0);

  await row(page, 'friend').getByRole('button', {name: 'Disable'}).click();
  await expect(row(page, 'friend')).toContainText('Member · Disabled');
  await row(page, 'friend').getByRole('button', {name: 'Enable'}).click();
  await expect(row(page, 'friend')).not.toContainText('Disabled');
  await row(page, 'friend').getByRole('button', {name: 'Make administrator'}).click();
  await expect(row(page, 'friend')).toContainText('Administrator');
  await expect(row(page, 'friend').getByRole('button', {name: 'Make administrator'})).toHaveCount(0);

  await row(page, 'cousin').getByRole('button', {name: 'Delete'}).click();
  await expect(row(page, 'cousin').getByRole('button')).toHaveText(['Delete account and games', 'Keep it']);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({path: `test-results/settings-accounts-delete-${info.project.name}.png`, fullPage: true});
  await row(page, 'cousin').getByRole('button', {name: 'Keep it'}).click();
  await expect(row(page, 'cousin').getByRole('button', {name: 'Delete', exact: true})).toBeVisible();
  await row(page, 'cousin').getByRole('button', {name: 'Delete', exact: true}).click();
  await row(page, 'cousin').getByRole('button', {name: 'Delete account and games'}).click();
  await expect(section(page).getByRole('status')).toHaveText('Deleted cousin and their games.');
  await expect(section(page).getByRole('heading', {level: 3})).toHaveText(['keeper (you)', 'friend']);
  expect(calls).toEqual([
    'POST friend-id password {"password":"a-new-password"}',
    'POST friend-id access {"disabled":true}',
    'POST friend-id access {"disabled":false}',
    'POST friend-id admin',
    'DELETE cousin-id',
  ]);
});
